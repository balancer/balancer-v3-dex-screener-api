// GraphQL types based on the subgraph schema

export interface SubgraphSwap {
    id: string;
    pool: string;
    tokenIn: string;
    tokenOut: string;
    tokenAmountIn: string;
    tokenAmountOut: string;
    user: SubgraphUser;
    blockNumber: string;
    blockTimestamp: string;
    transactionHash: string;
    logIndex: string;
}

export interface SubgraphAddRemove {
    id: string;
    type: 'ADD' | 'REMOVE';
    sender: string;
    amounts: string[];
    pool: SubgraphPool;
    user: SubgraphUser;
    blockNumber: string;
    blockTimestamp: string;
    transactionHash: string;
    logIndex: string;
}

export interface SubgraphPool {
    id: string;
    address: string;
    name: string;
    symbol: string;
    swapFee: string;
    blockNumber: string;
    blockTimestamp: string;
    transactionHash: string;
    poolCreator: string;
    tokens: SubgraphPoolToken[];
}

export interface SubgraphPoolToken {
    name: string;
    symbol: string;
    decimals: number;
    address: string;
    balance: string;
}

export interface SubgraphUser {
    id: string;
}

// Query result types
export interface SwapsQuery {
    swaps: SubgraphSwap[];
}

export interface AddRemovesQuery {
    addRemoves: SubgraphAddRemove[];
}

export interface PoolsQuery {
    pools: SubgraphPool[];
}
