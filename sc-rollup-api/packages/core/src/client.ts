import {BigIntType, HexString, None, NumberType, Option, Some} from "./types"
import {Coder, RawTypeEncoder, TypeCoder} from "./coder"
import {Session} from "./session"

const INDEX_TYPE = "u32";
const VERSION_TYPE = "u32";

export abstract class Client<KvRawType, ActionRawType, Message, Action> {
  protected readonly typeCoder: TypeCoder
  protected readonly rawTypeEncoder: RawTypeEncoder<KvRawType, ActionRawType>
  protected readonly messageCoder: Coder<Message>
  protected readonly actionCoder: Coder<Action>
  protected readonly versionNumberKey: HexString
  protected readonly queueHeadKey: HexString
  protected readonly queueTailKey: HexString
  protected currentSession: Session

  protected constructor(
    typeCoder: TypeCoder,
    rawTypeEncoder: RawTypeEncoder<KvRawType, ActionRawType>,
    messageCoder: Coder<Message>,
    actionCoder: Coder<Action>,
    versionNumberKey: HexString,
    queueHeadKey: HexString,
    queueTailKey: HexString,
  ) {
    this.typeCoder = typeCoder
    this.rawTypeEncoder = rawTypeEncoder
    this.messageCoder = messageCoder
    this.actionCoder = actionCoder
    this.versionNumberKey = versionNumberKey
    this.queueHeadKey = queueHeadKey
    this.queueTailKey = queueTailKey
    this.currentSession = new Session()
  }

  protected abstract getMessageKey(index: number): HexString

  protected abstract getRemoteValue(key: HexString): Promise<Option<HexString>>

  protected abstract sendTransaction(
    conditions: KvRawType[],
    updates: KvRawType[],
    actions: ActionRawType[],
  ): Promise<HexString>

  public async startSession() {
    this.currentSession = new Session()
    this.currentSession.version = await this.getNumber(
      this.versionNumberKey,
      VERSION_TYPE
    )
  }

  encodeIndex(index: number): HexString {
    return this.typeCoder.encodeNumber(index, INDEX_TYPE);
  }

  decodeIndex(index: HexString): number {
    return this.typeCoder.decodeNumber(index, INDEX_TYPE);
  }

  private async getIndex(key: HexString): Promise<number> {
    const encodedIndex = await this.getRemoteValue(key)
    return encodedIndex
      .map((v)=> this.typeCoder.decodeNumber(v, INDEX_TYPE))
      .orElse(0)
  }

  async getQueueTailIndex(): Promise<number> {
    return await this.getIndex(this.queueTailKey)
  }

  async getQueueHeadIndex(): Promise<number> {
    return await this.getIndex(this.queueHeadKey)
  }

  public async getMessage(index: number): Promise<Message> {
    const key = this.getMessageKey(index)
    const optionalMessage = await this.getRemoteValue(key)
    const message = optionalMessage.valueOf()
    if (message == undefined) {
      return Promise.reject("Error to get the message for index " + index)
    }
    return this.messageCoder.decode(message)
  }

  public async pollMessage(): Promise<Option<Message>> {
    const tailIndex = await this.getQueueTailIndex()

    if (this.currentSession.currentIndex == undefined) {
      this.currentSession.currentIndex = await this.getQueueHeadIndex()
    }
    if (this.currentSession.currentIndex >= tailIndex) {
      return new None()
    }
    const message = await this.getMessage(this.currentSession.currentIndex)
    this.currentSession.currentIndex += 1
    this.currentSession.indexUpdated = true
    return Option.of(message)
  }

  public async getValue(key: HexString): Promise<Option<HexString>> {
    // search in the updated values
    const updatedValue = this.currentSession.updates.get(key)
    if (updatedValue) {
      return updatedValue
    }

    // search in the session
    const localValue = this.currentSession.values.get(key)
    if (localValue) {
      return localValue
    }

    // fetch the value remotely
    const remoteValue = await this.getRemoteValue(key)
    // save the value in the session
    this.currentSession.values.set(key, remoteValue)
    return remoteValue
  }

  public setValue(key: HexString, value: Option<HexString>) {
    this.currentSession.updates.set(key, value)
  }

  public async getNumber(key: HexString, type: NumberType): Promise<Option<number>> {
    const value = await this.getValue(key)
    return value.map((v)=> this.typeCoder.decodeNumber(v, type))
  }

