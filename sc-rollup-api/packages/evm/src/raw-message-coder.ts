import {HexString, MessageCoder} from "@guigou/sc-rollup-core"
import {BytesLike} from "ethers"
import {hexAddPrefix} from "./evm-client";


export class RawMessageCoder implements MessageCoder<BytesLike> {
  decode(raw: HexString): BytesLike {
      return raw
  }
  encode(message: BytesLike): HexString {
      return hexAddPrefix(message.toString())
  }
}
