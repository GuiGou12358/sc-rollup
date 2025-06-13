import type {KeyringPair} from "@polkadot/keyring/types";
import type {HexString} from "@guigou/sc-rollup-core";

export type InkClientConfig = {
  rpc: string;
  address: string;
  //attestorPk: HexString | KeyringPair;
  attestorPk: HexString;
  senderPk: HexString | undefined;
}

export type PriceRequestMessage = {
  tradingPairId: number;
  token0: string;
  token1: string;
}
