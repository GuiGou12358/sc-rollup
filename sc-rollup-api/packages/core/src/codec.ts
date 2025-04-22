import { HexString, Option } from "./types"

export interface Codec {
  encodeString(value: string): HexString
  encodeBoolean(value: boolean): HexString
  encodeNumeric(value: number): HexString
  decodeString(value: HexString): string
  decodeBoolean(value: HexString): boolean
  decodeNumeric(value: HexString): number
}

export interface ActionEncoder<KV, A> {
  encodeKeyValue(key: HexString, value: Option<HexString>): KV
  encodeReply(action: HexString): A
  encodeSetQueueHead(index: number): A
}
