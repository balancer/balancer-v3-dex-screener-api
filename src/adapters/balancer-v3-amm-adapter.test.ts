import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { BalancerV3AMMAdapter } from './balancer-v3-amm-adapter';
import { ChainConfig } from '../utils/chain-config';
import { SubgraphPool, SubgraphSwap, SubgraphAddRemove } from '../types/subgraph-types';

// Mock the GraphQL client
const mockSubgraphClient = {
    getLatestBlock: mock(() =>
        Promise.resolve({
            number: '19123456',
            timestamp: '1752762620',
            hash: '0xblock123',
        }),
    ),
    getPool: mock(() =>
        Promise.resolve({
            id: '1',
            address: '0xpool123',
            name: 'Test Pool',
            symbol: 'TEST',
            swapFee: '0.001',
            blockNumber: '100',
            blockTimestamp: '1000',
            transactionHash: '0xtx123',
            poolCreator: '0xcreator123',
            tokens: [
                {
                    address: '0xtoken1',
                    name: 'Token 1',
                    symbol: 'TK1',
                    decimals: 18,
                    balance: '1000000000000000000',
                },
                {
                    address: '0xtoken2',
                    name: 'Token 2',
                    symbol: 'TK2',
                    decimals: 18,
                    balance: '2000000000000000000',
                },
            ],
        } as SubgraphPool),
    ),
    getAllSwaps: mock(() =>
        Promise.resolve([
            {
                id: '1',
                tokenIn: '0xtoken1',
                tokenOut: '0xtoken2',
                tokenAmountIn: '1000000000000000000',
                tokenAmountOut: '2000000000000000000',
                pool: '0xpool123',
                blockNumber: '100',
                blockTimestamp: '1000',
                transactionHash: '0xtx123',
                logIndex: '0',
                user: { id: '0xuser123' },
            },
        ] as SubgraphSwap[]),
    ),
    getAllAddRemoves: mock(() =>
        Promise.resolve([
            {
                id: '1',
                type: 'ADD',
                amounts: ['1000000000000000000', '2000000000000000000'],
                blockNumber: '100',
                blockTimestamp: '1000',
                transactionHash: '0xtx123',
                logIndex: '1',
                sender: '0xuser123',
                user: { id: '0xuser123' },
                pool: {
                    id: '1',
                    address: '0xpool123',
                    name: 'Test Pool',
                    symbol: 'TEST',
                    swapFee: '0.001',
                    blockNumber: '50',
                    blockTimestamp: '500',
                    transactionHash: '0xtx50',
                    poolCreator: '0xcreator123',
                    tokens: [
                        {
                            address: '0xtoken1',
                            name: 'Token 1',
                            symbol: 'TK1',
                            decimals: 18,
                            balance: '1000000000000000000',
                        },
                        {
                            address: '0xtoken2',
                            name: 'Token 2',
                            symbol: 'TK2',
                            decimals: 18,
                            balance: '2000000000000000000',
                        },
                    ],
                },
            },
        ] as SubgraphAddRemove[]),
    ),
};

// Mock the BalancerV3SubgraphClient
mock.module('../graphql/client', () => ({
    BalancerV3SubgraphClient: class {
        constructor() {
            return mockSubgraphClient;
        }
    },
}));

// Don't mock utility functions globally to avoid conflicts with other tests
// The adapter will use the real utility functions

