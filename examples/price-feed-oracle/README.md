# Price Feed Oracle Example

Example of `ink! smart contract` that consumes the prices sent by the [Price Feed Oracle](worker-phala-cloud) implemented via a worker deployed on [Phala Cloud](https://cloud.phala.network/)

## Deploy the smart contract (ink! v6)

Build the [contract](price_feed_consumer/ink-v6) or use the [artifact](price_feed_consumer/ink-v6/artifacts) adn then deploy it on a Substrate node with `revive` pallet.

For testing, the contract `0x96213b72A4CF50402D9dFe71919350451B8dC356` is deployed on Pop Network (testnet). 

## Deploy the smart contract (ink! v5)

Build the [contract](price_feed_consumer/ink-v5) or use the [artifact](price_feed_consumer/ink-v5/artifacts) adn then deploy it on a Substrate node with `contracts` pallet.

For testing, the contract `W6jGgZUAiryufdJRX33GdDTeX28pt7dZxawwbCUfFwbc2cH` is deployed on Shibuya (Astar testnet). 

## Configure the smart contracts

1. Configure the attestor (ie the address granted to send the prices).

```bash
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message AccessControl::grant_role --args 2852625541 <attestor-address> --suri //Alice --execute
```
In the contracts deployed for testing purpose, `Bob` is granted as attestor.

2. Create the trading pairs (optional)

Create the trading pairs to know the ticker associated with the tradingPairId when you query the contract directly on-chain. 
This ticker is already configured in the worker deployed on Phala Cloud and also known in the user interface. 
Therefore, this part is optional.

```bash
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 1 \"bitcoin\" \"usd\" --suri //Alice --execute
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 2 \"ethereum\" \"usd\" --suri //Alice --execute
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 5 \"binancecoin\" \"usd\" --suri //Alice --execute
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 32 \"polkadot\" \"usd\" --suri //Alice --execute
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 283 \"astar\" \"usd\" --suri //Alice --execute
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 256 \"kusama\" \"usd\" --suri //Alice --execute
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 528 \"pha\" \"usd\" --suri //Alice --execute
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 576 \"moonbeam\" \"usd\" --suri //Alice --execute
cargo contract call --url <rpc-endpoint> --contract <contract-address> --message create_trading_pair --args 2294 \"shiden\" \"usd\" --suri //Alice --execute
```

## Deploy the worker on local or Phala Cloud

All information [here](worker-phala-cloud/README.md)

## Deploy the UI to display the price

// TODO put the git repo
