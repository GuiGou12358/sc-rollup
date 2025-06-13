import type {PriceRequestMessage} from "./types.ts";

export type CoingeckoPrices = Record<string, Record<string, string>>;

export async function fetchCoingeckoPrices(
  tradingPairs: PriceRequestMessage[]
): Promise<CoingeckoPrices> {
  let tokens = '';
  let currencies = '';

  for (let i = 0; i < tradingPairs.length; i++) {
    const pair = tradingPairs[i];
    if (i > 0) {
      tokens += ',';
      currencies += ',';
    }
    tokens += pair.token0;
    currencies += pair.token1;
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokens}&vs_currencies=${currencies}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch price');
  }

  let data: CoingeckoPrices;
  try {
    data = await response.json();
  } catch (err) {
    console.error('failed to parse json', err);
    throw new Error('Failed to decode response');
  }

  return data;
}