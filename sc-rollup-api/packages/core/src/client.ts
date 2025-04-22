import { HexString, None, Option, Some } from "./types"
import { ActionEncoder, Codec } from "./codec"
import { Session } from "./session"

export abstract class Client<KV, A> {
  protected currentSession: Session
  protected readonly codec: Codec
  protected readonly actionEncoder: ActionEncoder<KV, A>
  protected readonly versionNumberKey: HexString
  protected readonly queueTailKey: HexString
  protected readonly queueHeadKey: HexString

  protected constructor(
    codec: Codec,
    actionEncoder: ActionEncoder<KV, A>,
    versionNumberKey: HexString,
    queueTailKey: HexString,
    queueHeadKey: HexString,
  ) {
    this.currentSession = new Session()
    this.codec = codec
    this.actionEncoder = actionEncoder
    this.versionNumberKey = versionNumberKey
    this.queueTailKey = queueTailKey
    this.queueHeadKey = queueHeadKey
  }

  protected abstract getMessageKey(index: number): HexString

  protected abstract getRemoteValue(key: HexString): Promise<Option<HexString>>

  protected abstract sendTransaction(
    conditions: KV[],
    updates: KV[],
    actions: A[],
  ): Promise<HexString>

  public async startSession() {
    this.currentSession = new Session()
    this.currentSession.version = await this.getNumericValue(
      this.versionNumberKey,
    )
  }

  private async getIndex(key: HexString): Promise<number> {
    const encodedIndex = await this.getRemoteValue(key)
    const index = encodedIndex.map(this.codec.decodeNumeric).valueOf()
    return index == undefined ? 0 : index
  }

  async getQueueTailIndex(): Promise<number> {
    return await this.getIndex(this.queueTailKey)
  }

  async getQueueHeadIndex(): Promise<number> {
    return await this.getIndex(this.queueHeadKey)
  }

  public async getMessage(index: number): Promise<HexString> {
    const key = this.getMessageKey(index)
    const optionalMessage = await this.getRemoteValue(key)
    const message = optionalMessage.valueOf()
    if (message == undefined) {
      return Promise.reject("Error to get the message for index " + index)
    }
    return message
  }

  public async pollMessage(): Promise<Option<HexString>> {
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

  public async getNumericValue(key: HexString): Promise<Option<number>> {
    const value = await this.getValue(key)
    return value.map(this.codec.decodeNumeric)
  }

  public async getStringValue(key: HexString): Promise<Option<string>> {
    const value = await this.getValue(key)
    return value.map(this.codec.decodeString)
  }

  public async getBooleanValue(key: HexString): Promise<Option<boolean>> {
    const value = await this.getValue(key)
    return value.map(this.codec.decodeBoolean)
  }

  public setStringValue(key: HexString, value: string) {
    const v = this.codec.encodeString(value)
    this.setValue(key, Option.of(v))
  }

  public setBooleanValue(key: HexString, value: boolean) {
    const v = this.codec.encodeBoolean(value)
    this.setValue(key, Option.of(v))
  }

  public setNumericValue(key: HexString, value: number) {
    const v = this.codec.encodeNumeric(value)
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

  public addAction(action: HexString) {
    this.currentSession.actions.push(action)
  }

  public async commit(): Promise<Option<HexString>> {
    if (!this.currentSession.hasUpdates()) {
      // nothing to commit
      console.log("Nothing to commit ")
      // do we need to clear the session?
      return new None()
    }

    let conditions: KV[] = []
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
      conditions.push(this.actionEncoder.encodeKeyValue(key, value))
    })

    let updates: KV[] = []
    // optimistic locking: bump the version
    const newVersion = this.bumpVersion()
    console.log(
      "update key %s with value %s",
      this.versionNumberKey,
      newVersion,
    )
    updates.push(
      this.actionEncoder.encodeKeyValue(
        this.versionNumberKey,
        newVersion.map(this.codec.encodeNumeric),
      ),
    )

    this.currentSession.updates.forEach((value, key) => {
      console.log("update key %s with value %s", key, value)
      updates.push(this.actionEncoder.encodeKeyValue(key, value))
    })

    let actions: A[] = []
    if (
      this.currentSession.indexUpdated &&
      this.currentSession.currentIndex != undefined
    ) {
      console.log("SetQueueHead %s", this.currentSession.currentIndex)
      actions.push(
        this.actionEncoder.encodeSetQueueHead(this.currentSession.currentIndex),
      )
    }

    this.currentSession.actions.forEach((action) => {
      console.log("Action : %s " + action)
      actions.push(this.actionEncoder.encodeReply(action))
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
