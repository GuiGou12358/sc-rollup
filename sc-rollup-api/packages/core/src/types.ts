
export type HexString = `0x${string}`;


export interface Action {
  encode(): HexString;
  decode(): HexString;
}

export type Condition = string;
export type Signature = string;
export type Target = string;


interface OptionBase {
  isSome() : boolean
  isNone() : boolean;
  //value() : T;
}

export class None implements OptionBase {
  isNone(): boolean {
    return true;
  }

  isSome(): boolean {
    return false;
  }
}

export class Some<T> implements OptionBase {

  private readonly value: T;

  isNone(): boolean {
    return false;
  }

  isSome(): boolean {
    return true;
  }

  public constructor(value: T) {
    this.value = value;
  }

  getValue(): T {
    return this.value;
  }
}

export type Option<T> = None | Some<T>;
