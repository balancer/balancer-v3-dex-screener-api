import { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import { SubgraphAddRemove, SubgraphPool, SubgraphSwap } from '../types/subgraph-types';
import { getTokenInfo } from '../utils/blockchain-client';
import { ChainConfigService } from './chain-config';

interface TokenData {
    address: string;
    underlyingTokenAddress: string | null;
    erc4626ReviewData: {
        useUnderlyingForAddRemove: boolean;
        canUseBufferForSwaps: boolean;
    } | null;
}

interface TokensResponse {
    tokenGetTokens: TokenData[];
}

const BALANCER_API_URL = 'https://api-v3.balancer.fi';

const TOKENS_QUERY = gql`
    query GetTokens($chains: [GqlChain!]!) {
        tokenGetTokens(chains: $chains) {
            address
            underlyingTokenAddress
            erc4626ReviewData {
                useUnderlyingForAddRemove
                canUseBufferForSwaps
            }
        }
    }
`;

export class BalancerApiClient {
    private client: GraphQLClient;

    constructor() {
        this.client = new GraphQLClient(BALANCER_API_URL);
    }

    async getTokens(chainSlug: string): Promise<TokenData[]> {
        const response = await this.client.request<TokensResponse>(TOKENS_QUERY, {
            chains: [chainSlug.toUpperCase()],
        });
        return response.tokenGetTokens;
    }
}

export interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    address: string;
}

export interface TokenMapping {
    [poolTokenAddress: string]: TokenInfo; // maps pool token -> underlying token
}

interface ChainTokenCache {
    mapping: TokenMapping;
    lastUpdated: number;
}

export class TokenMappingService {
    private static instance: TokenMappingService;
    private chainTokenCache: Map<string, ChainTokenCache> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private balancerApiClient: BalancerApiClient;
    private chainConfigService: ChainConfigService;

    private constructor() {
        this.balancerApiClient = new BalancerApiClient();
        this.chainConfigService = ChainConfigService.getInstance();
    }

    public static getInstance(): TokenMappingService {
        if (!TokenMappingService.instance) {
            TokenMappingService.instance = new TokenMappingService();
        }
        return TokenMappingService.instance;
    }

    async getTokenMapping(chainSlug: string): Promise<TokenMapping> {
        const now = Date.now();
        const cacheKey = chainSlug.toLowerCase();
        const cached = this.chainTokenCache.get(cacheKey);

        // Check if cache is still valid
        if (cached && now - cached.lastUpdated < this.CACHE_DURATION && Object.keys(cached.mapping).length > 0) {
            return cached.mapping;
        }

        try {
            const chainConfig = this.chainConfigService.getChainConfig(chainSlug);
            const tokens = await this.balancerApiClient.getTokens(chainConfig.apiSlug);

            // Build mapping for tokens that should use underlying token
            const tokenMapping: TokenMapping = {};

            for (const token of tokens) {
                if (
                    token.underlyingTokenAddress &&
                    token.erc4626ReviewData &&
                    token.erc4626ReviewData.useUnderlyingForAddRemove &&
                    token.erc4626ReviewData.canUseBufferForSwaps
                ) {
                    // Get token info from blockchain using viem
                    const tokenInfo = await getTokenInfo(token.underlyingTokenAddress, chainConfig);
                    tokenMapping[token.address.toLowerCase()] = {
                        address: token.underlyingTokenAddress.toLowerCase(),
                        decimals: tokenInfo.decimals,
                        name: tokenInfo.name,
                        symbol: tokenInfo.symbol,
                    };
                }
            }

            // Update cache
            this.chainTokenCache.set(cacheKey, {
                mapping: tokenMapping,
                lastUpdated: now,
            });

            return tokenMapping;
        } catch (error) {
            console.error(`Failed to fetch token mappings from Balancer API for chain ${chainSlug}:`, error);
            // Return existing mapping if API fails, or empty mapping if none exists
            return cached?.mapping || {};
        }
    }

    /**
     * Replaces pool token addresses with underlying token addresses if conditions are met
     */
    async mapToUnderlyingTokenIfPresent(token: TokenInfo, chainSlug: string): Promise<TokenInfo> {
        const mapping = await this.getTokenMapping(chainSlug);
        const normalizedAddress = token.address.toLowerCase();

        return mapping[normalizedAddress] || token;
    }

    /**
     * Replaces multiple token addresses with underlying tokens
     */
    async mapToUnderlyingTokensIfPresent(tokenAddresses: TokenInfo[], chainSlug: string): Promise<TokenInfo[]> {
        const mapping = await this.getTokenMapping(chainSlug);

        return tokenAddresses.map((token) => {
            const normalizedAddress = token.address.toLowerCase();
            return mapping[normalizedAddress] || token;
        });
    }

    async mapUnderlyingInSwaps(allSwaps: SubgraphSwap[], chainSlug: string): Promise<SubgraphSwap[]> {
        return Promise.all(
            allSwaps.map(async (swap) => {
                const underlyingToken0 = await this.mapToUnderlyingTokenIfPresent(
                    {
                        address: swap.tokenIn,
                        name: '',
                        decimals: 18,
                        symbol: '',
                    },
                    chainSlug,
                );
                const underlyingToken1 = await this.mapToUnderlyingTokenIfPresent(
                    {
                        address: swap.tokenOut,
                        name: '',
                        decimals: 18,
                        symbol: '',
                    },
                    chainSlug,
                );
                return {
                    ...swap,
                    tokenInSymbol: underlyingToken0.symbol,
                    tokenOutSymbol: underlyingToken1.symbol,
                    tokenIn: underlyingToken0.address,
                    tokenOut: underlyingToken1.address,
                };
            }),
        );
    }

    async mapUnderlyingInAddRemoves(
        allAddRemoves: SubgraphAddRemove[],
        chainSlug: string,
    ): Promise<SubgraphAddRemove[]> {
        // replace all pool tokens with underlying tokens in the pool field
        for (const addRemove of allAddRemoves) {
            for (let token of addRemove.pool.tokens) {
                token = {
                    ...token,
                    ...(await this.mapToUnderlyingTokenIfPresent(
                        {
                            address: token.address,
                            name: token.name,
                            decimals: token.decimals,
                            symbol: token.symbol,
                        },
                        chainSlug,
                    )),
                };
            }
        }
        return allAddRemoves;
    }

    async mapUnderlyingInPools(pool: SubgraphPool, chainSlug: string): Promise<SubgraphPool> {
        const mappedTokens = await Promise.all(
            pool.tokens.map(async (token) => {
                const underlyingToken = await this.mapToUnderlyingTokenIfPresent(
                    {
                        address: token.address,
                        name: token.name,
                        decimals: token.decimals,
                        symbol: token.symbol,
                    },
                    chainSlug,
                );
                return {
                    ...token,
                    address: underlyingToken.address,
                    name: underlyingToken.name,
                    symbol: underlyingToken.symbol,
                    decimals: underlyingToken.decimals,
                };
            }),
        );

        return { ...pool, tokens: mappedTokens };
    }
}
