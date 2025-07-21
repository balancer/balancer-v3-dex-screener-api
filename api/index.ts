import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import routes from '../src/api/routes';
import { ChainConfigService } from '../src/utils/chain-config';

// Create Express app
const app = express();

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Balancer V3 DEX Screener Adapter',
        version: '1.0.0',
        description: 'REST API adapter for Balancer V3 pools across multiple chains',
        endpoints: {
            'GET /api/health': 'Health check',
            'GET /api/chains': 'Get supported chains',
            'GET /api/{chain}/latest-block': 'Get latest block information',
            'GET /api/{chain}/asset?id=:string': 'Get asset information',
            'GET /api/{chain}/pair?id=:string': 'Get pair information',
            'GET /api/{chain}/events?fromBlock=X&toBlock=Y': 'Get events for block range',
        },
        chains: (() => {
            try {
                const chainConfigService = ChainConfigService.getInstance();
                return chainConfigService.getSupportedChains();
            } catch (error) {
                console.error('Chain config error:', error);
                return [];
            }
        })(),
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        timestamp: Date.now(),
    });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: Date.now(),
    });
});

// Export Vercel handler
export default (req: VercelRequest, res: VercelResponse) => {
    return app(req as any, res as any);
};