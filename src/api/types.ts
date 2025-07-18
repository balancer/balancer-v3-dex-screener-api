// API response types for DEX Screener adapter

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: number;
}

export interface LatestBlockResponse {
    blockNumber: number;
    blockTimestamp: number; // Unix timestamp in UTC
}

export interface AssetResponse {
    id: string;
    name: string;
    symbol: string;
    totalSupply?: string | number;
    circulatingSupply?: string | number;
    coinGeckoId?: string;
    coinMarketCapId?: string;
    metadata?: Record<string, string>;
}

export interface PairResponse {
    id: string;
    dexKey: string | null;
    feeBps: number | null;
    asset0Id: string;
    asset1Id: string;
    creationBlockNumber: number | null;
    creationBlockTimestamp: number | null; // Unix timestamp in UTC
    creationTxnId: string | null;
    creator: string | null;
    pool?: {
        id: string;
        name: string;
        assetIds: string[];
        pairIds: string[];
        metadata?: Record<string, string>;
    };
}

export interface SwapEvent {
    block: {
        blockNumber: number;
        blockTimestamp: number; // Unix timestamp in UTC
    };
    eventType: 'swap';
    txnId: string;
    txnIndex: number;
    eventIndex: number;
    maker: string;
    pairId: string;
    asset0In?: string;
    asset1Out?: string;
    asset0Out?: string;
    asset1In?: string;
    priceNative: string;
    reserves: {
        asset0: string;
        asset1: string;
    } | null;
}

export interface JoinExitEvent {
    block: {
        blockNumber: number;
        blockTimestamp: number; // Unix timestamp in UTC
    };
    eventType: 'join' | 'exit';
    txnId: string;
    txnIndex: number;
    eventIndex: number;
    maker: string;
    pairId: string;
    amount0: string;
    amount1: string;
    reserves: {
        asset0: string;
        asset1: string;
    } | null;
}

export interface EventsResponse {
    events: (SwapEvent | JoinExitEvent)[];
}
