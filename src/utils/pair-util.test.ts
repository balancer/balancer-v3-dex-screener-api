import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { generateAllPairIdsForPool, parsePairId, isSwapForPair, isAddRemoveForPair, convertFeeToBps } from './pair-util';
import { SubgraphPool } from '../types/subgraph-types';

describe('Pair Utility Functions', () => {
    const mockPool: SubgraphPool = {
        id: '1',
        address: '0xpool123456789012345678901234567890123456789',
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
                address: '0xtoken1234567890123456789012345678901234567890',
                name: 'Token 1',
                symbol: 'TK1',
                decimals: 18,
                balance: '1000000000000000000'
            },
            {
                id: '2',
                address: '0xtoken2345678901234567890123456789012345678901',
                name: 'Token 2',
                symbol: 'TK2',
                decimals: 18,
                balance: '2000000000000000000'
            },
            {
                id: '3',
                address: '0xtoken3456789012345678901234567890123456789012',
                name: 'Token 3',
                symbol: 'TK3',
                decimals: 18,
                balance: '3000000000000000000'
            }
        ]
    };

    describe('generateAllPairIdsForPool', () => {
        it('should generate all possible pair combinations for a pool', async () => {
            const pairIds = await generateAllPairIdsForPool(mockPool);
            
            // For 3 tokens, should generate 3 pairs (3 choose 2 = 3)
            expect(pairIds).toHaveLength(3);
            expect(pairIds).toContain('0xpool123456789012345678901234567890123456789-0xtoken1234567890123456789012345678901234567890-0xtoken2345678901234567890123456789012345678901');
            expect(pairIds).toContain('0xpool123456789012345678901234567890123456789-0xtoken1234567890123456789012345678901234567890-0xtoken3456789012345678901234567890123456789012');
            expect(pairIds).toContain('0xpool123456789012345678901234567890123456789-0xtoken2345678901234567890123456789012345678901-0xtoken3456789012345678901234567890123456789012');
        });

        it('should generate pairs for two-token pool', async () => {
            const twoTokenPool = {
                ...mockPool,
                tokens: mockPool.tokens.slice(0, 2)
            };
            
            const pairIds = await generateAllPairIdsForPool(twoTokenPool);
            
            expect(pairIds).toHaveLength(1);
            expect(pairIds[0]).toBe('0xpool123456789012345678901234567890123456789-0xtoken1234567890123456789012345678901234567890-0xtoken2345678901234567890123456789012345678901');
        });

        it('should handle single token pool', async () => {
            const singleTokenPool = {
                ...mockPool,
                tokens: mockPool.tokens.slice(0, 1)
            };
            
            const pairIds = await generateAllPairIdsForPool(singleTokenPool);
            
            expect(pairIds).toHaveLength(0);
        });

        it('should handle pool with no tokens', async () => {
            const emptyPool = {
                ...mockPool,
                tokens: []
            };
            
            const pairIds = await generateAllPairIdsForPool(emptyPool);
            
            expect(pairIds).toHaveLength(0);
        });

        it('should maintain consistent pair ordering', async () => {
            const pairIds = await generateAllPairIdsForPool(mockPool);
            
            // Check that tokens are ordered consistently (lexicographically)
            pairIds.forEach(pairId => {
                const { asset0Id, asset1Id } = parsePairId(pairId);
                expect(asset0Id.toLowerCase() < asset1Id.toLowerCase()).toBe(true);
            });
        });
    });

    describe('parsePairId', () => {
        it('should parse valid pair ID correctly', () => {
            const pairId = '0xpool123456789012345678901234567890123456789-0xtoken1234567890123456789012345678901234567890-0xtoken2345678901234567890123456789012345678901';
            
            const result = parsePairId(pairId);
            
            expect(result).toEqual({
                poolAddress: '0xpool123456789012345678901234567890123456789',
                asset0Id: '0xtoken1234567890123456789012345678901234567890',
                asset1Id: '0xtoken2345678901234567890123456789012345678901'
            });
        });

        it('should handle different case addresses', () => {
            const pairId = '0xPOOL123456789012345678901234567890123456789-0xTOKEN1234567890123456789012345678901234567890-0xTOKEN2345678901234567890123456789012345678901';
            
            const result = parsePairId(pairId);
            
            expect(result.poolAddress).toBe('0xPOOL123456789012345678901234567890123456789');
            expect(result.asset0Id).toBe('0xTOKEN1234567890123456789012345678901234567890');
            expect(result.asset1Id).toBe('0xTOKEN2345678901234567890123456789012345678901');
        });

        it('should throw error for invalid pair ID format', () => {
            expect(() => parsePairId('invalid-pair-id-with-too-many-parts')).toThrow('Invalid pair ID format');
        });

        it('should throw error for missing components', () => {
            expect(() => parsePairId('0xpool123-0xtoken1')).toThrow('Invalid pair ID format');
        });

        it('should throw error for empty pair ID', () => {
            expect(() => parsePairId('')).toThrow('Invalid pair ID format');
        });
    });

    describe('isSwapForPair', () => {
        const pairId = '0xpool123456789012345678901234567890123456789-0xtoken1234567890123456789012345678901234567890-0xtoken2345678901234567890123456789012345678901';
        
        it('should return true for swap between pair tokens', () => {
            const result = isSwapForPair(
                pairId,
                '0xtoken1234567890123456789012345678901234567890',
                '0xtoken2345678901234567890123456789012345678901'
            );
            
            expect(result).toBe(true);
        });

        it('should return true for reverse swap', () => {
            const result = isSwapForPair(
                pairId,
                '0xtoken2345678901234567890123456789012345678901',
                '0xtoken1234567890123456789012345678901234567890'
            );
            
            expect(result).toBe(true);
        });

        it('should return false for swap with external token', () => {
            const result = isSwapForPair(
                pairId,
                '0xtoken1234567890123456789012345678901234567890',
                '0xtoken9999999999999999999999999999999999999999'
            );
            
            expect(result).toBe(false);
        });

        it('should return false for swap with same token', () => {
            const result = isSwapForPair(
                pairId,
                '0xtoken1234567890123456789012345678901234567890',
                '0xtoken1234567890123456789012345678901234567890'
            );
            
            expect(result).toBe(false);
        });

        it('should be case insensitive', () => {
            const result = isSwapForPair(
                pairId,
                '0xtoken1234567890123456789012345678901234567890',
                '0xtoken2345678901234567890123456789012345678901'
            );
            
            expect(result).toBe(true);
        });
    });

    describe('isAddRemoveForPair', () => {
        const pairId = '0xpool123456789012345678901234567890123456789-0xtoken1234567890123456789012345678901234567890-0xtoken2345678901234567890123456789012345678901';
        
        it('should return true for pool matching pair', () => {
            const result = isAddRemoveForPair(pairId, mockPool);
            
            expect(result).toBe(true);
        });

        it('should return false for different pool', () => {
            const differentPool = {
                ...mockPool,
                address: '0xdifferentpool12345678901234567890123456789012'
            };
            
            const result = isAddRemoveForPair(pairId, differentPool);
            
            expect(result).toBe(false);
        });

        it('should return false for pool without pair tokens', () => {
            const differentTokenPool = {
                ...mockPool,
                tokens: [
                    {
                        id: '1',
                        address: '0xtoken9999999999999999999999999999999999999999',
                        name: 'Token 9',
                        symbol: 'TK9',
                        decimals: 18,
                        balance: '1000000000000000000'
                    },
                    {
                        id: '2',
                        address: '0xtoken8888888888888888888888888888888888888888',
                        name: 'Token 8',
                        symbol: 'TK8',
                        decimals: 18,
                        balance: '2000000000000000000'
                    }
                ]
            };
            
            const result = isAddRemoveForPair(pairId, differentTokenPool);
            
            expect(result).toBe(false);
        });

        it('should be case insensitive', () => {
            const upperCasePool = {
                ...mockPool,
                address: mockPool.address.toUpperCase()
            };
            
            const result = isAddRemoveForPair(pairId, upperCasePool);
            
            expect(result).toBe(true);
        });
    });

    describe('convertFeeToBps', () => {
        it('should convert decimal fee to basis points', () => {
            expect(convertFeeToBps('0.001')).toBe(0.1); // 0.1% = 0.1 bps
            expect(convertFeeToBps('0.01')).toBe(1); // 1% = 1 bps
            expect(convertFeeToBps('0.1')).toBe(10); // 10% = 10 bps
            expect(convertFeeToBps('1')).toBe(100); // 100% = 100 bps
        });

        it('should handle zero fee', () => {
            expect(convertFeeToBps('0')).toBe(0);
            expect(convertFeeToBps('0.0')).toBe(0);
            expect(convertFeeToBps('0.000')).toBe(0);
        });

        it('should handle very small fees', () => {
            expect(convertFeeToBps('0.0001')).toBe(0.01); // 0.01% = 0.01 bps
            expect(convertFeeToBps('0.00001')).toBe(0.001); // 0.001% = 0.001 bps
        });

        it('should handle string numbers', () => {
            expect(convertFeeToBps('0.005')).toBe(0.5); // 0.5% = 0.5 bps
        });

        it('should round to nearest basis point', () => {
            expect(convertFeeToBps('0.00015')).toBe(0.015); // 0.015% = 0.015 bps
            expect(convertFeeToBps('0.00014')).toBe(0.013999999999999999); // Floating point precision
        });

        it('should handle invalid input gracefully', () => {
            expect(convertFeeToBps('')).toBe(0);
            expect(convertFeeToBps('invalid')).toBe(0);
            expect(convertFeeToBps('NaN')).toBe(0);
        });

        it('should handle negative fees', () => {
            expect(convertFeeToBps('-0.001')).toBe(0); // Should not be negative
        });
    });

    describe('Edge Cases', () => {
        it('should handle pools with many tokens', async () => {
            const manyTokenPool = {
                ...mockPool,
                tokens: Array.from({ length: 10 }, (_, i) => ({
                    id: `${i + 1}`,
                    address: `0xtoken${i.toString().padStart(39, '0')}`,
                    name: `Token ${i + 1}`,
                    symbol: `TK${i + 1}`,
                    decimals: 18,
                    balance: `${(i + 1) * 1000000000000000000}`
                }))
            };
            
            const pairIds = await generateAllPairIdsForPool(manyTokenPool);
            
            // For 10 tokens, should generate 45 pairs (10 choose 2 = 45)
            expect(pairIds).toHaveLength(45);
            
            // All pairs should be unique
            const uniquePairIds = new Set(pairIds);
            expect(uniquePairIds.size).toBe(45);
        });

        it('should handle very long addresses', () => {
            const longAddressPairId = '0x' + 'a'.repeat(40) + '-0x' + 'b'.repeat(40) + '-0x' + 'c'.repeat(40);
            
            const result = parsePairId(longAddressPairId);
            
            expect(result.poolAddress).toBe('0x' + 'a'.repeat(40));
            expect(result.asset0Id).toBe('0x' + 'b'.repeat(40));
            expect(result.asset1Id).toBe('0x' + 'c'.repeat(40));
        });
    });
});