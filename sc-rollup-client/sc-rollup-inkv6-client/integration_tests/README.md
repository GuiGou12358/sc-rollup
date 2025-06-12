# Integrations tests

Integrations tests of the [smart contract](../ink_client_example) and [library](../ink_client_lib).

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

And finally execute the following command to start e2e test execution.

```bash
cargo test --features e2e-tests
```
