import type {InkClientConfig, PriceRequestMessage} from "./types.ts";
import {fetchCoingeckoPrices} from "./coingecko-api.ts";
import {InkClient} from "@guigou/sc-rollup-ink-v5";
import {type HexString, Option} from "@guigou/sc-rollup-core";
import {Option as ScaleOption, str, Struct, u128, u32, u8} from "scale-ts";

const TYPE_FEED = 11; // Adapt this constant if needed

const myMessageCodec = Struct({
  opType: u8,
  tradingPairId: u32,
  tokenA: str,
  tokenB: str,
});

const myActionCodec = Struct({
  respType: u8,
  tradingPairId: u32,
  price: ScaleOption(u128),
  errNo: ScaleOption(u128),
});

function convertPrice(price: number) : bigint {
  const valueStr = price.toString();
  const [intPart, decPart = ''] = valueStr.split(".");
  // keep only 18 decimals
  const normalizedDec = (decPart + "0".repeat(18)).slice(0, 18);
  return BigInt(intPart + normalizedDec);
}


export async function feedPrices(
  config: InkClientConfig,
  tradingPairs: PriceRequestMessage[]
): Promise<Option<HexString>> {


  const inkClient = new InkClient(config.rpc, config.address, config.attestorPk, config.senderPk, myMessageCodec, myActionCodec);
  await inkClient.startSession();

  const prices = await fetchCoingeckoPrices(tradingPairs);

  for (const request of tradingPairs) {
    const tokenPrices = prices[request.token0];
    const priceStr = tokenPrices?.[request.token1];
    if (priceStr != undefined) {
      try {
        inkClient.addAction({
          respType: TYPE_FEED,
          tradingPairId: request.tradingPairId,
          price: convertPrice(parseFloat(priceStr)),
          errNo: undefined,
        });
      } catch (e) {
        console.error('error for trading pair ' + request.tradingPairId + ' : ' + e);
        inkClient.addAction({
          respType: TYPE_FEED,
          tradingPairId: request.tradingPairId,
          price: undefined,
          errNo: 2n,
        });
      }
    } else {
      console.error('no price for trading pair ' + request.tradingPairId);
      inkClient.addAction({
        respType: TYPE_FEED,
        tradingPairId: request.tradingPairId,
        price: undefined,
        errNo: 1n,
      });
    }
  }

  return await inkClient.commit();
}
