import { createPublicClient, http, formatUnits, PublicClient } from 'viem';
import { ChainConfig } from './chain-config';

// ERC20 token ABI for name, symbol, decimals, and totalSupply
const ERC20_ABI = [
    {
        inputs: [],
        name: 'name',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'symbol',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// Chain-aware client cache
const clientCache = new Map<string, PublicClient>();

// Create viem client for a specific chain
function getPublicClient(chainConfig: ChainConfig): PublicClient {
    const cacheKey = chainConfig.apiSlug;

    if (!clientCache.has(cacheKey)) {
        const client = createPublicClient({
            chain: chainConfig.viemChain,
            transport: http(chainConfig.rpcUrl),
        });
        clientCache.set(cacheKey, client);
    }

    return clientCache.get(cacheKey)!;
}

export interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
}

export async function getTokenInfo(tokenAddress: string, chainConfig: ChainConfig): Promise<TokenInfo> {
    const publicClient = getPublicClient(chainConfig);

    try {
        const [name, symbol, decimals, totalSupply] = await publicClient.multicall({
            contracts: [
                {
                    address: tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'name',
                },
                {
                    address: tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'symbol',
                },
                {
                    address: tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'decimals',
                },
                {
                    address: tokenAddress as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'totalSupply',
                },
            ],
            multicallAddress: '0xca11bde05977b3631167028862be2a173976ca11',
        });

        return {
            name: name.result || 'Unknown Token',
            symbol: symbol.result || 'UNKNOWN',
            decimals: decimals.result || 18,
            totalSupply: totalSupply.result ? formatUnits(totalSupply.result, decimals.result || 18) : '0',
        };
    } catch (error) {
        console.error('Error fetching token info:', error);
        // Return default value if contract call fails
        return {
            name: 'Unknown Token',
            symbol: 'UNKNOWN',
            decimals: 18,
            totalSupply: '0',
        };
    }
}
