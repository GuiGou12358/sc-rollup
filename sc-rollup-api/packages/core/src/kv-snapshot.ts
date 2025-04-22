export type SnapshotId = string

export interface KvSnapshot<K, V> {
  getValue(key: K): Promise<V>
  getSnapshotId(): SnapshotId
}
