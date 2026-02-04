# Guess The Number - Game Example

## Overview

**Guess The Number** is a game where users attempt to guess a randomly generated number.  
The randomness is provided by a **Verifiable Random Function (VRF)**, ensuring fairness and transparency.

The number of attempts a player is allowed depends on the **NFTs hold by the player** (Graph Api Oracle). Each NFT defines a maximum number of attempts through a specific attribute.

It's implemented with two `ink! smart contracts` and a `verifiable offchain worker` and a `squid indexer`.

The first `ink! smart contract` is an example implementation of ERC-721 (NFT) standard. Each NFT has a unique indetifier and an attribute 'max attempts'.

The second `ink! smart contract` manages the game:
 - start a new game
 - register the guess made by the user
 - communicate with the worker

The worker:
 - reads  the on-chain data from the `ink! smart contract`
 - uses a `VRF` to compute the target number
 - query the indexer to determine the maximum number of attempts available to the user. This number depends on the NFTs held by the user’s address. If no NFTs are owned by the address, the default number of attempts is 3.
 - send the clue (Lower than or Greater than or Equals to) to the `ink! smart contract`
 - is deployed on [Phala Cloud](https://cloud.phala.network/)


## Deploy the smart contract (ink! v6 - PolkaVM) - Game

Build the [contract](ink-v6-contracts/game) or use the [artifact](ink-v6-contracts/artifacts) adn then deploy it on a Substrate node with `revive` pallet.

For testing, the contract `0x987b94aaff6c60d10002d76f7ec2fe3fef837559` is deployed on a development node (wss://query.substrate.fi/guess-the-number-node). 

## Deploy the smart contract (ink! v6 - PolkaVM) - ERC-721 

Build the [contract](ink-v6-contracts/erc721) or use the [artifact](ink-v6-contracts/artifacts) adn then deploy it on a Substrate node with `revive` pallet.

For testing, the contract `0xeb3c4a6d9dd4b62eca09f87e5de151f37c02c2e7` is deployed on a development node (wss://query.substrate.fi/guess-the-number-node).


## Deploy the worker on local or Phala Cloud
     
All information [here](worker-phala-cloud/README.md)

## Graph Indexer

A squid indexer is deployed here: https://query2.substrate.fi/squid-guess/graphql
GitHub: https://github.com/LuckyDapp/squid-guess

## UI

Here is a UI example: https://guess.substrate.fi/
GitHub: https://github.com/LuckyDapp/guess-ui
