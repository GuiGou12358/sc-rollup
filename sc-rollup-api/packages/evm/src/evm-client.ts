import {HexString, Option} from "../../core/src/types";
import {Client} from "../../core/src/client";
import {ActionEncoder, Codec} from "../../core/src/codec";
import {BytesLike, ethers, JsonRpcProvider, Wallet} from "ethers";
import {Contract} from "ethers/lib.commonjs/contract/contract";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();


function abiEncode(type: string, value: any) {
    return abiCoder.encode([type], [value]);
}


const ABI = [
    {
        "inputs": [
            {
                "internalType": "bytes",
                "name": "key",
                "type": "bytes"
            }
        ],
        "name": "getStorage",
        "outputs": [
            {
                "internalType": "bytes",
                "name": "",
                "type": "bytes"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes[]",
                "name": "condKeys",
                "type": "bytes[]"
            },
            {
                "internalType": "bytes[]",
                "name": "condValues",
                "type": "bytes[]"
            },
            {
                "internalType": "bytes[]",
                "name": "updateKeys",
                "type": "bytes[]"
            },
            {
                "internalType": "bytes[]",
                "name": "updateValues",
                "type": "bytes[]"
            },
            {
                "internalType": "bytes[]",
                "name": "actions",
                "type": "bytes[]"
            }
        ],
        "name": "rollupU256CondEq",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
];

function hexAddPrefix(value: string) : HexString {
    if (value.startsWith('0x')){
        return value as HexString;
    }
    return `0x${value}`;
}


// q/_tail : 0x712f5f7461696c
const QUEUE_TAIL_KEY = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes('q/_tail')));
// q/_head : 0x712f5f68656164
const QUEUE_HEAD_KEY = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes('q/_head')));
const VERSION_NUMBER_KEY = hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes('v/_number')));

type KV = [BytesLike, BytesLike];
type Action = BytesLike;

export class EvmClient extends Client<KV, Action>{

    readonly contract: Contract;
    readonly provider : JsonRpcProvider;
    readonly signerAddress : Wallet;

    public constructor(rpc: string, address: string, pk: string){
        super(new EvmCodec(), new EvmActionDecoder(), VERSION_NUMBER_KEY, QUEUE_TAIL_KEY, QUEUE_HEAD_KEY);
        this.provider = new ethers.JsonRpcProvider(rpc);
        this.signerAddress = new ethers.Wallet(pk);
        this.contract = new ethers.Contract(address, ABI, this.signerAddress);
    }

    getMessageKey(index: number): HexString {
        const encodedIndex = abiEncode('uint32', index);
        const prefix = ethers.toUtf8Bytes('q/');
        return hexAddPrefix(ethers.concat([prefix, encodedIndex]));
    }

    async getRemoteValue(key: HexString): Promise<Option<HexString>> {
        const value = await this.contract.getStorage(key);
        return Option.of(value);
    };

    async sendTransaction(conditions: KV[], updates: KV[], actions: Action[]) : Promise<HexString> {

          // [string[], string[], string[], string[], string[]];
        const conditionKeys = conditions.map(v => v[0]);
        const conditionValues = conditions.map(v => v[1]);
        const updateKeys = updates.map(v => v[0]);
        const updatesValues = updates.map(v => v[1]);

        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes[]', 'bytes[]', 'bytes[]', 'bytes[]', 'bytes[]'],
          [conditionKeys, conditionValues, updateKeys, updatesValues, actions],
        );

        return await this.contract.rollupU256CondEq(data);
    }

}

export class EvmCodec implements Codec {

    encodeString(value: string): HexString {
        return hexAddPrefix(ethers.hexlify(ethers.toUtf8Bytes(value)));
    }

    encodeBoolean(value: boolean): HexString {
        return hexAddPrefix(abiEncode('bool', value));
    }

    encodeNumeric(value: number): HexString {
        return hexAddPrefix(abiEncode('uint256', value));
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
        return Number(ethers.getUint(value));
    }
}

class EvmActionDecoder implements ActionEncoder<KV, Action> {

    encodeKeyValue(key: HexString, value: Option<HexString>): KV {
        return [key, value.orElse('0x00')];
    }

    encodeReply(action: HexString): Action {
        return hexAddPrefix(ethers.concat(['0x00',  abiEncode('uint32', 0), action]));
    }

    encodeSetQueueHead(index: number): Action {
        return hexAddPrefix(ethers.concat(['0x01',  abiEncode('uint32', index)]));
    }

}
