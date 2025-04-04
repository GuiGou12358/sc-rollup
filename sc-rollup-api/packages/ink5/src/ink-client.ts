import type {HexString} from "@polkadot/util/types";
import {Action, None, Option, Some} from "../../core/src/types";

import {contracts, shibuya} from "@polkadot-api/descriptors";


import {hexAddPrefix, hexToU8a, stringToHex, stringToU8a, u8aConcat, u8aToHex} from "@polkadot/util";
import {createInkSdk} from "@polkadot-api/sdk-ink";
import {createClient, ResultPayload, SS58String, Enum, FixedSizeBinary, FixedSizeArray, Binary} from 'polkadot-api';
import {withPolkadotSdkCompat} from "polkadot-api/polkadot-sdk-compat";
import {getWsProvider} from "polkadot-api/ws-provider/web";
import {Contract} from "@polkadot/api-contract/base";
import {entropyToMiniSecret, mnemonicToEntropy, sr25519} from "@polkadot-labs/hdkd-helpers";
import {sr25519CreateDerive} from "@polkadot-labs/hdkd";
import {getPolkadotSigner} from "polkadot-api/signer";
import {u32} from "scale-ts";
import {Keyring} from "@polkadot/api";



const ALICE = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

export class InkClient {

    readonly rpc: string;
    readonly address: string;
    readonly pk: string;
    contract: any | Contract<any>;
    currentSession: Session;

    public constructor(rpc: string, address: string, pk: string){
        this.rpc = rpc;
        this.address = address;
        this.pk = pk;
        this.currentSession = new Session();

        const client = createClient(
          withPolkadotSdkCompat(
            getWsProvider(this.rpc),
          )
        );
        const typedApi = client.getTypedApi(shibuya);
        const sdk = createInkSdk(typedApi, contracts.ink_client)
        this.contract = sdk.getContract(this.address);
        if (!this.contract.isCompatible()){
            throw new Error("Contract has changed");
        }
    }

    /*
    getSnapshotId(): SnapshotId {
        return "";
    }
     */

    async getIndex(key: HexString): Promise<number> {


        console.log('getIndex');

        const {success, value} = await this.contract.query('RollupClient::get_value',{
           origin: ALICE,
            data: {
               key : Binary.fromHex(key)
            }
        });

        if (!success){
            console.error('Error to get value for key %s  - value: %s ', key, value);
            return Promise.reject('Error to get value for key ' + key);
        }

        console.log("getIndex : ", value)

        const encodedValue =  value.response?.asHex();
        if (!encodedValue){
            return 0;
        }
        return this.decodeNumericValue(encodedValue);
    }

    async getQueueTailIndex(): Promise<number> {
        // q/_tail : 0x712f5f7461696c
        return await this.getIndex(stringToHex('q/_tail'));
    }

    async getQueueHeadIndex(): Promise<number> {
        // q/_head : 0x712f5f68656164
        return await this.getIndex(stringToHex('q/_head'));
    }

    async getMessage(index: number): Promise<HexString> {
        const encodedIndex = this.encodeNumericValue(index).replace('0x', '');
        const key = u8aToHex(u8aConcat(stringToU8a('q/'), encodedIndex));
        console.log('Key for getting the message for index ' + index + ' : ' + key);

        const {value, success} = await this.contract.query('RollupClient::get_value',{
            origin: ALICE,
            data: {
                key : Binary.fromHex(key)
            }
        });

        if (!success){
            console.error('Error to getMessage fro index %s - value: %s ', index, value);
            return Promise.reject('No message');
        }
        return value.response?.asHex();
    }

    async pollMessage(): Promise<Option<HexString>> {
        if (this.currentSession.currentIndex == undefined
          || this.currentSession.minIndex == undefined
          || this.currentSession.maxIndex == undefined
        ){
            this.currentSession.minIndex = await this.getQueueHeadIndex();
            this.currentSession.maxIndex = await this.getQueueTailIndex();
            this.currentSession.currentIndex = this.currentSession.minIndex;
        }

        if (this.currentSession.currentIndex >= this.currentSession.maxIndex){
            return new None();
        }
        const message =  await this.getMessage(this.currentSession.currentIndex);
        this.currentSession.currentIndex += 1;
        return new Some(message);
    }

    async hasMessage(): Promise<Boolean> {
        const {value, success} = await this.contract.query('RollupClient::has_message',{
            origin: ALICE,
        });
        if (!success){
            console.error('Error to query hasMessage - value: %s ', value);
            return Promise.reject('Error to query hasMessage' );
        }
        return value.response;
    }

    async getValue(key: HexString): Promise<Option<HexString>> {

        // search in the session
        const localValue = this.currentSession.updates.get(key);
        if (localValue){
            return localValue;
        }

        const {value, success} = await this.contract.query('RollupClient::get_value',{
            origin: ALICE,
            data: {
                key : Binary.fromHex(key)
            }
        });

        if (!success){
            return new None();
        }

        const remoteValue = value.response?.asHex();
        if (!remoteValue || remoteValue == '0x00'){
            return new None();
        }
        return new Some(remoteValue);
    };

