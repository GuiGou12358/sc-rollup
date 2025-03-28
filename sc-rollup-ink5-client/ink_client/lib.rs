#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod ink_client {

    use ink_client_lib::traits::kv_store::{Key, KvStore, Value};
    use ink_client_lib::traits::message_queue::{MessageQueue, QueueIndex};
    use ink_client_lib::traits::rollup_client::{
        BaseRollupAnchor, HandleActionInput, MessageHandler, RollupClient,
    };
    use ink_client_lib::traits::{Result, RollupClientError};
    use ink::prelude::vec::Vec;
    use ink::scale::{Decode, Encode};
    use ink::storage::Mapping;
    use ink::prelude::string::String;

    #[derive(Default, Debug)]
    #[ink(storage)]
    pub struct InkClient {
        pub kv_store: Mapping<Key, Value>,
    }

    impl InkClient {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self::default()
        }

        #[ink(message)]
        pub fn push_message(&mut self, message: String) -> Result<QueueIndex>  {
            MessageQueue::push_message(self, &message)
        }
    }

    impl KvStore for InkClient {
        fn inner_get_value(&self, key: &Key) -> Option<Value> {
            self.kv_store.get(key)
        }

        fn inner_set_value(&mut self, key: &Key, value: Option<&Value>) {
            match value {
                None => self.kv_store.remove(key),
                Some(v) => {
                    self.kv_store.insert(key, v);
                }
            }
        }
    }

    impl MessageQueue for InkClient {}

    impl BaseRollupAnchor for InkClient {}

    impl RollupClient for InkClient {
        #[ink(message)]
        fn get_value(&self, key: Key) -> Option<Value> {
            KvStore::inner_get_value(self, &key)
        }

        #[ink(message)]
        fn has_message(&self) -> Result<bool> {
            MessageQueue::has_message(self)
        }

        //#[openbrush::modifiers(access_control::only_role(ATTESTOR_ROLE))]
        #[ink(message)]
        fn rollup_cond_eq(
            &mut self,
            conditions: Vec<(Key, Option<Value>)>,
            updates: Vec<(Key, Option<Value>)>,
            actions: Vec<HandleActionInput>,
        ) -> Result<()> {
            self.inner_rollup_cond_eq(conditions, updates, actions)
        }
    }

    impl MessageHandler for InkClient {
        fn on_message_received(&mut self, action: Vec<u8>) -> Result<()> {
            Ok(())
        }
    }

}
