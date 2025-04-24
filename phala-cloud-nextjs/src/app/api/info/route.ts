import {TappdClient} from '@phala/dstack-sdk'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = new TappdClient()
  const info = await client.info();
  return Response.json(info);
}
