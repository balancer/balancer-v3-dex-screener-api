import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { BalancerV3SubgraphClient } from './client';
import { ChainConfig } from '../utils/chain-config';
import { TokenMappingService } from '../utils/token-mapper-service';
import { SubgraphPool, SubgraphSwap, SubgraphAddRemove } from '../types/subgraph-types';

// Mock the TokenMappingService
const mockTokenMappingService = {
    mapUnderlyingInPools: mock((pool: SubgraphPool) => Promise.resolve({
        ...pool,
        tokens: pool.tokens.map(token => ({
            ...token,
            symbol: token.symbol + '_MAPPED'
        }))
    })),
    mapUnderlyingInSwaps: mock((swaps: SubgraphSwap[]) => Promise.resolve(
        swaps.map(swap => ({
            ...swap,
            tokenInSymbol: swap.tokenInSymbol + '_MAPPED',
            tokenOutSymbol: swap.tokenOutSymbol + '_MAPPED'
        }))
    )),
    mapUnderlyingInAddRemoves: mock((addRemoves: SubgraphAddRemove[]) => Promise.resolve(
        addRemoves.map(ar => ({
            ...ar,
            pool: {
                ...ar.pool,
                tokens: ar.pool.tokens.map(token => ({
                    ...token,
                    symbol: token.symbol + '_MAPPED'
                }))
            }
        }))
    ))
};

// Mock TokenMappingService.getInstance
mock.module('../utils/token-mapper-service', () => ({
    TokenMappingService: {
        getInstance: mock(() => mockTokenMappingService)
    }
}));

