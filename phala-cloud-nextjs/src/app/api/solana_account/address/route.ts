import {TappdClient} from '@phala/dstack-sdk'
import { toKeypair } from '@phala/dstack-sdk/solana'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = new TappdClient()
  const testDeriveKey = await client.deriveKey("solana");
  const account = toKeypair(testDeriveKey);
  console.log(account);
  return Response.json({ address: account.publicKey.toBase58() });
}
