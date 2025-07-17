import { assert, expect, test } from "vitest"
import { InkClient, InkTypeCoder } from "../src/ink-client"
import * as process from "node:process"
import { configDotenv } from "dotenv"
import { mergeUint8 } from "polkadot-api/utils"
import { Binary } from "@polkadot-api/substrate-bindings"
import {
  hexAddPrefix,
  hexToU8a,
  stringToHex,
  stringToU8a,
  u8aConcat,
  u8aToHex,
} from "@polkadot/util"
import { Bytes, Enum, str, Struct, u128, u32 } from "scale-ts"
//import {writeHeapSnapshot} from "v8";

configDotenv()
const rpc = process.env.RPC
const address = process.env.CONTRACT_ADDRESS
const attestorPk = hexAddPrefix(process.env.ATTESTOR_PRIVATE_KEY)
const senderPk = hexAddPrefix(process.env.SENDER_PRIVATE_KEY)

test("encode keys", async () => {
  expect(Binary.fromText("q/_tail").asHex()).toBe("0x712f5f7461696c")
  expect(stringToHex("q/_tail")).toBe("0x712f5f7461696c")

  expect(Binary.fromText("q/_head").asHex()).toBe("0x712f5f68656164")
  expect(stringToHex("q/_head")).toBe("0x712f5f68656164")

  expect(Binary.fromText("v/_number").asHex()).toBe("0x762f5f6e756d626572")
  expect(stringToHex("v/_number")).toBe("0x762f5f6e756d626572")

  const codec = new InkTypeCoder()
  const index = 7
  const encodedIndex = hexToU8a(codec.encodeNumber(index, "u32"))
  const v1 = u8aToHex(u8aConcat(stringToU8a("q/"), encodedIndex))

  expect(v1).toBe("0x712f07000000")

  const p = Binary.fromText("q/").asBytes()
  const i = u32.enc(index)
  const v2 = Binary.fromBytes(mergeUint8(p, i)).asHex()
  expect(v2).toBe("0x712f07000000")
})

test("encoding / decoding Type", async () => {
  const codec = new InkTypeCoder()

  let n = 8
  let encodedNumber = codec.encodeNumber(n, "u8")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe("0x08")
  expect(codec.decodeNumber(encodedNumber, "u8")).toBe(n)

  n = 16
  encodedNumber = codec.encodeNumber(n, "u16")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe("0x1000")
  expect(codec.decodeNumber(encodedNumber, "u16")).toBe(n)

  n = 32
  encodedNumber = codec.encodeNumber(n, "u32")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe("0x20000000")
  expect(codec.decodeNumber(encodedNumber, "u32")).toBe(n)

  let bn = BigInt(64)
  encodedNumber = codec.encodeBigInt(bn, "u64")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe("0x4000000000000000")
  expect(codec.decodeBigInt(encodedNumber, "u64")).toBe(bn)

  bn = BigInt(128)
  encodedNumber = codec.encodeBigInt(bn, "u128")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe("0x80000000000000000000000000000000")
  expect(codec.decodeBigInt(encodedNumber, "u128")).toBe(bn)

  const encodedBooleanFalse = codec.encodeBoolean(false)
  console.log("encoded %s : %s", false, encodedBooleanFalse)
  expect(encodedBooleanFalse).toBe("0x00")
  expect(codec.decodeBoolean(encodedBooleanFalse)).toBe(false)

  const encodedBooleanTrue = codec.encodeBoolean(true)
  console.log("encoded %s : %s", true, encodedBooleanTrue)
  expect(encodedBooleanTrue).toBe("0x01")
  expect(codec.decodeBoolean(encodedBooleanTrue)).toBe(true)

  const s = "test"
  const encodedString = codec.encodeString(s)
  console.log("encoded %s : %s", s, encodedString)
  assert(encodedString) // todo check the value
  expect(codec.decodeString(encodedString)).toBe(s)
})

const requestMessageCodec = Bytes()

/*
    enum ResponseMessage {
        PriceFeed {
            /// id of the trading pair
            trading_pair_id: TradingPairId,
            /// price of the trading pair
            price: u128,
        },
        Error {
            /// id of the trading pair
            trading_pair_id: TradingPairId,
            /// error when the price is read
            err_no: u128,
        },
    }
 */

const responseMessageCodec = Enum({
  PriceFeed: Struct({
    tradingPairId: u32,
    price: u128,
  }),
  Error: Struct({
    tradingPairId: u32,
    errNo: u128,
  }),
})

test("encoding / decoding Action", async () => {
  const encoded = responseMessageCodec.enc({
    tag: "PriceFeed",
    value: {
      tradingPairId: 1,
      price: 94024n * 1_000_000_000_000_000_000n,
    },
  })

  expect(u8aToHex(encoded)).toBe("0x0001000000000020707fef1e0de913000000000000")

  const decoded = responseMessageCodec.dec(
    "0x0002000000000020707fef1e0de913000000000000",
  )

  expect(decoded).toStrictEqual({
    tag: "PriceFeed",
    value: {
      tradingPairId: 2,
      price: 94024n * 1_000_000_000_000_000_000n,
    },
  })
})

