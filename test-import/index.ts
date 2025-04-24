
import {serve} from "bun";
import {InkClient} from "@guigou/sc-rollup-ink5";
import {cryptoWaitReady} from "@polkadot/util-crypto";

const inkClientRpc = process.env.INK_CLIENT_RPC;
const inkClientAddress = process.env.INK_CLIENT_ADDRESS;
const pk = process.env.ATTESTOR_PK;
const port = process.env.PORT || 3000;
console.log(`Listening on port ${port}`);

serve({
  port,
  idleTimeout : 30,
  routes: {
    "/": new Response("Hello GuiGou!"),

    "/test": async () => {

      /*
      const inkClientRpc = process.env.INK_CLIENT_RPC;
      const inkClientAddress = process.env.INK_CLIENT_ADDRESS;
      const pk = process.env.ATTESTOR_PK;
       */
      if (inkClientRpc == undefined ||  inkClientAddress == undefined  || pk == undefined ){
        console.log('Missing configuration!');
        return;
      }

      await cryptoWaitReady();

      await poolMessage(inkClientRpc, inkClientAddress, pk);
    },


  },
});

const poolMessage = async (inkClientRpc: string, inkClientAddress:string, pk:string)=> {

  console.log('inkClientRpc: %s', inkClientRpc);
  console.log('inkClientAddress: %s', inkClientAddress);

  const inkClient = new InkClient(inkClientRpc, inkClientAddress, pk);
  console.log('signerAddress: %s', inkClient.signerAddress);

  const remoteValue = await inkClient.getRemoteValue('0x712f5f7461696c');
  console.log('remoteValue : ' + remoteValue);

  const hasMessage = await inkClient.hasMessage();
  console.log('hasMessage : ' + hasMessage);

  console.log('Tail Index before: ');
  const tail = await inkClient.getQueueTailIndex();
  console.log('Tail Index: ' + tail);
  const head = await inkClient.getQueueHeadIndex();
  console.log('Head Index: ' + head);

  console.log('start session');
  await inkClient.startSession();
  console.log('session started');

  console.log('Poll message ...');
  let message;
  do {
    message = await inkClient.pollMessage();
    console.log('message %s', message);
  } while (message.isSome());

  await inkClient.commit();
}


