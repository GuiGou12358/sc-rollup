import {serve} from "bun";
import {TappdClient} from "@phala/dstack-sdk";
import {Keyring} from "@polkadot/keyring";
import type {KeyringPair} from "@polkadot/keyring/types";
import cron, {type ScheduledTask} from "node-cron";
import {fetchCoingeckoPrices} from "./coingecko-api.ts";
import {type InkClientConfig, InkVersion, type PriceRequestMessage} from "./types.ts";
import {feedPrices} from "./price-feed-oracle.ts";
import {hexAddPrefix} from "@polkadot/util";
import {fromHex} from "polkadot-api/utils"
import {toHex} from "viem";

const inkV5ClientRpc = process.env.INK_V5_CLIENT_RPC;
const inkV5ClientAddress = process.env.INK_V5_CLIENT_ADDRESS;
const inkV5AttestorPk = process.env.INK_V5_ATTESTOR_PK;
const inkV5SenderPk = process.env.INK_V5_SENDER_PK;
const inkV6ClientRpc = process.env.INK_V6_CLIENT_RPC;
const inkV6ClientAddress = process.env.INK_V6_CLIENT_ADDRESS;
const inkV6AttestorPk = process.env.INK_V6_ATTESTOR_PK;
const inkV6SenderPk = process.env.INK_V6_SENDER_PK;
const port = process.env.PORT || 3000;
console.log(`Listening on port ${port}`);

const scheduledTasks: ScheduledTask[] = [];

function getVersion(v: string): InkVersion | undefined {
  if (v == 'v5' || v == 'V5' || v == 'ink_v5'){
    return InkVersion.V5;
  }
  if (v == 'v6' || v == 'V6' || v == 'ink_v6'){
    return InkVersion.V6;
  }
  return undefined;
}

function displayVersion(version: InkVersion): string {
  return version == InkVersion.V5 ? "v5" : "v6";
}

async function deriveKey(client: TappdClient) : Promise<Uint8Array> {
  const result = await client.deriveKey('polkadot');
  return result.asUint8Array(32);
}

async function getSubstrateKeyringPair(client: TappdClient) : Promise<KeyringPair> {
  const seed = await deriveKey(client);
  return new Keyring({type: 'sr25519'}).addFromSeed(seed);
}

async function getInkClientConfig(version: InkVersion) : Promise<InkClientConfig> {

  let rpc, address, attestorPk, senderPk;
  if (version == InkVersion.V5) {
    rpc = inkV5ClientRpc;
    address = inkV5ClientAddress;
    attestorPk = inkV5AttestorPk;
    senderPk = inkV5SenderPk;
  } else {
    rpc = inkV6ClientRpc;
    address = inkV6ClientAddress;
    attestorPk = inkV6AttestorPk;
    senderPk = inkV6SenderPk;
  }
  if (!rpc || !address){
    console.log('Missing configuration!');
    throw new Error('Missing configuration!');
  }
  if (attestorPk){
    return {
      version: version,
      rpc: rpc,
      address: address,
      attestorPk: hexAddPrefix(attestorPk),
      senderPk: senderPk ? hexAddPrefix(senderPk) : undefined,
    };
  }

  const client = new TappdClient();
  const pk = await deriveKey(client);
  return {
    version: version,
    rpc: rpc,
    address: address,
    attestorPk: toHex(pk),
    senderPk: senderPk ? hexAddPrefix(senderPk) : undefined,
  };
}
async function getOrCreateTask(version: InkVersion) : Promise<ScheduledTask> {

  if (!scheduledTasks[version]){
    scheduledTasks[version] = cron.schedule('*/5 * * * *',
        async () => {
          try {
            console.log('start feeding price for ink! contract :' + displayVersion(version));
            const config = await getInkClientConfig(version);
            const tradingPairs = getTradingPairs();
            const tx = await feedPrices(config, tradingPairs);
            console.log('tx:' + tx);
          } catch (e){
            console.error(e);
          }
        });
  }
  return scheduledTasks[version];
}

async function startFeedingPrices(version: InkVersion) : Promise<ScheduledTask> {
  console.log('Start feeding the prices for ink! contract ' + displayVersion(version));
  const task = await getOrCreateTask(version);
  await task.start();
  return task;
}

