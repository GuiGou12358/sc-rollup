import {
  type BigIntType,
  Client,
  Coder,
  type HexString,
  type NumberType,
  Option,
  RawTypeEncoder,
  TypeCoder,
} from "@guigou/sc-rollup-core"
import { contracts, shibuya } from "@guigou/sc-rollup-ink-v5-descriptors"
//import { contracts, shibuya } from "@polkadot-api/descriptors"
import { createClient } from "polkadot-api"
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getPolkadotSigner, PolkadotSigner } from "polkadot-api/signer"
import { fromHex, toHex } from "polkadot-api/utils"
import { getWsProvider } from "polkadot-api/ws-provider/web"
import { createInkSdk } from "@polkadot-api/sdk-ink"
import {
  AccountId,
  Binary,
  bool,
  Bytes,
  Codec,
  Option as ScaleOption,
  SS58String,
  str,
  Struct,
  Tuple,
  u128,
  u16,
  u256,
  u32,
  u64,
  u8,
  Vector,
} from "@polkadot-api/substrate-bindings"
import { Keyring } from "@polkadot/keyring"
import type { KeyringPair } from "@polkadot/keyring/types"
import {
  hexAddPrefix,
  hexToU8a,
  stringToHex,
  stringToU8a,
  u8aConcat,
  u8aToHex,
} from "@polkadot/util"
import { Enum } from "scale-ts"

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
export type ActionRawType =
  | {
      type: "Reply"
      value: Binary
    }
  | {
      type: "SetQueueHead"
      value: number
    }
  | {
      type: "GrantAttestor"
      value: SS58String
    }
  | {
      type: "RevokeAttestor"
      value: SS58String
    }

type ActionRawScaleType =
  | {
      tag: "Reply"
      value: Uint8Array
    }
  | {
      tag: "SetQueueHead"
      value: number
    }
  | {
      tag: "GrantAttestor"
      value: SS58String
    }
  | {
      tag: "RevokeAttestor"
      value: SS58String
    }

function isKeyringPair(obj: any): obj is KeyringPair {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.address === "string" &&
    typeof obj.sign === "function" &&
    typeof obj.publicKey !== "undefined"
  )
}

export class InkClient<Message, Action> extends Client<
  KvRawType,
  ActionRawType,
  Message,
  Action
