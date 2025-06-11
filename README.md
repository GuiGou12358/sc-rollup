# Verifiable Offchain Rollup

Verifiable Offchain Rollup is a SDK designed to simplify the process of connecting off-chain rollup, deployed on Phala Cloud, to a wide range of blockchains. Its primary focus is on providing transactional and atomic cross-blockchain operations for seamless integration and interaction.

## Table of Contents

- [The Challenge](#the-challenge)
- [Key Benefits](#key-benefits)
- [Getting Started](#getting-started)

## The Challenge

Developing dApps that interact with blockchains can be a common but challenging task, especially when it comes to handling concurrency issues in off-chain programs.
Without a proper synchronization mechanism, this may end up conflicting between the contracts and dApp deployed on Phala Cloud.

Consider a real-world scenario: a smart contract distributes computation tasks to workers. These workers compete with each other when claiming tasks from the blockchain. Ideally, each task should only be claimed once. However, without coordination among the workers, they might send transactions simultaneously to claim the same task, resulting in inconsistent smart contract states.

Consistent state management is crucial when developing an application that communicates with a blockchain. Developers need a reliable and transactional way to perform operations, where read and write tasks are combined into a single unit and executed atomically on the blockchain. This approach aligns with the ACID principle found in transactional database management systems.

The sdk is here to simplify development by providing a stable, ACID-compliant connection with ink! smart contracts. This eliminates concurrency issues and enables a request-response programming model for seamless interaction between the workers and on-chain smart contracts.

## Key Benefits

- Seamless connectivity between evm/ink! smart contracts and workers
- Reliable KV-store on blockchains for durable state management
- Transactional (ACID) on-chain KV-store designed for stateful dApps deployed on Phala Cloud
- ACID-compliant read, write, and contract call operations for consistent data handling
- Request-response programming model that simplifies interactions between worker and on-chain smart contracts

## Getting Started

![communication-contracts.png](../assets/verifiable_offchain_computing/communication-contracts.png)

To successfully use the Verifiable Offchain Rollup, follow these three steps illustrated in the diagram:

1. Build the evm or wasm contract with the sc-rollup-client and deploy it on the target blockchain.
2. Use the sc-rollup-api to build the off-chain rollup and connect with your smart contract.
3. Deploy the off-chain rollup in Phala Cloud to enable verifiable off-chain computing capabilities through Phala Cloud's Trusted Execution Environment (TEE)

