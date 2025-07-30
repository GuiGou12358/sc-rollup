# Guess The Number Worker deployed on Phala Cloud


This worker polls the messages from the smart contract, computes the target number via a VRF and sends the clue (More/Less/Found) about the last guess made by the user. 
This worker uses the [sc-rolluo-api](/sc-rollup-api) to connect to the smart contract. It is developed with [Bun](https://bun.sh/) and deployed on [Phala Cloud](https://cloud.phala.network/).
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

By default, the Bun development server will listen on port 3000. Open http://127.0.0.1:3000/ in your browser to display the menu.

This repo also includes code snippets for the following common use cases:

- `/start`: Start a scheduled task, running every 30 seconds, to poll the messages, compute the target number via a VRF and send the clue.
- `/stop`: Stop the scheduled task.
- `/execute`: Force the execution of scheduled task.
- `/worker/account`: Using the `deriveKey` API to generate a deterministic wallet for Polkadot, a.k.a. a wallet held by the TEE instance.
- `/worker/tdx-quote`: The `reportdata` is the worker public key and generates the quote for attestation report via `tdxQuote` API.
- `/worker/tdx-quote-raw`: The `reportdata` is the worker public key and generates the quote for attestation report. The difference from `/tdx_quote` is that you can see the worker public key in [Attestation Explorer](https://proof.t16z.com/).
- `/worker/info`: Returns the TCB Info of the hosted CVM.

## Build

You need to build the image and push it to DockerHub for deployment. The following instructions are for publishing to a public registry via DockerHub:

```shell
sudo docker build . -t guigoudev/guess-the-number-worker
sudo docker push guigoudev/guess-the-number-worker
```

## Deploy

You can copy and paste the `docker-compose.yml` file from this repo to see the example up and running.