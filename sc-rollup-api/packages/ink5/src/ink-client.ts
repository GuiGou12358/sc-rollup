import {
  type BigIntType,
  Client,
  Coder,
  type HexString,
  type NumberType,
  Option,
  RawTypeEncoder,
  TypeCoder
} from "@guigou/sc-rollup-core"
import {contracts, shibuya} from "@guigou/sc-rollup-ink5-descriptors"
import {createClient} from "polkadot-api"
import {withPolkadotSdkCompat} from "polkadot-api/polkadot-sdk-compat"
import {getPolkadotSigner, PolkadotSigner} from "polkadot-api/signer"
import {fromHex, toHex} from "polkadot-api/utils"
import {getWsProvider} from "polkadot-api/ws-provider/web"
import {createInkSdk} from "@polkadot-api/sdk-ink"
import {Binary, bool, SS58String, str, u128, u16, u256, u32, u64, u8} from "@polkadot-api/substrate-bindings"
//import {ed25519} from "@polkadot-labs/hdkd-helpers";
import {Keyring} from "@polkadot/keyring";
import {hexAddPrefix, hexToU8a, stringToHex, stringToU8a, u8aConcat, u8aToHex} from "@polkadot/util"
//import {encodeAddress} from "@polkadot/util-crypto"
import {Codec} from "scale-ts"

// q/_tail : 0x712f5f7461696c
//const QUEUE_TAIL_KEY = Binary.fromText("q/_tail").asHex()
const QUEUE_TAIL_KEY = stringToHex("q/_tail")
// q/_head : 0x712f5f68656164
//const QUEUE_HEAD_KEY = Binary.fromText("q/_head").asHex()
const QUEUE_HEAD_KEY = stringToHex("q/_head")
// v/_number : 0x762f5f6e756d626572
//const VERSION_NUMBER_KEY = Binary.fromText("v/_number").asHex()
const VERSION_NUMBER_KEY = stringToHex("v/_number")

export type KvRawType = [Binary, Binary | undefined]
export type ActionRawType = {}

export class InkClient<Message, Action> extends Client<KvRawType, ActionRawType, Message, Action> {
  contract: any
  signer: PolkadotSigner
  signerAddress: SS58String

  public constructor(
    rpc: string,
    address: string,
    pk: string,
    messageCodec: Codec<Message>,
    actionCodec: Codec<Action>,
    ) {
    super(
      new InkTypeCoder(),
      new InkEncoder(),
      new ScaleCoder(messageCodec),
      new ScaleCoder(actionCodec),
      VERSION_NUMBER_KEY,
      QUEUE_HEAD_KEY,
      QUEUE_TAIL_KEY,
    )

    const client = createClient(withPolkadotSdkCompat(getWsProvider(rpc)))
    const typedApi = client.getTypedApi(shibuya)
    const sdk = createInkSdk(typedApi, contracts.ink_client)
    this.contract = sdk.getContract(address)

/*
    const privateKey = fromHex(pk)
    const publicKey = ed25519.getPublicKey(privateKey)
    console.log('publicKey %s', publicKey)

    this.signer = getPolkadotSigner(
      publicKey,
      //"Sr25519",
      "Ed25519",
      (input) => ed25519.sign(input, privateKey)
    );

    this.signerAddress = encodeAddress(publicKey)
    console.log('signerAddress %s', this.signerAddress)
*/

/*
    const publicKey = sr25519.getPublicKey(hexToU8a(pk))
    this.signer = getPolkadotSigner(
      publicKey,
      "Sr25519",
      (input) => sr25519.sign(input, hexToU8a(pk))
    );
    this.signerAddress = encodeAddress(publicKey)

 */

    const keyringPair = new Keyring({ type: "sr25519" }).addFromSeed(
      fromHex(pk),
    )
    this.signerAddress = keyringPair.address
    this.signer = getPolkadotSigner(
      keyringPair.publicKey,
      "Sr25519",
      keyringPair.sign,
    )

  }

  public async checkCompatibility() {
    if (!(await this.contract.isCompatible())) {
      return Promise.reject("Contract has changed")
    }
  }


  getMessageKey(index: number): HexString {
    const encodedIndex = hexToU8a(this.encodeIndex(index))
    return u8aToHex(u8aConcat(stringToU8a("q/"), encodedIndex))

    //const bytes = mergeUint8(Binary.fromText("q/").asBytes(), u32.enc(index))
    //return hexAddPrefix(Binary.fromBytes(bytes).asHex())

  }

