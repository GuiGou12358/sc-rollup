import {HexString, None, Option} from "../../core/src/types";
import {contracts, shibuya} from "@polkadot-api/descriptors";
import {hexAddPrefix, hexToU8a, stringToHex, stringToU8a, u8aConcat, u8aToHex} from "@polkadot/util";
import {createInkSdk} from "@polkadot-api/sdk-ink";
import {Binary, createClient, PolkadotSigner, SS58String} from 'polkadot-api';
import {withPolkadotSdkCompat} from "polkadot-api/polkadot-sdk-compat";
import {getWsProvider} from "polkadot-api/ws-provider/web";
import {getPolkadotSigner} from "polkadot-api/signer";
import {Keyring} from "@polkadot/keyring";

export class InkClient {

    currentSession: Session;
    contract: any;
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
        //const encodedIndex = this.encodeNumericValue(index).replace('0x', '');
        const encodedIndex = hexToU8a(this.encodeNumericValue(index));
        const key = u8aToHex(u8aConcat(stringToU8a('q/'), encodedIndex));
        //console.log('key for getting the message ' + index + ' : ' + key);

        const {value, success} = await this.contract.query('RollupClient::get_value',{
            origin: this.signerAddress,
            data: {
                key : Binary.fromHex(key)
            }
        });

        if (!success){
            return Promise.reject('Error to get the message for index ' + index);
        }
        return value.response?.asHex();
    }

    async pollMessage(): Promise<Option<HexString>> {

        const tailIndex = await this.getQueueTailIndex();

        if (this.currentSession.currentIndex == undefined){
            this.currentSession.currentIndex = await this.getQueueHeadIndex();
        }
        if (this.currentSession.currentIndex >= tailIndex){
            return new None();
        }
        const message = await this.getMessage(this.currentSession.currentIndex);
        this.currentSession.currentIndex += 1;
        this.currentSession.indexUpdated = true;
        return Option.of(message);
    }

    async hasMessage(): Promise<Boolean> {
        const {value, success} = await this.contract.query('RollupClient::has_message',{
            origin: this.signerAddress,
        });
        if (!success){
            return Promise.reject('Error to query has_message method');
        }
        return value.response;
    }

    async getValue(key: HexString): Promise<Option<HexString>> {

        // search in the updated values
        const updatedValue = this.currentSession.updates.get(key);
        if (updatedValue){
            return updatedValue;
        }

        // search in the session
        const localValue = this.currentSession.values.get(key);
        if (localValue){
            return localValue;
        }

        // load the value
        const {value, success} = await this.contract.query('RollupClient::get_value',{
            origin: this.signerAddress,
            data: {
                key : Binary.fromHex(key)
            }
        });

        if (!success){
            return Promise.reject('Error to query get_value method for key ' + key);
        }

        const remoteValue = Option.of(value.response?.asHex());
        // save the value in the session
        this.currentSession.values.set(key, remoteValue);
        return remoteValue;
    };

    async getNumericValue(key: HexString): Promise<Option<number>> {
        const value = await this.getValue(key);
        return value.map(this.decodeNumericValue);
    }

    async getStringValue(key: HexString): Promise<Option<string>> {
        const value = await this.getValue(key)
        return value.map(this.decodeStringValue);
    }

    async getBooleanValue(key: HexString): Promise<Option<boolean>> {
        const value = await this.getValue(key)
        return value.map(this.decodeBooleanValue);
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
        this.setValue(key, Option.of(v));
    }

    setBooleanValue(key: HexString, value : boolean)  {
        const v = this.encodeBooleanValue(value);
        this.setValue(key, Option.of(v));
    }

    setNumericValue(key: HexString, value : number)  {
        const v = this.encodeNumericValue(value);
        this.setValue(key, Option.of(v));
    }

    removeValue(key: HexString)  {
        this.setValue(key, new None());
    }

    setValue(key: HexString, value: Option<HexString>) {
        this.currentSession.updates.set(key, value);
    }

    addAction(action: HexString) {
        this.currentSession.actions.push(action);
    }

    async commit(): Promise<Option<HexString>> {

        const converter = (input: HexString): Binary => {
            return Binary.fromHex(input);
        }

        let conditions: (Binary | undefined)[][] =  [];
        this.currentSession.values.forEach(
          (value, key) => {
              console.log('condition: key %s equals to with value %s', key, value);
              conditions.push([Binary.fromHex(key), value.map(converter).valueOf()]);
          }
        );

        let updates: (Binary | undefined)[][] =  [];
        this.currentSession.updates.forEach(
          (value, key) => {
              console.log('update key %s with value %s', key, value);
              updates.push([Binary.fromHex(key), value.map(converter).valueOf()]);
          }
        );

        let actions =  [];
        if (this.currentSession.indexUpdated){
            console.log("SetQueueHead %s", this.currentSession.currentIndex);
            actions.push(
              {
                  type: "SetQueueHead",
                  value : this.currentSession.currentIndex,
              }
            );
        }
        this.currentSession.actions.forEach(
          (action) => {
              console.log("Action : %s " + action);
              actions.push(
                {
                    type: "Reply",
                    value : Binary.fromHex(action),
                }
              );
          }
        );

        if (updates.length === 0 && actions.length === 0){
            // nothing to commit
            console.log('Nothing to commit ')
            // clear the current session
            this.currentSession = new Session();
            return new None();
        }

        console.log('Dry Run ...')
        const {value, success} = await this.contract.query('RollupClient::rollup_cond_eq',{
            origin: this.signerAddress,
            data: {
                conditions, updates, actions
            }
        });
        if (!success){
            return Promise.reject('Error when dry run tx ' + value);
        }

        console.log('Submitting tx ... ')
        const result = await this.contract.send('RollupClient::rollup_cond_eq',{
            origin: this.signerAddress,
            data: {
                conditions, updates, actions
            }
        }).signAndSubmit(this.signer);

        if (!result.ok){
            return Promise.reject('Error when submitting tx ' + result);
        }
        const txHash = result.txHash;
        console.log('Tx hash ', txHash)
        // clear the current session
        this.currentSession = new Session();
        return txHash;
    }

    rollback() {
        this.currentSession = new Session();
    }
}

class Session {
    values: Map<HexString, Option<HexString>> = new Map();
    updates: Map<HexString, Option<HexString>> = new Map();
    actions: HexString[] = [];
    currentIndex: number | undefined;
    indexUpdated: boolean = false;
}

