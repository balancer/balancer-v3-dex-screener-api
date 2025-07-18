import { gql } from 'graphql-request';

export const SWAPS_QUERY = gql`
    query GetSwaps($first: Int!, $id_gt: String!, $fromBlock: BigInt!, $toBlock: BigInt!) {
        swaps(
            first: $first
            orderBy: id
            orderDirection: asc
            where: { id_gt: $id_gt, blockNumber_gte: $fromBlock, blockNumber_lte: $toBlock }
        ) {
            id
            pool
            tokenIn
            tokenOut
            tokenAmountIn
            tokenAmountOut
            user {
                id
            }
            blockNumber
            blockTimestamp
            transactionHash
            logIndex
        }
    }
`;

export const ADD_REMOVES_QUERY = gql`
    query GetAddRemoves($first: Int!, $id_gt: String!, $fromBlock: BigInt!, $toBlock: BigInt!) {
        addRemoves(
            first: $first
            orderBy: id
            orderDirection: asc
            where: { id_gt: $id_gt, blockNumber_gte: $fromBlock, blockNumber_lte: $toBlock }
        ) {
            id
            type
            sender
            amounts
            pool {
                id
                address
                name
                symbol
                swapFee
                tokens {
                    name
                    symbol
                    decimals
                    address
                    balance
                    index
                }
            }
            user {
                id
            }
            blockNumber
            blockTimestamp
            transactionHash
            logIndex
        }
    }
`;

export const POOLS_QUERY = gql`
    query GetPools($first: Int!, $skip: Int!, $poolIds: [Bytes!]) {
        pools(first: $first, skip: $skip, where: { id_in: $poolIds }) {
            id
            address
            name
            symbol
            swapFee
            blockNumber
            blockTimestamp
            transactionHash
            poolCreator
            tokens {
                name
                symbol
                decimals
                address
                balance
                index
            }
        }
    }
`;

export const POOL_QUERY = gql`
    query GetPool($poolId: Bytes!) {
        pool(id: $poolId) {
            id
            address
            name
            symbol
            swapFee
            blockNumber
            blockTimestamp
            transactionHash
            poolCreator
            tokens {
                name
                symbol
                decimals
                address
                balance
                index
            }
        }
    }
`;

export const POOL_QUERY_AT_BLOCK = gql`
    query GetPool($poolId: Bytes!, $blockNumber: Int) {
        pool(id: $poolId, block: { number: $blockNumber }) {
            id
            address
            name
            symbol
            swapFee
            blockNumber
            blockTimestamp
            transactionHash
            poolCreator
            tokens {
                name
                symbol
                decimals
                address
                balance
                index
            }
        }
    }
`;

export const LATEST_BLOCK_QUERY = gql`
    query GetLatestBlock {
        _meta {
            block {
                number
                timestamp
                hash
            }
        }
    }
`;
