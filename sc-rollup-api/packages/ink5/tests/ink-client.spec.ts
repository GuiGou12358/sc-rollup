import {assert, expect, test} from "vitest";
import {InkClient} from "../src/ink-client";
import {stringToHex} from "@polkadot/util";
import {Some} from "../../core/src/types";
import * as process from "node:process";
import {configDotenv} from "dotenv";

const rpc = 'wss://rpc.shibuya.astar.network';
const address = 'X9Fmz7823BWqgX4g3aZCUfbx1HKocHPzteMimEMAnrt6iVw';

// grace ready roast engine harvest sting open amused enforce use problem very
//configDotenv().config();

configDotenv();
const pk = process.env.pk;

/*
test('encoding / decoding', async () => {


  const client = new InkClient(rpc, address, pk);
  await client.connect();

  const n : number = 5;
  const encodedNumber = client.encodeNumericValue(n);
  console.log('encoded %s : %s', n, encodedNumber);
  assert(encodedNumber);
  expect(client.decodeNumericValue(encodedNumber)).toBe(n);

  const encodedBooleanFalse = client.encodeBooleanValue(false);
  console.log('encoded %s : %s', false, encodedBooleanFalse);
  assert(encodedBooleanFalse);
  expect(client.decodeBooleanValue(encodedBooleanFalse)).toBe(false);

  const encodedBooleanTrue = client.encodeBooleanValue(true);
  console.log('encoded %s : %s', true, encodedBooleanTrue);
  assert(encodedBooleanTrue);
  expect(client.decodeBooleanValue(encodedBooleanTrue)).toBe(true);

  const s = 'test';
  const encodedString = client.encodeStringValue(s);
  console.log('encoded %s : %s', s, encodedString);
  assert(encodedString);
  expect(client.decodeStringValue(encodedString)).toBe(s);

});

test('Read / Write values', async () => {

  const client = new InkClient(rpc, address, pk);

  await client.connect();

  const key1 = stringToHex('key1')
  const value1 = await client.getNumericValue(key1);
  console.log('key1 %s - value : %s', key1, value1);
  const newValue1 = value1.isNone() ? 1 : (value1 as Some<number>).getValue() + 1;
  client.setNumericValue(key1, newValue1);

  const key2 = stringToHex('key2')
  const value2 = await client.getStringValue(key2);
  console.log('key2 %s - value : %s', key2, value2);
  const newValue2 = value2.isNone() ? '1': (value2 as Some<string>).getValue() + 1;
  client.setStringValue(key2, newValue2);

  const key3 = stringToHex('key3')
  const value3 = await client.getBooleanValue(key3);
  console.log('key3 %s - value : %s', key3, value3);
  const newValue3 = value3.isNone() ? false : !(value3 as Some<boolean>);
  client.setBooleanValue(key3, newValue3);

  client.removeValue(stringToHex('key4'));

  const tx = await client.commit();
  console.log('tx: %s', tx);
});
 */


test('Poll message', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk);

  await client.connect();

  const tail = await client.getQueueTailIndex();
  console.log('Tail Index: ' + tail);
  const head = await client.getQueueHeadIndex();
  console.log('Head Index: ' + head);
  const hasMessage = await client.hasMessage();
  console.log('hasMessage : ' + hasMessage);

  let message;
  do {
    message = await client.pollMessage();
    console.log('message : ' + message);
  } while (message.isSome());

  await client.commit();

});