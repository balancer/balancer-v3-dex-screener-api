import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { calculatePrice, calculateReserves } from './swap-util';

describe('Swap Utility Functions', () => {
    describe('calculatePrice', () => {
        it('should calculate price correctly for normal amounts', () => {
            const price = calculatePrice('1000000000000000000', '2000000000000000000');
            expect(price).toBe('2');
        });

        it('should calculate price for fractional amounts', () => {
            const price = calculatePrice('1500000000000000000', '1000000000000000000');
            expect(price).toBe('0.6666666666666666');
        });

        it('should handle very small amounts', () => {
            const price = calculatePrice('1', '2');
            expect(price).toBe('2');
        });

        it('should handle very large amounts', () => {
            const price = calculatePrice('1000000000000000000000000', '2000000000000000000000000');
            expect(price).toBe('2');
        });

        it('should handle zero input amount', () => {
            const price = calculatePrice('0', '1000000000000000000');
            expect(price).toBe('0');
        });

        it('should handle zero output amount', () => {
            const price = calculatePrice('1000000000000000000', '0');
            expect(price).toBe('0');
        });

        it('should handle both zero amounts', () => {
            const price = calculatePrice('0', '0');
            expect(price).toBe('0');
        });

        it('should handle string numbers with decimals', () => {
            const price = calculatePrice('1500000000000000000', '3000000000000000000');
            expect(price).toBe('2');
        });

        it('should handle precision correctly', () => {
            const price = calculatePrice('1', '3');
            expect(price).toBe('3');
        });

        it('should handle very precise calculations', () => {
            const price = calculatePrice('1000000000000000000', '1000000000000000001');
            expect(price).toBe('1');
        });

        it('should handle invalid input gracefully', () => {
            expect(calculatePrice('', '1000000000000000000')).toBe('0');
            expect(calculatePrice('1000000000000000000', '')).toBe('0');
            expect(calculatePrice('invalid', '1000000000000000000')).toBe('0');
            expect(calculatePrice('1000000000000000000', 'invalid')).toBe('0');
        });
    });

    describe('calculateReserves', () => {
        const mockTokens = [
            {
                id: '1',
                address: '0xtoken1111111111111111111111111111111111111111',
                name: 'Token 1',
                symbol: 'TK1',
                decimals: 18,
                balance: '1000000000000000000',
            },
            {
                id: '2',
                address: '0xtoken2222222222222222222222222222222222222222',
                name: 'Token 2',
                symbol: 'TK2',
                decimals: 18,
                balance: '2000000000000000000',
            },
            {
                id: '3',
                address: '0xtoken3333333333333333333333333333333333333333',
                name: 'Token 3',
                symbol: 'TK3',
                decimals: 18,
                balance: '3000000000000000000',
            },
        ];

        it('should calculate reserves for valid token pair', () => {
            const reserves = calculateReserves(
                mockTokens,
                '0xtoken1111111111111111111111111111111111111111',
                '0xtoken2222222222222222222222222222222222222222',
            );

            expect(reserves).toEqual(['1000000000000000000', '2000000000000000000']);
        });

        it('should calculate reserves in reverse order', () => {
            const reserves = calculateReserves(
                mockTokens,
                '0xtoken2222222222222222222222222222222222222222',
                '0xtoken1111111111111111111111111111111111111111',
            );

            expect(reserves).toEqual(['2000000000000000000', '1000000000000000000']);
        });

        it('should handle case insensitive addresses', () => {
            const reserves = calculateReserves(
                mockTokens,
                '0xTOKEN1111111111111111111111111111111111111111',
                '0xTOKEN2222222222222222222222222222222222222222',
            );

            expect(reserves).toEqual(['1000000000000000000', '2000000000000000000']);
        });

        it('should return null for non-existent asset0', () => {
            const reserves = calculateReserves(
                mockTokens,
                '0xnonexistent111111111111111111111111111111111',
                '0xtoken2222222222222222222222222222222222222222',
            );

            expect(reserves).toBeNull();
        });

        it('should return null for non-existent asset1', () => {
            const reserves = calculateReserves(
                mockTokens,
                '0xtoken1111111111111111111111111111111111111111',
                '0xnonexistent222222222222222222222222222222222',
            );

            expect(reserves).toBeNull();
        });

        it('should return null for both non-existent assets', () => {
            const reserves = calculateReserves(
                mockTokens,
                '0xnonexistent111111111111111111111111111111111',
                '0xnonexistent222222222222222222222222222222222',
            );

            expect(reserves).toBeNull();
        });

        it('should handle empty token array', () => {
            const reserves = calculateReserves(
                [],
                '0xtoken1111111111111111111111111111111111111111',
                '0xtoken2222222222222222222222222222222222222222',
            );

            expect(reserves).toBeNull();
        });

        it('should handle same asset IDs', () => {
            const reserves = calculateReserves(
                mockTokens,
                '0xtoken1111111111111111111111111111111111111111',
                '0xtoken1111111111111111111111111111111111111111',
            );

            expect(reserves).toEqual(['1000000000000000000', '1000000000000000000']);
        });

        it('should handle zero balances', () => {
            const tokensWithZeroBalance = [
                {
                    ...mockTokens[0],
                    balance: '0',
                },
                {
                    ...mockTokens[1],
                    balance: '0',
                },
            ];

            const reserves = calculateReserves(
                tokensWithZeroBalance,
                '0xtoken1111111111111111111111111111111111111111',
                '0xtoken2222222222222222222222222222222222222222',
            );

            expect(reserves).toEqual(['0', '0']);
        });

        it('should handle very large balances', () => {
            const tokensWithLargeBalance = [
                {
                    ...mockTokens[0],
                    balance: '1000000000000000000000000000000000000000',
                },
                {
                    ...mockTokens[1],
                    balance: '2000000000000000000000000000000000000000',
                },
            ];

            const reserves = calculateReserves(
                tokensWithLargeBalance,
                '0xtoken1111111111111111111111111111111111111111',
                '0xtoken2222222222222222222222222222222222222222',
            );

            expect(reserves).toEqual([
                '1000000000000000000000000000000000000000',
                '2000000000000000000000000000000000000000',
            ]);
        });

        it('should handle malformed balances', () => {
            const tokensWithMalformedBalance = [
                {
                    ...mockTokens[0],
                    balance: 'invalid',
                },
                {
                    ...mockTokens[1],
                    balance: '',
                },
            ];

            const reserves = calculateReserves(
                tokensWithMalformedBalance,
                '0xtoken1111111111111111111111111111111111111111',
                '0xtoken2222222222222222222222222222222222222222',
            );

            expect(reserves).toEqual(['invalid', '']);
        });

        it('should handle mixed case in token addresses', () => {
            const mixedCaseTokens = [
                {
                    ...mockTokens[0],
                    address: '0xTOKEN1111111111111111111111111111111111111111',
                },
                {
                    ...mockTokens[1],
                    address: '0xtoken2222222222222222222222222222222222222222',
                },
            ];

            const reserves = calculateReserves(
                mixedCaseTokens,
                '0xtoken1111111111111111111111111111111111111111',
                '0xTOKEN2222222222222222222222222222222222222222',
            );

            expect(reserves).toEqual(['1000000000000000000', '2000000000000000000']);
        });
    });

    describe('Edge Cases and Performance', () => {
        it('should handle very long token arrays efficiently', () => {
            const manyTokens = Array.from({ length: 1000 }, (_, i) => ({
                id: `${i + 1}`,
                address: `0xtoken${i.toString().padStart(39, '0')}`,
                name: `Token ${i + 1}`,
                symbol: `TK${i + 1}`,
                decimals: 18,
                balance: `${(i + 1) * 1000000000000000000}`,
            }));

            const startTime = performance.now();
            const reserves = calculateReserves(
                manyTokens,
                '0xtoken000000000000000000000000000000000000000',
                '0xtoken000000000000000000000000000000000000999',
            );
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
            expect(reserves).toEqual(['1000000000000000000', '1e+21']);
        });

        it('should handle extreme price calculations', () => {
            // Very small amount in, large amount out
            const price1 = calculatePrice('1', '1000000000000000000000000');
            expect(price1).toBe('1e+24');

            // Very large amount in, small amount out
            const price2 = calculatePrice('1000000000000000000000000', '1');
            expect(price2).toBe('1.0000000000000001e-24');
        });

        it('should handle scientific notation in balances', () => {
            const scientificTokens = [
                {
                    id: '1',
                    address: '0xtoken1111111111111111111111111111111111111111',
                    name: 'Token 1',
                    symbol: 'TK1',
                    decimals: 18,
                    balance: '1e18',
                },
                {
                    id: '2',
                    address: '0xtoken2222222222222222222222222222222222222222',
                    name: 'Token 2',
                    symbol: 'TK2',
                    decimals: 18,
                    balance: '2e18',
                },
            ];

            const reserves = calculateReserves(
                scientificTokens,
                '0xtoken1111111111111111111111111111111111111111',
                '0xtoken2222222222222222222222222222222222222222',
            );

            expect(reserves).toEqual(['1e18', '2e18']);
        });
    });
});
