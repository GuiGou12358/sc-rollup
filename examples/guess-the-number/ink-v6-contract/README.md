# Guess The Number - ink! v6 (PolkaVM) contract

Example of `ink! smart contract` that implements `Gues The Number` games. The VRF is implemented via a worker deployed on [Phala Cloud](https://cloud.phala.network/)
We use the crate `inkv6_client_lib` to facilitate the communication between `ink! smart contract` and the worker. 

It supports:
 - User starts a new game with the min and max numbers in parameter.
 - User make a guess to find the target number. The target number is computed by the VRF deployed on Phala Cloud.
 - The worker sends the clue (More/Less/Found). The worker must be granted as `ATTESTOR`.
 - The user/UI can query the current game (last guess, last clue, number of attempts).
 - The admin can manage the roles and grant an address as `ADMIN` or `ATTESTOR`. Only the admin can do it.
 - Allow meta transactions to separate the attestor and the payer.

By default, the contract owner is granted as `ADMIN` but it is not granted as `ATTESTOR`.

## Build

To build the contract:

```bash
cargo contract build
```

## Run e2e tests

Before you can run the test, you have to install a Polkadot SDK node with `pallet-revive`.
By default, e2e tests require that you install [ink-node](https://github.com/use-ink/ink-node).
You do not need to run it in the background since the node is started for each test independently.
The easiest way is to [download a binary from the releases page](https://github.com/use-ink/ink-node/releases) (Linux and Mac).
Alternatively, you can build the node by yourself. The build instructions and pre-requisites can be found here.

If you want to run any other node with `pallet-revive` you need to change `CONTRACTS_NODE` environment variable:
```bash
export CONTRACTS_NODE="YOUR_CONTRACTS_NODE_PATH"
```

And finally execute the following command to start e2e tests execution.
```bash
cargo test --features e2e-tests
```
