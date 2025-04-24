import {TappdClient} from '@phala/dstack-sdk'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = new TappdClient()
  const getRemoteAttestation = await client.tdxQuote("test");
  return Response.json(getRemoteAttestation);
}
