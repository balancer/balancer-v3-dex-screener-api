import { GraphQLClient } from 'graphql-request';
import { SWAPS_QUERY, ADD_REMOVES_QUERY, POOL_QUERY, LATEST_BLOCK_QUERY, POOL_QUERY_AT_BLOCK } from './queries';
import { SwapsQuery, AddRemovesQuery, SubgraphPool } from '../types/subgraph-types';
import { TokenMappingService } from '../utils/token-mapper-service';
import { ChainConfig } from '../utils/chain-config';

export class BalancerV3SubgraphClient {
    private client: GraphQLClient;
    public tokenMappingService: TokenMappingService;
    private chainConfig: ChainConfig;

    constructor(subgraphUrl: string, chainConfig: ChainConfig) {
        this.client = new GraphQLClient(subgraphUrl);
        this.tokenMappingService = TokenMappingService.getInstance();
        this.chainConfig = chainConfig;
    }

    private getChainSlug(): string {
        // Convert API slug to chain slug for token mapping
        const apiSlugToChainSlug: Record<string, string> = {
            'SONIC': 'sonic',
            'MAINNET': 'ethereum',
            'ARBITRUM': 'arbitrum',
            'POLYGON': 'polygon',
            'OPTIMISM': 'optimism',
            'BASE': 'base',
            'AVALANCHE': 'avalanche',
            'GNOSIS': 'gnosis',
            'HYPEREVM': 'hyperevm'
        };
        
        return apiSlugToChainSlug[this.chainConfig.apiSlug] || this.chainConfig.apiSlug.toLowerCase();
    }

    private async getSwaps(params: {
        first?: number;
        id_gt?: string;
        fromBlock: bigint;
        toBlock: bigint;
    }): Promise<SwapsQuery> {
        const { first = 1000, id_gt = '0x', fromBlock, toBlock } = params;

        return this.client.request<SwapsQuery>(SWAPS_QUERY, {
            first,
            id_gt,
            fromBlock: fromBlock.toString(),
            toBlock: toBlock.toString(),
        });
    }

    private async getAddRemoves(params: {
        first?: number;
        id_gt?: string;
        fromBlock: bigint;
        toBlock: bigint;
    }): Promise<AddRemovesQuery> {
        const { first = 1000, id_gt = '0x', fromBlock, toBlock } = params;

        return this.client.request<AddRemovesQuery>(ADD_REMOVES_QUERY, {
            first,
            id_gt,
            fromBlock: fromBlock.toString(),
            toBlock: toBlock.toString(),
        });
    }

    async getPool(poolId: string, blockNumber?: number): Promise<SubgraphPool | null> {
        const variables: any = { poolId };
        if (blockNumber) {
            variables.blockNumber = blockNumber;
        }

        const query = blockNumber ? POOL_QUERY_AT_BLOCK : POOL_QUERY;

        const result = await this.client.request<{ pool: SubgraphPool | null }>(query, variables);
        return result.pool ? this.tokenMappingService.mapUnderlyingInPools(result.pool, this.getChainSlug()) : null;
    }

    async getLatestBlock(): Promise<{ number: string; timestamp: string; hash: string }> {
        const result = await this.client.request<{
            _meta: { block: { number: string; timestamp: string; hash: string } };
        }>(LATEST_BLOCK_QUERY);
        return result._meta.block;
    }

    async getAllSwaps(params: { fromBlock: bigint; toBlock: bigint }): Promise<SwapsQuery['swaps']> {
        const limit = 1000;
        let hasMore = true;
        let id = '0x';
        let allSwaps: SwapsQuery['swaps'] = [];

        while (hasMore) {
            const result = await this.getSwaps({
                first: limit,
                id_gt: id,
                fromBlock: params.fromBlock,
                toBlock: params.toBlock,
            });

            allSwaps = [...allSwaps, ...result.swaps];

            if (result.swaps.length < limit) {
                hasMore = false;
            } else {
                id = result.swaps[result.swaps.length - 1].id;
            }
        }

        return this.tokenMappingService.mapUnderlyingInSwaps(allSwaps, this.getChainSlug());
    }

    async getAllAddRemoves(params: { fromBlock: bigint; toBlock: bigint }): Promise<AddRemovesQuery['addRemoves']> {
        const limit = 1000;
        let hasMore = true;
        let id = '0x';
        let allAddRemoves: AddRemovesQuery['addRemoves'] = [];

        while (hasMore) {
            const result = await this.getAddRemoves({
                first: limit,
                id_gt: id,
                fromBlock: params.fromBlock,
                toBlock: params.toBlock,
            });

            allAddRemoves = [...allAddRemoves, ...result.addRemoves];

            if (result.addRemoves.length < limit) {
                hasMore = false;
            } else {
                id = result.addRemoves[result.addRemoves.length - 1].id;
            }
        }

        return this.tokenMappingService.mapUnderlyingInAddRemoves(allAddRemoves, this.getChainSlug());
    }
}
