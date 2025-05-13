import {
  Client,
} from "../src/client"
import {
  type BigIntType,
  HexString,
  None,
  type NumberType,
  Option,
} from "../src/types"
import {Coder, RawTypeEncoder, TypeCoder} from "@/coder";

// q/_tail : 0x712f5f7461696c
export const QUEUE_TAIL_KEY = "0x712f5f7461696c"
// q/_head : 0x712f5f68656164
export const QUEUE_HEAD_KEY = "0x712f5f68656164"
export const VERSION_NUMBER_KEY = "0x00000000000001"

type KvRawType = [HexString, HexString | undefined]
type ActionRawType = HexString


class SimpleTypeCoder implements TypeCoder  {

  encodeBoolean(value: boolean): HexString {
    return value ? '0x01' : '0x00';
  }

  encodeNumber(value: number, _type: NumberType): HexString {
    const hexStr = value.toString(16);
    return `0x${hexStr}`;
  }

  encodeBigInt(value: bigint, _type: BigIntType): HexString {
    const hexStr = value.toString(16);
    return `0x${hexStr}`;
  }

  encodeString(value: string): HexString {
    const hexStr = Buffer.from(value, 'utf-8').toString('hex');
    return `0x${hexStr}`;
  }

  encodeBytes(value: Uint8Array): HexString {
    const hexStr = Array.from(value)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `0x${hexStr}`;
  }

  decodeBoolean(value: HexString): boolean {
    return value === '0x01';
  }

  decodeNumber(value: HexString, _type: NumberType): number {
    return parseInt(value, 16)
  }

  decodeBigInt(value: HexString, _type: BigIntType): bigint {
    return BigInt(value)
  }

  decodeString(value: HexString): string {
    const bytes = value
      .slice(2)
      .match(/.{1,2}/g);

    if (!bytes){
      return "";
    }
    return bytes
      .map(b => String.fromCharCode(parseInt(b, 16)))
      .join('');
  }

  decodeBytes(value: HexString): Uint8Array {
    if (value.length % 2 != 0){
      throw new Error('Invalid Hex String')
    }
    const bytes = new Uint8Array(value.length / 2);
    for (let i = 0; i < value.length; i+= 2){
      bytes[i / 2] = parseInt(value.substring(i, 2), 16);
    }
    return bytes;
  }

}

class StringEncoder implements RawTypeEncoder<KvRawType, ActionRawType> {
  encodeKeyValue(key: HexString, value: Option<HexString>): KvRawType {
    return [key, value.orElse("0x")]
  }

  encodeReply(action: HexString): ActionRawType {
    const actionWithoutPrefix = action.slice(2);
    return `0x01${actionWithoutPrefix}`;
  }

  encodeSetQueueHead(index: number): ActionRawType {
    const encodedNumberWithoutPrefix = simpleTypeCoder.encodeNumber(index, "u32").slice(2);
    return `0x02${encodedNumberWithoutPrefix}`;
  }
}

class MockCoder implements Coder<HexString> {
  decode(raw: HexString): HexString {
    return raw;
  }
  encode(value: HexString): HexString {
    return value;
  }
}

export const simpleTypeCoder = new SimpleTypeCoder();
export const stringEnCoder = new StringEncoder();
export const mockCoder = new MockCoder();

export const KEY_1 = '0xff01';
export const KEY_2 = '0xff02';
export const KEY_3 = '0xff03';
export const KEY_4 = '0xff04';

export const remoteValues  = new Map<HexString, HexString>();
export let remoteActions : string[] = [];


