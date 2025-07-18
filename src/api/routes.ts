import { Router, Request, Response } from 'express';
import { BalancerV3AMMAdapter } from '../adapters/balancer-v3-amm-adapter';
import { getTokenInfo } from '../utils/blockchain-client';
import { LatestBlockResponse, AssetResponse, EventsResponse, SwapEvent, JoinExitEvent } from './types';
import { ChainConfigService } from '../utils/chain-config';

const router = Router();

// Get chain configuration service
const chainConfigService = ChainConfigService.getInstance();

// Create adapter cache
const adapterCache = new Map<string, BalancerV3AMMAdapter>();

// Helper function to get or create adapter for chain
function getAdapter(chainSlug: string): BalancerV3AMMAdapter {
    if (!adapterCache.has(chainSlug)) {
        const chainConfig = chainConfigService.getChainConfig(chainSlug);
        const adapter = new BalancerV3AMMAdapter({ chainConfig });
        adapterCache.set(chainSlug, adapter);
    }
    return adapterCache.get(chainSlug)!;
}

// GET /:chain/latest-block
router.get('/:chain/latest-block', async (req: Request, res: Response) => {
    try {
        const chainSlug = req.params.chain;
        const adapter = getAdapter(chainSlug);
        const block = await adapter.getLatestBlock();

        const response: LatestBlockResponse = {
            blockNumber: block.blockNumber,
            blockTimestamp: block.blockTimestamp,
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching latest block:', error);
        if (error instanceof Error && error.message.includes('Unsupported chain')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch latest block' });
        }
    }
});

// GET /:chain/asset?id=:string
router.get('/:chain/asset', async (req: Request, res: Response) => {
    try {
        const chainSlug = req.params.chain;
        const assetId = req.query.id as string;

        if (!assetId) {
            return res.status(400).json({ error: 'Asset id parameter is required' });
        }

        const chainConfig = chainConfigService.getChainConfig(chainSlug);
        const tokenInfo = await getTokenInfo(assetId, chainConfig);

        const response: AssetResponse = {
            id: assetId,
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            totalSupply: tokenInfo.totalSupply,
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching asset:', error);
        if (error instanceof Error && error.message.includes('Unsupported chain')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(404).json({ error: 'Asset not found' });
        }
    }
});

// GET /:chain/pair?id=:string
router.get('/:chain/pair', async (req: Request, res: Response) => {
    try {
        const chainSlug = req.params.chain;
        const pairId = req.query.id as string;

        if (!pairId) {
            return res.status(400).json({ error: 'Pair id parameter is required' });
        }

        const adapter = getAdapter(chainSlug);
        const pair = await adapter.getPair({ pairId });

        res.json(pair);
    } catch (error) {
        console.error('Error fetching pair:', error);
        if (error instanceof Error && error.message.includes('Unsupported chain')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(404).json({ error: 'Pair not found' });
        }
    }
});

// GET /:chain/events
router.get('/:chain/events', async (req: Request, res: Response) => {
    try {
        const chainSlug = req.params.chain;
        const fromBlock = parseInt(req.query.fromBlock as string);
        const toBlock = parseInt(req.query.toBlock as string);

        if (isNaN(fromBlock) || isNaN(toBlock)) {
            return res.status(400).json({ error: 'fromBlock and toBlock parameters are required' });
        }

        if (fromBlock > toBlock) {
            return res.status(400).json({ error: 'fromBlock must be less than or equal to toBlock' });
        }

        const adapter = getAdapter(chainSlug);
        const events = await adapter.getEvents({ fromBlock, toBlock });

        const response: EventsResponse = { events };
        res.json(response);
    } catch (error) {
        console.error('Error fetching events:', error);
        if (error instanceof Error && error.message.includes('Unsupported chain')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch events' });
        }
    }
});

// GET /chains - List supported chains
router.get('/chains', (req: Request, res: Response) => {
    try {
        const supportedChains = chainConfigService.getSupportedChains();
        res.json({ chains: supportedChains });
    } catch (error) {
        console.error('Error fetching supported chains:', error);
        res.status(500).json({ error: 'Failed to fetch supported chains' });
    }
});

// GET /health - Health check endpoint
router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', service: 'balancer-v3-dex-screener-adapter' });
});

export default router;