  async hasMessage(): Promise<Boolean> {
    const { value, success } = await this.contract.query(
      "RollupClient::has_message",
      {
        origin: this.signerAddress,
      },
    )
    if (!success) {
      return Promise.reject("Error to query has_message method")
    }
    return value.response
  }

  async getRemoteValue(key: HexString): Promise<Option<HexString>> {
    const { value, success } = await this.contract.query(
      "RollupClient::get_value",
      {
        origin: this.signerAddress,
        data: {
          key: Binary.fromHex(key),
        },
      },
    )

    if (!success) {
      return Promise.reject("Error to query get_value method for key " + key)
    }

    return Option.of(value.response?.asHex())
  }

  async sendTransaction(
    conditions: KvRawType[],
    updates: KvRawType[],
    actions: ActionRawType[],
  ): Promise<HexString> {
    console.log("Dry Run ...")
    const { value, success } = await this.contract.query(
      "RollupClient::rollup_cond_eq",
      {
        origin: this.signerAddress,
        data: {
          conditions,
          updates,
          actions,
        },
      },
    )
    if (!success) {
      return Promise.reject("Error when dry run tx " + value)
    }

    console.log("Submitting tx ... ")
    const result = await this.contract
      .send("RollupClient::rollup_cond_eq", {
        origin: this.signerAddress,
        data: {
          conditions,
          updates,
          actions,
        },
      })
      .signAndSubmit(this.signer)

    if (!result.ok) {
      return Promise.reject("Error when submitting tx " + result)
    }
    return result.txHash
  }
}


class ScaleCoder<T> implements Coder<T> {

  codec: Codec<T>

  public constructor(codec: Codec<T>){
    this.codec = codec
  }

  decode(raw: HexString): T {
    return this.codec.dec(raw);
  }

  encode(object: T): HexString {
    return u8aToHex(this.codec.enc(object));
  }
}


const fromBytesToHex = (bytes: Uint8Array): HexString => {
  return hexAddPrefix(toHex(bytes))
}

export class InkTypeCoder implements TypeCoder {

  encodeBoolean(value: boolean): HexString {
    return fromBytesToHex(bool.enc(value))
  }

  encodeNumber(value: number, type: NumberType): HexString {
    switch (type) {
      case "u8":
        return fromBytesToHex(u8.enc(value))
      case "u16":
        return fromBytesToHex(u16.enc(value))
      case "u32":
        return fromBytesToHex(u32.enc(value))
    }
  }

  encodeBigInt(value: bigint, type: BigIntType): HexString {
    switch (type) {
      case "u64":
        return fromBytesToHex(u64.enc(value))
      case "u128":
        return fromBytesToHex(u128.enc(value))
      case "u256":
        return fromBytesToHex(u256.enc(value))
    }
  }

  encodeString(value: string): HexString {
    return fromBytesToHex(str.enc(value))
  }

  encodeBytes(value: Uint8Array): HexString {
    return hexAddPrefix(Binary.fromBytes(value).asHex())
  }

  decodeBoolean(value: HexString): boolean {
    return bool.dec(value)
  }

  decodeNumber(value: HexString, type: NumberType): number {
    switch (type) {
      case "u8":
        return u8.dec(value)
      case "u16":
        return u16.dec(value)
      case "u32":
        return u32.dec(value)
    }
  }

  decodeBigInt(value: HexString, type: BigIntType): bigint {
    switch (type) {
      case "u64":
        return u64.dec(value)
      case "u128":
        return u128.dec(value)
      case "u256":
        return u256.dec(value)
    }
  }

  decodeString(value: HexString): string {
    return str.dec(value);
  }

  decodeBytes(value: HexString): Uint8Array {
    return Binary.fromHex(value).asBytes()
  }

}

const converter = (input: HexString): Binary => {
  return Binary.fromHex(input)
}

class InkEncoder implements RawTypeEncoder<KvRawType, ActionRawType> {
  encodeKeyValue(key: HexString, value: Option<HexString>): KvRawType {
    return [Binary.fromHex(key), value.map(converter).valueOf()]
  }

  encodeReply(action: HexString): ActionRawType {
    return {
      type: "Reply",
      value: Binary.fromHex(action),
    }
  }

  encodeSetQueueHead(index: number): ActionRawType {
    return {
      type: "SetQueueHead",
      value: index,
    }
  }
}
