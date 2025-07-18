# Smart Contract Rollup API

Use this api in your worker to perform transactional and atomic operations for seamless integration and interaction with your contract.
- the [core](packages/core) package contains the common logic to interact with any contract.
- the [evm](packages/evm) package contains the implementation for EVM contract using the `ethers` lib.
- the [ink-v5](packages/ink-v5) package contains the implementation for WASM contract (ink! v5) using the `papi` lib.
- the [ink-v6](packages/ink-v6) package contains the implementation for PolkaVM contract (ink! v6) using the `papi` lib.
- the [ink-v5-papi-descriptors](packages/ink-v5-papi-descriptors) and [ink-v6-papi-descriptors](packages/ink-v5-papi-descriptors) packages contain the contract descriptors required by `papi` lib.


## Install

```
pnpm install
```

## Build

```
pnpm build
```

## Test

1. Copy `ink-v5\.env_shibuya` as `ink-v5\.env` if you haven't done it before. It tells the worker to connect to [the contract](../sc-rollup-client/sc-rollup-inkv5-client) you have created and deployed on Shibuya.
2. Copy `ink-v6\.env_paseo` as `ink-v6\.env` if you haven't done it before. It tells the worker to connect to [the contract](../sc-rollup-client/sc-rollup-inkv6-client) you have created and deployed on Pop.
3. Run the tests:
```
pnpm test
```


# Integration for contracts written with ink! v5 (WASM) or ink! v6 (PolkaVM)

## Add imports (ink! v6)

Import the libraries in your `package.json` file

```
  "dependencies": {
    "@guigou/sc-rollup-core": "...",
    "@guigou/sc-rollup-ink-v6": "...",
  }
```

## Add imports (ink! v5)

Import the libraries in your `package.json` file

```
  "dependencies": {
    "@guigou/sc-rollup-core": "...",
    "@guigou/sc-rollup-ink-v5": "...",
  }
```

## Create the client 

Use the `InkClient` constructor to create a new client instance with the following parameters:
- `rpc` : the endpoint to reach the contract address (string - mandatory).
- `addrress` : the contract address  (string - mandatory).
- `attestorPk` : the private key used to sign the message. Its address must be granted as attestor in the contract.  (string - mandatory).
- `senderPk` : If you want to separate the sender and the attestor, you can provide a different private key to send the message. In this case the ecdsa address of attestor must be granted in the contract. If no sender key is provided, the attestor key will be used to send the message (string - optional).
- `requestMessageCodec` : the `Codec` from `scale-ts` lib to read the message from the contract's queue.
- `responseMessageCodec` : the `Codec` from `scale-ts` lib to write the message sent to the contract.

```js
const client = new InkClient(
    rpc,
    address,
    attestorPk,
    senderPk,
    requestMessageCodec,
    responseMessageCodec,
)
```

Here is an example of Codec to encode/decode the `RequestMessage` enum message.
```js
/*
    enum RequestMessage {
        NewTradingPair {
            /// id of the trading pair
            trading_pair_id: TradingPairId,
            /// trading pair like 'polkadot/usd' => token0: 'polkadot' , 'token1' : 'usd'
            token0: String,
            token1: String,
        },
        RemoveTradingPair {
            /// id of the trading pair
            trading_pair_id: TradingPairId,
        },
    }
 */

import {Enum, str, Struct, u32} from "scale-ts"

const requestMessageCodec = Enum({
    NewTradingPair: Struct({
        tradingPairId: u32,
        tokenA: str,
        tokenB: str,
    }),
    RemoveTradingPair: Struct({
        tradingPairId: u32,
    }),
})
```

Here is an example of Codec to encode/decode the `ResponseMessage` enum message.
```js
/*
    enum ResponseMessage {
        PriceFeed {
            /// id of the trading pair
            trading_pair_id: TradingPairId,
            /// price of the trading pair
            price: u128,
        },
        Error {
            /// id of the trading pair
            trading_pair_id: TradingPairId,
            /// error when the price is read
            err_no: u128,
        },
    }
 */
const responseMessageCodec = Enum({
    PriceFeed: Struct({
        tradingPairId: u32,
        price: u128,
    }),
    Error: Struct({
        tradingPairId: u32,
        errNo: u128,
    }),
})
```

## Start - Commit/Rollback the session

Use the `startSession` and method to start the session and the `commit` method to submit all changes in a transactional way. 

```js
// start the session 
await client.startSession()

...

// commit the changes (send the transaction)
const tx = await client.commit()
```

Use the `rollback` method to cancel all ongoing changes and reset the session.

```js
await client.rollback()
```

## Read/Write the value 

```js
// start the session 
await client.startSession()

// read and write a number value
const key1 = stringToHex("key1")
const value1 = await client.getNumber(key1, "u32")
const v1 = value1.valueOf()
const newValue1 = v1 ? v1 + 1 : 1
client.setNumber(key1, newValue1, "u32")

// read and write a string value
const key2 = stringToHex("key2")
const value2 = await client.getString(key2)
const v2 = value2.valueOf()
const newValue2 = v2 ? Number(v2) + 1 : 1
client.setString(key2, newValue2.toString())

// read and write a boolean value
const key3 = stringToHex("key3")
const value3 = await client.getBoolean(key3)
const v3 = value3.valueOf()
const newValue3 = v3 == undefined ? false : !v3
client.setBoolean(key3, newValue3)

// remove a value
client.removeValue(stringToHex("key4"))

// commit the changes (send the transaction)
const tx = await client.commit()
```

## Poll the message

The `requestMessageCodec` Codec is used to decode the message from the smart contract.

```js

// Define the codec to read the message 
const requestMessageCodec = Enum({
    NewTradingPair: Struct({
        tradingPairId: u32,
        tokenA: str,
        tokenB: str,
    }),
    RemoveTradingPair: Struct({
        tradingPairId: u32,
    }),
})

// create the client 
const client = new InkClient(
    ...
    requestMessageCodec,
    ...
)

// start the session 
await client.startSession()

let message
do {
    // read the message
    message = await client.pollMessage()
    console.log("message %s", message)
    // do the action
     ...
} while (message.isSome())

// mark as read all messages
await client.commit()
```

## Push a message

The `responseMessageCodec` Codec is used to encode the message sent to the smart contract.


```js

// Define the codec to push the message 
/*
    enum ResponseMessage {
        PriceFeed {
            /// id of the trading pair
            trading_pair_id: TradingPairId,
            /// price of the trading pair
            price: u128,
        },
        Error {
            /// id of the trading pair
            trading_pair_id: TradingPairId,
            /// error when the price is read
            err_no: u128,
        },
    }
 */
const responseMessageCodec = Enum({
    PriceFeed: Struct({
        tradingPairId: u32,
        price: u128,
    }),
    Error: Struct({
        tradingPairId: u32,
        errNo: u128,
    }),
})

// start the session 
await client.startSession()

// push a message
client.addAction({
    tag: "PriceFeed",
    value: {
      tradingPairId: 1,
      price: 94024n * 1_000_000_000_000_000_000n,
    },
})

// send the transaction
await client.commit()
```
