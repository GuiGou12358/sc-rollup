import {serve} from "bun";
import {TappdClient} from "@phala/dstack-sdk";
import {Keyring} from "@polkadot/keyring";
import type {KeyringPair} from "@polkadot/keyring/types";
import type {InkClient} from "@guigou/sc-rollup-ink5";

const inkClientRpc = process.env.INK_CLIENT_RPC;
const inkClientAddress = process.env.INK_CLIENT_ADDRESS;
const pk = process.env.ATTESTOR_PK;
const port = process.env.PORT || 3000;
console.log(`Listening on port ${port}`);


async function getSubstrateKeyringPair(client: TappdClient) : Promise<KeyringPair> {
  const result = await client.deriveKey('polkadot');
  const bytes = result.asUint8Array(32)
  return new Keyring({type: 'sr25519'}).addFromSeed(bytes);
}

serve({
  port,
  idleTimeout : 30,
  routes: {
    "/": new Response("Hello GuiGou!"),

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

    "/feed": async (req) => {

      const client = new TappdClient();
      const keypair = await getSubstrateKeyringPair(client);

      const inkClient = new InkClient(inkClientRpc, inkClientAddress, pk);
      await inkClient.startSession();
      inkClient.addAction('0x00');
      const tx = await inkClient.commit();

      return new Response(JSON.stringify(tx));
    },

  },
});

