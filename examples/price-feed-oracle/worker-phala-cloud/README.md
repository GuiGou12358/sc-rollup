# Price Feed Worker deployed on Phala Cloud


This worker fetch the prices from CoinGecko and feed them into the wasm contract. 
This worker uses the [sc-rolluo-api](/sc-rollup-api) to connect to the wasm contract. It is developed with [Bun](https://bun.sh/) and deployed on [Phala Cloud](https://cloud.phala.network/).
This repo also includes a default Dockerfile and docker-compose.yml for deployment.

## Installation

```shell
bun i
cp env.example .env
```

We need to download the DStack simulator:

```shell
# Mac
wget https://github.com/Leechael/tappd-simulator/releases/download/v0.1.4/tappd-simulator-0.1.4-aarch64-apple-darwin.tgz
tar -xvf tappd-simulator-0.1.4-aarch64-apple-darwin.tgz
cd tappd-simulator-0.1.4-aarch64-apple-darwin
./tappd-simulator -l unix:/tmp/tappd.sock

# Linux
wget https://github.com/Leechael/tappd-simulator/releases/download/v0.1.4/tappd-simulator-0.1.4-x86_64-linux-musl.tgz
tar -xvf tappd-simulator-0.1.4-x86_64-linux-musl.tgz
cd tappd-simulator-0.1.4-x86_64-linux-musl
./tappd-simulator -l unix:/tmp/tappd.sock
```

Once the simulator is running, you need to open another terminal to start your Bun development server:

```shell
bun run dev
```

By default, the Bun development server will listen on port 3000. Open http://127.0.0.1:3000/fetch_prices in your browser to fetch the price from CoinGecko.

This repo also includes code snippets for the following common use cases:

- `/account/worker`: Using the `deriveKey` API to generate a deterministic wallet for Polkadot, a.k.a. a wallet held by the TEE instance.
- `/account/attestor`: Display the address used as attestor to feed the process. Use the `ATTESTOR_PK` env key if provided. Otherwise, use the worker's address.
- `/account/sender`: Display the address used as sender in the context of Meta tx. Use the `SENDER_PK` env key if provided. Otherwise, the meta tx is not enabled (ie the attestor is the sender).
- `/fetch_prices`: Using the `fetch_prices` API to fetch the prices from CoinGecko.
- `/ink-v5/feed-prices/start`: Using the `/ink-v5/feed-prices/start` API to start a scheduled task, running every 5 minutes, to feed the prices into the ink! smart contract.
- `/ink-v5/feed-prices/stop`: Using the `/ink-v5/feed-prices/stop` API to stop the scheduled task.
- `/ink-v5/feed-prices/execute`: Using the `/ink-v5/feed-prices/execute` API to force to feed the prices into the ink! smart contract.
- `/ink-v5/feed-prices/info`: Using the `/ink-v5/feed-prices/info` API to display the information linked to the scheduled task.
- `/ink-v6/feed-prices/start`: Using the `/ink-v6/feed-prices/start` API to start a scheduled task, running every 5 minutes, to feed the prices into the ink! smart contract.
- `/ink-v6/feed-prices/stop`: Using the `/ink-v6/feed-prices/stop` API to stop the scheduled task.
- `/ink-v6/feed-prices/execute`: Using the `/ink-v6/feed-prices/execute` API to force to feed the prices into the ink! smart contract.
- `/ink-v6/feed-prices/info`: Using the `/ink-v6/feed-prices/info` API to display the information linked to the scheduled task.
- `/worker/tdx-quote`: The `reportdata` is `Price Feed Oracle` and generates the quote for attestation report via `tdxQuote` API.
- `/worker/tdx-quote-raw`: The `reportdata` is `Price Feed Oracle` and generates the quote for attestation report. The difference from `/tdx_quote` is that you can see the raw text `Price Feed Oracle` in [Attestation Explorer](https://proof.t16z.com/).
- `/worker/info`: Returns the TCB Info of the hosted CVM.

## Build

You need to build the image and push it to DockerHub for deployment. The following instructions are for publishing to a public registry via DockerHub:

```shell
sudo docker build . -t guigoudev/price-feed-oracle-phala-cloud-inkv5
sudo docker push guigoudev/price-feed-oracle-phala-cloud-inkv5
```

## Deploy

You can copy and paste the `docker-compose.yml` file from this repo to see the example up and running.