async function stopFeedingPrices(version: InkVersion) : Promise<ScheduledTask> {

  console.log('Stop feeding the prices for ink! contract ' + displayVersion(version));
  const task = await getOrCreateTask(version);
  //if (task && await task.getStatus() != 'stopped'){
  await task.stop();
  //}
  return task;
}

async function executeFeedingPrices(version: InkVersion) : Promise<ScheduledTask> {

  console.log('Execute feeding the prices for ink! contract ' + displayVersion(version));
  const task = await getOrCreateTask(version);
  //if (task && await task.getStatus() != 'stopped'){
  task.execute();
  //}
  return task;
}



serve({
  port,
  idleTimeout : 30,
  routes: {
    "/fetch-prices": async (req) => {
      const tradingPairs = getTradingPairs();
      const prices = await fetchCoingeckoPrices(tradingPairs);
      return new Response(JSON.stringify({prices}));
    },

    "/": new Response("" +
        "<h1>Price Feed Worker</h1>" +
        "<div><ul>" +
        "<li><a href='/fetch-prices'>/fetch-prices</a>: Fetch the prices from CoinGecko.</li>" +
        "<li><a href='/feed-prices/v5/start'>/feed-prices/v5/start</a>: Start a scheduled task, running every 5 minutes, to feed the prices into the ink! smart contract.</li>" +
        "<li><a href='/feed-prices/v5/stop'>/feed-prices/v5/stop</a>: Stop the scheduled task.</li>" +
        "<li><a href='/feed-prices/v5/execute'>/feed-prices/v5/execute</a>: Force to feed the prices into the ink! smart contract.</li>" +
        "<li><a href='/feed-prices/v5/info'>/feed-prices/v5/info</a>: Display the information linked to the scheduled task.</li>" +
        "<li><a href='/feed-prices/v5/attestor'>/feed-prices/v5/attestor</a>: Display the address used as attestor to feed the process. If the `INK_V5_ATTESTOR_PK` env key if not provided, the worker's address will be used.</li>" +
        "<li><a href='/feed-prices/v5/sender'>/feed-prices/v5/sender</a>: Display the address used as sender in the context of meta-transaction. If the `INK_V5_SENDER_PK` env key if not provided, the meta tx is not enabled (ie the attestor is the sender).</li>" +
        "<li><a href='/feed-prices/v6/start'>/feed-prices/v6/start</a>: Start a scheduled task, running every 5 minutes, to feed the prices into the ink! smart contract.</li>" +
        "<li><a href='/feed-prices/v6/stop'>/feed-prices/v6/stop</a>: Stop the scheduled task.</li>" +
        "<li><a href='/feed-prices/v6/execute'>/feed-prices/v6/execute</a>: Force to feed the prices into the ink! smart contract.</li>" +
        "<li><a href='/feed-prices/v6/info'>/feed-prices/v6/info</a>: Display the information linked to the scheduled task.</li>" +
        "<li><a href='/feed-prices/v6/attestor'>/feed-prices/v6/attestor</a>: Display the address used as attestor to feed the process. If the `INK_V6_ATTESTOR_PK` env key if not provided, the worker's address will be used.</li>" +
        "<li><a href='/feed-prices/v6/sender'>/feed-prices/v6/sender</a>: Display the address used as sender in the context of meta-transaction. If the `INK_V6_SENDER_PK` env key if not provided, the meta tx is not enabled (ie the attestor is the sender).</li>" +
        "<li><a href='/worker/account'>/worker/account</a>: Using the `deriveKey` API to generate a deterministic wallet for Polkadot, a.k.a. a wallet held by the TEE instance.</li>" +
        "<li><a href='/worker/tdx-quote'>/worker/tdx-quote</a>: Generates the quote for attestation report via `tdxQuote` API with the worker public key as `reportdata`.</li>" +
        "<li><a href='/worker/tdx-quote-raw'>/worker/tdx-quote-raw</a>: Generates the quote for attestation report with the worker public key as `reportdata`. The difference from `/tdx_quote` is that you can see the `reportdata` (ie the worker public key) in <a href='https://proof.t16z.com'>Attestation Explorer</a>.</li>" +
        "<li><a href='/worker/info'>/worker/info</a>: Returns the TCB Info of the hosted CVM.</li>" +
        "</ul></div>"
    ),

    "/feed-prices/:version/attestor": async (req) => {
      const version = getVersion(req.params.version);
      if (version == undefined){
        return new Response("Unknown version!", {status: 503});
      }
      const pk = version == InkVersion.V5 ? inkV5AttestorPk : inkV6AttestorPk;

      const client = new TappdClient();
      const keypair = pk
          ? new Keyring({type: 'sr25519'}).addFromSeed(fromHex(hexAddPrefix(pk)))
          : await getSubstrateKeyringPair(client);

      const ecdsaKeypair = pk
          ? new Keyring({type: 'ecdsa'}).addFromSeed(fromHex(hexAddPrefix(pk)))
          : new Keyring({type: 'ecdsa'}).addFromSeed(await deriveKey(client))

      return new Response(JSON.stringify({
        sr25519Address: keypair.address,
        sr25519PublicKey: toHex(keypair.publicKey),
        ecdsaAddress: ecdsaKeypair.address,
        ecdsaPublicKey: toHex(ecdsaKeypair.publicKey),
      }));
    },

    "/feed-prices/:version/sender": async (req) => {
      const version = getVersion(req.params.version);
      if (version == undefined){
        return new Response("Unknown version!", {status: 503});
      }
      const pk = version == InkVersion.V5 ? inkV5SenderPk : inkV6SenderPk;
      if (!pk){
        return new Response("No sender set");
      }
      const keypair = new Keyring({type: 'sr25519'}).addFromSeed(fromHex(hexAddPrefix(pk)));
      return new Response(JSON.stringify({
        address: keypair.address,
        publicKey: toHex(keypair.publicKey),
      }));
    },

    "/feed-prices/:version/info": async (req) => {
      const version = getVersion(req.params.version);
      if (version == undefined){
        return new Response("Unknown version!", {status: 503});
      }
      const task = scheduledTasks[version];
      return new Response(JSON.stringify({task}));
    },

    "/feed-prices/:version/start": async (req) => {
      const version = getVersion(req.params.version);
      if (version == undefined){
        return new Response("Unknown version!", {status: 503});
      }
      const task = await startFeedingPrices(version);
      return new Response(JSON.stringify({task}));
    },

    "/feed-prices/:version/stop": async (req) => {
      const version = getVersion(req.params.version);
      if (version == undefined){
        return new Response("Unknown version!", {status: 503});
      }
      const task = await stopFeedingPrices(version);
      return new Response(JSON.stringify({task}));
    },

    "/feed-prices/:version/execute": async (req) => {
      const version = getVersion(req.params.version);
      if (version == undefined){
        return new Response("Unknown version!", {status: 503});
      }
      const task = await executeFeedingPrices(version);
      return new Response(JSON.stringify({task}));
    },

    "/worker/info": async (req) => {
      const client = new TappdClient();
      const result = await client.info();
      return new Response(JSON.stringify(result));
    },

    "/worker/tdx-quote": async (req) => {
      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);
      const publicKey = toHex(keypair.publicKey).slice(2);
      const result = await client.tdxQuote(publicKey);
      return new Response(JSON.stringify(result));
    },

    "/worker/tdx-quote-raw": async (req) => {
      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);
      const publicKey = toHex(keypair.publicKey).slice(2);
      const result = await client.tdxQuote(publicKey, 'raw');
      return new Response(JSON.stringify(result));
    },

    "/worker/account": async (req) => {
      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);
      const ecdsaKeypair = new Keyring({type: 'ecdsa'}).addFromSeed(await deriveKey(client));
      return new Response(JSON.stringify({
        sr25519Address: keypair.address,
        sr25519PublicKey: toHex(keypair.publicKey),
        ecdsaAddress: ecdsaKeypair.address,
        ecdsaPublicKey: toHex(ecdsaKeypair.publicKey),
      }));
    },

  },
});


const getTradingPairs = () : PriceRequestMessage[] => {
  return [
    {token0: "bitcoin", token1: "usd", tradingPairId: 1},
    {token0: "ethereum", token1: "usd", tradingPairId: 2},
    {token0: "polkadot", token1: "usd", tradingPairId: 32},
    {token0: "astar", token1: "usd", tradingPairId: 283},
    {token0: "pha", token1: "usd", tradingPairId: 528},
    {token0: "moonbeam", token1: "usd", tradingPairId: 576},
    {token0: "binancecoin", token1: "usd", tradingPairId: 5},
    {token0: "shiden", token1: "usd", tradingPairId: 2294},
    {token0: "kusama", token1: "usd", tradingPairId: 256},
  ];
}

