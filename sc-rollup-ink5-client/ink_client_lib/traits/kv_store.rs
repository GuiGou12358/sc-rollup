use ink::prelude::vec::Vec;
use ink::storage::Mapping;

pub type Key = Vec<u8>;
pub type Value = Vec<u8>;

#[derive(Default, Debug)]
#[ink::storage_item]
pub struct KvStoreData {
    pub kv_store: Mapping<Key, Value>,
}

impl KvStoreData {
    pub fn new() -> Self {
        Self::default()
    }
}

pub trait KvStoreStorage {
    fn get_storage(&self) -> &KvStoreData;
    fn get_mut_storage(&mut self) -> &mut KvStoreData;
}

pub trait KvStore: KvStoreStorage {
    fn inner_get_value(&self, key: &Key) -> Option<Value> {
        self.get_storage().kv_store.get(key)
    }

    fn inner_set_value(&mut self, key: &Key, value: Option<&Value>) {
        match value {
            None => self.get_mut_storage().kv_store.remove(key),
            Some(v) => {
                self.get_mut_storage().kv_store.insert(key, v);
            }
        }
    }
}
