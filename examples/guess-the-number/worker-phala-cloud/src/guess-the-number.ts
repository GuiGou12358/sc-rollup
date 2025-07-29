import {InkClient as InkV6Client} from "@guigou/sc-rollup-ink-v6";
import {Bytes, type Codec, Struct, u128, u16, u32, u8} from "scale-ts";
import {hexToU8a} from "@polkadot/util";
import {Vrf} from "@guigou/util-crypto";
import type {HexString} from "@guigou/sc-rollup-core";

export type Config = {
  rpc: string;
  address: string;
  attestorPk: HexString;
  senderPk: HexString | undefined;
}

export class GuessTheNumberWorker {

  private readonly client: InkV6Client<RequestMessage, ResponseMessage>;
  private readonly vrf : Vrf;

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
      message.map(this.handleMessage)
    } while (message.isSome())

    const tx = await this.client.commit()
    console.log("tx : %s ", tx);

  }

  handleMessage(message: RequestMessage) {
    console.log("handle message ...");
    console.log(message);
    const response = this.getResponse(message);
    console.log("response ...");
    console.log(response);
    this.client.addAction(response);
  }

  getResponse(message: RequestMessage): ResponseMessage {
    const target = this.getTargetNumber(message.gameNumber, message.minNumber, message.maxNumber, message.player);
    const guess = message.guess;
    let clue;
    if (target == guess) {
      clue = CLUE_FOUND;
    } else if (target > guess) {
      clue = CLUE_MORE;
    } else {
      clue = CLUE_LESS;
    }
    return {
      gameNumber: message.gameNumber,
      player: message.player,
      attempt: message.attempt,
      guess: guess,
      clue
    };
  }

  getTargetNumber(gameNumber: bigint, minNumber: number, maxNumber: number, player: Uint8Array): number {
    // build the salt used by the vrf
    const vrfSalt = saltVrfStructCodec.enc({
      gameNumber,
      player,
    })
    // use the vrf to get the target number
    return this.vrf.getRandomNumber(vrfSalt, minNumber, maxNumber);
  }
}


type RequestMessage = {
  gameNumber: bigint;
  minNumber: number;
  maxNumber: number;
  player: Uint8Array;
  attempt: number;
  guess: number;
}

const requestMessageCodec : Codec<RequestMessage> = Struct({
  gameNumber: u128,
  minNumber: u16,
  maxNumber: u16,
  player: Bytes(32),
  attempt: u32,
  guess: u16,
});


const CLUE_MORE = 0;
const CLUE_LESS = 1;
const CLUE_FOUND = 2;

export type ResponseMessage = {
  gameNumber: bigint;
  player: Uint8Array;
  attempt: number;
  guess: number;
  clue: number;
}

const responseMessageCodec : Codec<ResponseMessage> = Struct({
  gameNumber: u128,
  player: Bytes(32),
  attempt: u32,
  guess: u16,
  clue: u8,
});


type SaltVrfStruct = {
  gameNumber: bigint;
  player: Uint8Array;
}

const saltVrfStructCodec : Codec<SaltVrfStruct> = Struct({
  gameNumber: u128,
  player: Bytes(32),
});
