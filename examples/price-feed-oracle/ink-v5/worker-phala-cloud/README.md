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

By default, the Bun development server will listen on port 3000. Open http://127.0.0.1:3000/tdx_quote in your browser to get the quote with reportdata `test`.

This repo also includes code snippets for the following common use cases:

- `/tdx_quote`: The `reportdata` is `test` and generates the quote for attestation report via `tdxQuote` API.
- `/tdx_quote_raw`: The `reportdata` is `Hello DStack!` and generates the quote for attestation report. The difference from `/tdx_quote` is that you can see the raw text `Hello DStack!` in [Attestation Explorer](https://proof.t16z.com/).
- `/derive_key`: Basic example of the `deriveKey` API.
- `/account`: Using the `deriveKey` API to generate a deterministic wallet for Polkadot, a.k.a. a wallet held by the TEE instance.
- `/fetch_prices`: Using the `fetch_prices` API to fetch the price from CoinGecko.
- `/feed_prices`: Using the `feed_prices` API to feed the process into the ink! smart contract.
- `/info`: Returns the TCB Info of the hosted CVM.

## Build

You need to build the image and push it to DockerHub for deployment. The following instructions are for publishing to a public registry via DockerHub:

```shell
sudo docker build . -t guigoudev/price-feed-oracle-phala-cloud-inkv5
sudo docker push guigoudev/price-feed-oracle-phala-cloud-inkv5
```

## Deploy

You can copy and paste the `docker-compose.yml` file from this repo to see the example up and running.