test("Read / Write values", async () => {
  assert(rpc, "RPC must be set in .env file")
  assert(address, "CONTRACT_ADDRESS must be set in .env file")
  assert(attestorPk, "ATTESTOR_PRIVATE_KEY must be set in .env file")

  const client = new InkClient(
    rpc,
    address,
    attestorPk,
    undefined,
    requestMessageCodec,
    responseMessageCodec,
  )

  await client.startSession()

  const key1 = stringToHex("key1")
  const value1 = await client.getNumber(key1, "u32")
  console.log("key1 %s - value : %s", key1, value1)
  const v1 = value1.valueOf()
  const newValue1 = v1 ? v1 + 1 : 1
  client.setNumber(key1, newValue1, "u32")

  const key2 = stringToHex("key20")
  const value2 = await client.getString(key2)
  console.log("key2 %s - value : %s", key2, value2)
  const v2 = value2.valueOf()
  const newValue2 = v2 ? Number(v2) + 1 : 1
  client.setString(key2, newValue2.toString())

  const key3 = stringToHex("key3")
  const value3 = await client.getBoolean(key3)
  console.log("key3 %s - value : %s", key3, value3)
  const v3 = value3.valueOf()
  const newValue3 = v3 == undefined ? false : !v3
  console.log("new boolean value " + newValue3)
  client.setBoolean(key3, newValue3)

  client.removeValue(stringToHex("key4"))

  const tx = await client.commit()
  assert(tx)
})

test("Poll message", async () => {
  assert(rpc, "RPC must be set in .env file")
  assert(address, "CONTRACT_ADDRESS must be set in .env file")
  assert(attestorPk, "ATTESTOR_PRIVATE_KEY must be set in .env file")

  const client = new InkClient(
    rpc,
    address,
    attestorPk,
    undefined,
    requestMessageCodec,
    responseMessageCodec,
  )

  await client.startSession()

  const tail = await client.getQueueTailIndex()
  console.log("Tail Index: " + tail)
  const head = await client.getQueueHeadIndex()
  console.log("Head Index: " + head)
  const hasMessage = await client.hasMessage()
  console.log("hasMessage : " + hasMessage)

  let message
  do {
    message = await client.pollMessage()
    console.log("message %s", message)
  } while (message.isSome())

  await client.commit()
})

test("Feed data", async () => {
  assert(rpc, "RPC must be set in .env file")
  assert(address, "CONTRACT_ADDRESS must be set in .env file")
  assert(attestorPk, "ATTESTOR_PRIVATE_KEY must be set in .env file")

  const client = new InkClient(
    rpc,
    address,
    attestorPk,
    undefined,
    requestMessageCodec,
    responseMessageCodec,
  )

  await client.startSession()

  client.addAction({
    tag: "PriceFeed",
    value: {
      tradingPairId: 1,
      price: 94024n * 1_000_000_000_000_000_000n,
    },
  })

  await client.commit()
})

test("Meta Transaction", async () => {
  assert(rpc, "RPC must be set in .env file")
  assert(address, "CONTRACT_ADDRESS must be set in .env file")
  assert(attestorPk, "ATTESTOR_PRIVATE_KEY must be set in .env file")
  assert(senderPk, "SENDER_PRIVATE_KEY must be set in .env file")

  const client = new InkClient(
    rpc,
    address,
    attestorPk,
    senderPk,
    requestMessageCodec,
    responseMessageCodec,
  )

  await client.startSession()

  client.addAction({
    tag: "PriceFeed",
    value: {
      tradingPairId: 1,
      price: 94024n * 1_000_000_000_000_000_000n,
    },
  })

  await client.commit()
})

/*
test("Memory Leak", async () => {
  assert(rpc, "RPC must be set in .env file")
  assert(address, "CONTRACT_ADDRESS must be set in .env file")
  assert(attestorPk, "ATTESTOR_PRIVATE_KEY must be set in .env file")
  assert(senderPk, "SENDER_PRIVATE_KEY must be set in .env file")


  const client = new InkClient(
      rpc,
      address,
      attestorPk,
      senderPk,
      requestMessageCodec,
      responseMessageCodec,
  )


  const runJob = async () => {

    try {

      await client.startSession()

      client.addAction({
        tag: "PriceFeed",
        value: {
          tradingPairId: 1,
          price: 94024n * 1_000_000_000_000_000_000n,
        },
      })

      await client.commit()
    } catch (e){
      await client.rollback();
    }
  }

  const file = "heap-test";
  writeHeapSnapshot(file + "-initial.heapsnapshot");
  for (let i = 0; i < 5 ; i++) {
    console.log("iteration " + i);
    await runJob();
    writeHeapSnapshot(file + "-iteration-" + i + ".heapsnapshot")
  }

  writeHeapSnapshot(file +"-final.heapsnapshot");

})
 */
