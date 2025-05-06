import {BigIntType, HexString, NumberType, Option} from "./types"

export interface TypeCoder {
  encodeNumber(value: number, type: NumberType): HexString
  encodeBigInt(value: bigint, type: BigIntType): HexString
  encodeBoolean(value: boolean): HexString
  encodeString(value: string): HexString
  encodeBytes(value: Uint8Array): HexString
  decodeNumber(value: HexString, type: NumberType): number
  decodeBigInt(value: HexString, type: BigIntType): bigint
  decodeBoolean(value: HexString): boolean
  decodeString(value: HexString): string
  decodeBytes(value: HexString): Uint8Array
}

export interface RawTypeEncoder<KvRawType, ActionRawType> {
  encodeKeyValue(key: HexString, value: Option<HexString>): KvRawType
  encodeReply(action: HexString): ActionRawType
  encodeSetQueueHead(index: number): ActionRawType
}

export interface Coder<M> {
  decode(raw: HexString): M
  encode(message: M): HexString
}