  public async getBigInt(key: HexString, type: BigIntType): Promise<Option<bigint>> {
    const value = await this.getValue(key)
    return value.map((v)=> this.typeCoder.decodeBigInt(v, type))
  }

  public async getBoolean(key: HexString): Promise<Option<boolean>> {
    const value = await this.getValue(key)
    return value.map(this.typeCoder.decodeBoolean)
  }

  public async getString(key: HexString): Promise<Option<string>> {
    const value = await this.getValue(key)
    return value.map(this.typeCoder.decodeString)
  }

  public async getBytes(key: HexString): Promise<Option<Uint8Array>> {
    const value = await this.getValue(key)
    return value.map(this.typeCoder.decodeBytes)
  }

  public setNumber(key: HexString, value: number, type: NumberType) {
    const v = this.typeCoder.encodeNumber(value, type)
    this.setValue(key, Option.of(v))
  }

  public setBigInt(key: HexString, value: bigint, type: BigIntType) {
    const v = this.typeCoder.encodeBigInt(value, type)
    this.setValue(key, Option.of(v))
  }

  public setBoolean(key: HexString, value: boolean) {
    const v = this.typeCoder.encodeBoolean(value)
    this.setValue(key, Option.of(v))
  }

  public setString(key: HexString, value: string) {
    const v = this.typeCoder.encodeString(value)
    this.setValue(key, Option.of(v))
  }

  public setBytes(key: HexString, value: Uint8Array) {
    const v = this.typeCoder.encodeBytes(value)
    this.setValue(key, Option.of(v))
  }

  public removeValue(key: HexString) {
    this.setValue(key, new None())
  }

  private bumpVersion(): Option<number> {
    if (this.currentSession.version == undefined) {
      throw new Error("the session is not started")
    }
    const version = this.currentSession.version.valueOf()
    if (version == undefined) {
      return new Some(1)
    }
    return new Some(version + 1)
  }

  public addAction(action: Action) {
    this.currentSession.actions.push(this.actionCoder.encode(action))
  }

  public async commit(): Promise<Option<HexString>> {
    if (!this.currentSession.hasUpdates()) {
      // nothing to commit
      console.log("Nothing to commit ")
      // do we need to clear the session?
      return new None()
    }

    let conditions: KvRawType[] = []
    // optimistic locking: check the version of the current session
    // because all data read in the session are already put in the condition, we don't need to add this code
    /*
    console.log('condition: key %s equals to with value %s', VERSION_NUMBER_KEY, this.currentSession.version);
    conditions.push([
        Binary.fromHex(VERSION_NUMBER_KEY),
        this.currentSession.version?.map(this.encodeNumericValue).map(converter).valueOf()
    ]);
     */
    // check if there is no change in the read values
    this.currentSession.values.forEach((value, key) => {
      console.log("condition: key %s equals to with value %s", key, value)
      conditions.push(this.rawTypeEncoder.encodeKeyValue(key, value))
    })

    let updates: KvRawType[] = []
    // optimistic locking: bump the version
    const newVersion = this.bumpVersion()
    console.log(
      "update key %s with value %s",
      this.versionNumberKey,
      newVersion,
    )
    updates.push(
      this.rawTypeEncoder.encodeKeyValue(
        this.versionNumberKey,
        newVersion.map((v)=> this.typeCoder.encodeNumber(v, VERSION_TYPE)),
      ),
    )

    this.currentSession.updates.forEach((value, key) => {
      console.log("update key %s with value %s", key, value)
      updates.push(this.rawTypeEncoder.encodeKeyValue(key, value))
    })

    let actions: ActionRawType[] = []
    if (
      this.currentSession.indexUpdated &&
      this.currentSession.currentIndex != undefined
    ) {
      console.log("SetQueueHead %s", this.currentSession.currentIndex)
      actions.push(
        this.rawTypeEncoder.encodeSetQueueHead(this.currentSession.currentIndex),
      )
    }

    this.currentSession.actions.forEach((action) => {
      console.log("Action : %s " + action)
      actions.push(this.rawTypeEncoder.encodeReply(action))
    })

    const txHash = await this.sendTransaction(conditions, updates, actions)
    console.log("Tx hash ", txHash)
    await this.startSession()
    return Some.of(txHash)
  }

  public async rollback() {
    // start a new session
    await this.startSession()
  }
}
