import { assert, expect, test } from "vitest"
import * as process from "node:process"
import { configDotenv } from "dotenv"
import { EvmClient, EvmTypeCoder, hexAddPrefix } from "../src/evm-client"
import { ethers } from "ethers"
import { RawMessageCoder } from "./raw-message-coder"

const rpc = "https://rpc.minato.soneium.org"
const address = "0x51E561EAca24c91D6A3227c60Cbfdf0F527fA43e"

configDotenv()
const pk = process.env.pk

test("encode keys", async () => {
  const QUEUE_TAIL_KEY = hexAddPrefix(
    ethers.hexlify(ethers.toUtf8Bytes("q/_tail")),
  )
  const QUEUE_HEAD_KEY = hexAddPrefix(
    ethers.hexlify(ethers.toUtf8Bytes("q/_head")),
  )
  const VERSION_NUMBER_KEY = hexAddPrefix(
    ethers.hexlify(ethers.toUtf8Bytes("v/_number")),
  )

  expect(QUEUE_TAIL_KEY).toBe("0x712f5f7461696c")
  expect(QUEUE_HEAD_KEY).toBe("0x712f5f68656164")
  expect(VERSION_NUMBER_KEY).toBe("0x762f5f6e756d626572")
})

test("encoding / decoding Type", async () => {
  const codec = new EvmTypeCoder()

  let n = 8
  let encodedNumber = codec.encodeNumber(n, "u8")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe(
    "0x0000000000000000000000000000000000000000000000000000000000000008",
  )
  expect(codec.decodeNumber(encodedNumber, "u8")).toBe(n)

  n = 16
  encodedNumber = codec.encodeNumber(n, "u16")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe(
    "0x0000000000000000000000000000000000000000000000000000000000000010",
  )
  expect(codec.decodeNumber(encodedNumber, "u16")).toBe(n)

  n = 32
  encodedNumber = codec.encodeNumber(n, "u32")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe(
    "0x0000000000000000000000000000000000000000000000000000000000000020",
  )
  expect(codec.decodeNumber(encodedNumber, "u32")).toBe(n)

  let bn = BigInt(64)
  encodedNumber = codec.encodeBigInt(bn, "u64")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe(
    "0x0000000000000000000000000000000000000000000000000000000000000040",
  )
  expect(codec.decodeBigInt(encodedNumber, "u64")).toBe(bn)

  bn = BigInt(128)
  encodedNumber = codec.encodeBigInt(bn, "u128")
  console.log("encoded %s : %s", n, encodedNumber)
  expect(encodedNumber).toBe(
    "0x0000000000000000000000000000000000000000000000000000000000000080",
  )
  expect(codec.decodeBigInt(encodedNumber, "u128")).toBe(bn)

  const encodedBooleanFalse = codec.encodeBoolean(false)
  console.log("encoded %s : %s", false, encodedBooleanFalse)
  expect(encodedBooleanFalse).toBe(
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  )
  expect(codec.decodeBoolean(encodedBooleanFalse)).toBe(false)

  const encodedBooleanTrue = codec.encodeBoolean(true)
  console.log("encoded %s : %s", true, encodedBooleanTrue)
  expect(encodedBooleanTrue).toBe(
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  )
  expect(codec.decodeBoolean(encodedBooleanTrue)).toBe(true)

  const s = "test"
  const encodedString = codec.encodeString(s)
  console.log("encoded %s : %s", s, encodedString)
  assert(encodedString) // todo check the value
  expect(codec.decodeString(encodedString)).toBe(s)
})

test("Read / Write values and Poll messages", async () => {
  if (pk == undefined) {
    return
  }
  console.log("start ")

  const client = new EvmClient(
    rpc,
    address,
    pk,
    undefined,
    new RawMessageCoder(),
    new RawMessageCoder(),
  )

  await client.startSession()

  const key1 = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes("key1")))
  const value1 = await client.getNumber(key1, "u32")
  console.log("key1 %s - value : %s", key1, value1)
  const v1 = value1.valueOf()
  const newValue1 = v1 ? v1 + 1 : 1
  client.setNumber(key1, newValue1, "u32")

  const key2 = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes("key20")))
  const value2 = await client.getString(key2)
  console.log("key2 %s - value : %s", key2, value2)
  const v2 = value2.valueOf()
  const newValue2 = v2 ? Number(v2) + 1 : 1
  client.setString(key2, newValue2.toString())

  const key3 = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes("key3")))
  const value3 = await client.getBoolean(key3)
  console.log("key3 %s - value : %s", key3, value3)
  const v3 = value3.valueOf()
  const newValue3 = v3 == undefined ? false : !v3
  console.log("new boolean value " + newValue3)
  client.setBoolean(key3, newValue3)

  client.removeValue(hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes("key4"))))

  const tx = await client.commit()
  assert(tx)
})

test("Poll message", async () => {
  if (pk == undefined) {
    return
  }

  const client = new EvmClient(
    rpc,
    address,
    pk,
    undefined,
    new RawMessageCoder(),
    new RawMessageCoder(),
  )

  await client.startSession()

  const tail = await client.getQueueTailIndex()
  console.log("Tail Index: " + tail)
  const head = await client.getQueueHeadIndex()
  console.log("Head Index: " + head)

  let message
  do {
    message = await client.pollMessage()
    console.log("message %s", message)
  } while (message.isSome())

  await client.commit()
})

test("Feed data", async () => {
  if (pk == undefined) {
    return
  }

  const client = new EvmClient(
    rpc,
    address,
    pk,
    undefined,
    new RawMessageCoder(),
    new RawMessageCoder(),
  )

  await client.startSession()
  client.addAction("0x0002000000000020707fef1e0de913000000000000")
  await client.commit()
})

test("Meta Transaction", async () => {
  if (pk == undefined) {
    return
  }

  const client = new EvmClient(
    rpc,
    address,
    pk,
    pk,
    new RawMessageCoder(),
    new RawMessageCoder(),
  )

  await client.startSession()
  client.addAction("0x0002000000000020707fef1e0de913000000000000")

  await client.commit()
})
