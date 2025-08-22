import { LatestBlockResponse, PairResponse, SwapEvent, JoinExitEvent } from '../api/types';
import { BalancerV3SubgraphClient } from '../graphql/client';
import { SubgraphSwap, SubgraphAddRemove } from '../types/subgraph-types';
import {
    generateAllPairIdsForPool,
    parsePairId,
    isSwapForPair,
    isAddRemoveForPair,
    convertFeeToBps,
    checksumPair,
    checksumPairId,
} from '../utils/pair-util';
import { calculatePrice, calculateReserves } from '../utils/swap-util';
import { Logger } from '../utils/logger';
import { ChainConfig } from '../utils/chain-config';
import { getAddress } from 'viem';

export class BalancerV3AMMAdapter {
    public subgraphClient: BalancerV3SubgraphClient;
    protected log: Logger;
    private chainConfig: ChainConfig;

    constructor(params: { chainConfig: ChainConfig }) {
        this.chainConfig = params.chainConfig;
        this.subgraphClient = new BalancerV3SubgraphClient(params.chainConfig.subgraphUrl, params.chainConfig);
        this.log = new Logger(`${this.constructor.name}[${params.chainConfig.apiSlug}]`);
    }

    public getChainConfig(): ChainConfig {
        return this.chainConfig;
    }

    public async getLatestBlock(): Promise<LatestBlockResponse> {
        const latestBlock = await this.subgraphClient.getLatestBlock();

        return {
            blockNumber: parseInt(latestBlock.number),
            blockTimestamp: parseInt(latestBlock.timestamp),
        };
    }

    public async getEvents(params: { fromBlock: number; toBlock: number }): Promise<(SwapEvent | JoinExitEvent)[]> {
        const { fromBlock, toBlock } = params;

        this.log.info(`Fetching events from block ${fromBlock} to ${toBlock}`);

        // Fetch all swaps and add/removes for the block range
        const [swaps, addRemoves] = await Promise.all([
            this.subgraphClient.getAllSwaps({
                fromBlock: BigInt(fromBlock),
                toBlock: BigInt(toBlock),
            }),
            this.subgraphClient.getAllAddRemoves({
                fromBlock: BigInt(fromBlock),
                toBlock: BigInt(toBlock),
            }),
        ]);

        // Convert events to new format
        const convertedSwaps = await this.convertSwaps(swaps);
        const convertedJoinExits = await this.convertJoinExits(addRemoves);

        // Combine all events and sort by block number, then by transaction index
        const allEvents = checksumEvents([...convertedSwaps, ...convertedJoinExits]);
        return allEvents.sort((a, b) => {
            const blockDiff = a.block.blockNumber - b.block.blockNumber;
            if (blockDiff !== 0) return blockDiff;
            return a.txnIndex - b.txnIndex;
        });
    }

    public async getPair(params: { pairId: string }): Promise<PairResponse> {
        const { poolAddress, asset0Id, asset1Id } = parsePairId(params.pairId);

        // Get pool data
        const pool = await this.subgraphClient.getPool(poolAddress);
        if (!pool) {
            throw new Error(`Pool not found: ${poolAddress}`);
        }

        return checksumPair({
            id: params.pairId,
            dexKey: 'balancer-v3',
            feeBps: convertFeeToBps(pool.swapFee),
            asset0Id,
            asset1Id,
            creationBlockNumber: parseInt(pool.blockNumber),
            creationBlockTimestamp: parseInt(pool.blockTimestamp),
            creationTxnId: pool.transactionHash,
            creator: pool.poolCreator,
            pool: {
                id: pool.address,
                name: pool.name,
                assetIds: pool.tokens.map((token) => token.address),
                pairIds: await generateAllPairIdsForPool(pool),
                metadata: {
                    symbol: pool.symbol,
                },
            },
        });
    }

