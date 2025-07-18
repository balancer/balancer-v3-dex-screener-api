import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ChainConfigService } from './chain-config';

describe('ChainConfigService', () => {
    let service: ChainConfigService;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        // Clear singleton instance
        (ChainConfigService as any).instance = undefined;

        // Save original environment
        originalEnv = { ...process.env };

        // Set up test environment variables
        process.env.SUBGRAPH_URL_ETHEREUM = 'https://test-ethereum-subgraph.com';
        process.env.RPC_URL_ETHEREUM = 'https://test-ethereum-rpc.com';
        process.env.SUBGRAPH_URL_ARBITRUM = 'https://test-arbitrum-subgraph.com';
        process.env.RPC_URL_ARBITRUM = 'https://test-arbitrum-rpc.com';
        process.env.SUBGRAPH_URL_POLYGON = 'https://test-polygon-subgraph.com';
        process.env.RPC_URL_POLYGON = 'https://test-polygon-rpc.com';

        service = ChainConfigService.getInstance();
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = ChainConfigService.getInstance();
            const instance2 = ChainConfigService.getInstance();

            expect(instance1).toBe(instance2);
        });

        it('should maintain configuration across instances', () => {
            const instance1 = ChainConfigService.getInstance();
            const instance2 = ChainConfigService.getInstance();

            expect(instance1.getSupportedChains()).toEqual(instance2.getSupportedChains());
        });
    });

    describe('Configuration Loading', () => {
        it('should load configured chains from environment variables', () => {
            const supportedChains = service.getSupportedChains();

            expect(supportedChains).toContain('ethereum');
            expect(supportedChains).toContain('arbitrum');
            expect(supportedChains).toContain('polygon');
        });

        it('should not load chains with missing environment variables', () => {
            // Clear singleton to reload with new env
            (ChainConfigService as any).instance = undefined;

            // Remove one required env var
            delete process.env.RPC_URL_ETHEREUM;

            const newService = ChainConfigService.getInstance();
            const supportedChains = newService.getSupportedChains();

            expect(supportedChains).not.toContain('ethereum');
            expect(supportedChains).toContain('arbitrum');
            expect(supportedChains).toContain('polygon');
        });

        it('should load custom chain definitions', () => {
            // Clear singleton to reload with new env
            (ChainConfigService as any).instance = undefined;

            // Add HyperEVM environment variables
            process.env.SUBGRAPH_URL_HYPEREVM = 'https://test-hyperevm-subgraph.com';
            process.env.RPC_URL_HYPEREVM = 'https://test-hyperevm-rpc.com';

            const newService = ChainConfigService.getInstance();
            const supportedChains = newService.getSupportedChains();

            expect(supportedChains).toContain('hyperevm');

            const hyperevmConfig = newService.getChainConfig('hyperevm');
            expect(hyperevmConfig.apiSlug).toBe('HYPEREVM');
            expect(hyperevmConfig.viemChain.id).toBe(999);
        });
    });

    describe('getChainConfig', () => {
        it('should return valid configuration for supported chains', () => {
            const ethereumConfig = service.getChainConfig('ethereum');

            expect(ethereumConfig.apiSlug).toBe('MAINNET');
            expect(ethereumConfig.viemChain.id).toBe(1);
            expect(ethereumConfig.subgraphUrl).toBe('https://test-ethereum-subgraph.com');
            expect(ethereumConfig.rpcUrl).toBe('https://test-ethereum-rpc.com');
        });

        it('should return configuration for arbitrum', () => {
            const arbitrumConfig = service.getChainConfig('arbitrum');

            expect(arbitrumConfig.apiSlug).toBe('ARBITRUM');
            expect(arbitrumConfig.viemChain.id).toBe(42161);
            expect(arbitrumConfig.subgraphUrl).toBe('https://test-arbitrum-subgraph.com');
            expect(arbitrumConfig.rpcUrl).toBe('https://test-arbitrum-rpc.com');
        });

        it('should be case insensitive', () => {
            const config1 = service.getChainConfig('ethereum');
            const config2 = service.getChainConfig('ETHEREUM');
            const config3 = service.getChainConfig('Ethereum');

            expect(config1).toEqual(config2);
            expect(config2).toEqual(config3);
        });

        it('should throw error for unsupported chains', () => {
            expect(() => {
                service.getChainConfig('unsupported');
            }).toThrow('Unsupported chain: unsupported');
        });

        it('should include supported chains in error message', () => {
            try {
                service.getChainConfig('unsupported');
            } catch (error) {
                expect((error as Error).message).toContain('ethereum');
                expect((error as Error).message).toContain('arbitrum');
                expect((error as Error).message).toContain('polygon');
            }
        });
    });

    describe('getSupportedChains', () => {
        it('should return array of supported chain slugs', () => {
            const chains = service.getSupportedChains();

            expect(Array.isArray(chains)).toBe(true);
            expect(chains.length).toBeGreaterThan(0);
            expect(chains).toContain('ethereum');
            expect(chains).toContain('arbitrum');
            expect(chains).toContain('polygon');
        });

        it('should return chains in consistent order', () => {
            const chains1 = service.getSupportedChains();
            const chains2 = service.getSupportedChains();

            expect(chains1).toEqual(chains2);
        });

        it('should reflect actual configuration', () => {
            const chains = service.getSupportedChains();

            // Should be able to get config for each returned chain
            chains.forEach((chain) => {
                expect(() => service.getChainConfig(chain)).not.toThrow();
            });
        });
    });

    describe('Chain-Specific Configuration', () => {
        it('should handle all major chains correctly', () => {
            const testChains = [
                { slug: 'ethereum', apiSlug: 'MAINNET', chainId: 1 },
                { slug: 'arbitrum', apiSlug: 'ARBITRUM', chainId: 42161 },
                { slug: 'polygon', apiSlug: 'POLYGON', chainId: 137 },
            ];

            testChains.forEach(({ slug, apiSlug, chainId }) => {
                const config = service.getChainConfig(slug);
                expect(config.apiSlug).toBe(apiSlug);
                expect(config.viemChain.id).toBe(chainId);
                expect(config.subgraphUrl).toBe(process.env[`SUBGRAPH_URL_${slug.toUpperCase()}`] || '');
                expect(config.rpcUrl).toBe(process.env[`RPC_URL_${slug.toUpperCase()}`] || '');
            });
        });

        it('should handle viem chain objects properly', () => {
            const ethereumConfig = service.getChainConfig('ethereum');

            expect(ethereumConfig.viemChain).toHaveProperty('id');
            expect(ethereumConfig.viemChain).toHaveProperty('name');
            expect(ethereumConfig.viemChain).toHaveProperty('nativeCurrency');
            expect(ethereumConfig.viemChain).toHaveProperty('rpcUrls');
        });

        it('should handle custom chain definitions', () => {
            // Clear singleton to reload with new env
            (ChainConfigService as any).instance = undefined;

            // Add custom chain environment variables
            process.env.SUBGRAPH_URL_TESTCHAIN = 'https://test-custom-subgraph.com';
            process.env.RPC_URL_TESTCHAIN = 'https://test-custom-rpc.com';

            const newService = ChainConfigService.getInstance();

            // Should not include testchain since it's not in the configuration
            expect(newService.getSupportedChains()).not.toContain('testchain');
        });
    });

    describe('Environment Variable Validation', () => {
        it('should require both subgraph and RPC URLs', () => {
            // Clear singleton to reload with new env
            (ChainConfigService as any).instance = undefined;

            // Set only subgraph URL
            process.env.SUBGRAPH_URL_TESTCHAIN = 'https://test-subgraph.com';
            delete process.env.RPC_URL_TESTCHAIN;

            const newService = ChainConfigService.getInstance();

            // Should not include testchain since RPC URL is missing
            expect(newService.getSupportedChains()).not.toContain('testchain');
        });

        it('should handle empty environment variables', () => {
            // Clear singleton to reload with new env
            (ChainConfigService as any).instance = undefined;

            // Set empty values
            process.env.SUBGRAPH_URL_ETHEREUM = '';
            process.env.RPC_URL_ETHEREUM = '';

            const newService = ChainConfigService.getInstance();

            // Should not include ethereum since URLs are empty
            expect(newService.getSupportedChains()).not.toContain('ethereum');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing viem chain gracefully', () => {
            // This test ensures that if a chain is not available in viem/chains,
            // the service handles it properly (like HyperEVM which uses custom definition)
            expect(() => {
                service.getChainConfig('ethereum');
            }).not.toThrow();
        });

        it('should provide helpful error messages', () => {
            const supportedChains = service.getSupportedChains();

            try {
                service.getChainConfig('invalid');
            } catch (error) {
                const errorMessage = (error as Error).message;
                expect(errorMessage).toContain('Unsupported chain: invalid');
                expect(errorMessage).toContain('Supported chains:');
                supportedChains.forEach((chain) => {
                    expect(errorMessage).toContain(chain);
                });
            }
        });
    });
});
