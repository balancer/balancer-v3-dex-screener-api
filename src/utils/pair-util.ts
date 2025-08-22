import { getAddress } from 'viem';
import { PairResponse } from '../api/types';
import { SubgraphPool } from '../types/subgraph-types';

// Generate pair ID following the pattern: [poolAddress]-[asset0Id]-[asset1Id]
function generatePairId(poolAddress: string, asset0Id: string, asset1Id: string): string {
    // Ensure consistent asset ordering (lexicographic)
    const [a0, a1] = [asset0Id, asset1Id].sort();
    return `${poolAddress}-${a0}-${a1}`;
}

// Generate all possible pair IDs for a pool
export async function generateAllPairIdsForPool(pool: SubgraphPool): Promise<string[]> {
    const tokens = pool.tokens.map((pt) => pt.address);
    const pairIds: string[] = [];

    // Generate all possible pairs (n*(n-1)/2 combinations)
    for (let i = 0; i < tokens.length; i++) {
        for (let j = i + 1; j < tokens.length; j++) {
            pairIds.push(generatePairId(pool.address, tokens[i], tokens[j]));
        }
    }

    return pairIds;
}

// Extract pool address, asset0Id, and asset1Id from a pair ID
export function parsePairId(pairId: string): {
    poolAddress: string;
    asset0Id: string;
    asset1Id: string;
} {
    const parts = pairId.split('-');
    if (parts.length !== 3) {
        throw new Error(`Invalid pair ID format: ${pairId}`);
    }

    return {
        poolAddress: parts[0].toLowerCase(),
        asset0Id: parts[1].toLowerCase(),
        asset1Id: parts[2].toLowerCase(),
    };
}

export function checksumPair(pair: PairResponse): PairResponse {
    return {
        ...pair,
        id: checksumPairId(pair.id),
        asset0Id: getAddress(pair.asset0Id),
        asset1Id: getAddress(pair.asset1Id),
        creationTxnId: pair.creationTxnId ? getAddress(pair.creationTxnId) : null,
        creator: pair.creator ? getAddress(pair.creator) : null,
        pool: pair.pool
            ? {
                  ...pair.pool,
                  id: getAddress(pair.pool.id),
                  assetIds: pair.pool.assetIds.map((aid) => getAddress(aid)),
                  pairIds: pair.pool.pairIds.map((pid) => checksumPairId(pid)),
              }
            : undefined,
    };
}

export function checksumPairId(pairId: string): string {
    const parts = pairId.split('-');
    if (parts.length !== 3) {
        throw new Error(`Invalid pair ID format: ${pairId}`);
    }

    const poolAddress = getAddress(parts[0]);
    const asset0Id = getAddress(parts[1]);
    const asset1Id = getAddress(parts[2]);

    return `${poolAddress}-${asset0Id}-${asset1Id}`;
}

// Check if a swap involves the tokens in a specific pair
export function isSwapForPair(pairId: string, tokenIn: string, tokenOut: string): boolean {
    const { asset0Id, asset1Id } = parsePairId(pairId);

    const tokenInLower = tokenIn.toLowerCase();
    const tokenOutLower = tokenOut.toLowerCase();
    const asset0Lower = asset0Id.toLowerCase();
    const asset1Lower = asset1Id.toLowerCase();

    return (
        (tokenInLower === asset0Lower && tokenOutLower === asset1Lower) ||
        (tokenInLower === asset1Lower && tokenOutLower === asset0Lower)
    );
}

// Check if an add/remove operation involves the tokens in a specific pair
export function isAddRemoveForPair(pairId: string, pool: SubgraphPool): boolean {
    const { poolAddress, asset0Id, asset1Id } = parsePairId(pairId);

    // Check if the pool address matches first
    if (pool.address.toLowerCase() !== poolAddress.toLowerCase()) {
        return false;
    }

    const poolTokens = pool.tokens.map((pt) => pt.address.toLowerCase());
    return poolTokens.includes(asset0Id.toLowerCase()) && poolTokens.includes(asset1Id.toLowerCase());
}

// Convert fee from percentage to basis points
export function convertFeeToBps(feePercentage: string): number {
    // Handle null, undefined, or empty string
    if (!feePercentage || feePercentage === '') {
        return 0;
    }

    const parsed = parseFloat(feePercentage);

    if (isNaN(parsed) || parsed < 0) {
        return 0;
    }

    // Balancer V3 stores fees as decimal values (e.g., 0.001 = 0.1%)
    // Basis points are 1/100th of a percent, so we multiply by 10000
    // 0.001 * 10000 = 10 basis points
    return parsed * 100;
}
