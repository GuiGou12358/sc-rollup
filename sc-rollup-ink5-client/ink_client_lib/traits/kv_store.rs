use ink::prelude::vec::Vec;

pub type Key = Vec<u8>;
pub type Value = Vec<u8>;

/*
#[derive(Default, Debug)]
#[ink::storage_item]
pub struct Data {
    pub kv_store: Mapping<Key, Value>,
}
 */

pub trait KvStore {
    fn inner_get_value(&self, key: &Key) -> Option<Value>;
    fn inner_set_value(&mut self, key: &Key, value: Option<&Value>);
}