    async getNumericValue(key: HexString): Promise<Option<Number>> {
        const value = await this.getValue(key)
        if (value.isNone()){
            return value;
        }
        const some = value as Some<HexString>;
        const decodedValue = this.decodeNumericValue(some.getValue());
        return new Some(decodedValue);
    }

    async getStringValue(key: HexString): Promise<Option<String>> {
        const value = await this.getValue(key)
        if (value.isNone()){
            return value;
        }
        const some = value as Some<HexString>;
        const decodedValue = this.decodeStringValue(some.getValue());
        return new Some(decodedValue);
    }

    async getBooleanValue(key: HexString): Promise<Option<Boolean>> {
        const value = await this.getValue(key)
        if (value.isNone()){
            return value;
        }
        const some = value as Some<HexString>;
        const decodedValue = this.decodeBooleanValue(some.getValue());
        return new Some(decodedValue);
    }

    decodeStringValue(value: HexString): string {
        return value.replace(/^0x/i, '')
          .match(/.{1,2}/g)!
          .map(byte => String.fromCharCode(parseInt(byte, 16)))
          .join('');
    }

    decodeBooleanValue(value: HexString): boolean {
        return value === '0x01';
    }

    decodeNumericValue(value: HexString): number {
        //return u8aToNumber(hexToU8a(value, 8));
        return parseInt(value.replace(/(00)+$/, ''), 16);

    }

    encodeStringValue(value: string): HexString {
        return hexAddPrefix(Binary.fromText(value).asHex());
    }

    encodeBooleanValue(value: boolean): HexString {
        return value ? '0x01' : '0x00';
    }

    encodeNumericValue(value: number): HexString {
        //return u8aToHex(numberToU8a(value, 8));
        //return numberToHex(value, 8);

        let v = value.toString(16);
        if (v.length % 2 != 0) {
            v = '0' + v;
        }
        if (v.length > 8) {
            throw new Error('Too big number for u32');
        }
        // u32
        return hexAddPrefix(v.padEnd(8, '0'));

    }

    setStringValue(key: HexString, value : string)  {
        const v = this.encodeStringValue(value);
        this.setValue(key, new Some(v));
    }

    setBooleanValue(key: HexString, value : boolean)  {
        const v = this.encodeBooleanValue(value);
        this.setValue(key, new Some(v));
    }

    setNumericValue(key: HexString, value : number)  {
        const v = this.encodeNumericValue(value);
        this.setValue(key, new Some(v));
    }

    removeValue(key: HexString)  {
        this.setValue(key, new None());
    }

    setValue(key: HexString, value: Option<HexString>) {
        this.currentSession.updates.set(key, value);
    }

    addAction(action: Action) {
        this.currentSession.actions.push(action);
    }

    async commit(): Promise<Option<HexString>> {

        /*
        const entropy = mnemonicToEntropy(this.pk);
        const miniSecret = entropyToMiniSecret(entropy);
        const derive = sr25519CreateDerive(miniSecret);
        const hdkdKeyPair = derive("//Alice");

        //console.log('pk : %s - length : %s', this.pk, this.pk.length);
        //console.log('public key : %s', sr25519.getPublicKey(this.pk));
        const signer = getPolkadotSigner(
          //sr25519.getPublicKey(this.pk),
          hdkdKeyPair.publicKey,
          "Sr25519",
          //(input) => sr25519.sign(input, this.pk)
          hdkdKeyPair.sign
        );
        */

        const signer = new Keyring({type: 'sr25519'}).addFromSeed(hexToU8a(this.pk));
        console.log('address %s', signer.publicKey);

        //contracts.ink_client.__types;

          //type T2 = (Binary) | undefined;

        //let conditions: (Binary | Option<Binary>)[][] =  [];
        let conditions: (Binary | undefined)[][] =  [];
        //let conditions : Array<[Binary, Anonymize<T2>]> = [];

/*
        conditions.push(
          [Binary.fromHex('0x0000'), {
              type: 'Some',
              value: Binary.fromHex('0x0000'),
          }]);

 */
        //let updates: [] =  [];
        //let updates: (Binary | Option<Binary>)[][] =  [];
        //let updates: (Binary | {})[][] =  [];
        let updates: (Binary | undefined)[][] =  [];
        //let updates : Array<[Binary, Anonymize<T2>]> = []
/*
        this.currentSession.updates.forEach(
          (value, key) => {
              const v =  value.isNone()
                ? {
                    type: 'None',
                }
                : {
                    type: 'Some',
                    value: Binary.fromHex((value as Some<HexString>).getValue()),
                };
              console.log('update key %s with value %s', key, v);
              //updates.push([Binary.fromHex(key), Binary.fromHex(v)]);
              updates.push([Binary.fromHex(key), v]);
          }
        );
 */

        let actions: Array<Enum<{
            "Reply": Binary;
            "SetQueueHead": number;
            "GrantAttestor": SS58String;
            "RevokeAttestor": SS58String;
        }>> =  [];


/*
        if (this.currentSession.currentIndex != undefined && this.currentSession.minIndex != undefined
          && this.currentSession.currentIndex > this.currentSession.minIndex){
            actions.push(
              {
                  type: "SetQueueHead",
                  value : this.currentSession.currentIndex,
              }
            );
        }

 */


        console.log('Dry Run 1')
        const {value, success} = await this.contract.query('RollupClient::rollup_cond_eq',{
            origin: signer.publicKey,
            data: {
                conditions, updates, actions
            }
        });

        console.log('Dry Run 2')
        if (!success){
            console.log('Error when dry run tx ', value)
            return Promise.reject('Error in the tx');
        }

        console.log('Submitting tx ')

        const result = await this.contract.send('RollupClient::rollup_cond_eq',{
            origin: signer.publicKey,
            data: {
                conditions, updates, actions
            }
        }).signAndSubmit(signer);


        if (!result.ok){
            console.log('Error when submitting tx ', result)
            return Promise.reject('Error in the tx');
        }
        const txHash = result.txHash;


        //const txHash = await tx(this.contract, this.signer, 'rollupClient::rollupCondEq', conditions, updates, actions);
        this.currentSession = new Session();
        return txHash;
    }

