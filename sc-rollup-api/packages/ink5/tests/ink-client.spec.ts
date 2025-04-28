import {assert, expect, test} from "vitest";
import {InkClient, InkCodec} from "../src/ink-client";
import * as process from "node:process";
import {configDotenv} from "dotenv";
import {stringToHex} from "@polkadot/util";
import {HexString} from "@polkadot/util/types";
import {MessageCoder} from "@guigou/sc-rollup-core";

const rpc = 'wss://rpc.shibuya.astar.network';
const address = 'YGFfcLpZf7TAN2kn2J6trsj93jKyv9uBG8xSeXyLSFySM8x';

configDotenv();
const pk = process.env.pk;


test('encoding / decoding', async () => {

  const codec = new InkCodec();

  let n : number = 20;
  let encodedNumber = codec.encodeNumeric(n);
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x14000000');
  expect(codec.decodeNumeric(encodedNumber)).toBe(n);

  n = 5;
  encodedNumber = codec.encodeNumeric(n);
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x05000000');
  expect(codec.decodeNumeric(encodedNumber)).toBe(n);

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

/*
test('Check compatibility', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk);
  await client.checkCompatibility();

});
*/

class MyMessageCoder implements MessageCoder<HexString> {
  decode(raw: HexString): HexString {
    return raw
  }
  encode(message: HexString): HexString {
    return message
  }
}

test('Read / Write values', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk, new MyMessageCoder());

  await client.startSession();

  const key1 = stringToHex('key1')
  const value1 = await client.getNumericValue(key1);
  console.log('key1 %s - value : %s', key1, value1);
  const v1 = value1.valueOf();
  const newValue1 = v1 ? v1 + 1 : 1;
  client.setNumericValue(key1, newValue1);

  const key2 = stringToHex('key2')
  const value2 = await client.getStringValue(key2);
  console.log('key2 %s - value : %s', key2, value2);
  const v2 = value2.valueOf();
  const newValue2 = v2 ? Number(v2) + 1 : 1;
  client.setStringValue(key2, newValue2.toString());

  const key3 = stringToHex('key3')
  const value3 = await client.getBooleanValue(key3);
  console.log('key3 %s - value : %s', key3, value3);
  const v3 = value3.valueOf();
  const newValue3 = v3 == undefined ? false : !v3;
  console.log('new boolean value ' + newValue3);
  client.setBooleanValue(key3, newValue3);

  client.removeValue(stringToHex('key4'));

  const tx = await client.commit();
  assert(tx)
});



test('Poll message', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk, new MyMessageCoder());

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

  const client = new InkClient(rpc, address, pk, new MyMessageCoder());

  await client.startSession();

  client.addAction('0x00');

  await client.commit();

});

