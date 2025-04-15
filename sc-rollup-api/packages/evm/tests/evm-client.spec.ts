import {assert, expect, test} from "vitest";
import * as process from "node:process";
import {configDotenv} from "dotenv";
import {EvmClient, EvmCodec, hexAddPrefix} from "../src/evm-client";
import {BytesLike, ethers} from "ethers";
import {HexString, Option} from "../../core/src/types";

const rpc = 'https://rpc.minato.soneium.org';
const address = '0x8122f5742fBe3456930F8dBCA2AdE3cD678089ff';

configDotenv();
const pk = process.env.pk;


test('encoding / decoding', async () => {

  const codec = new EvmCodec();

  let n : number = 20;
  let encodedNumber = codec.encodeNumeric(n);
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x0000000000000000000000000000000000000000000000000000000000000014');
  expect(codec.decodeNumeric(encodedNumber)).toBe(n);

  n = 5;
  encodedNumber = codec.encodeNumeric(n);
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x0000000000000000000000000000000000000000000000000000000000000005');
  expect(codec.decodeNumeric(encodedNumber)).toBe(n);

  const encodedBooleanFalse = codec.encodeBoolean(false);
  console.log('encoded %s : %s', false, encodedBooleanFalse);
  expect(encodedBooleanFalse).toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
  expect(codec.decodeBoolean(encodedBooleanFalse)).toBe(false);

  const encodedBooleanTrue = codec.encodeBoolean(true);
  console.log('encoded %s : %s', true, encodedBooleanTrue);
  expect(encodedBooleanTrue).toBe('0x0000000000000000000000000000000000000000000000000000000000000001');
  expect(codec.decodeBoolean(encodedBooleanTrue)).toBe(true);

  const s = 'test';
  const encodedString = codec.encodeString(s);
  console.log('encoded %s : %s', s, encodedString);
  expect(encodedString).toBe('0x74657374');
  const decodedString = codec.decodeString(encodedString);
  console.log('decoded %s : %s', encodedString, decodedString);
  expect(decodedString).toBe(s);

});

test('Read / Write values', async () => {

  if (pk == undefined){
    return;
  }
  console.log('start ');

  const client = new EvmClient(rpc, address, pk);

  await client.startSession();

  const key1 = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes('key1')));
  console.log('key1 %s', key1);
  const value1 = await client.getNumericValue(key1);
  console.log('key1 %s - value : %s', key1, value1);
  const v1 = value1.valueOf();
  const newValue1 = v1 ? v1 + 1 : 1;
  client.setNumericValue(key1, newValue1);

  const key2 = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes('key2')));
  const value2 = await client.getStringValue(key2);
  console.log('key2 %s - value : %s', key2, value2);
  const v2 = value2.valueOf();
  const newValue2 = v2 ? Number(v2) + 1 : 1;
  client.setStringValue(key2, newValue2.toString());

  const key3 = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes('key3')));
  const value3 = await client.getBooleanValue(key3);
  console.log('key3 %s - value : %s', key3, value3);
  const v3 = value3.valueOf();
  const newValue3 = v3 == undefined ? false : !v3;
  console.log('new boolean value ' + newValue3);
  client.setBooleanValue(key3, newValue3);

  client.removeValue(hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes('key4'))));

  const tx = await client.commit();
  assert(tx)
});


test('Poll message', async () => {

  if (pk == undefined){
    return;
  }

  const client = new EvmClient(rpc, address, pk);

  await client.startSession();

  const tail = await client.getQueueTailIndex();
  console.log('Tail Index: ' + tail);
  const head = await client.getQueueHeadIndex();
  console.log('Head Index: ' + head);

  let message;
  do {
    message = await client.pollMessage();
    console.log('message %s', message);
  } while (message.isSome());

  await client.commit();

});