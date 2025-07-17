export type HexString = `0x${string}`

export class Option<T> {
  private readonly value: T | undefined

  protected constructor(value: T | undefined) {
    this.value = value
  }

  isSome(): boolean {
    return !this.isNone()
  }

  isNone() {
    return this.value == undefined
  }

  valueOf(): T | undefined {
    return this.value
  }

  map<U>(fn: (arg: T) => U): Option<U> {
    if (this.value == undefined) {
      return new None()
    }
    return new Some(fn(this.value))
  }

  orElse(other: T): T {
    if (this.value == undefined) {
      return other
    }
    return this.value
  }

  toString() : string {
    if (this.value == undefined) {
      return 'None';
    }
    return `Some(${this.value})`
  }

  equals(other: Option<T>) : boolean {
    return this.value === other.value;
  }

  static of<T>(value: T | undefined): Option<T> {
    if (value == undefined) {
      return new None()
    }
    return new Some(value)
  }

  static empty<T>(): Option<T> {
    return new None();
  }
}

export class None extends Option<any> {
  constructor() {
    super(undefined)
  }
}

export class Some<T> extends Option<T> {
  constructor(value: T) {
    super(value)
  }
}

export type NumberType = "u8" | "u16" | "u32"
export type BigIntType = "u64" | "u128" | "u256"
