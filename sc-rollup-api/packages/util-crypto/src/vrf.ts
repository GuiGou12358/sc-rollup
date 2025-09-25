import type { KeyringPair } from "@polkadot/keyring/types"
import { Keyring } from "@polkadot/keyring"
import { u8aToHex } from "@polkadot/util"
import { toKeypair } from "./polkadot"
import { TappdClient } from "@phala/dstack-sdk"

const MAX_U32 = Math.pow(2, 32)

export class Vrf {
  private readonly pair: KeyringPair

  constructor(pair: KeyringPair) {
    this.pair = pair
  }

  static getFromSeed(seed: Uint8Array): Vrf {
    const pair = new Keyring({ type: "sr25519" }).addFromSeed(seed)
    return new Vrf(pair)
  }

  static getFromClient(client: TappdClient): Promise<Vrf> {
    return client
      .getKey("vrf")
      .then((keyResponse) => new Vrf(toKeypair(keyResponse)))
  }

  getRandomNumber(salt: Uint8Array, min: number, max: number): number {
    // precondition check
    if (min >= max) {
      throw new Error("Max must be greater than min")
    }
    if (min < 0) {
      throw new Error("Min must be greater or equals to 0")
    }
    if (max > MAX_U32) {
      throw new Error("max must be lower than 2^32")
    }
    if (salt.length == 0) {
      throw new Error("the salt must not be empty")
    }

    // derive a new address base on the salt
    const output = this.pair.derive("/" + u8aToHex(salt)).addressRaw
    // keep only 4 bytes to compute the random u32
    const random = output.slice(0, 4)
    const randomNumber = parseInt(u8aToHex(random), 16)
    return (randomNumber % (max - min + 1)) + min
  }

  verify(salt: Uint8Array, min: number, max: number, n: number): boolean {
    return n === this.getRandomNumber(salt, min, max)
  }
}
