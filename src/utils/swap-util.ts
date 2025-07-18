// Utility functions for swap calculations

// Calculate price from two amounts
export function calculatePrice(amount0: string, amount1: string): string {
    const amt0 = parseFloat(amount0);
    const amt1 = parseFloat(amount1);

    // Handle invalid inputs
    if (isNaN(amt0) || isNaN(amt1)) {
        return '0';
    }

    // Handle zero amounts
    if (amt0 === 0 || amt1 === 0) {
        return '0';
    }

    // Calculate price as amount1 / amount0 (how much of token1 per token0)
    const price = amt1 / amt0;

    // Handle edge cases
    if (!isFinite(price) || isNaN(price)) {
        return '0';
    }

    return price.toString();
}

// Calculate reserves for a pair from pool token balances
export function calculateReserves(
    poolTokens: Array<{ address: string; balance: string }>,
    asset0Id: string,
    asset1Id: string,
): [string, string] | null {
    const asset0Balance = poolTokens.find((pt) => pt.address.toLowerCase() === asset0Id.toLowerCase())?.balance;
    const asset1Balance = poolTokens.find((pt) => pt.address.toLowerCase() === asset1Id.toLowerCase())?.balance;

    if (asset0Balance === undefined || asset1Balance === undefined) {
        return null;
    }

    return [asset0Balance, asset1Balance];
}
