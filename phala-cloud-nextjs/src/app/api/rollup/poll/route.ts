import {InkClient} from '@guigou/sc-rollup-ink5'

export const dynamic = 'force-dynamic'

const inkClientRpc = process.env.INK_CLIENT_RPC;
const inkClientAddress = process.env.INK_CLIENT_ADDRESS;
const pk = process.env.ATTESTOR_PK;

export async function GET() {

  if (inkClientRpc == undefined || inkClientAddress == undefined || pk == undefined){
    return Response.error();
  }

  const tx = await poolMessage(inkClientRpc, inkClientAddress, pk);
  return Response.json(tx);
}


async function poolMessage(inkClientRpc: string, inkClientAddress:string, pk:string){

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

  return await inkClient.commit();
}