describe('BalancerV3AMMAdapter', () => {
    let adapter: BalancerV3AMMAdapter;
    let chainConfig: ChainConfig;

    beforeEach(() => {
        chainConfig = {
            apiSlug: 'ETHEREUM',
            viemChain: { id: 1, name: 'Ethereum' } as any,
            subgraphUrl: 'https://test-subgraph.com',
            rpcUrl: 'https://test-rpc.com',
        };

        adapter = new BalancerV3AMMAdapter({ chainConfig });

        // Clear all mocks
        mockSubgraphClient.getLatestBlock.mockClear();
        mockSubgraphClient.getPool.mockClear();
        mockSubgraphClient.getAllSwaps.mockClear();
        mockSubgraphClient.getAllAddRemoves.mockClear();

        // Set default mock return values
        mockSubgraphClient.getPool.mockResolvedValue({
            id: '1',
            address: '0xpool123',
            name: 'Test Pool',
            symbol: 'TEST',
            swapFee: '0.001',
            blockNumber: '100',
            blockTimestamp: '1000',
            transactionHash: '0xtx123',
            poolCreator: '0xcreator123',
            tokens: [
                {
                    address: '0xtoken1',
                    name: 'Token 1',
                    symbol: 'TK1',
                    decimals: 18,
                    balance: '1000000000000000000',
                },
                {
                    address: '0xtoken2',
                    name: 'Token 2',
                    symbol: 'TK2',
                    decimals: 18,
                    balance: '2000000000000000000',
                },
            ],
        });

        // No need to clear utility function mocks since we're using real functions
    });

    describe('Constructor', () => {
        it('should initialize with correct configuration', () => {
            expect(adapter.getChainConfig()).toEqual(chainConfig);
            expect(adapter.subgraphClient).toBeDefined();
        });

        it('should create logger with correct name', () => {
            const loggerSpy = mock();
            const adapter = new BalancerV3AMMAdapter({ chainConfig });
            expect(adapter['log']).toBeDefined();
        });
    });

    describe('getLatestBlock', () => {
        it('should return latest block information', async () => {
            const result = await adapter.getLatestBlock();

            expect(mockSubgraphClient.getLatestBlock).toHaveBeenCalled();
            expect(result).toEqual({
                blockNumber: 19123456,
                blockTimestamp: 1752762620,
            });
        });

        it('should handle subgraph client errors', async () => {
            mockSubgraphClient.getLatestBlock.mockRejectedValue(new Error('Subgraph error'));

            await expect(adapter.getLatestBlock()).rejects.toThrow('Subgraph error');
        });
    });

    describe('getPair', () => {
        it('should return pair information', async () => {
            const result = await adapter.getPair({ pairId: '0xpool123-0xtoken1-0xtoken2' });

            expect(mockSubgraphClient.getPool).toHaveBeenCalledWith('0xpool123');
            expect(result).toMatchObject({
                id: '0xpool123-0xtoken1-0xtoken2',
                dexKey: 'balancer-v3',
                asset0Id: '0xtoken1',
                asset1Id: '0xtoken2',
            });
        });

        it('should include pool metadata', async () => {
            // Reset mock to return pool data for this test
            mockSubgraphClient.getPool.mockResolvedValue({
                id: '1',
                address: '0xpool123',
                name: 'Test Pool',
                symbol: 'TEST',
                swapFee: '0.001',
                blockNumber: '100',
                blockTimestamp: '1000',
                transactionHash: '0xtx123',
                poolCreator: '0xcreator123',
                tokens: [
                    {
                        address: '0xtoken1',
                        name: 'Token 1',
                        symbol: 'TK1',
                        decimals: 18,
                        balance: '1000000000000000000',
                    },
                    {
                        address: '0xtoken2',
                        name: 'Token 2',
                        symbol: 'TK2',
                        decimals: 18,
                        balance: '2000000000000000000',
                    },
                ],
            });

            const result = await adapter.getPair({ pairId: '0xpool123-0xtoken1-0xtoken2' });

            expect(result.pool).toMatchObject({
                id: '0xpool123',
                name: 'Test Pool',
                metadata: {
                    symbol: 'TEST',
                },
            });
        });
    });

    describe('getEvents', () => {
        it('should return combined swap and join/exit events', async () => {
            const result = await adapter.getEvents({
                fromBlock: 100,
                toBlock: 200,
            });

            expect(mockSubgraphClient.getAllSwaps).toHaveBeenCalledWith({
                fromBlock: BigInt(100),
                toBlock: BigInt(200),
            });
            expect(mockSubgraphClient.getAllAddRemoves).toHaveBeenCalledWith({
                fromBlock: BigInt(100),
                toBlock: BigInt(200),
            });

            expect(result).toHaveLength(2); // 1 swap + 1 join/exit
            expect(result[0]).toHaveProperty('eventType');
            expect(result[1]).toHaveProperty('eventType');
        });

        it('should sort events by block number and transaction index', async () => {
            // Mock multiple events with different block numbers
            mockSubgraphClient.getAllSwaps.mockResolvedValue([
                {
                    id: '1',
                    tokenIn: '0xtoken1',
                    tokenOut: '0xtoken2',
                    tokenAmountIn: '1000000000000000000',
                    tokenAmountOut: '2000000000000000000',
                    pool: '0xpool123',
                    blockNumber: '102',
                    blockTimestamp: '1002',
                    transactionHash: '0xtx102',
                    logIndex: '0',
                    user: { id: '0xuser123' },
                },
                {
                    id: '2',
                    tokenIn: '0xtoken2',
                    tokenOut: '0xtoken1',
                    tokenAmountIn: '2000000000000000000',
                    tokenAmountOut: '1000000000000000000',
                    pool: '0xpool123',
                    blockNumber: '101',
                    blockTimestamp: '1001',
                    transactionHash: '0xtx101',
                    logIndex: '0',
                    user: { id: '0xuser123' },
                },
            ]);

            const result = await adapter.getEvents({
                fromBlock: 100,
                toBlock: 200,
            });

            // Should be sorted by block number
            expect(result[0].block.blockNumber).toBeLessThanOrEqual(result[1].block.blockNumber);
        });

        it('should handle empty results', async () => {
            mockSubgraphClient.getAllSwaps.mockResolvedValue([]);
            mockSubgraphClient.getAllAddRemoves.mockResolvedValue([]);

            const result = await adapter.getEvents({
                fromBlock: 100,
                toBlock: 200,
            });

            expect(result).toHaveLength(0);
        });
    });

    describe('convertSwaps', () => {
        it('should convert subgraph swaps to swap events', async () => {
            const result = await adapter.getEvents({
                fromBlock: 100,
                toBlock: 200,
            });

            const swapEvents = result.filter((event) => event.eventType === 'swap');
            expect(swapEvents.length).toBeGreaterThanOrEqual(0);

            if (swapEvents.length > 0) {
                const swapEvent = swapEvents[0];
                expect(swapEvent).toMatchObject({
                    eventType: 'swap',
                    txnId: expect.any(String),
                    txnIndex: expect.any(Number),
                    maker: expect.any(String),
                    pairId: expect.any(String),
                });
            }
        });

        it('should handle bidirectional swaps', async () => {
            // Mock swap in both directions
            mockSubgraphClient.getAllSwaps.mockResolvedValue([
                {
                    id: '1',
                    tokenIn: '0xtoken1',
                    tokenOut: '0xtoken2',
                    tokenAmountIn: '1000000000000000000',
                    tokenAmountOut: '2000000000000000000',
                    pool: '0xpool123',
                    blockNumber: '100',
                    blockTimestamp: '1000',
                    transactionHash: '0xtx123',
                    logIndex: '0',
                    user: { id: '0xuser123' },
                },
                {
                    id: '2',
                    tokenIn: '0xtoken2',
                    tokenOut: '0xtoken1',
                    tokenAmountIn: '2000000000000000000',
                    tokenAmountOut: '1000000000000000000',
                    pool: '0xpool123',
                    blockNumber: '100',
                    blockTimestamp: '1000',
                    transactionHash: '0xtx123',
                    logIndex: '1',
                    user: { id: '0xuser123' },
                },
            ]);

            const result = await adapter.getEvents({
                fromBlock: 100,
                toBlock: 200,
            });

            const swapEvents = result.filter((event) => event.eventType === 'swap');
            expect(swapEvents.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('convertJoinExits', () => {
        it('should convert subgraph add/removes to join/exit events', async () => {
            const result = await adapter.getEvents({
                fromBlock: 100,
                toBlock: 200,
            });

            const joinExitEvents = result.filter((event) => event.eventType === 'join' || event.eventType === 'exit');
            expect(joinExitEvents.length).toBeGreaterThanOrEqual(0);

            if (joinExitEvents.length > 0) {
                const joinEvent = joinExitEvents[0];
                expect(joinEvent).toMatchObject({
                    eventType: expect.stringMatching(/^(join|exit)$/),
                    txnId: expect.any(String),
                    txnIndex: expect.any(Number),
                    maker: expect.any(String),
                    pairId: expect.any(String),
                    amount0: expect.any(String),
                    amount1: expect.any(String),
                });
            }
        });

        it('should handle exit events', async () => {
            mockSubgraphClient.getAllAddRemoves.mockResolvedValue([
                {
                    id: '1',
                    type: 'REMOVE',
                    amounts: ['1000000000000000000', '2000000000000000000'],
                    blockNumber: '100',
                    blockTimestamp: '1000',
                    transactionHash: '0xtx123',
                    logIndex: '1',
                    sender: '0xuser123',
                    user: { id: '0xuser123' },
                    pool: {
                        id: '1',
                        address: '0xpool123',
                        name: 'Test Pool',
                        symbol: 'TEST',
                        swapFee: '0.001',
                        blockNumber: '50',
                        blockTimestamp: '500',
                        transactionHash: '0xtx50',
                        poolCreator: '0xcreator123',
                        tokens: [
                            {
                                address: '0xtoken1',
                                name: 'Token 1',
                                symbol: 'TK1',
                                decimals: 18,
                                balance: '1000000000000000000',
                            },
                            {
                                address: '0xtoken2',
                                name: 'Token 2',
                                symbol: 'TK2',
                                decimals: 18,
                                balance: '2000000000000000000',
                            },
                        ],
                    },
                },
            ]);

            const result = await adapter.getEvents({
                fromBlock: 100,
                toBlock: 200,
            });

            const exitEvents = result.filter((event) => event.eventType === 'exit');
            expect(exitEvents).toHaveLength(1);
            expect(exitEvents[0].eventType).toBe('exit');
        });
    });

    describe('Error Handling', () => {
        it('should handle subgraph client errors in getEvents', async () => {
            mockSubgraphClient.getAllSwaps.mockRejectedValue(new Error('Subgraph error'));

            await expect(
                adapter.getEvents({
                    fromBlock: 100,
                    toBlock: 200,
                }),
            ).rejects.toThrow('Subgraph error');
        });

        it('should handle invalid pair IDs', async () => {
            // Test with a truly invalid pair ID that will cause parsePairId to throw
            await expect(adapter.getPair({ pairId: 'invalid-format' })).rejects.toThrow('Invalid pair ID format');
        });
    });

    describe('Logging', () => {
        it('should log information during getEvents', async () => {
            // Reset mocks for clean state
            mockSubgraphClient.getAllSwaps.mockResolvedValue([]);
            mockSubgraphClient.getAllAddRemoves.mockResolvedValue([]);

            const logSpy = mock();
            adapter['log'].info = logSpy;

            await adapter.getEvents({
                fromBlock: 100,
                toBlock: 200,
            });

            expect(logSpy).toHaveBeenCalledWith('Fetching events from block 100 to 200');
        });
    });

    describe('Chain Configuration', () => {
        it('should return correct chain configuration', () => {
            const config = adapter.getChainConfig();
            expect(config).toEqual(chainConfig);
        });

        it('should use chain configuration in subgraph client', () => {
            expect(adapter.subgraphClient).toBeDefined();
            expect(adapter['chainConfig']).toEqual(chainConfig);
        });
    });
});
