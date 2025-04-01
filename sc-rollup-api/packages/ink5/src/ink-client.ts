import {ApiPromise, Keyring, WsProvider} from "@polkadot/api";
import {readFileSync} from "fs";
import {ContractPromise} from "@polkadot/api-contract";
import type {HexString} from "@polkadot/util/types";
import {ApiDecoration, SubmittableExtrinsic} from "@polkadot/api/types";
//import {query, tx} from "./ink-contract-helper";
import {Action, None, Option, Some} from "../../core/src/types";
import {KeyringPair} from "@polkadot/keyring/types";
import type {ISubmittableResult} from "@polkadot/types/types";
import {setTimeout} from "timers/promises";
import {hexAddPrefix, hexToU8a, stringToHex, stringToU8a, u8aConcat, u8aToHex} from "@polkadot/util";


const METADATA_FILE = 'metadata/ink_client.json';


export class InkClient {

    readonly rpc: string;
    readonly address: string;
    readonly pk: string;
    contract: ContractPromise | undefined;
    apiAt: ApiDecoration<any> | undefined;
    currentSession: Session;
    signer : KeyringPair | undefined;

    public constructor(rpc: string, address: string, pk: string){
        this.rpc = rpc;
        this.address = address;
        this.pk = pk;
        this.currentSession = new Session();
    }

    public async connect() : Promise<void> {

        if (this.contract){
            return;
        }

        const api = await ApiPromise.create({ provider: new WsProvider(this.rpc)});
        const[chain, nodeName, nodeVersion] = await Promise.all([
            api.rpc.system.chain(),
            api.rpc.system.name(),
            api.rpc.system.version()
        ]);
        console.log('You are connected to chain %s using %s v%s', chain, nodeName, nodeVersion);

        const finalizedHead = await api.rpc.chain.getFinalizedHead();
        console.log("finalizedHead %s ", finalizedHead);
        const block = await api.rpc.chain.getBlock(finalizedHead);
        //console.log("block %s ", block);
        this.apiAt = await api.at(finalizedHead);
        //console.log("apiAt %s ", this.apiAt);

        const metadata = readFileSync(METADATA_FILE);
        this.contract = new ContractPromise(api, metadata.toString(), this.address);

    }

    /*
    getSnapshotId(): SnapshotId {
        return "";
    }
     */

    async getIndex(key: HexString): Promise<number> {
        const encodedValue : HexString = await query(this.contract, 'rollupClient::getValue', key);
        if (!encodedValue){
            return 0;
        }
        const index = this.contract?.api.createType('u32', hexToU8a(encodedValue)).toNumber();
        if (!index){
            return Promise.reject('Error to decode the index ' + encodedValue);
        }
        return index;
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
        const encodedIndex = this.contract?.api.createType('u32', index)?.toU8a();
        if (!encodedIndex){
            return Promise.reject('Error to encode the message index ' + index);
        }
        const key = u8aToHex(u8aConcat(stringToU8a('q/'), encodedIndex));
        console.log('Key for getting the message for index ' + index + ' : ' + key);
        return await query(this.contract, 'rollupClient::getValue', key);
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
        const value = await query(this.contract, 'rollupClient::hasMessage');
        console.log('hasMessage :' + value);
        return (value as boolean).valueOf();
    }

    async getValue(key: HexString): Promise<Option<HexString>> {

        // search in the session
        const localValue = this.currentSession.updates.get(key);
        if (localValue){
            return localValue;
        }

        const remoteValue: HexString = await query(this.contract, 'rollupClient::getValue', key);
        //if (!remoteValue || remoteValue == '0x00'){
        if (!remoteValue || remoteValue == '0x00'){
            return new None();
        }
        // remove 0x01 from Options type
        //return new Some(remoteValue.replace('0x01', '0x'));
        return new Some(remoteValue);

    };

    async getNumericValue(key: HexString): Promise<Option<Number>> {
        const value = await this.getValue(key)
        if (value.isNone()){
            return value;
        }
        console.log('value %s', value);
        const some = value as Some<HexString>;
        const decodedValue = this.decodeNumericValue(some.getValue());
        if (decodedValue == undefined){
            return Promise.reject('Error to decode the numeric value ' + some.getValue());
        }
        return new Some(decodedValue);
    }

