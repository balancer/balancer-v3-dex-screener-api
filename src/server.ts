import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './api/routes';
import { ChainConfigService } from './utils/chain-config';

// Load environment variables
dotenv.config();

// Validate required environment variables
try {
    const chainConfigService = ChainConfigService.getInstance();
    console.log(`🔗 Supported chains: ${chainConfigService.getSupportedChains().join(', ')}`);
} catch (error) {
    console.error('❌ Environment validation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Balancer V3 DEX Screener Adapter',
        version: '1.0.0',
        description: 'REST API adapter for Balancer V3 pools on Sonic chain',
        endpoints: {
            'GET /api/health': 'Health check',
            'GET /api/latest-block': 'Get latest block information',
            'GET /api/chains': 'Get supported chains (simple list)',
            'GET /api/chain': 'Get all possible chains with detailed information',
            'GET /api/{chain}/latest-block': 'Get latest block information',
            'GET /api/{chain}/asset?id=:string': 'Get asset information',
            'GET /api/{chain}/pair?id=:string': 'Get pair information',
            'GET /api/{chain}/events?fromBlock=X&toBlock=Y': 'Get events for block range',
        },
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: Date.now(),
    });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: Date.now(),
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Balancer V3 DEX Screener Adapter running on port ${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
    const chainConfigService = ChainConfigService.getInstance();
    const supportedChains = chainConfigService.getSupportedChains();
    console.log(`🌐 Multichain support enabled for: ${supportedChains.join(', ')}`);
});

export default app;
