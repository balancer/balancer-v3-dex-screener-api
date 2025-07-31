import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import request from 'supertest';
import express from 'express';
import routes from './routes';
import { ChainConfigService } from '../utils/chain-config';
import { BalancerV3AMMAdapter } from '../adapters/balancer-v3-amm-adapter';

// Mock the chain config service
const mockChainConfigService = {
    getInstance: mock(() => ({
        getChainConfig: mock((chainSlug: string) => {
            if (chainSlug === 'ethereum') {
                return {
                    apiSlug: 'ETHEREUM',
                    viemChain: { id: 1, name: 'Ethereum' },
                    subgraphUrl: 'https://test-ethereum-subgraph.com',
                    rpcUrl: 'https://test-ethereum-rpc.com',
                };
            }
            if (chainSlug === 'arbitrum') {
                return {
                    apiSlug: 'ARBITRUM',
                    viemChain: { id: 42161, name: 'Arbitrum' },
                    subgraphUrl: 'https://test-arbitrum-subgraph.com',
                    rpcUrl: 'https://test-arbitrum-rpc.com',
                };
            }
            throw new Error(`Unsupported chain: ${chainSlug}`);
        }),
        getSupportedChains: mock(() => ['ethereum', 'arbitrum']),
    })),
};

// Mock the adapter
const mockAdapter = {
    getLatestBlock: mock(() =>
        Promise.resolve({
            blockNumber: 19123456,
            blockTimestamp: 1752762620,
        }),
    ),
    getPair: mock(() =>
        Promise.resolve({
            id: 'test-pair-id',
            dexKey: 'balancer-v3',
            feeBps: 50,
            asset0Id: '0x123',
            asset1Id: '0x456',
            creationBlockNumber: 19000000,
            creationBlockTimestamp: 1752762600,
            creationTxnId: '0xabc',
            creator: '0xdef',
            pool: {
                id: '0xpool',
                name: 'Test Pool',
                assetIds: ['0x123', '0x456'],
                pairIds: ['test-pair-id'],
                metadata: { symbol: 'TEST-POOL' },
            },
        }),
    ),
    getEvents: mock(() =>
        Promise.resolve([
            {
                block: {
                    blockNumber: 19123456,
                    blockTimestamp: 1752762620,
                },
                eventType: 'swap',
                txnId: '0xtest-txn',
                txnIndex: 0,
                eventIndex: 1,
                maker: '0xuser',
                pairId: 'test-pair-id',
                priceNative: '1.0025',
                asset0In: '1000000000000000000',
                asset1Out: '1002500000000000000',
                reserves: {
                    asset0: '1000000000000000000000',
                    asset1: '999000000000000000000',
                },
            },
        ]),
    ),
    getChainConfig: mock(() => ({
        apiSlug: 'ETHEREUM',
        viemChain: { id: 1, name: 'Ethereum' },
        subgraphUrl: 'https://test-ethereum-subgraph.com',
        rpcUrl: 'https://test-ethereum-rpc.com',
    })),
};

// Mock blockchain client
mock.module('../utils/blockchain-client', () => ({
    getTokenInfo: mock(() =>
        Promise.resolve({
            name: 'Test Token',
            symbol: 'TEST',
            decimals: 18,
        }),
    ),
}));

