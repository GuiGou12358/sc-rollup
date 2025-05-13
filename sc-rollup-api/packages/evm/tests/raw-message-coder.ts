import { HexString, Coder } from "@guigou/sc-rollup-core"
import { BytesLike } from "ethers"
import { hexAddPrefix } from "../src/evm-client"

export class RawMessageCoder implements Coder<BytesLike> {
  decode(raw: HexString): BytesLike {
    return raw
  }
  encode(message: BytesLike): HexString {
    return hexAddPrefix(message.toString())
  }
}