    async getStringValue(key: HexString): Promise<Option<String>> {
        const value = await this.getValue(key)
        if (value.isNone()){
            return value;
        }
        const some = value as Some<HexString>;
        const decodedValue = this.decodeStringValue(some.getValue());
        if (decodedValue == undefined){
            return Promise.reject('Error to decode the numeric value ' + some.getValue());
        }
        return new Some(decodedValue);
    }

    async getBooleanValue(key: HexString): Promise<Option<Boolean>> {
        const value = await this.getValue(key)
        if (value.isNone()){
            return value;
        }
        const some = value as Some<HexString>;
        const decodedValue = this.decodeBooleanValue(some.getValue());
        if (decodedValue == undefined){
            return Promise.reject('Error to decode the boolean value ' + some.getValue());
        }
        return new Some(decodedValue);
    }

    decodeStringValue(value: HexString): string | undefined {
        return this.contract?.api.createType('String', String(value)).toString();
    }

    decodeBooleanValue(value: HexString): boolean | undefined {
        return this.contract?.api.createType('bool', hexToU8a(value)).toPrimitive();
    }

    decodeNumericValue(value: HexString): number | undefined {
        return this.contract?.api.createType('u32', hexToU8a(value)).toNumber();
    }

    encodeStringValue(value: string): HexString | undefined {
        return this.contract?.api.createType('String', value).toHex();
    }

    encodeBooleanValue(value: boolean): HexString | undefined {
        return this.contract?.api.createType('bool', value).toHex();
    }

    encodeNumericValue(value: number): HexString | undefined {
        return this.contract?.api.createType('u32', value).toHex(true);
    }

    setStringValue(key: HexString, value : string)  {
        const v = this.encodeStringValue(value);
        if (v) {
            this.setValue(key, new Some(v));
        }
    }

    setBooleanValue(key: HexString, value : boolean)  {
        const v = this.encodeBooleanValue(value);
        if (v) {
            this.setValue(key, new Some(v));
        }
    }

    setNumericValue(key: HexString, value : number)  {
        const v = this.encodeNumericValue(value);
        if (v) {
            this.setValue(key, new Some(v));
        }
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

        if (!this.signer) {
            this.signer = new Keyring({type: 'sr25519'}).addFromSeed(hexToU8a(this.pk));
            console.log('address %s', this.signer.address);
        }

        let conditions: (HexString | Option<HexString>)[][] =  [];

        let updates: (HexString | Option<HexString>)[][] =  [];
        this.currentSession.updates.forEach(
          (value, key) => {
              const v =  value.isNone()
                ? hexAddPrefix('0x')
                : (value as Some<HexString>).getValue();
              console.log('update key %s with value %s', key, v);
              updates.push([key, v]);
          }
        );

        let actions =  [];

        if (this.currentSession.currentIndex != undefined && this.currentSession.minIndex != undefined
          && this.currentSession.currentIndex > this.currentSession.minIndex){
            actions.push(
              {
                  SetQueueHead: this.currentSession.currentIndex
              }
            );
        }

        const txHash = await tx(this.contract, this.signer, 'rollupClient::rollupCondEq', conditions, updates, actions);
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













export async function query(
  smartContract: ContractPromise | undefined,
  methodName: string,
  ...params: any[]
) : Promise<any> {

    if (!smartContract){
        return Promise.reject("ERROR Contract is not connected");
    }

    const alice = new Keyring({ type: 'sr25519' }).addFromUri("//Alice");

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit : any = smartContract.api.registry.createType('WeightV2',
      {refTime: 30000000000, proofSize: 1000000}
    );

    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    const {result, output}  = await smartContract.query[methodName](
      alice.address,
      {gasLimit, storageDepositLimit},
      ...params
    );

    if (result.isOk){
        const value : string = output?.toString() ?? '';
        return JSON.parse(value).ok;
    }
    return Promise.reject("ERROR when query " + result.asErr);
}


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
