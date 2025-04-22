import { Action, Condition, Option, Signature, Target } from "./types"

class RollupTx<K, V> {
  conditions: Condition[]
  actions: Action[]
  updates: Map<K, Option<V>>

  constructor(
    conditions: Condition[],
    actions: Action[],
    updates: Map<K, Option<V>>,
  ) {
    this.conditions = conditions
    this.actions = actions
    this.updates = updates
  }

  addAction(action: Action) {
    this.actions.push(action)
  }
}

export type RollupResult<K, V> = {
  tx: RollupTx<K, V>
  signature: Option<Signature>
  target: Option<Target>
}

export interface RollupHandler<K, V> {
  handleRollup(): RollupResult<K, V>
}
