import {HexString, Option} from "./types"

export interface Codec {
  encodeString(value: string): HexString
  encodeBoolean(value: boolean): HexString
  encodeNumeric(value: number): HexString
  decodeString(value: HexString): string
  decodeBoolean(value: HexString): boolean
  decodeNumeric(value: HexString): number
}

export interface RawTypeEncoder<KvRawType, ActionRawType> {
  encodeKeyValue(key: HexString, value: Option<HexString>): KvRawType
  encodeReply(action: HexString): ActionRawType
  encodeSetQueueHead(index: number): ActionRawType
}


export interface MessageCoder<Message> {
  decode(raw: HexString): Message
  encode(message: Message): HexString
}
