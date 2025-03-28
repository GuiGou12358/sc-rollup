import {Action, HexString, Option} from "./types";

export interface Client {

  getValue(key: HexString) : HexString | undefined;
  setValue(key: HexString, value: HexString) : void;

  hasMessage() : boolean;
  pollMessage() : HexString | undefined;

  addAction(action: Action) : void;

  commit() : HexString | undefined;

  rollback() : void;

}

// define Codec interface to encode/decode Key and Value
// same for action and message
