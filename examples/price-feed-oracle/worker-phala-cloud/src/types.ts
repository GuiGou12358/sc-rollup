import type {HexString} from "@guigou/sc-rollup-core";

export enum InkVersion { V5, V6}

export type InkClientConfig = {
  version: InkVersion;
  rpc: string;
  address: string;
  attestorPk: HexString;
  senderPk: HexString | undefined;
}

export type PriceRequestMessage = {
  tradingPairId: number;
  token0: string;
  token1: string;
}