    private async convertSwaps(swaps: SubgraphSwap[]): Promise<SwapEvent[]> {
        const convertedSwaps: SwapEvent[] = [];

        // Group swaps by block and pool for efficient querying
        const swapsByBlockAndPool = swaps.reduce((acc, swap) => {
            const key = `${swap.blockNumber}-${swap.pool}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(swap);
            return acc;
        }, {} as Record<string, SubgraphSwap[]>);

        // Process swaps grouped by block and pool
        for (const [key, blockPoolSwaps] of Object.entries(swapsByBlockAndPool)) {
            const [blockNumber, poolAddress] = key.split('-');

            // Query pool data at the specific block for this group of swaps
            const pool = await this.subgraphClient.getPool(poolAddress, parseInt(blockNumber));
            if (!pool) continue;

            // Generate all possible pairs for this pool
            const pairIds = await generateAllPairIdsForPool(pool);

            // Group swaps by transaction hash for proper indexing
            const swapsByTxn = blockPoolSwaps.reduce((acc, swap) => {
                if (!acc[swap.transactionHash]) {
                    acc[swap.transactionHash] = [];
                }
                acc[swap.transactionHash].push(swap);
                return acc;
            }, {} as Record<string, SubgraphSwap[]>);

            for (const [txnHash, txnSwaps] of Object.entries(swapsByTxn)) {
                const sortedSwaps = txnSwaps.sort((a, b) => parseInt(a.logIndex) - parseInt(b.logIndex));

                for (let i = 0; i < sortedSwaps.length; i++) {
                    const swap = sortedSwaps[i];

                    // Find pairs that this swap affects
                    const relevantPairs = pairIds.filter((pairId) =>
                        isSwapForPair(pairId, swap.tokenIn, swap.tokenOut),
                    );

                    for (const pairId of relevantPairs) {
                        const { asset0Id, asset1Id } = parsePairId(pairId);

                        // Determine swap direction
                        const isAsset0In = swap.tokenIn === asset0Id;
                        const reserves = calculateReserves(pool.tokens, asset0Id, asset1Id);

                        const swapEvent: SwapEvent = {
                            block: {
                                blockNumber: parseInt(swap.blockNumber),
                                blockTimestamp: parseInt(swap.blockTimestamp),
                            },
                            eventType: 'swap',
                            txnId: swap.transactionHash,
                            txnIndex: i,
                            eventIndex: parseInt(swap.logIndex),
                            maker: swap.user.id,
                            pairId,
                            priceNative: calculatePrice(
                                isAsset0In ? swap.tokenAmountIn : swap.tokenAmountOut,
                                isAsset0In ? swap.tokenAmountOut : swap.tokenAmountIn,
                            ),
                            reserves: reserves
                                ? {
                                      asset0: reserves[0],
                                      asset1: reserves[1],
                                  }
                                : null,
                        };

                        // Add directional amounts
                        if (isAsset0In) {
                            swapEvent.asset0In = swap.tokenAmountIn;
                            swapEvent.asset1Out = swap.tokenAmountOut;
                        } else {
                            swapEvent.asset1In = swap.tokenAmountIn;
                            swapEvent.asset0Out = swap.tokenAmountOut;
                        }

                        convertedSwaps.push(swapEvent);
                    }
                }
            }
        }

        return convertedSwaps;
    }

    private async convertJoinExits(addRemoves: SubgraphAddRemove[]): Promise<JoinExitEvent[]> {
        const convertedJoinExits: JoinExitEvent[] = [];

        // Group by transaction hash for proper indexing
        const addRemovesByTxn = addRemoves.reduce((acc, addRemove) => {
            if (!acc[addRemove.transactionHash]) {
                acc[addRemove.transactionHash] = [];
            }
            acc[addRemove.transactionHash].push(addRemove);
            return acc;
        }, {} as Record<string, SubgraphAddRemove[]>);

        for (const [txnHash, txnAddRemoves] of Object.entries(addRemovesByTxn)) {
            const sortedAddRemoves = txnAddRemoves.sort((a, b) => parseInt(a.logIndex) - parseInt(b.logIndex));

            for (let i = 0; i < sortedAddRemoves.length; i++) {
                const addRemove = sortedAddRemoves[i];

                // Generate all possible pairs for this pool with underlying tokens
                const pairIds = await generateAllPairIdsForPool(addRemove.pool);

                // Find pairs that this add/remove affects
                const relevantPairs = pairIds.filter((pairId) => isAddRemoveForPair(pairId, addRemove.pool));

                for (const pairId of relevantPairs) {
                    const { asset0Id, asset1Id } = parsePairId(pairId);

                    // Calculate reserves - we need to get pool data at block
                    const poolAtBlock = await this.subgraphClient.getPool(
                        addRemove.pool.address,
                        parseInt(addRemove.blockNumber),
                    );
                    const reserves = poolAtBlock ? calculateReserves(poolAtBlock.tokens, asset0Id, asset1Id) : null;

                    // Find the amounts for the two assets in the pair
                    const asset0Index = addRemove.pool.tokens.findIndex((pt) => pt.address === asset0Id);
                    const asset1Index = addRemove.pool.tokens.findIndex((pt) => pt.address === asset1Id);

                    const amount0 =
                        asset0Index !== -1 && addRemove.amounts[asset0Index] ? addRemove.amounts[asset0Index] : '0';
                    const amount1 =
                        asset1Index !== -1 && addRemove.amounts[asset1Index] ? addRemove.amounts[asset1Index] : '0';

                    const joinExitEvent: JoinExitEvent = {
                        block: {
                            blockNumber: parseInt(addRemove.blockNumber),
                            blockTimestamp: parseInt(addRemove.blockTimestamp),
                        },
                        eventType: addRemove.type === 'ADD' ? 'join' : 'exit',
                        txnId: addRemove.transactionHash,
                        txnIndex: i,
                        eventIndex: parseInt(addRemove.logIndex),
                        maker: addRemove.user.id,
                        pairId,
                        amount0,
                        amount1,
                        reserves: reserves
                            ? {
                                  asset0: reserves[0],
                                  asset1: reserves[1],
                              }
                            : null,
                    };

                    convertedJoinExits.push(joinExitEvent);
                }
            }
        }

        return convertedJoinExits;
    }
}
function checksumEvents(events: (SwapEvent | JoinExitEvent)[]): (SwapEvent | JoinExitEvent)[] {
    return events.map((event) => {
        return {
            ...event,
            maker: getAddress(event.maker),
            pairId: checksumPairId(event.pairId),
        };
    });
}
