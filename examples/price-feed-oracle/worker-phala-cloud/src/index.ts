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
const inkV6ClientRpc = process.env.INK_V6_CLIENT_RPC;
const inkV6ClientAddress = process.env.INK_V6_CLIENT_ADDRESS;
const attestorPk = process.env.ATTESTOR_PK;
const senderPk = process.env.SENDER_PK;
const port = process.env.PORT || 3000;
console.log(`Listening on port ${port}`);

const scheduledTasks: ScheduledTask[] = [];

async function deriveKey(client: TappdClient) : Promise<Uint8Array> {
  const result = await client.deriveKey('polkadot');
  return result.asUint8Array(32);
}

async function getSubstrateKeyringPair(client: TappdClient) : Promise<KeyringPair> {
  const seed = await deriveKey(client);
  return new Keyring({type: 'sr25519'}).addFromSeed(seed);
}

async function getInkClientConfig(version: InkVersion) : Promise<InkClientConfig> {

  let rpc, address;
  if (version == InkVersion.V5) {
    rpc = inkV5ClientRpc;
    address = inkV5ClientAddress
  } else {
    rpc = inkV6ClientRpc;
    address = inkV6ClientAddress
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
    attestorPk: hexAddPrefix(pk.toString()),
    senderPk: senderPk ? hexAddPrefix(senderPk) : undefined,
  };
}
async function getOrCreateTask(version: InkVersion) : Promise<ScheduledTask> {

  if (!scheduledTasks[version]){
    scheduledTasks[version] = cron.schedule('*/5 * * * *',
        async () => {
          const config = await getInkClientConfig(version);
          const tradingPairs = getTradingPairs();
          const tx =  await feedPrices(config, tradingPairs);
          console.log('tx:' + tx);
        });
  }
  return scheduledTasks[version];
}

async function startFeedingPrices(version: InkVersion) : Promise<ScheduledTask> {
  console.log('Start feeding the prices for ink! contract ' + version);
  const task = await getOrCreateTask(version);
  await task.start();
  return task;
}

async function stopFeedingPrices(version: InkVersion) : Promise<ScheduledTask> {

  console.log('Stop feeding the prices for ink! contract ' + version);
  const task = await getOrCreateTask(version);
  //if (task && await task.getStatus() != 'stopped'){
  await task.stop();
  //}
  return task;
}

async function executeFeedingPrices(version: InkVersion) : Promise<ScheduledTask> {

  console.log('Execute feeding the prices for ink! contract ' + version);
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
    "/": new Response("Hello Price Feed Oracle!"),

    "/worker/info": async (req) => {
      const client = new TappdClient();
      const result = await client.info();
      return new Response(JSON.stringify(result));
    },

    "/worker/tdx-quote": async (req) => {
      const client = new TappdClient();
      const result = await client.tdxQuote('Price Feed Oracle');
      return new Response(JSON.stringify(result));
    },

    "/worker/tdx-quote-raw": async (req) => {
      const client = new TappdClient();
      const result = await client.tdxQuote('Price Feed Oracle', 'raw');
      return new Response(JSON.stringify(result));
    },

    "/account/worker": async (req) => {
      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);
      return new Response(JSON.stringify({
        address: keypair.address,
        publicKey: toHex(keypair.publicKey),
      }));
    },

    "/account/attestor": async (req) => {

      const client = new TappdClient();
      const keypair = attestorPk
        ? new Keyring({type: 'sr25519'}).addFromSeed(fromHex(hexAddPrefix(attestorPk)))
       : await getSubstrateKeyringPair(client);

      const ecdsaKeypair = attestorPk
          ? new Keyring({type: 'ecdsa'}).addFromSeed(fromHex(hexAddPrefix(attestorPk)))
          : new Keyring({type: 'ecdsa'}).addFromSeed(await deriveKey(client))

      return new Response(JSON.stringify({
        sr25519Address: keypair.address,
        sr25519PublicKey: toHex(keypair.publicKey),
        ecdsaAddress: ecdsaKeypair.address,
        ecdsaPublicKey: toHex(ecdsaKeypair.publicKey),
      }));
    },

    "/account/sender": async (req) => {
      console.log("sender" + senderPk)
      if (!senderPk){
        return new Response("No sender set");
      }
      const keypair = new Keyring({type: 'sr25519'}).addFromSeed(fromHex(hexAddPrefix(senderPk)));
      return new Response(JSON.stringify({
        address: keypair.address,
        publicKey: toHex(keypair.publicKey),
      }));
    },


    "/fetch-prices": async (req) => {
      const tradingPairs = getTradingPairs();
      const prices = await fetchCoingeckoPrices(tradingPairs);
      return new Response(JSON.stringify({prices}));
    },

    "/ink-v5/feed-prices/info": async (req) => {
      const task = scheduledTasks[InkVersion.V5];
      return new Response(JSON.stringify({task}));
    },

    "/ink-v5/feed-prices/start": async (req) => {
      const task = await startFeedingPrices(InkVersion.V5);
      return new Response(JSON.stringify({task}));
    },

    "/ink-v5/feed-prices/stop": async (req) => {
      const task = await stopFeedingPrices(InkVersion.V5);
      return new Response(JSON.stringify({task}));
    },

    "/ink-v5/feed-prices/execute": async (req) => {
      const task = await executeFeedingPrices(InkVersion.V5);
      return new Response(JSON.stringify({task}));
    },

    "/ink-v6/feed-prices/info": async (req) => {
      const task = scheduledTasks[InkVersion.V6];
      return new Response(JSON.stringify({task}));
    },

    "/ink-v6/feed-prices/start": async (req) => {
      const task = await startFeedingPrices(InkVersion.V6);
      return new Response(JSON.stringify({task}));
    },

    "/ink-v6/feed-prices/stop": async (req) => {
      const task = await stopFeedingPrices(InkVersion.V6);
      return new Response(JSON.stringify({task}));
    },

    "/ink-v6/feed-prices/execute": async (req) => {
      const task = await executeFeedingPrices(InkVersion.V6);
      return new Response(JSON.stringify({task}));
    },

  },
});


const getTradingPairs = () : PriceRequestMessage[] => {
  return [
    {token0: "bitcoin", token1: "usd", tradingPairId: 1},
    {token0: "ethereum", token1: "usd", tradingPairId: 2},
    {token0: "polkadot", token1: "usd", tradingPairId: 4},
    {token0: "kusama", token1: "usd", tradingPairId: 5},
  ];
}

