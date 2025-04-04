import {assert, expect, test} from "vitest";
import {InkClient} from "../src/ink-client";
import * as process from "node:process";
import {configDotenv} from "dotenv";
import {stringToHex} from "@polkadot/util";

const rpc = 'wss://rpc.shibuya.astar.network';
const address = 'ZNSgeEfQDyEi4C6eLwMYeXQVQx5x4LVvxhKyVwrBDK3Z9gY';

configDotenv();
const pk = process.env.pk;


test('encoding / decoding', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk);

  let n : number = 20;
  let encodedNumber = client.encodeNumericValue(n);
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x14000000');
  expect(client.decodeNumericValue(encodedNumber)).toBe(n);

  n = 5;
  encodedNumber = client.encodeNumericValue(n);
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x05000000');
  expect(client.decodeNumericValue(encodedNumber)).toBe(n);

  const encodedBooleanFalse = client.encodeBooleanValue(false);
  console.log('encoded %s : %s', false, encodedBooleanFalse);
  expect(encodedBooleanFalse).toBe('0x00');
  expect(client.decodeBooleanValue(encodedBooleanFalse)).toBe(false);

  const encodedBooleanTrue = client.encodeBooleanValue(true);
  console.log('encoded %s : %s', true, encodedBooleanTrue);
  expect(encodedBooleanTrue).toBe('0x01');
  expect(client.decodeBooleanValue(encodedBooleanTrue)).toBe(true);

  const s = 'test';
  const encodedString = client.encodeStringValue(s);
  console.log('encoded %s : %s', s, encodedString);
  assert(encodedString); // todo check the value
  expect(client.decodeStringValue(encodedString)).toBe(s);

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

test('Read / Write values', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk);

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
  const newValue3 = v3 ? !v3 : false;
  client.setBooleanValue(key3, newValue3);

  client.removeValue(stringToHex('key4'));

  const tx = await client.commit();
  assert(tx)
});


test('Poll message', async () => {

  if (pk == undefined){
    return;
  }

  const client = new InkClient(rpc, address, pk);

  const tail = await client.getQueueTailIndex();
  console.log('Tail Index: ' + tail);
  const head = await client.getQueueHeadIndex();
  console.log('Head Index: ' + head);
  const hasMessage = await client.hasMessage();
  console.log('hasMessage : ' + hasMessage);

  let message;
  do {
    message = await client.pollMessage();
    if (message.isSome()){
      console.log('message : ' + message.valueOf());
    } else {
      console.log('No more message ');
    }
  } while (message.isSome());

  await client.commit();

});

