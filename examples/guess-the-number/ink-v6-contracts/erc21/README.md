# ERC-721 - ink! v6 (PolkaVM) contract

This is an example of ERC-721 Token implementation. 
The source code was copied from https://github.com/use-ink/ink-examples/ and slightly updated.

When the ERC-721 is minted, an attribute called `max_attempts` is defined.
This attribute is used by the worker (by reading an indexer) to determine the maximum number of attempts the user has to find the number in the "Guess The Number" game.

If the user does not own any NFT, they are granted 3 attempts by default.
If the user owns multiple NFTs, the highest value among them is assigned.

## Build

To build the contract:

```bash
cargo contract build
```

## Run the tests

To run the tests:

```bash
cargo test
```
