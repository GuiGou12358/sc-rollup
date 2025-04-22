import { HexString, Option } from "./types"

export class Session {
  version: Option<number> | undefined
  values: Map<HexString, Option<HexString>> = new Map()
  updates: Map<HexString, Option<HexString>> = new Map()
  actions: HexString[] = []
  currentIndex: number | undefined
  indexUpdated: boolean = false

  hasUpdates(): boolean {
    return this.indexUpdated || this.updates.size > 0 || this.actions.length > 0
  }
}
