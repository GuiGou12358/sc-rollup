import {BigIntType, HexString, None, NumberType, Option, Some} from "./types"
import {Codec, MessageCoder, RawTypeEncoder} from "./codec"
import {Session} from "./session"

const INDEX_TYPE = "u32";
const VERSION_TYPE = "u32";

export abstract class Client<KvRawType, ActionRawType, Message> {
  protected readonly codec: Codec
  protected readonly encoder: RawTypeEncoder<KvRawType, ActionRawType>
  protected readonly messageCoder: MessageCoder<Message>
  protected readonly versionNumberKey: HexString
  protected readonly queueHeadKey: HexString
  protected readonly queueTailKey: HexString
  protected currentSession: Session

  protected constructor(
    codec: Codec,
    encoder: RawTypeEncoder<KvRawType, ActionRawType>,
    messageCoder: MessageCoder<Message>,
    versionNumberKey: HexString,
    queueHeadKey: HexString,
    queueTailKey: HexString,
  ) {
    this.codec = codec
    this.encoder = encoder
    this.messageCoder = messageCoder
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
    return this.codec.encodeNumber(index, INDEX_TYPE);
  }

  decodeIndex(index: HexString): number {
    return this.codec.decodeNumber(index, INDEX_TYPE);
  }

  private async getIndex(key: HexString): Promise<number> {
    const encodedIndex = await this.getRemoteValue(key)
    return encodedIndex
      .map((v)=> this.codec.decodeNumber(v, INDEX_TYPE))
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
    return value.map((v)=> this.codec.decodeNumber(v, type))
  }

  public async getBigInt(key: HexString, type: BigIntType): Promise<Option<bigint>> {
    const value = await this.getValue(key)
    return value.map((v)=> this.codec.decodeBigInt(v, type))
  }

  public async getBoolean(key: HexString): Promise<Option<boolean>> {
    const value = await this.getValue(key)
    return value.map(this.codec.decodeBoolean)
  }

  public async getString(key: HexString): Promise<Option<string>> {
    const value = await this.getValue(key)
    return value.map(this.codec.decodeString)
  }

  public async getBytes(key: HexString): Promise<Option<Uint8Array>> {
    const value = await this.getValue(key)
    return value.map(this.codec.decodeBytes)
  }

  public setNumber(key: HexString, value: number, type: NumberType) {
    const v = this.codec.encodeNumber(value, type)
    this.setValue(key, Option.of(v))
  }

  public setBigInt(key: HexString, value: bigint, type: BigIntType) {
    const v = this.codec.encodeBigInt(value, type)
    this.setValue(key, Option.of(v))
  }

  public setBoolean(key: HexString, value: boolean) {
    const v = this.codec.encodeBoolean(value)
    this.setValue(key, Option.of(v))
  }

  public setString(key: HexString, value: string) {
    const v = this.codec.encodeString(value)
    this.setValue(key, Option.of(v))
  }

  public setBytes(key: HexString, value: Uint8Array) {
    const v = this.codec.encodeBytes(value)
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

  public addAction(action: Message) {
    this.currentSession.actions.push(this.messageCoder.encode(action))
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
      conditions.push(this.encoder.encodeKeyValue(key, value))
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
      this.encoder.encodeKeyValue(
        this.versionNumberKey,
        newVersion.map((v)=> this.codec.encodeNumber(v, VERSION_TYPE)),
      ),
    )

    this.currentSession.updates.forEach((value, key) => {
      console.log("update key %s with value %s", key, value)
      updates.push(this.encoder.encodeKeyValue(key, value))
    })

    let actions: ActionRawType[] = []
    if (
      this.currentSession.indexUpdated &&
      this.currentSession.currentIndex != undefined
    ) {
      console.log("SetQueueHead %s", this.currentSession.currentIndex)
      actions.push(
        this.encoder.encodeSetQueueHead(this.currentSession.currentIndex),
      )
    }

    this.currentSession.actions.forEach((action) => {
      console.log("Action : %s " + action)
      actions.push(this.encoder.encodeReply(action))
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
