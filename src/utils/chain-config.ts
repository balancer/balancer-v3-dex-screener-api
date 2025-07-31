import { Chain } from 'viem';
import { mainnet, sonic, arbitrum, optimism, base, avalanche, gnosis } from 'viem/chains';

// Custom chain definition for HyperEVM
const hyperevm: Chain = {
    id: 999,
    name: 'HyperEVM',
    nativeCurrency: {
        name: 'Hyperliquid',
        symbol: 'HYPE',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.hyperliquid.xyz/evm'],
        },
    },
    blockExplorers: {
        default: {
            name: 'HyperEVM Explorer',
            url: 'https://explorer.hyperliquid.xyz',
        },
    },
};

export interface ChainConfig {
    apiSlug: string;
    viemChain: Chain;
    subgraphUrl: string;
    rpcUrl: string;
}

export class ChainConfigService {
    private static instance: ChainConfigService;
    private configs: Map<string, ChainConfig> = new Map();

    private constructor() {
        this.initializeConfigs();
    }

    public static getInstance(): ChainConfigService {
        if (!ChainConfigService.instance) {
            ChainConfigService.instance = new ChainConfigService();
        }
        return ChainConfigService.instance;
    }

    private initializeConfigs(): void {
        // Load Sonic chain configuration
        const sonicSubgraphUrl = process.env.SUBGRAPH_URL_SONIC;
        const sonicRpcUrl = process.env.RPC_URL_SONIC;

        if (sonicSubgraphUrl && sonicRpcUrl) {
            this.configs.set('sonic', {
                apiSlug: 'SONIC',
                viemChain: sonic,
                subgraphUrl: sonicSubgraphUrl,
                rpcUrl: sonicRpcUrl,
            });
        }

        // Ethereum mainnet configuration
        const ethereumSubgraphUrl = process.env.SUBGRAPH_URL_ETHEREUM;
        const ethereumRpcUrl = process.env.RPC_URL_ETHEREUM;
        if (ethereumSubgraphUrl && ethereumRpcUrl) {
            this.configs.set('ethereum', {
                apiSlug: 'MAINNET',
                viemChain: mainnet,
                subgraphUrl: ethereumSubgraphUrl,
                rpcUrl: ethereumRpcUrl,
            });
        }

        // Arbitrum configuration
        const arbitrumSubgraphUrl = process.env.SUBGRAPH_URL_ARBITRUM;
        const arbitrumRpcUrl = process.env.RPC_URL_ARBITRUM;
        if (arbitrumSubgraphUrl && arbitrumRpcUrl) {
            this.configs.set('arbitrum', {
                apiSlug: 'ARBITRUM',
                viemChain: arbitrum,
                subgraphUrl: arbitrumSubgraphUrl,
                rpcUrl: arbitrumRpcUrl,
            });
        }

        // Optimism configuration
        const optimismSubgraphUrl = process.env.SUBGRAPH_URL_OPTIMISM;
        const optimismRpcUrl = process.env.RPC_URL_OPTIMISM;
        if (optimismSubgraphUrl && optimismRpcUrl) {
            this.configs.set('optimism', {
                apiSlug: 'OPTIMISM',
                viemChain: optimism,
                subgraphUrl: optimismSubgraphUrl,
                rpcUrl: optimismRpcUrl,
            });
        }

        // Base configuration
        const baseSubgraphUrl = process.env.SUBGRAPH_URL_BASE;
        const baseRpcUrl = process.env.RPC_URL_BASE;
        if (baseSubgraphUrl && baseRpcUrl) {
            this.configs.set('base', {
                apiSlug: 'BASE',
                viemChain: base,
                subgraphUrl: baseSubgraphUrl,
                rpcUrl: baseRpcUrl,
            });
        }

        // Avalanche configuration
        const avalancheSubgraphUrl = process.env.SUBGRAPH_URL_AVALANCHE;
        const avalancheRpcUrl = process.env.RPC_URL_AVALANCHE;
        if (avalancheSubgraphUrl && avalancheRpcUrl) {
            this.configs.set('avalanche', {
                apiSlug: 'AVALANCHE',
                viemChain: avalanche,
                subgraphUrl: avalancheSubgraphUrl,
                rpcUrl: avalancheRpcUrl,
            });
        }

        // Gnosis configuration
        const gnosisSubgraphUrl = process.env.SUBGRAPH_URL_GNOSIS;
        const gnosisRpcUrl = process.env.RPC_URL_GNOSIS;
        if (gnosisSubgraphUrl && gnosisRpcUrl) {
            this.configs.set('gnosis', {
                apiSlug: 'GNOSIS',
                viemChain: gnosis,
                subgraphUrl: gnosisSubgraphUrl,
                rpcUrl: gnosisRpcUrl,
            });
        }

        // HyperEVM configuration
        const hyperevmSubgraphUrl = process.env.SUBGRAPH_URL_HYPEREVM;
        const hyperevmRpcUrl = process.env.RPC_URL_HYPEREVM;
        if (hyperevmSubgraphUrl && hyperevmRpcUrl) {
            this.configs.set('hyperevm', {
                apiSlug: 'HYPEREVM',
                viemChain: hyperevm,
                subgraphUrl: hyperevmSubgraphUrl,
                rpcUrl: hyperevmRpcUrl,
            });
        }
    }

    public getChainConfig(chainSlug: string): ChainConfig {
        const config = this.configs.get(chainSlug.toLowerCase());
        if (!config) {
            throw new Error(
                `Unsupported chain: ${chainSlug}. Supported chains: ${Array.from(this.configs.keys()).join(', ')}`,
            );
        }
        return config;
    }

    public getSupportedChains(): string[] {
        return Array.from(this.configs.keys());
    }
}