export function resetRemoteStorage(){
  remoteValues.clear();
  // storage for the message queue
  remoteValues.set(QUEUE_TAIL_KEY, simpleTypeCoder.encodeNumber(4, 'u32'))
  remoteValues.set(QUEUE_HEAD_KEY, simpleTypeCoder.encodeNumber(1, 'u32'))
  remoteValues.set(simpleTypeCoder.encodeNumber(1, 'u32'), simpleTypeCoder.encodeString('message 1'))
  remoteValues.set(simpleTypeCoder.encodeNumber(2, 'u32'), simpleTypeCoder.encodeString('message 2'))
  remoteValues.set(simpleTypeCoder.encodeNumber(3, 'u32'), simpleTypeCoder.encodeString('message 3'))
  // the version number
  remoteValues.set(VERSION_NUMBER_KEY, simpleTypeCoder.encodeNumber(33, 'u32'))
  // other values in kv store
  remoteValues.set(KEY_1, simpleTypeCoder.encodeNumber(31, 'u32'))
  remoteValues.set(KEY_2, simpleTypeCoder.encodeString('Hello'))
  remoteValues.set(KEY_3, simpleTypeCoder.encodeBoolean(true))
  remoteValues.set(KEY_4, simpleTypeCoder.encodeString('Empty'))

  remoteActions = [];
}

export class MockClient extends Client<KvRawType, ActionRawType, string, string> {

  metaTx : boolean = false;

  public constructor(metaTx : boolean) {
    super(
      simpleTypeCoder,
      stringEnCoder,
      mockCoder,
      mockCoder,
      VERSION_NUMBER_KEY,
      QUEUE_HEAD_KEY,
      QUEUE_TAIL_KEY,
    )
    this.metaTx = metaTx;
  }

  protected useMetaTransaction(): boolean {
    return this.metaTx;
  }

  getMessageKey(index: number): HexString {
    return simpleTypeCoder.encodeNumber(index, "u32");
  }

  async getRemoteValue(key: HexString): Promise<Option<HexString>> {
    const value = remoteValues.get(key);
    return Option.of(value)
  }

  async sendTransaction(
    conditions: KvRawType[],
    updates: KvRawType[],
    actions: ActionRawType[],
  ): Promise<HexString> {

    console.log("Send Transaction ....")
    logParams(conditions, updates, actions);
    checkConditions(conditions);
    updateRemoteValues(updates);
    doRemoteActions(actions);
    return "0x01";
  }


  async sendMetaTransaction(
    conditions: KvRawType[],
    updates: KvRawType[],
    actions: ActionRawType[],
  ): Promise<HexString> {

    console.log("Send Meta Transaction ....")
    logParams(conditions, updates, actions)
    checkConditions(conditions);
    updateRemoteValues(updates);
    doRemoteActions(actions);
    return "0x01";
  }
}

function logParams(
  conditions: KvRawType[],
  updates: KvRawType[],
  actions: ActionRawType[],
){
  conditions.forEach((v) =>
    console.log("condition - key : " + v[0] + " - value : " + v[1]),
  )
  updates.forEach((v) =>
    console.log("updates - key : " + v[0] + " - value : " + v[1]),
  )
  actions.forEach((v) => console.log("action : " + v))
}


function checkConditions(
  conditions: KvRawType[],
){
  conditions.forEach((c) => {
    const key = c[0] as HexString;
    const value = c[1];
    const remoteValue = remoteValues.get(key);
    if (value !== remoteValue) {
      throw new Error("Condition Not Met")
    }
  })
}

function updateRemoteValues(
  updates: KvRawType[],
) {
  updates.forEach((c) => {
    const key = c[0] as HexString;
    const value = c[1];
    if (value) {
      remoteValues.set(key, value);
    } else {
      remoteValues.delete(key);
    }
  })
}


function doRemoteActions(
  actions: ActionRawType[],
){
  actions.forEach((v) => {
    if (v.startsWith('0x01')){
      remoteActions.push(`0x${v.slice(4)}`)
    } else if (v.startsWith('0x02')){
      // update the queue index
      const encodedIndex = v.slice(4);
      remoteValues.set(QUEUE_HEAD_KEY, `0x${encodedIndex}`);
    }
  })
}


