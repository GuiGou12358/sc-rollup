import {Client, Codec, HexString, MessageCoder, None, Option, RawTypeEncoder} from "@guigou/sc-rollup-core"
import {BytesLike, Contract, ethers, JsonRpcProvider, Wallet} from "ethers"

const abiCoder = ethers.AbiCoder.defaultAbiCoder()

function abiEncode(type: string, value: any) {
  return abiCoder.encode([type], [value])
}

function abiEncodeIndex(index: number) {
  //return ethers.solidityPacked(['uint32'], [index]);
  return abiCoder.encode(["uint"], [index])
}

const ABI = [
  {
    inputs: [
      {
        internalType: "bytes",
        name: "key",
        type: "bytes",
      },
    ],
    name: "getStorage",
    outputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes[]",
        name: "condKeys",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "condValues",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "updateKeys",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "updateValues",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "actions",
        type: "bytes[]",
      },
    ],
    name: "rollupU256CondEq",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
]

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

export class EvmClient<Message> extends Client<KvRawType, ActionRawType, Message> {
  readonly contract: Contract
  readonly provider: JsonRpcProvider
  readonly signerAddress: Wallet

  public constructor(
    rpc: string,
    address:
    string,
    pk: string,
    messageCoder : MessageCoder<Message>
  ) {
    super(
      new EvmCodec(),
      new EvmEncoder(),
      messageCoder,
      VERSION_NUMBER_KEY,
      QUEUE_HEAD_KEY,
      QUEUE_TAIL_KEY,
    )
    this.provider = new ethers.JsonRpcProvider(rpc)
    this.signerAddress = new ethers.Wallet(pk).connect(this.provider)
    console.log("Attestor address: " + this.signerAddress.address)
    this.contract = new ethers.Contract(address, ABI, this.signerAddress)
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
    const conditionKeys = conditions.map((v) => v[0])
    const conditionValues = conditions.map((v) => v[1])
    const updateKeys = updates.map((v) => v[0])
    const updatesValues = updates.map((v) => v[1])

    conditions.forEach((v) =>
      console.log("condition - key : " + v[0] + " - value : " + v[1]),
    )
    updates.forEach((v) =>
      console.log("updates - key : " + v[0] + " - value : " + v[1]),
    )
    actions.forEach((v) => console.log("action : " + v))

    const tx = await this.contract.rollupU256CondEq(
      conditionKeys,
      conditionValues,
      updateKeys,
      updatesValues,
      actions,
    )
    return tx.hash
  }
}

export class EvmCodec implements Codec {
  encodeString(value: string): HexString {
    return hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes(value)))
  }

  encodeBoolean(value: boolean): HexString {
    return hexAddPrefix(abiEncode("bool", value))
  }

  encodeNumeric(value: number): HexString {
    return hexAddPrefix(abiEncode("uint", value))
  }

  decodeString(value: HexString): string {
    return ethers.toUtf8String(value)
  }

  decodeBoolean(value: HexString): boolean {
    return ethers.getNumber(value) === 1
  }

  decodeNumeric(value: HexString): number {
    return ethers.getNumber(value)
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
