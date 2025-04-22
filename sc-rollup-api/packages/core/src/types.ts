export type HexString = `0x${string}`

export interface Action {
  encode(): HexString
  decode(): HexString
}

export type Condition = string
export type Signature = string
export type Target = string

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

  static of<T>(value: T | undefined): Option<T> {
    if (value == undefined) {
      return new None()
    }
    return new Some(value)
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
