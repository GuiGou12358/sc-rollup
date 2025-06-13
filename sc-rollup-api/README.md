# Smart Contract Rollup API

Use this api in your worker to perform transactional and atomic operations for seamless integration and interaction with your contract.
- the [core](packages/core) package contains the common code used to interact with any contract.
- the [evm](packages/evm) package contains the implementation for evm contract using the `ethers` lib.
- the [ink-v5](packages/ink-v5) package contains the implementation for wasm contract (ink! v5) using the `papi` lib.
- the [ink-v6](packages/ink-v6) package contains the implementation for wasm contract (ink! v6) using the `papi` lib.
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
2. Copy `ink-v6\.env_shibuya` as `ink-v6\.env` if you haven't done it before. It tells the worker to connect to [the contract](../sc-rollup-client/sc-rollup-inkv6-client) you have created and deployed on Pop.

```
pnpm test
```


# Integration for wasm contract

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

Use the `InkClient` constructor to create a new client instance.
- `rpc` : the endpoint to reach the contract address (string - mandatory).
- `addrress` : the contract address  (string - mandatory).
- `attestorPk` : the private key used to sign the message. Its address must be granted as attestor in the contract.  (string - mandatory).
- `senderPk` : If we want to separate the sender and the attestor, you can provide a different private key to send the message. In this case the ecdsa address of attestor must be granted in the contract. If no sender key is provided, we use the attestor key to send the message (string - optional).
- `requestMessageCodec` : the Codec to read the message from the contract's queue.
- `responseMessageCodec` : the Codec to write the message sent to the contract.

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


## Read/Write the value 

```js

```

## Poll the message

```js

```

## Push a message

```js

```

## Commit the transaction

```js

```

