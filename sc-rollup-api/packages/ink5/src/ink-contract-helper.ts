import {Keyring} from '@polkadot/api';
import {KeyringPair} from "@polkadot/keyring/types";
import {ContractPromise} from "@polkadot/api-contract";
import {setTimeout} from "timers/promises";
import {SubmittableExtrinsic} from '@polkadot/api/types';
import type {ISubmittableResult} from '@polkadot/types/types';
import {HexString} from "@polkadot/util/types";

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

    const {gasRequired, result, debugMessage } =
      await smartContract.query[methodName](
        signer.address,
        { storageDepositLimit, gasLimit},
        ...params
      ) ;

    if (result.isOk){
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
