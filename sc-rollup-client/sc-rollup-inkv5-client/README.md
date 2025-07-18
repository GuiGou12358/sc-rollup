# Smart Contract Rollup Client built with ink! v5 (WASM)

## Introduction

⚡️ use.ink helps you easily build safe, efficient smart contracts for Polkadot and Substrate-based blockchains.

🚀 Write smart contracts in ink!, a domain-specific language built on top of Rust — combining safety, performance, and scalability.

🛠 Use familiar Rust tooling like clippy, cargo, crates from crates.io, and popular IDEs for a seamless development experience.

Please read the full documentation to learn more about ink! : https://use.ink/

## Pre-condition

- Rust >= 1.81
- cargo-contract v5.x.x


## `inkv5_client_lib` crate

This library helps you to build off-chain rollup client for ink! smart contract deployed on the `contract` pallet.
It provides the following features:
- `AccessControl`: Access control management
- `KvStore`: key-value store that allows off-chain rollup to perform read/write operations.
- `MessageQueue`: Message Queue, enabling a request-response programming model for the smart-contract while ensuring that each request received exactly one response. It uses the KV Store to save the messages.
- `RollupClient`: Use the kv-store and the message queue to allow off-chain rollup transactions.
- `MetaTransaction`: Allow the off-chain rollup to do transactions without paying the gas fee. The fee will be paid by a third party (the relayer).

[Here is the full documentation about the library](./ink_client_lib)

## 'ink_client_example' smart contract

[This smart contract](./ink_client_example) is an example of using the `inkv5_client_lib` crate.

## 'integration_tests' folder

[This folder](./integration_tests) contains the integrations tests of the contract and library.