describe('BalancerV3SubgraphClient', () => {
    let client: BalancerV3SubgraphClient;
    let mockGraphQLClient: any;
    let chainConfig: ChainConfig;

    beforeEach(() => {
        chainConfig = {
            apiSlug: 'ETHEREUM',
            viemChain: { id: 1, name: 'Ethereum' } as any,
            subgraphUrl: 'https://test-subgraph.com',
            rpcUrl: 'https://test-rpc.com'
        };

        // Create mock GraphQL client
        mockGraphQLClient = {
            request: mock(() => Promise.resolve({}))
        };

        // Create client instance
        client = new BalancerV3SubgraphClient(chainConfig.subgraphUrl, chainConfig);
        
        // Replace the internal GraphQL client
        (client as any).client = mockGraphQLClient;

        // Clear token mapping service mocks
        mockTokenMappingService.mapUnderlyingInPools.mockClear();
        mockTokenMappingService.mapUnderlyingInSwaps.mockClear();
        mockTokenMappingService.mapUnderlyingInAddRemoves.mockClear();
    });

    afterEach(() => {
        mockGraphQLClient.request.mockClear();
    });

    describe('Constructor', () => {
        it('should initialize with correct configuration', () => {
            expect(client.tokenMappingService).toBeDefined();
            expect((client as any).chainConfig).toEqual(chainConfig);
        });

        it('should create GraphQL client with correct URL', () => {
            const newClient = new BalancerV3SubgraphClient('https://different-url.com', chainConfig);
            expect(newClient).toBeDefined();
        });
    });

    describe('getChainSlug', () => {
        it('should convert API slug to chain slug', () => {
            const chainSlug = (client as any).getChainSlug();
            expect(chainSlug).toBe('ethereum'); // ETHEREUM -> ethereum (via fallback)
        });

        it('should handle different API slugs', () => {
            const arbitrumConfig = {
                ...chainConfig,
                apiSlug: 'ARBITRUM'
            };
            const arbitrumClient = new BalancerV3SubgraphClient('https://test.com', arbitrumConfig);
            // Replace the internal GraphQL client
            (arbitrumClient as any).client = mockGraphQLClient;
            const chainSlug = (arbitrumClient as any).getChainSlug();
            expect(chainSlug).toBe('arbitrum');
        });

        it('should handle unknown API slugs', () => {
            const unknownConfig = {
                ...chainConfig,
                apiSlug: 'UNKNOWN'
            };
            const unknownClient = new BalancerV3SubgraphClient('https://test.com', unknownConfig);
            // Replace the internal GraphQL client
            (unknownClient as any).client = mockGraphQLClient;
            const chainSlug = (unknownClient as any).getChainSlug();
            expect(chainSlug).toBe('unknown');
        });
    });

    describe('getPool', () => {
        const mockPool: SubgraphPool = {
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
                    id: '1',
                    address: '0xtoken1',
                    name: 'Token 1',
                    symbol: 'TK1',
                    decimals: 18,
                    balance: '1000'
                },
                {
                    id: '2',
                    address: '0xtoken2',
                    name: 'Token 2',
                    symbol: 'TK2',
                    decimals: 18,
                    balance: '2000'
                }
            ]
        };

        it('should fetch pool data without block number', async () => {
            mockGraphQLClient.request.mockResolvedValue({ pool: mockPool });

            const result = await client.getPool('0xpool123');

            expect(mockGraphQLClient.request).toHaveBeenCalledWith(
                expect.any(String),
                { poolId: '0xpool123' }
            );
            expect(result).toBeDefined();
            expect(result?.id).toBe('1');
            expect(mockTokenMappingService.mapUnderlyingInPools).toHaveBeenCalledWith(mockPool, 'ethereum');
        });

        it('should fetch pool data with block number', async () => {
            mockGraphQLClient.request.mockResolvedValue({ pool: mockPool });

            const result = await client.getPool('0xpool123', 12345);

            expect(mockGraphQLClient.request).toHaveBeenCalledWith(
                expect.any(String),
                { poolId: '0xpool123', blockNumber: 12345 }
            );
            expect(result).toBeDefined();
            expect(mockTokenMappingService.mapUnderlyingInPools).toHaveBeenCalledWith(mockPool, 'ethereum');
        });

        it('should return null for non-existent pool', async () => {
            mockGraphQLClient.request.mockResolvedValue({ pool: null });

            const result = await client.getPool('0xnonexistent');

            expect(result).toBeNull();
            expect(mockTokenMappingService.mapUnderlyingInPools).not.toHaveBeenCalled();
        });

        it('should apply token mapping to pool data', async () => {
            mockGraphQLClient.request.mockResolvedValue({ pool: mockPool });

            const result = await client.getPool('0xpool123');

            expect(result?.tokens[0].symbol).toBe('TK1_MAPPED');
            expect(result?.tokens[1].symbol).toBe('TK2_MAPPED');
        });
    });

    describe('getLatestBlock', () => {
        it('should fetch latest block information', async () => {
            const mockBlock = {
                number: '12345',
                timestamp: '1640995200',
                hash: '0xblock123'
            };
            mockGraphQLClient.request.mockResolvedValue({ _meta: { block: mockBlock } });

            const result = await client.getLatestBlock();

            expect(mockGraphQLClient.request).toHaveBeenCalledWith(expect.any(String));
            expect(result).toEqual(mockBlock);
        });
    });

    describe('getAllSwaps', () => {
        const mockSwaps: SubgraphSwap[] = [
            {
                id: '1',
                tokenIn: '0xtoken1',
                tokenOut: '0xtoken2',
                tokenAmountIn: '1000',
                tokenAmountOut: '2000',
                tokenInSymbol: 'TK1',
                tokenOutSymbol: 'TK2',
                pool: '0xpool123',
                blockNumber: '100',
                blockTimestamp: '1000',
                transactionHash: '0xtx123',
                logIndex: '0',
                user: { id: '0xuser123' }
            },
            {
                id: '2',
                tokenIn: '0xtoken2',
                tokenOut: '0xtoken1',
                tokenAmountIn: '2000',
                tokenAmountOut: '1000',
                tokenInSymbol: 'TK2',
                tokenOutSymbol: 'TK1',
                pool: '0xpool123',
                blockNumber: '101',
                blockTimestamp: '1001',
                transactionHash: '0xtx124',
                logIndex: '1',
                user: { id: '0xuser124' }
            }
        ];

        it('should fetch all swaps for block range', async () => {
            mockGraphQLClient.request.mockResolvedValue({ swaps: mockSwaps });

            const result = await client.getAllSwaps({
                fromBlock: BigInt(100),
                toBlock: BigInt(200)
            });

            expect(mockGraphQLClient.request).toHaveBeenCalledWith(
                expect.any(String),
                {
                    first: 1000,
                    id_gt: '0x',
                    fromBlock: '100',
                    toBlock: '200'
                }
            );
            expect(result).toHaveLength(2);
            expect(mockTokenMappingService.mapUnderlyingInSwaps).toHaveBeenCalledWith(mockSwaps, 'ethereum');
        });

        it('should handle pagination for large datasets', async () => {
            const firstBatch = Array.from({ length: 1000 }, (_, i) => ({
                ...mockSwaps[0],
                id: `${i + 1}`,
                transactionHash: `0xtx${i + 1}`
            }));
            
            const secondBatch = Array.from({ length: 500 }, (_, i) => ({
                ...mockSwaps[0],
                id: `${i + 1001}`,
                transactionHash: `0xtx${i + 1001}`
            }));

            mockGraphQLClient.request
                .mockResolvedValueOnce({ swaps: firstBatch })
                .mockResolvedValueOnce({ swaps: secondBatch });

            const result = await client.getAllSwaps({
                fromBlock: BigInt(100),
                toBlock: BigInt(200)
            });

            expect(mockGraphQLClient.request).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(1500);
            
            // Check that second call uses correct pagination
            expect(mockGraphQLClient.request).toHaveBeenNthCalledWith(
                2,
                expect.any(String),
                {
                    first: 1000,
                    id_gt: '1000',
                    fromBlock: '100',
                    toBlock: '200'
                }
            );
        });

        it('should apply token mapping to swap data', async () => {
            mockGraphQLClient.request.mockResolvedValue({ swaps: mockSwaps });

            const result = await client.getAllSwaps({
                fromBlock: BigInt(100),
                toBlock: BigInt(200)
            });

            expect(result[0].tokenInSymbol).toBe('TK1_MAPPED');
            expect(result[0].tokenOutSymbol).toBe('TK2_MAPPED');
        });
    });

    describe('getAllAddRemoves', () => {
        const mockAddRemoves: SubgraphAddRemove[] = [
            {
                id: '1',
                type: 'ADD',
                amounts: ['1000', '2000'],
                blockNumber: '100',
                blockTimestamp: '1000',
                transactionHash: '0xtx123',
                logIndex: '0',
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
                            id: '1',
                            address: '0xtoken1',
                            name: 'Token 1',
                            symbol: 'TK1',
                            decimals: 18,
                            balance: '1000'
                        }
                    ]
                }
            }
        ];

        it('should fetch all add/remove events for block range', async () => {
            mockGraphQLClient.request.mockResolvedValue({ addRemoves: mockAddRemoves });

            const result = await client.getAllAddRemoves({
                fromBlock: BigInt(100),
                toBlock: BigInt(200)
            });

            expect(mockGraphQLClient.request).toHaveBeenCalledWith(
                expect.any(String),
                {
                    first: 1000,
                    id_gt: '0x',
                    fromBlock: '100',
                    toBlock: '200'
                }
            );
            expect(result).toHaveLength(1);
            expect(mockTokenMappingService.mapUnderlyingInAddRemoves).toHaveBeenCalledWith(mockAddRemoves, 'ethereum');
        });

        it('should handle pagination for large datasets', async () => {
            const firstBatch = Array.from({ length: 1000 }, (_, i) => ({
                ...mockAddRemoves[0],
                id: `${i + 1}`,
                transactionHash: `0xtx${i + 1}`
            }));
            
            const secondBatch = Array.from({ length: 200 }, (_, i) => ({
                ...mockAddRemoves[0],
                id: `${i + 1001}`,
                transactionHash: `0xtx${i + 1001}`
            }));

            mockGraphQLClient.request
                .mockResolvedValueOnce({ addRemoves: firstBatch })
                .mockResolvedValueOnce({ addRemoves: secondBatch });

            const result = await client.getAllAddRemoves({
                fromBlock: BigInt(100),
                toBlock: BigInt(200)
            });

            expect(mockGraphQLClient.request).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(1200);
        });

        it('should apply token mapping to add/remove data', async () => {
            mockGraphQLClient.request.mockResolvedValue({ addRemoves: mockAddRemoves });

            const result = await client.getAllAddRemoves({
                fromBlock: BigInt(100),
                toBlock: BigInt(200)
            });

            expect(result[0].pool.tokens[0].symbol).toBe('TK1_MAPPED');
        });
    });

    describe('Error Handling', () => {
        it('should handle GraphQL errors gracefully', async () => {
            mockGraphQLClient.request.mockRejectedValue(new Error('GraphQL Error'));

            await expect(client.getPool('0xpool123')).rejects.toThrow('GraphQL Error');
        });

        it('should handle network errors', async () => {
            mockGraphQLClient.request.mockRejectedValue(new Error('Network Error'));

            await expect(client.getLatestBlock()).rejects.toThrow('Network Error');
        });

        it('should handle token mapping errors', async () => {
            const testPool = {
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
                        id: '1',
                        address: '0xtoken1',
                        name: 'Token 1',
                        symbol: 'TK1',
                        decimals: 18,
                        balance: '1000'
                    }
                ]
            };
            
            mockGraphQLClient.request.mockResolvedValue({ pool: testPool });
            mockTokenMappingService.mapUnderlyingInPools.mockRejectedValue(new Error('Mapping Error'));

            await expect(client.getPool('0xpool123')).rejects.toThrow('Mapping Error');
        });
    });

    describe('Private Methods', () => {
        it('should handle getSwaps method correctly', async () => {
            const testSwaps = [{
                id: '1',
                tokenIn: '0xtoken1',
                tokenOut: '0xtoken2',
                tokenAmountIn: '1000',
                tokenAmountOut: '2000',
                tokenInSymbol: 'TK1',
                tokenOutSymbol: 'TK2',
                pool: '0xpool123',
                blockNumber: '100',
                blockTimestamp: '1000',
                transactionHash: '0xtx123',
                logIndex: '0',
                user: { id: '0xuser123' }
            }];
            
            mockGraphQLClient.request.mockResolvedValue({ swaps: testSwaps });

            const result = await (client as any).getSwaps({
                first: 100,
                id_gt: '0x',
                fromBlock: BigInt(100),
                toBlock: BigInt(200)
            });

            expect(mockGraphQLClient.request).toHaveBeenCalledWith(
                expect.any(String),
                {
                    first: 100,
                    id_gt: '0x',
                    fromBlock: '100',
                    toBlock: '200'
                }
            );
            expect(result.swaps).toHaveLength(1);
        });

        it('should handle getAddRemoves method correctly', async () => {
            const testAddRemoves = [{
                id: '1',
                type: 'ADD',
                amounts: ['1000', '2000'],
                blockNumber: '100',
                blockTimestamp: '1000',
                transactionHash: '0xtx123',
                logIndex: '0',
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
                            id: '1',
                            address: '0xtoken1',
                            name: 'Token 1',
                            symbol: 'TK1',
                            decimals: 18,
                            balance: '1000'
                        }
                    ]
                }
            }];
            
            mockGraphQLClient.request.mockResolvedValue({ addRemoves: testAddRemoves });

            const result = await (client as any).getAddRemoves({
                first: 100,
                id_gt: '0x',
                fromBlock: BigInt(100),
                toBlock: BigInt(200)
            });

            expect(mockGraphQLClient.request).toHaveBeenCalledWith(
                expect.any(String),
                {
                    first: 100,
                    id_gt: '0x',
                    fromBlock: '100',
                    toBlock: '200'
                }
            );
            expect(result.addRemoves).toHaveLength(1);
        });
    });
});