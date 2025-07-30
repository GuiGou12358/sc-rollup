import {serve} from "bun";
import {TappdClient, to_hex} from "@phala/dstack-sdk";
import {Keyring} from "@polkadot/keyring";
import type {KeyringPair} from "@polkadot/keyring/types";
import cron, {type ScheduledTask} from "node-cron"
import {hexAddPrefix} from "@polkadot/util";
import {computePrivateKey} from "@guigou/util-crypto";
import {type Config, GuessTheNumberWorker} from "./guess-the-number.ts";

const port = process.env.PORT || 3000;
console.log(`Listening on port ${port}`);

async function deriveKey(client: TappdClient) : Promise<Uint8Array> {
  const deriveKeyResponse = await client.deriveKey('polkadot');
  return computePrivateKey(deriveKeyResponse);
}

async function getSubstrateKeyringPair(client: TappdClient) : Promise<KeyringPair> {
  const seed = await deriveKey(client);
  return new Keyring({type: 'sr25519'}).addFromSeed(seed);
}

function getConfig() : Config {

  const address = process.env.CONTRACT_ADDRESS;
  const rpc = process.env.RPC;
  const attestorPk = process.env.ATTESTOR_PK;

  if (!address){
    throw new Error("Contract address is missing!");
  }
  if (!rpc){
    throw new Error("RPC is missing!");
  }
  if (!attestorPk){
    throw new Error("Attestor key is missing!");
  }
  return {
    address,
    rpc,
    attestorPk: hexAddPrefix(attestorPk),
    senderPk: undefined,
  };
}

let worker : GuessTheNumberWorker | undefined = undefined;

function getOrCreateWorker() : GuessTheNumberWorker {

  if (!worker) {
    worker = new GuessTheNumberWorker(
        getConfig()
    )
  }
  return worker;
}

let scheduledTask: ScheduledTask | undefined = undefined;

function getOrCreateTask() : ScheduledTask {

  if (!scheduledTask){
    // Every 30 seconds
    scheduledTask = cron.schedule('*/30 * * * * *',
        async () => {
          try {
            const worker = getOrCreateWorker();
            await worker.pollMessages();
          } catch (e){
            console.error(e);
          }
        }, {noOverlap: true} );
  }
  return scheduledTask;
}

function startScheduledTask() : ScheduledTask {
  console.log('Start the scheduled task');
  const task = getOrCreateTask();
  task.start();
  return task;
}

function stopScheduledTask() : ScheduledTask {
  console.log('Stop the scheduled task');
  const task = getOrCreateTask();
  task.stop();
  return task;
}

function executeScheduledTask() : ScheduledTask {
  console.log('Execute the scheduled task');
  const task = getOrCreateTask();
  task.execute();
  return task;
}

serve({
  port,
  idleTimeout : 30,
  routes: {
    "/": new Response("" +
        "<h1>Guess The Number Worker</h1>" +
        "<div><ul>" +
        "<li><a href='/start'>/start</a>: Start a scheduled task, running every 30 seconds, to poll the messages, compute the target number via a VRF and send the clue.</li>" +
        "<li><a href='/stop'>/stop</a>: Stop the scheduled task.</li>" +
        "<li><a href='/execute'>/execute</a>: Force the execution of scheduled task.</li>" +
        "<li><a href='/worker/account'>/worker/account</a>: Using the `deriveKey` API to generate a deterministic wallet for Polkadot, a.k.a. a wallet held by the TEE instance.</li>" +
        "<li><a href='/worker/tdx-quote'>/worker/tdx-quote</a>: The `reportdata` is the worker public key and generates the quote for attestation report via `tdxQuote` API.</li>" +
        "<li><a href='/worker/tdx-quote-raw'>/worker/tdx-quote-raw</a>: The `reportdata` is the worker public key and generates the quote for attestation report. The difference from `/tdx_quote` is that you can see the worker public key in <a href='https://proof.t16z.com/' target='_blank'>Attestation Explorer</a>.</li>" +
        "<li><a href='/worker/info'>/worker/info</a>: Returns the TCB Info of the hosted CVM.</li>" +
        "</ul></div>"
    ),

    "/start": async (req) => {
      const task = startScheduledTask();
      return new Response(JSON.stringify({task}));
    },

    "/stop": async (req) => {
      const task = stopScheduledTask();
      return new Response(JSON.stringify({task}));
    },

    "/execute": async (req) => {
      const task = executeScheduledTask();
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
      const publicKey = to_hex(keypair.publicKey).slice(2);
      const result = await client.tdxQuote(publicKey);
      return new Response(JSON.stringify(result));
    },

    "/worker/tdx-quote-raw": async (req) => {
      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);
      const publicKey = to_hex(keypair.publicKey).slice(2);
      const result = await client.tdxQuote(publicKey, 'raw');
      return new Response(JSON.stringify(result));
    },

    "/worker/account": async (req) => {
      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);
      const ecdsaKeypair = new Keyring({type: 'ecdsa'}).addFromSeed(await deriveKey(client));
      return new Response(JSON.stringify({
        sr25519Address: keypair.address,
        sr25519PublicKey: to_hex(keypair.publicKey),
        ecdsaAddress: ecdsaKeypair.address,
        ecdsaPublicKey: to_hex(ecdsaKeypair.publicKey),
      }));
    },

  },
});


