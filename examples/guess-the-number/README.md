# Guess The Number - Game Example

Example of the game 'Guess The Number' implemented with an `ink! smart contract` and a `verifiable offchain worker` that uses a VRF (Verifiable Random Function) to compute the target number.

The `ink! smart contract` manages the game:
 - start a new game
 - register the guess made by the user

The worker:
 - reads  the on-chain data from the `ink! smart contract`
 - uses a `VRF` to compute the target number
 - send the clue (Lower than or Greater than or Equals to) to the `ink! smart contract`
 - is deployed on [Phala Cloud](https://cloud.phala.network/)


## Deploy the smart contract (ink! v6 - PolkaVM)

Build the [contract](ink-v6-contracts) or use the [artifact](ink-v6-contracts/artifacts) adn then deploy it on a Substrate node with `revive` pallet.

For testing, the contract `0x22851ec2D16c25e83bFdf8d538bcD24e09b34b0e` is deployed on PAsset Hub (testnet). 

## Configure the smart contracts

Configure the attestor (ie the address granted to send the prices).

```bash
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message AccessControl::grant_role --args 2852625541 <attestor-address> --suri //Alice --execute
```
In the contracts deployed for testing purpose, `Bob` is granted as attestor.

## Deploy the worker on local or Phala Cloud

All information [here](worker-phala-cloud/README.md)

## Deploy the UI to display the price

Here is a UI example: https://github.com/GuiGou12358/guess-the-number-ui