> {
  contract: any
  signerEcdsa: KeyringPair | undefined
  signerEcdsaAddress: SS58String | undefined
  sender: PolkadotSigner
  senderAddress: SS58String

  constructor(
    rpc: string,
    address: string,
    attestorPk: HexString,
    senderPk: HexString | undefined,
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

    let senderKeyringPair

    if (senderPk) {
      // we use meta transactions : attestor and sender are different
      // attestor signs the transactions and the sender sends them (ie pay the fee)

      // the attestor uses ECDSA to sign
      this.signerEcdsa = new Keyring({ type: "ecdsa" }).addFromSeed(
        fromHex(attestorPk),
      )
      this.signerEcdsaAddress = this.signerEcdsa.address

      // the sender always uses SR25519 to sign
      senderKeyringPair = new Keyring({ type: "sr25519" }).addFromSeed(
        fromHex(senderPk),
      )
    } else {
      // we don't use meta transactions : attestor sends the transactions
      senderKeyringPair = new Keyring({ type: "sr25519" }).addFromSeed(
        fromHex(attestorPk),
      )
    }

    this.senderAddress = senderKeyringPair.address
    this.sender = getPolkadotSigner(
      senderKeyringPair.publicKey,
      "Sr25519",
      senderKeyringPair.sign,
    )

    /*
      // following issue with this method : Error: privateKey of length 64 expected, got 32
        const publicKey = sr25519.getPublicKey(attestorPk)
        this.signer = getPolkadotSigner(
          publicKey,
          "Sr25519",
          (input) => sr25519.sign(input, attestorPk)
        );
        this.signerAddress = encodeAddress(publicKey)
     */

    /*
    let keyringPair;
    if (isKeyringPair(attestorPk)) {
      keyringPair = attestorPk as KeyringPair;
    } else {
      keyringPair = new Keyring({type: "sr25519"}).addFromSeed(
        fromHex(attestorPk),
      );

      this.signerEcdsaKP = new Keyring({type: "ecdsa"}).addFromSeed(
        fromHex(attestorPk),
      );
      this.signerEcdsaAddress = this.signerEcdsaKP.address;

    }

    this.signerAddress = keyringPair.address
    this.signer = getPolkadotSigner(
      keyringPair.publicKey,
      "Sr25519",
      keyringPair.sign,
    )

    this.senderAddress = keyringPair.address
    this.sender = getPolkadotSigner(
      keyringPair.publicKey,
      "Sr25519",
      keyringPair.sign,
    )
 */
  }

  public async checkCompatibility() {
    if (!(await this.contract.isCompatible())) {
      return Promise.reject("Contract has changed")
    }
  }

  protected useMetaTransaction(): boolean {
    return this.signerEcdsaAddress != undefined
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
        origin: this.senderAddress,
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
        origin: this.senderAddress,
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
        origin: this.senderAddress,
        data: {
          conditions,
          updates,
          actions,
        },
      },
    )
    if (!success) {
      return Promise.reject("Error when dry run tx " + value.toString())
    }

    console.log("Submitting tx ... ")
    const result = await this.contract
      .send("RollupClient::rollup_cond_eq", {
        origin: this.senderAddress,
        data: {
          conditions,
          updates,
          actions,
        },
      })
      .signAndSubmit(this.sender)

    if (!result.ok) {
      return Promise.reject("Error when submitting tx " + result)
    }
    return result.txHash
  }

  async sendMetaTransaction(
    conditions: KvRawType[],
    updates: KvRawType[],
    actions: ActionRawType[],
  ): Promise<HexString> {
    if (!this.signerEcdsa) {
      return Promise.reject("Signer ECDSA not set")
    }

    // encode the data to provide to the prepare method
    // Need to use the scale codec types to get the encoded hex string
    const dataCodec = Struct({
      conditions: Vector(Tuple(Bytes(), ScaleOption(Bytes()))),
      updates: Vector(Tuple(Bytes(), ScaleOption(Bytes()))),

      actions: Vector(
        Enum({
          Reply: Bytes(),
          SetQueueHead: u32,
          GrantAttestor: AccountId(),
          RevokeAttestor: AccountId(),
        }),
      ),
    })

    const data = {
      conditions: conditions.map(fromBinaryToU8a),
      updates: updates.map(fromBinaryToU8a),
      actions: actions.map(convertAction),
    }

    const encodedData = dataCodec.enc(data)
    console.log("Encoded data : %s ", u8aToHex(encodedData))

    // query the prepare method to get the nonce
    console.log("Query the MetaTransaction::prepare method ...")
    const { value: valueP, success: successP } = await this.contract.query(
      "MetaTransaction::prepare",
      {
        origin: this.senderAddress,
        data: {
          from: this.signerEcdsaAddress,
          data: Binary.fromBytes(encodedData),
        },
      },
    )
    if (!successP) {
      return Promise.reject(
        "Error Query the MetaTransaction::prepare method" + valueP,
      )
    }
    const [forwardRequest, hash] = valueP.response

    console.log("forwardRequest.from %s", forwardRequest.from)
    console.log("forwardRequest.to %s", forwardRequest.to)
    console.log("forwardRequest.nonce %s", forwardRequest.nonce)
    console.log("forwardRequest.data %s", forwardRequest.data.asHex())
    console.log("hash %s", hash.asHex())

    // Sign the message by the attestor
    // If there was an existing ecdsa_sign_prehashed method, we can directly sign the hash.
    // Otherwise, we have to sign the forwardRequest message
    const forwardRequestCodec = Struct({
      from: AccountId(),
      to: AccountId(),
      nonce: u128,
      data: Bytes(),
    })
    const encodedMessage = forwardRequestCodec.enc({
      from: forwardRequest.from,
      to: forwardRequest.to,
      nonce: forwardRequest.nonce,
      data: forwardRequest.data.asBytes(),
    })
    console.log("Encoded message %s", u8aToHex(encodedMessage))
    const signature = this.signerEcdsa.sign(encodedMessage)
    console.log("Signature : %s", u8aToHex(signature))

    console.log("Dry Run MetaTransaction::meta_tx_rollup_cond_eq ...")
    const { value, success } = await this.contract.query(
      "MetaTransaction::meta_tx_rollup_cond_eq",
      {
        origin: this.senderAddress,
        data: {
          request: forwardRequest,
          signature: Binary.fromBytes(signature),
        },
      },
    )
    if (!success) {
      console.log("Error when dry run tx : %s ", value)
      return Promise.reject("Error when dry run tx " + value.toString())
    }

    console.log("Submitting tx ... ")
    const result = await this.contract
      .send("MetaTransaction::meta_tx_rollup_cond_eq", {
        origin: this.senderAddress,
        data: {
          request: forwardRequest,
          signature: Binary.fromBytes(signature),
        },
      })
      .signAndSubmit(this.sender)

    if (!result.ok) {
      return Promise.reject("Error when submitting tx " + result)
    }
    return result.txHash
  }
}

/**
 * Method to convert from polkadot-api type to scale type.
 *
 * @param data
 */
function fromBinaryToU8a(
  data: KvRawType,
): [Uint8Array, Uint8Array | undefined] {
  const key = data.at(0)
  const value = data.at(1)
  if (key) {
    return [key.asBytes(), value?.asBytes()]
  } else {
    throw new Error("Key is missing")
  }
}

/**
 * Method to convert from polkadot-api type to scale type.
 *
 * @param action
 */
function convertAction(action: ActionRawType): ActionRawScaleType {
  switch (action.type) {
    case "Reply":
      return {
        tag: "Reply",
        value: action.value.asBytes(),
      }
    case "SetQueueHead":
      return {
        tag: "SetQueueHead",
        value: action.value,
      }
    case "RevokeAttestor":
      return {
        tag: "RevokeAttestor",
        value: action.value,
      }
    case "GrantAttestor":
      return {
        tag: "GrantAttestor",
        value: action.value,
      }
  }
}

class ScaleCoder<T> implements Coder<T> {
  codec: Codec<T>

  public constructor(codec: Codec<T>) {
    this.codec = codec
  }

  decode(raw: HexString): T {
    return this.codec.dec(raw)
  }

  encode(object: T): HexString {
    return u8aToHex(this.codec.enc(object))
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
    return str.dec(value)
  }

  decodeBytes(value: HexString): Uint8Array {
    return Binary.fromHex(value).asBytes()
  }
}

const converter = (input: HexString): Binary => {
  return Binary.fromHex(input)
}

export class InkEncoder implements RawTypeEncoder<KvRawType, ActionRawType> {
  encodeKeyValue(key: HexString, value: Option<HexString>): KvRawType {
    //return [Binary.fromHex(key), value.map(converter).valueOf()]
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
