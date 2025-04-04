import type {HexString} from "@polkadot/util/types";
import {Action, None, Option, Some} from "../../core/src/types";

import {contracts, shibuya} from "@polkadot-api/descriptors";


import {hexAddPrefix, hexToU8a, stringToHex, stringToU8a, u8aConcat, u8aToHex} from "@polkadot/util";
import {createInkSdk} from "@polkadot-api/sdk-ink";
import {Binary, createClient, Enum, PolkadotSigner, SS58String} from 'polkadot-api';
import {withPolkadotSdkCompat} from "polkadot-api/polkadot-sdk-compat";
import {getWsProvider} from "polkadot-api/ws-provider/web";
import {Contract} from "@polkadot/api-contract/base";
import {getPolkadotSigner} from "polkadot-api/signer";
import {Keyring} from "@polkadot/api";

export class InkClient {

    currentSession: Session;
    contract: any | Contract<any>;
    readonly signer : PolkadotSigner;
    readonly signerAddress : SS58String;

    public constructor(rpc: string, address: string, pk: string){
        this.currentSession = new Session();

        const client = createClient(
          withPolkadotSdkCompat(
            getWsProvider(rpc),
          )
        );
        const typedApi = client.getTypedApi(shibuya);
        const sdk = createInkSdk(typedApi, contracts.ink_client)
        this.contract = sdk.getContract(address);

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

        const keyringPair = new Keyring({type: 'sr25519'}).addFromSeed(hexToU8a(pk));
        this.signerAddress = keyringPair.address;
        this.signer = getPolkadotSigner(
          keyringPair.publicKey,
          "Sr25519",
          keyringPair.sign
        );
    }

    public async checkCompatibility(){
        if (!await this.contract.isCompatible()){
            return Promise.reject('Contract has changed');
        }
    }

    /*
    getSnapshotId(): SnapshotId {
        return "";
    }
     */

    async getIndex(key: HexString): Promise<number> {

        const {success, value} = await this.contract.query('RollupClient::get_value',{
           origin: this.signerAddress,
            data: {
               key : Binary.fromHex(key)
            }
        });

        if (!success){
            console.error('Error to get value for key %s  - value: %s ', key, value);
            return Promise.reject('Error to get value for key ' + key);
        }

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
            origin: this.signerAddress,
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
            origin: this.signerAddress,
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
            origin: this.signerAddress,
            data: {
                key : Binary.fromHex(key)
            }
        });

        if (!success){
            return new None();
        }

        const remoteValue = value.response?.asHex();
        if (!remoteValue || remoteValue == '0x'){
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
        console.log('boolean value: ', value);
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
        console.log('encode boolean value: ', value);
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

        let conditions: (Binary | undefined)[][] =  [];

        let updates: (Binary | undefined)[][] =  [];
        this.currentSession.updates.forEach(
          (value, key) => {
              const v =  value.isNone()
                ? undefined
                : Binary.fromHex((value as Some<HexString>).getValue());
              //console.log('update key %s with value %s', key, v);
              updates.push([Binary.fromHex(key), v]);
          }
        );

        let actions =  [];
        if (this.currentSession.currentIndex != undefined && this.currentSession.minIndex != undefined
          && this.currentSession.currentIndex > this.currentSession.minIndex){
            console.log("SetQueueHead " + this.currentSession.currentIndex);
            actions.push(
              {
                  type: "SetQueueHead",
                  value : this.currentSession.currentIndex,
              }
            );
        }

        console.log('Dry Run ...')
        const {value, success} = await this.contract.query('RollupClient::rollup_cond_eq',{
            origin: this.signerAddress,
            data: {
                conditions, updates, actions
            }
        });
        if (!success){
            console.log('Error when dry run tx ', value)
            return Promise.reject('Error in the tx');
        }

        console.log('Submitting tx ... ')
        const result = await this.contract.send('RollupClient::rollup_cond_eq',{
            origin: this.signerAddress,
            data: {
                conditions, updates, actions
            }
        }).signAndSubmit(this.signer);

        if (!result.ok){
            console.log('Error when submitting tx ', result)
            return Promise.reject('Error in the tx');
        }
        const txHash = result.txHash;
        console.log('Tx hash ', txHash)
        // clear the curret session
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

