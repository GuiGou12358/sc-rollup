import {InkClient as InkV6Client} from "@guigou/sc-rollup-ink-v6";
import {Bytes, type Codec, Option, Struct, u128, u16, u32, u8} from "scale-ts";
import {hexToU8a} from "@polkadot/util";
import {Vrf} from "@guigou/util-crypto";
import {type HexString} from "@guigou/sc-rollup-core";
import {Indexer} from "./indexer.ts";

const DEFAULT_MAX_ATTEMPTS = 3;

export type Config = {
  rpc: string;
  address: string;
  attestorPk: HexString;
  senderPk: HexString | undefined;
  indexerUrl: string;
}

export class GuessTheNumberWorker {

  private readonly client: InkV6Client<RequestMessage, ResponseMessage>;
  private readonly vrf : Vrf;
  private readonly indexer : Indexer;

  constructor(config: Config) {
    this.client = new InkV6Client<RequestMessage, ResponseMessage>(
        config.rpc,
        config.address,
        config.attestorPk,
        config.senderPk,
        requestMessageCodec,
        responseMessageCodec
    );
    this.vrf = Vrf.getFromSeed(hexToU8a(config.attestorPk));
    this.indexer = new Indexer(config.indexerUrl);
  }

  async pollMessages() {

    const hasMessage = await this.client.hasMessage();
    if (!hasMessage){
      return;
    }

    await this.client.startSession();
    let message
    do {
      message = await this.client.pollMessage();
      if (message.isSome()){
        const m = message.valueOf();
        if (m){
          await this.handleMessage(m);
        }
      }
      //message.map(async m => await this.handleMessage(m));
    } while (message.isSome());

    await this.client.commit();

  }

  async handleMessage(message: RequestMessage) {
    console.log("handle message ...");
    console.log(message);
    const response = await this.getResponse(message);
    console.log("response ...");
    console.log(response);
    this.client.addAction(response);
  }

  async getMaxAttempts(player: Address): Promise<number> {
    try {
      const address = bytesToHex(player);
      const maxAttempts = await this.indexer.getMaxAttempts(address);
      console.log("Max attempts for address %s : %s", address, maxAttempts);

      if (maxAttempts == null) {
        return DEFAULT_MAX_ATTEMPTS
      }

      return maxAttempts;
    } catch (error) {
      console.error("Error when query the indexer : ", error)
      return DEFAULT_MAX_ATTEMPTS;
    }
  }

  async getResponse(message: RequestMessage): Promise<ResponseMessage> {
    const target = this.getTargetNumber(message.gameNumber, message.minNumber, message.maxNumber, message.player);
    const maxAttempts = await this.getMaxAttempts(message.player);
    const guess = message.guess;
    let clue;
    if (target == guess) {
      clue = CLUE_FOUND;
    } else if (target > guess) {
      clue = CLUE_MORE;
    } else {
      clue = CLUE_LESS;
    }

    const attempt = message.attempt;
    let responseTarget : number | undefined = undefined;
    if (clue == CLUE_FOUND || attempt >= maxAttempts){
      responseTarget = target;
    }

    return {
      gameNumber: message.gameNumber,
      player: message.player,
      attempt: message.attempt,
      guess: guess,
      clue,
      maxAttempts,
      target: responseTarget,
    };
  }

  getTargetNumber(gameNumber: bigint, minNumber: number, maxNumber: number, player: Address): number {
    // build the salt used by the vrf
    const vrfSalt = saltVrfStructCodec.enc({
      gameNumber,
      player,
    })
    // use the vrf to get the target number
    return this.vrf.getRandomNumber(vrfSalt, minNumber, maxNumber);
  }
}

type Address = Uint8Array;
const addressCodec = Bytes(20);

type RequestMessage = {
  gameNumber: bigint;
  minNumber: number;
  maxNumber: number;
  player: Address;
  attempt: number;
  guess: number;
}

const requestMessageCodec : Codec<RequestMessage> = Struct({
  gameNumber: u128,
  minNumber: u16,
  maxNumber: u16,
  player: addressCodec,
  attempt: u32,
  guess: u16,
});


const CLUE_MORE = 0;
const CLUE_LESS = 1;
const CLUE_FOUND = 2;

export type ResponseMessage = {
  gameNumber: bigint;
  player: Address;
  attempt: number;
  guess: number;
  clue: number;
  maxAttempts: number;
  target: number | undefined;
}

const responseMessageCodec : Codec<ResponseMessage> = Struct({
  gameNumber: u128,
  player: addressCodec,
  attempt: u32,
  guess: u16,
  clue: u8,
  maxAttempts: u32,
  target: Option(u16),
});

type SaltVrfStruct = {
  gameNumber: bigint;
  player: Address;
}

const saltVrfStructCodec : Codec<SaltVrfStruct> = Struct({
  gameNumber: u128,
  player: addressCodec,
});


function bytesToHex(bytes: Address): string {
  return (
      "0x" +
      [...bytes]
          .map(b => b.toString(16).padStart(2, "0"))
          .join("")
  );
}