    rollback() {
        this.currentSession = new Session();
    }
}


class Session {
    actions: Action[] = [];
    updates: Map<HexString, Option<HexString>> = new Map();
    minIndex: number | undefined;
    maxIndex: number | undefined;
    currentIndex: number | undefined;
}


/*
export async function tx(
  smartContract: ContractPromise | undefined,
  signer : KeyringPair | undefined,
  methodName: string,
  ...params: any[]
) : Promise<any> {

    if (!smartContract){
        return Promise.reject("ERROR Contract is not connected");
    }

    if (!signer){
        return Promise.reject("ERROR Signer is not defined");
    }

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit : any = smartContract.api.registry.createType('WeightV2',
      {refTime: 30000000000, proofSize: 1000000}
    );

    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    console.log('params: %s', params);
    console.log('params: %s', params[2]);
    console.log('params: %s', params[2][0] );

    const {gasRequired, result, debugMessage } =
      await smartContract.query[methodName](
        signer.address,
        { storageDepositLimit, gasLimit},
        ...params
      ) ;

    if (result.isOk){


        console.log('result is ok: %s', result);
        console.log('debugMessage: %s', debugMessage);

        const tx = smartContract.tx[methodName](
          { storageDepositLimit, gasLimit : gasRequired },
          ...params
        );
        await signAndSend(tx, signer);
    } else {
        console.log('Error when sending transaction - debugMessage : %s', debugMessage);
        return Promise.reject("Error when sending transaction " + result.asErr);
    }
}


export async function signAndSend(
  extrinsic: SubmittableExtrinsic<'promise', ISubmittableResult>,
  signer : KeyringPair,
) : Promise<HexString> {

    let extrinsicResult : ExtrinsicResult = {success: false, failed: false, finalized: false };

    const unsub = await extrinsic.signAndSend(
      signer,
      (result) => {
          if (readResult(result, extrinsicResult)) {
              unsub();
          }
      }
    );

    do {
        // wait 10 seconds
        await setTimeout(10000);
        // until the transaction has been finalized (or failed)
    } while (!extrinsicResult.failed && !extrinsicResult.finalized);

    if (extrinsicResult.failed){
        return Promise.reject("ERROR: Extrinsic failed");
    }

    if (!extrinsicResult.txHash){
        return Promise.reject("ERROR: no tx");
    }

    return extrinsicResult.txHash;
}

export type ExtrinsicResult = {
    success: boolean;
    failed: boolean;
    finalized: boolean;
    txHash?: HexString;
}


function readResult(result: ISubmittableResult, extrinsicResult: ExtrinsicResult) : boolean {

    console.log('Transaction status:', result.status.type);

    if (result.status.isInBlock || result.status.isFinalized) {
        console.log('Transaction hash ', result.txHash.toHex());
        extrinsicResult.txHash = result.txHash.toHex();
        extrinsicResult.finalized = result.status.isFinalized;

        result.events.forEach(({ phase, event} ) => {
            let data = event.data;
            let method = event.method;
            let section = event.section;
            console.log(' %s : %s.%s:: %s', phase, section, method, data);

            if (section == 'system' && method == 'ExtrinsicSuccess'){
                extrinsicResult.success = true;
                return true;
            } else if (section == 'system' && method == 'ExtrinsicFailed'){
                extrinsicResult.failed = true;
                console.log(' %s : %s.%s:: %s', phase, section, method, data);
                return true;
            }
        });
    } else if (result.isError){
        console.log('Error');
        extrinsicResult.failed = true;
        return true;
    }
    return false;
}
 */
