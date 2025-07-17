import {
  type BigIntType,
  Client,
  Coder,
  HexString,
  None,
  type NumberType,
  Option,
  RawTypeEncoder,
  TypeCoder,
} from "@guigou/sc-rollup-core"
import { BytesLike, Contract, ethers, JsonRpcProvider, Wallet } from "ethers"
import { ABI } from "./evm-client-abi"

const abiCoder = ethers.AbiCoder.defaultAbiCoder()

function abiEncode(type: string, value: any) {
  return abiCoder.encode([type], [value])
}

function abiEncodeIndex(index: number) {
  //return ethers.solidityPacked(['uint32'], [index]);
  return abiCoder.encode(["uint"], [index])
}

export function hexAddPrefix(value: string): HexString {
  if (value.startsWith("0x")) {
    return value as HexString
  }
  return `0x${value}`
}

// q/_tail : 0x712f5f7461696c
const QUEUE_TAIL_KEY = hexAddPrefix(
  ethers.hexlify(ethers.toUtf8Bytes("q/_tail")),
)
// q/_head : 0x712f5f68656164
const QUEUE_HEAD_KEY = hexAddPrefix(
  ethers.hexlify(ethers.toUtf8Bytes("q/_head")),
)
const VERSION_NUMBER_KEY = hexAddPrefix(
  ethers.hexlify(ethers.toUtf8Bytes("v/_number")),
)

type KvRawType = [BytesLike, BytesLike]
type ActionRawType = BytesLike

export class EvmClient<Message, Action> extends Client<
  KvRawType,
  ActionRawType,
  Message,
  Action
> {
  readonly contract: Contract
  readonly provider: JsonRpcProvider
  readonly senderAddress: Wallet
  readonly signerAddress: Wallet | undefined

  public constructor(
    rpc: string,
    address: string,
    attestorPk: string,
    senderPk: string | undefined,
    messageCodec: Coder<Message>,
    actionCodec: Coder<Action>,
  ) {
    super(
      new EvmTypeCoder(),
      new EvmEncoder(),
      messageCodec,
      actionCodec,
      VERSION_NUMBER_KEY,
      QUEUE_HEAD_KEY,
      QUEUE_TAIL_KEY,
    )

    this.provider = new ethers.JsonRpcProvider(rpc)

    if (senderPk) {
      // we use meta transactions : attestor and sender are different
      // attestor signs the transactions and the sender sends them (ie pay the fee)

      this.signerAddress = new ethers.Wallet(attestorPk).connect(this.provider)
      console.log("Signer address: " + this.signerAddress.address)
      this.senderAddress = new ethers.Wallet(senderPk).connect(this.provider)
    } else {
      // we don't use meta transactions : attestor sends the transactions
      this.senderAddress = new ethers.Wallet(attestorPk).connect(this.provider)
    }

    console.log("Sender address: " + this.senderAddress.address)
    this.contract = new ethers.Contract(address, ABI, this.senderAddress)
  }

  protected useMetaTransaction(): boolean {
    return this.signerAddress != undefined
  }

  getMessageKey(index: number): HexString {
    const encodedIndex = abiEncodeIndex(index)
    const prefix = ethers.toUtf8Bytes("q/")
    return hexAddPrefix(ethers.concat([prefix, encodedIndex]))
  }

  async getRemoteValue(key: HexString): Promise<Option<HexString>> {
    const value = await this.contract.getStorage(key)
    if (value === "0x") {
      return new None()
    }
    return Option.of(value)
  }

  async sendTransaction(
    conditions: KvRawType[],
    updates: KvRawType[],
    actions: ActionRawType[],
  ): Promise<HexString> {
    const { conditionKeys, conditionValues, updateKeys, updatesValues } =
      prepareParams(conditions, updates)
    const tx = await this.contract.rollupU256CondEq(
      conditionKeys,
      conditionValues,
      updateKeys,
      updatesValues,
      actions,
    )
    return tx.hash
  }

  async sendMetaTransaction(
    conditions: KvRawType[],
    updates: KvRawType[],
    actions: ActionRawType[],
  ): Promise<HexString> {
    if (!this.signerAddress) {
      return Promise.reject("Meta tx signer is not set")
    }

    const { conditionKeys, conditionValues, updateKeys, updatesValues } =
      prepareParams(conditions, updates)

    const from = this.signerAddress.address
    const data = abiCoder.encode(
      ["bytes[]", "bytes[]", "bytes[]", "bytes[]", "bytes[]"],
      [conditionKeys, conditionValues, updateKeys, updatesValues, actions],
    )
    const [forwardRequest, hash] = await this.contract.metaTxPrepare(from, data)

    console.log("forwardRequest.from %s", forwardRequest.from)
    console.log("forwardRequest.nonce %s", forwardRequest.nonce)
    console.log("forwardRequest.data %s", forwardRequest.data)
    console.log("hash %s", hash)

    // Sign the message by the attestor
    const metaTxData = {
      from: forwardRequest.from,
      nonce: forwardRequest.nonce,
      data: forwardRequest.data,
    }

    // All properties on a domain are optional
    const domain = {
      name: "PhatRollupMetaTxReceiver",
      version: "0.0.1",
      chainId: (await this.provider.getNetwork()).chainId,
      verifyingContract: await this.contract.getAddress(),
    }
    const types = {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    }

    const signature = await this.signerAddress.signTypedData(
      domain,
      types,
      metaTxData,
    )
    console.log("signature %s", signature)

    // Send meta-tx
    const tx = await this.contract.metaTxRollupU256CondEq(metaTxData, signature)
    return tx.hash
  }
}


