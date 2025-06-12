# Ink! client example

Implements a dummy client . It uses the crate `inkv6_client_lib`.
It supports:
- manage the roles and grant an address as `ADMIN` or `ATTESTOR`. Only the admin can do it.
- push raw message in the queue.
- handle the raw messages sent by the offchain rollup: In this dummy example, nothing is done (TODO: emit an event!)
- allow meta transactions to separate the attestor and the payer.

By default, the contract owner is granted as `ADMIN` and `ATTESTOR`.

## Build

To build the contract:

```bash
cargo contract build
```

## e2e tests

[Here](../integration_tests/README.md) are the integration tests.