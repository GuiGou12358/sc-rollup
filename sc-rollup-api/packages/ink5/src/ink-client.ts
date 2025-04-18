import {HexString, Option} from "../../core/src/types";
import {Client} from "../../core/src/client";
import {ActionEncoder, Codec} from "../../core/src/codec";
import {contracts, shibuya} from "@polkadot-api/descriptors";
import {hexAddPrefix, hexToU8a, stringToHex, stringToU8a, u8aConcat, u8aToHex} from "@polkadot/util";
import {createInkSdk} from "@polkadot-api/sdk-ink";
import {Binary, createClient, PolkadotSigner, SS58String} from 'polkadot-api';
import {withPolkadotSdkCompat} from "polkadot-api/polkadot-sdk-compat";
import {getWsProvider} from "polkadot-api/ws-provider/web";
import {getPolkadotSigner} from "polkadot-api/signer";
import {Keyring} from "@polkadot/keyring";


// q/_tail : 0x712f5f7461696c
const QUEUE_TAIL_KEY = stringToHex('q/_tail');
// q/_head : 0x712f5f68656164
const QUEUE_HEAD_KEY = stringToHex('q/_head');
const VERSION_NUMBER_KEY = stringToHex('v/_number');

type KV = [Binary, Binary | undefined];
type Action = {};

export class InkClient extends Client<KV, Action>{

    contract: any;
    readonly signer : PolkadotSigner;
    readonly signerAddress : SS58String;

    public constructor(rpc: string, address: string, pk: string){

        super(new InkCodec(), new InkActionDecoder(), VERSION_NUMBER_KEY, QUEUE_TAIL_KEY, QUEUE_HEAD_KEY);

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

    getMessageKey(index: number): HexString {
        //const encodedIndex = this.encodeNumericValue(index).replace('0x', '');
        const encodedIndex = hexToU8a(this.codec.encodeNumeric(index));
        return u8aToHex(u8aConcat(stringToU8a('q/'), encodedIndex));
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

    async getRemoteValue(key: HexString): Promise<Option<HexString>> {

        const {value, success} = await this.contract.query('RollupClient::get_value',{
            origin: this.signerAddress,
            data: {
                key : Binary.fromHex(key)
            }
        });

        if (!success){
            return Promise.reject('Error to query get_value method for key ' + key);
        }

        return Option.of(value.response?.asHex());
    };


    async sendTransaction(conditions: KV[], updates: KV[], actions: Action[]) : Promise<HexString> {

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
        return result.txHash;
    }

}

export class InkCodec implements Codec {

    encodeString(value: string): HexString {
        return hexAddPrefix(Binary.fromText(value).asHex());
    }

    encodeBoolean(value: boolean): HexString {
        return value ? '0x01' : '0x00';
    }

    encodeNumeric(value: number): HexString {
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

    decodeString(value: HexString): string {
        return value.replace(/^0x/i, '')
          .match(/.{1,2}/g)!
          .map(byte => String.fromCharCode(parseInt(byte, 16)))
          .join('');
    }

    decodeBoolean(value: HexString): boolean {
        return value === '0x01';
    }

    decodeNumeric(value: HexString): number {
        //return u8aToNumber(hexToU8a(value, 8));
        return parseInt(value.replace(/(00)+$/, ''), 16);
    }
}

const converter = (input: HexString): Binary => {
    return Binary.fromHex(input);
}

class InkActionDecoder implements ActionEncoder<KV, Action> {

    encodeKeyValue(key: HexString, value: Option<HexString>): KV {
        return [Binary.fromHex(key), value.map(converter).valueOf()];
    }

    encodeReply(action: HexString): Action {
        return {
            type: "Reply",
            value : Binary.fromHex(action),
        }
    }

    encodeSetQueueHead(index: number): Action {
        return {
            type: "SetQueueHead",
            value : index,
        }
    }

}