function prepareParams(conditions: KvRawType[], updates: KvRawType[]) {
  const conditionKeys = conditions.map((v) => v[0])
  const conditionValues = conditions.map((v) => v[1])
  const updateKeys = updates.map((v) => v[0])
  const updatesValues = updates.map((v) => v[1])
  return { conditionKeys, conditionValues, updateKeys, updatesValues }
}

export class EvmTypeCoder implements TypeCoder {
  encodeBoolean(value: boolean): HexString {
    return hexAddPrefix(abiEncode("bool", value))
  }

  encodeNumber(value: number, type: NumberType): HexString {
    switch (type) {
      case "u8":
        return hexAddPrefix(abiEncode("uint8", value))
      case "u16":
        return hexAddPrefix(abiEncode("uint16", value))
      case "u32":
        return hexAddPrefix(abiEncode("uint32", value))
    }
  }

  encodeBigInt(value: bigint, type: BigIntType): HexString {
    switch (type) {
      case "u64":
        return hexAddPrefix(abiEncode("uint64", value))
      case "u128":
        return hexAddPrefix(abiEncode("uint128", value))
      case "u256":
        return hexAddPrefix(abiEncode("uint256", value))
    }
  }

  encodeString(value: string): HexString {
    return hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes(value)))
  }

  encodeBytes(value: Uint8Array): HexString {
    return hexAddPrefix(abiEncode("bytes", value))
  }

  decodeBoolean(value: HexString): boolean {
    return ethers.getNumber(value) === 1
  }

  decodeNumber(value: HexString, _type: NumberType): number {
    return ethers.getNumber(value)
  }

  decodeBigInt(value: HexString, _type: BigIntType): bigint {
    return ethers.getBigInt(value)
  }

  decodeString(value: HexString): string {
    return ethers.toUtf8String(value)
  }

  decodeBytes(value: HexString): Uint8Array {
    return ethers.toUtf8Bytes(value)
  }
}

class EvmEncoder implements RawTypeEncoder<KvRawType, ActionRawType> {
  encodeKeyValue(key: HexString, value: Option<HexString>): KvRawType {
    return [key, value.orElse("0x")]
  }

  encodeReply(action: HexString): ActionRawType {
    return hexAddPrefix(ethers.concat(["0x00", action]))
  }

  encodeSetQueueHead(index: number): ActionRawType {
    return hexAddPrefix(ethers.concat(["0x01", abiEncodeIndex(index)]))
  }
}
