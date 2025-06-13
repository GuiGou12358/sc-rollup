import {serve} from "bun";
import {TappdClient} from "@phala/dstack-sdk";
import {Keyring} from "@polkadot/keyring";
import type {KeyringPair} from "@polkadot/keyring/types";
import cron from "node-cron";
import {fetchCoingeckoPrices} from "./coingecko-api.ts";
import type {InkClientConfig, PriceRequestMessage} from "./types.ts";
import {feedPrices} from "./price-feed-oracle.ts";
import {hexAddPrefix} from "@polkadot/util";

const inkClientRpc = process.env.INK_CLIENT_RPC;
const inkClientAddress = process.env.INK_CLIENT_ADDRESS;
const attestorPk = hexAddPrefix(process.env.ATTESTOR_PK);
const senderPk = hexAddPrefix(process.env.SENDER_PK);
const port = process.env.PORT || 3000;
console.log(`Listening on port ${port}`);

async function getSubstrateKeyringPair(client: TappdClient) : Promise<KeyringPair> {
  const result = await client.deriveKey('polkadot');
  const bytes = result.asUint8Array(32)
  return new Keyring({type: 'sr25519'}).addFromSeed(bytes);
}

async function getInkClientConfig() : Promise<InkClientConfig> {

  if (!inkClientRpc || !inkClientAddress){
    console.log('Missing configuration!');
    throw new Error('Missing configuration!');
  }
  if (attestorPk){
    return {
      rpc: inkClientRpc,
      address: inkClientAddress,
      attestorPk: attestorPk,
      senderPk: senderPk,
    };
  }

  const client = new TappdClient();
  // TODO manage keyring pair
  const keypair = await getSubstrateKeyringPair(client);
  return {
    rpc: inkClientRpc,
    address: inkClientAddress,
    //attestorPk: keypair,
    attestorPk: attestorPk,
    senderPk: senderPk,
  };
}


serve({
  port,
  idleTimeout : 30,
  routes: {
    "/": new Response("Hello Price Feed Oracle!"),

    "/info": async (req) => {
      const client = new TappdClient();
      const result = await client.info();
      return new Response(JSON.stringify(result));
    },

    "/tdx_quote": async (req) => {
      const client = new TappdClient();
      const result = await client.tdxQuote('test');
      return new Response(JSON.stringify(result));
    },

    "/tdx_quote_raw": async (req) => {
      const client = new TappdClient();
      const result = await client.tdxQuote('Hello DStack!', 'raw');
      return new Response(JSON.stringify(result));
    },

    "/derive_key": async (req) => {
      const client = new TappdClient();
      const result = await client.deriveKey('polkadot');
      return new Response(JSON.stringify(result));
    },

    "/account": async (req) => {
      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);
      return new Response(JSON.stringify({
        address: keypair.address,
        publicKey: keypair.publicKey,
      }));
    },

    "/fetch_prices": async (req) => {
      const tradingPairs = getTradingPairs();
      const prices = await fetchCoingeckoPrices(tradingPairs);
      return new Response(JSON.stringify({prices}));
    },

    "/feed_prices": async (req) => {
      const config = await getInkClientConfig();
      const tradingPairs = getTradingPairs();
      const tx = await feedPrices(config, tradingPairs);
      return new Response(JSON.stringify({tx}));
    },

    "/start_feeding_prices": async (req) => {

      console.log('Message polling enabled');

      const task = cron.schedule('*/5 * * * *',
        async () => {
          const config = await getInkClientConfig();
          const tradingPairs = getTradingPairs();
          const tx = await feedPrices(config, tradingPairs);
          console.log('tx:' + tx);
        });
      task.start();

      return new Response(JSON.stringify({task}));
    },

    "/list_scheduled_tasks": async (req) => {

      const tasks = cron.getTasks();
      return new Response(JSON.stringify({tasks}));
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

