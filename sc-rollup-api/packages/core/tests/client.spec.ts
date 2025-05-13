import {assert, expect, test} from "vitest";
import {
  KEY_1,
  KEY_2,
  KEY_3,
  KEY_4,
  MockClient,
  remoteActions,
  remoteValues,
  resetRemoteStorage,
  simpleTypeCoder,
  VERSION_NUMBER_KEY
} from "./mock-client";


test('encoding / decoding Type', async () => {

  const codec = simpleTypeCoder;

  let n = 8;
  let encodedNumber = codec.encodeNumber(n, "u8");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x8');
  expect(codec.decodeNumber(encodedNumber, "u8")).toBe(n);

  n = 16;
  encodedNumber = codec.encodeNumber(n, "u16");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x10');
  expect(codec.decodeNumber(encodedNumber, "u16")).toBe(n);

  n = 32;
  encodedNumber = codec.encodeNumber(n, "u32");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x20');
  expect(codec.decodeNumber(encodedNumber, "u32")).toBe(n);

  let bn  = BigInt(64);
  encodedNumber = codec.encodeBigInt(bn, "u64");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x40');
  expect(codec.decodeBigInt(encodedNumber, "u64")).toBe(bn);

  bn  = BigInt(128);
  encodedNumber = codec.encodeBigInt(bn, "u128");
  console.log('encoded %s : %s', n, encodedNumber);
  expect(encodedNumber).toBe('0x80');
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
  expect(codec.decodeString(encodedString)).toBe(s);

});

test('Read / Write values', async () => {

  // reset the storage in a know state
  resetRemoteStorage();

  const client = new MockClient(false);

  await client.startSession();

  const value1 = await client.getNumber(KEY_1, "u32");
  expect(value1.valueOf()).toBe(31);
  client.setNumber(KEY_1, 33,"u32");

  const value2 = await client.getString(KEY_2);
  expect(value2.valueOf()).toBe('Hello');
  client.setString(KEY_2, 'Hello Dot');

  const value3 = await client.getBoolean(KEY_3);
  expect(value3.valueOf()).toBe(true);
  client.setBoolean(KEY_3, false);

  client.removeValue(KEY_4);

  // remote values are not saved yet
  expect(remoteValues.get(KEY_1)).toBe(simpleTypeCoder.encodeNumber(31, "u32"));
  expect(remoteValues.get(KEY_2)).toBe(simpleTypeCoder.encodeString("Hello"));
  expect(remoteValues.get(KEY_3)).toBe(simpleTypeCoder.encodeBoolean(true));
  expect(remoteValues.get(KEY_4)).toBe(simpleTypeCoder.encodeString("Empty"));
  expect(remoteValues.get(VERSION_NUMBER_KEY)).toBe(simpleTypeCoder.encodeNumber(33, "u32"));

  // read again the value (from local storage)
  const value1Again = await client.getNumber(KEY_1, "u32");
  expect(value1Again.valueOf()).toBe(33);

  const value2Again = await client.getString(KEY_2);
  expect(value2Again.valueOf()).toBe('Hello Dot');

  const value3Again = await client.getBoolean(KEY_3);
  expect(value3Again.valueOf()).toBe(false);

  const value4Again = await client.getString(KEY_4);
  expect(value4Again.valueOf()).toBeUndefined

  // save the tx
  const tx = await client.commit();
  assert(tx)

  // check the remote values are not saved yet
  expect(remoteValues.get(KEY_1)).toBe(simpleTypeCoder.encodeNumber(33, "u32"));
  expect(remoteValues.get(KEY_2)).toBe(simpleTypeCoder.encodeString("Hello Dot"));
  expect(remoteValues.get(KEY_3)).toBe(simpleTypeCoder.encodeBoolean(false));
  expect(remoteValues.get(KEY_4)).toBeUndefined
  // version number must be updated
  expect(remoteValues.get(VERSION_NUMBER_KEY)).toBe(simpleTypeCoder.encodeNumber(34, "u32"));

});


test('Test Rollback', async () => {

  // reset the storage in a know state
  resetRemoteStorage();
  expect(remoteActions.length).toBe(0);

  const client = new MockClient(false);

  // remote values at the beginning
  expect(remoteValues.get(KEY_1)).toBe(simpleTypeCoder.encodeNumber(31, "u32"));
  expect(remoteValues.get(KEY_4)).toBe(simpleTypeCoder.encodeString("Empty"));

  await client.startSession();

  // update the key 1
  let value1 = await client.getNumber(KEY_1, "u32");
  expect(value1.valueOf()).toBe(31);
  client.setNumber(KEY_1, 33,"u32");

  // remove the key 4
  let value4 = await client.getString(KEY_4);
  expect(value4.valueOf()).toBe("Empty");
  client.removeValue(KEY_4);

  // read again the value (from local storage)
  // check the key 1
  value1 = await client.getNumber(KEY_1, "u32");
  expect(value1.valueOf()).toBe(33);
  // check the key 4
  value4 = await client.getString(KEY_4);
  expect(value4.valueOf()).toBeUndefined

  // add an action
  client.addAction('0x0002000000000020707fef1e0de913000000000000');

  // rollback
  await client.rollback();

  // remote values are not updated
  expect(remoteValues.get(KEY_1)).toBe(simpleTypeCoder.encodeNumber(31, "u32"));
  expect(remoteValues.get(KEY_4)).toBe(simpleTypeCoder.encodeString("Empty"));

  expect(remoteActions.length).toBe(0);

  // and the values in the session are empty
  value1 = await client.getNumber(KEY_1, "u32");
  expect(value1.valueOf()).toBe(31);
  value4 = await client.getString(KEY_4);
  expect(value4.valueOf()).toBe("Empty");

});


test('Poll message', async () => {

  // reset the storage in a know state
  resetRemoteStorage();

  const client = new MockClient(false);

  await client.startSession();

  const head = await client.getQueueHeadIndex();
  expect(head).toBe(1);

  const tail = await client.getQueueTailIndex();
  expect(tail).toBe(4);

  let message;
  let nbMessages = 0;
  do {
    message = await client.pollMessage();
    console.log('message %s', message);
    if (message.isSome()) {
      nbMessages ++;
    }
  } while (message.isSome());

  // check the number of message
  expect(nbMessages).toBe(3);

  await client.commit();

  // check teh queue index
  const headAgain = await client.getQueueHeadIndex();
  expect(headAgain).toBe(4);

  const tailAgain = await client.getQueueTailIndex();
  expect(tailAgain).toBe(4);


});

test('Feed data', async () => {

  // reset the storage in a know state
  resetRemoteStorage();
  expect(remoteActions.length).toBe(0);

  const client = new MockClient(false);

  await client.startSession();
  client.addAction('0x0002000000000020707fef1e0de913000000000000');
  await client.commit();

  expect(remoteActions.length).toBe(1);
  expect(remoteActions[0]).toBe('0x0002000000000020707fef1e0de913000000000000');

});


test('Meta Transaction', async () => {

  // reset the storage in a know state
  resetRemoteStorage();
  expect(remoteActions.length).toBe(0);

  const client = new MockClient(true);

  await client.startSession();
  client.addAction('0x0002000000000020707fef1e0de913000000000000');
  await client.commit();

  expect(remoteActions.length).toBe(1);
  expect(remoteActions[0]).toBe('0x0002000000000020707fef1e0de913000000000000');

});
