import {assert, expect, test} from "vitest";
import {InkClient, InkCodec} from "../src/ink-client";
import * as process from "node:process";
import {configDotenv} from "dotenv";
import {mergeUint8} from "polkadot-api/utils";
import {Binary} from "@polkadot-api/substrate-bindings";
import {hexToU8a, stringToHex, stringToU8a, u8aConcat, u8aToHex} from "@polkadot/util";
import {Struct, u8, u32, Option, u128} from "scale-ts";

const rpc = 'wss://rpc.shibuya.astar.network';
const address = 'Z3CvWXXo9Hhgw7rjs5m8aekZszdniAFBER64yhD3Lobae3G';

configDotenv();
const pk = process.env.pk;


test('encode keys', async () => {
  expect(Binary.fromText("q/_tail").asHex()).toBe('0x712f5f7461696c');
  expect(stringToHex("q/_tail")).toBe('0x712f5f7461696c');

  expect(Binary.fromText("q/_head").asHex()).toBe('0x712f5f68656164');
  expect(stringToHex("q/_head")).toBe('0x712f5f68656164');

  expect(Binary.fromText("v/_number").asHex()).toBe('0x762f5f6e756d626572');
  expect(stringToHex("v/_number")).toBe('0x762f5f6e756d626572');


  const codec = new InkCodec();
  const index = 7
  const encodedIndex = hexToU8a(codec.encodeNumber(index, "u32"))
  const v1 = u8aToHex(u8aConcat(stringToU8a("q/"), encodedIndex))

  expect(v1).toBe('0x712f07000000');

  const p = Binary.fromText("q/").asBytes()
  const i = u32.enc(index)
  const v2 = Binary.fromBytes(mergeUint8(p, i)).asHex()
  expect(v2).toBe('0x712f07000000');

});

test('encoding / decoding Type', async () => {

  const codec = new InkCodec();

  let n = 8;
  let encodedNumber = codec.encodeNumber(n, "u8");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x08');
  expect(codec.decodeNumber(encodedNumber, "u8")).toBe(n);

  n = 16;
  encodedNumber = codec.encodeNumber(n, "u16");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x1000');
  expect(codec.decodeNumber(encodedNumber, "u16")).toBe(n);

  n = 32;
  encodedNumber = codec.encodeNumber(n, "u32");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x20000000');
  expect(codec.decodeNumber(encodedNumber, "u32")).toBe(n);

  let bn  = BigInt(64);
  encodedNumber = codec.encodeBigInt(bn, "u64");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x4000000000000000');
  expect(codec.decodeBigInt(encodedNumber, "u64")).toBe(bn);

  bn  = BigInt(128);
  encodedNumber = codec.encodeBigInt(bn, "u128");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x80000000000000000000000000000000');
  expect(codec.decodeBigInt(encodedNumber, "u128")).toBe(bn);

  const encodedBooleanFalse = codec.encodeBoolean(false);
  console.log('encoded %s : %s', false, encodedBooleanFalse);
  expect(encodedBooleanFalse).toBe('0x00');
  expect(codec.decodeBoolean(encodedBooleanFalse)).toBe(false);

  const encodedBooleanTrue = codec.encodeBoolean(true);
  console.log('encoded %s : %s', true, encodedBooleanTrue);
  expect(encodedBooleanTrue).toBe('0x01');
  expect(codec.decodeBoolean(encodedBooleanTrue)).toBe(true);

  const s = 'test';
  const encodedString = codec.encodeString(s);
  console.log('encoded %s : %s', s, encodedString);
  assert(encodedString); // todo check the value
  expect(codec.decodeString(encodedString)).toBe(s);

});


const myMessageCodec = Struct({
  respType: u8,
  tradingPairId: u32,
  price: Option(u128),
  errNo: Option(u128),
});


test('encoding / decoding Message', async () => {

  const encoded = myMessageCodec.enc({
    respType : 11,
    tradingPairId : 1,
    price : 94024n * 1_000_000_000_000_000_000n,
    errNo: undefined,
  });

  expect(u8aToHex(encoded)).toBe('0x0b0100000001000020707fef1e0de91300000000000000');

  const decoded = myMessageCodec.dec('0x0b0300000001000020707fef1e0de91300000000000000');

  expect(decoded).toStrictEqual({
    respType : 11,
    tradingPairId : 3,
    price : 94024n * 1_000_000_000_000_000_000n,
    errNo: undefined,
  });

});

/*
test('Check compatibility', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk, myMessageCoder);
  await client.checkCompatibility();

});
*/


test('Read / Write values', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk, myMessageCodec);

  await client.startSession();

  const key1 = stringToHex('key1')
  const value1 = await client.getNumber(key1, "u32");
  console.log('key1 %s - value : %s', key1, value1);
  const v1 = value1.valueOf();
  const newValue1 = v1 ? v1 + 1 : 1;
  client.setNumber(key1, newValue1,"u32");

  const key2 = stringToHex('key20')
  const value2 = await client.getString(key2);
  console.log('key2 %s - value : %s', key2, value2);
  const v2 = value2.valueOf();
  const newValue2 = v2 ? Number(v2) + 1 : 1;
  client.setString(key2, newValue2.toString());

  const key3 = stringToHex('key3')
  const value3 = await client.getBoolean(key3);
  console.log('key3 %s - value : %s', key3, value3);
  const v3 = value3.valueOf();
  const newValue3 = v3 == undefined ? false : !v3;
  console.log('new boolean value ' + newValue3);
  client.setBoolean(key3, newValue3);

  client.removeValue(stringToHex('key4'));

  const tx = await client.commit();
  assert(tx)
});


test('Poll message', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk, myMessageCodec);

  await client.startSession();

  const tail = await client.getQueueTailIndex();
  console.log('Tail Index: ' + tail);
  const head = await client.getQueueHeadIndex();
  console.log('Head Index: ' + head);
  const hasMessage = await client.hasMessage();
  console.log('hasMessage : ' + hasMessage);

  let message;
  do {
    message = await client.pollMessage();
    console.log('message %s', message);
  } while (message.isSome());

  await client.commit();

});

test('Feed data', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk, myMessageCodec);

  await client.startSession();

  client.addAction({
    respType : 11,
    tradingPairId : 2,
    price : 1800n * 1_000_000_000_000_000_000n,
    errNo: undefined,
  });

  await client.commit();

});