describe('API Routes - integration tests', () => {
    let app: express.Application;
    let server: any;

    beforeAll(async () => {
        // Create Express app
        app = express();
        app.use(express.json());

        // Mock ChainConfigService
        (ChainConfigService as any).getInstance = mockChainConfigService.getInstance;

        // Mock adapter creation
        const originalBalancerV3AMMAdapter = (global as any).BalancerV3AMMAdapter;
        (global as any).BalancerV3AMMAdapter = class {
            constructor() {
                return mockAdapter;
            }
        };

        // Create routes
        app.use('/api', routes);

        // Start server
        server = app.listen(0);
    });

    afterAll(async () => {
        if (server) {
            await server.close();
        }
    });

    beforeEach(() => {
        // Reset mocks
        mockAdapter.getLatestBlock.mockClear();
        mockAdapter.getPair.mockClear();
        mockAdapter.getEvents.mockClear();
        mockChainConfigService.getInstance().getChainConfig.mockClear();
        mockChainConfigService.getInstance().getSupportedChains.mockClear();
    });

    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await request(app).get('/api/health').expect(200);

            expect(response.body.status).toBe('healthy');
            expect(response.body.service).toBe('balancer-v3-dex-screener-adapter');
        });
    });

    describe('Chain Management', () => {
        it('should list supported chains', async () => {
            const response = await request(app).get('/api/chains').expect(200);

            expect(response.body.chains).toEqual(['ethereum', 'arbitrum']);
        });
    });

    describe('Latest Block Endpoint', () => {
        it('should return latest block for supported chain', async () => {
            const response = await request(app).get('/api/ethereum/latest-block').expect(200);

            expect(response.body.blockNumber).toBe(19123456);
            expect(response.body.blockTimestamp).toBe(1752762620);
            expect(mockAdapter.getLatestBlock).toHaveBeenCalled();
        });

        it('should return 400 for unsupported chain', async () => {
            const response = await request(app).get('/api/unsupported/latest-block').expect(400);

            expect(response.body.error).toContain('Unsupported chain: unsupported');
        });
    });

    describe('Asset Endpoint', () => {
        it('should return asset information', async () => {
            const response = await request(app).get('/api/ethereum/asset').query({ id: '0x123456789' }).expect(200);

            expect(response.body.id).toBe('0x123456789');
            expect(response.body.name).toBe('Test Token');
            expect(response.body.symbol).toBe('TEST');
            expect(response.body.totalSupply).toBeDefined();
        });

        it('should return 400 for missing asset id', async () => {
            const response = await request(app).get('/api/ethereum/asset').expect(400);

            expect(response.body.error).toContain('Asset id parameter is required');
        });

        it('should return 404 for invalid asset id', async () => {
            const response = await request(app).get('/api/ethereum/asset').query({ id: 'invalid-address' }).expect(404);

            expect(response.body.error).toContain('Asset not found');
        });
    });

    describe('Pair Endpoint', () => {
        it('should return pair information', async () => {
            const response = await request(app).get('/api/ethereum/pair').query({ id: 'test-pair-id' }).expect(200);

            expect(response.body.id).toBe('test-pair-id');
            expect(response.body.dexKey).toBe('balancer-v3');
            expect(response.body.feeBps).toBe(50);
            expect(mockAdapter.getPair).toHaveBeenCalledWith({ pairId: 'test-pair-id' });
        });

        it('should return 400 for missing pair id', async () => {
            const response = await request(app).get('/api/ethereum/pair').expect(400);

            expect(response.body.error).toContain('Pair id parameter is required');
        });

        it('should handle adapter errors gracefully', async () => {
            mockAdapter.getPair.mockRejectedValue(new Error('Pool not found'));

            const response = await request(app).get('/api/ethereum/pair').query({ id: 'nonexistent-pair' }).expect(404);

            expect(response.body.error).toContain('Pair not found');
        });
    });

    describe('Events Endpoint', () => {
        it('should return events for valid block range', async () => {
            const response = await request(app)
                .get('/api/ethereum/events')
                .query({ fromBlock: '19123450', toBlock: '19123460' })
                .expect(200);

            expect(response.body.events).toHaveLength(1);
            expect(response.body.events[0].eventType).toBe('swap');
            expect(response.body.events[0].pairId).toBe('test-pair-id');
            expect(mockAdapter.getEvents).toHaveBeenCalledWith({
                fromBlock: 19123450,
                toBlock: 19123460,
            });
        });

        it('should return 400 for missing block parameters', async () => {
            const response = await request(app)
                .get('/api/ethereum/events')
                .query({ fromBlock: '19123450' })
                .expect(400);

            expect(response.body.error).toContain('fromBlock and toBlock parameters are required');
        });

        it('should return 400 for invalid block numbers', async () => {
            const response = await request(app)
                .get('/api/ethereum/events')
                .query({ fromBlock: 'invalid', toBlock: '19123460' })
                .expect(400);

            expect(response.body.error).toContain('fromBlock and toBlock parameters are required');
        });

        it('should return 200 for large block range', async () => {
            const response = await request(app)
                .get('/api/ethereum/events')
                .query({ fromBlock: '19123450', toBlock: '19124550' })
                .expect(200);

            expect(response.body.events).toHaveLength(1);
        });

        it('should return 400 for fromBlock greater than toBlock', async () => {
            const response = await request(app)
                .get('/api/ethereum/events')
                .query({ fromBlock: '19123460', toBlock: '19123450' })
                .expect(400);

            expect(response.body.error).toContain('fromBlock must be less than or equal to toBlock');
        });
    });

    describe('Error Handling', () => {
        it('should handle internal server errors', async () => {
            mockAdapter.getLatestBlock.mockRejectedValue(new Error('Internal error'));

            const response = await request(app).get('/api/ethereum/latest-block').expect(500);

            expect(response.body.error).toContain('Failed to fetch latest block');
        });

        it('should handle chain configuration errors', async () => {
            mockChainConfigService.getInstance().getChainConfig.mockImplementation(() => {
                throw new Error('Chain configuration error');
            });

            const response = await request(app).get('/api/ethereum/latest-block').expect(500);

            expect(response.body.error).toContain('Failed to fetch latest block');
        });
    });

    describe('Response Format', () => {
        it('should always include status and service fields', async () => {
            const response = await request(app).get('/api/health').expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('service');
            expect(response.body.status).toBe('healthy');
        });

        it('should include error field for failed requests', async () => {
            const response = await request(app).get('/api/unsupported/latest-block').expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Unsupported chain');
        });
    });

    describe('CORS and Headers', () => {
        it('should include CORS headers', async () => {
            const response = await request(app).get('/api/health').expect(200);

            expect(response.headers['content-type']).toContain('application/json');
        });

        it('should handle OPTIONS requests', async () => {
            await request(app).options('/api/health').expect(200);
        });
    });
});
