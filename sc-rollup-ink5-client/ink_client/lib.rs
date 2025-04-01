#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod ink_client {
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;
    use ink::scale::{Decode, Encode};
    use ink::storage::Mapping;
    use ink_client_lib::traits::kv_store::{Key, KvStore, Value};
    use ink_client_lib::traits::message_queue::{MessageQueue, QueueIndex};
    use ink_client_lib::traits::ownable::{BaseOwnable, Ownable, OwnableError};
    use ink_client_lib::traits::rollup_client::{
        BaseRollupAnchor, HandleActionInput, MessageHandler, RollupClient,
    };
    use ink_client_lib::traits::RollupClientError;

    #[derive(Default, Debug)]
    #[ink(storage)]
    pub struct InkClient {
        pub kv_store: Mapping<Key, Value>,
        pub owner: Option<AccountId>,
    }

    impl InkClient {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self::default()
        }

        #[ink(message)]
        pub fn push_message(&mut self, message: String) -> Result<QueueIndex, RollupClientError>  {
            MessageQueue::push_message(self, &message)
        }
    }

    impl BaseOwnable for InkClient {
        fn inner_get_owner(&self) -> Option<AccountId> {
            self.owner
        }

        fn inner_set_owner(&mut self, owner: Option<AccountId>) {
            self.owner = owner;
        }
    }

    impl Ownable for InkClient {

        #[ink(message)]
        fn get_owner(&self) -> Option<AccountId> {
            self.inner_get_owner()
        }

        #[ink(message)]
        fn renounce_ownership(&mut self) -> Result<(), OwnableError> {
            self.inner_renounce_ownership()
        }

        #[ink(message)]
        fn transfer_ownership(&mut self, new_owner: Option<AccountId>) -> Result<(), OwnableError> {
            self.transfer_ownership(new_owner)
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
        fn has_message(&self) -> Result<bool, RollupClientError> {
            MessageQueue::has_message(self)
        }

        //#[openbrush::modifiers(access_control::only_role(ATTESTOR_ROLE))]
        #[ink(message)]
        fn rollup_cond_eq(
            &mut self,
            conditions: Vec<(Key, Option<Value>)>,
            updates: Vec<(Key, Option<Value>)>,
            actions: Vec<HandleActionInput>,
        ) -> Result<(), RollupClientError> {
            self.inner_rollup_cond_eq(conditions, updates, actions)
        }
    }

    impl MessageHandler for InkClient {
        fn on_message_received(&mut self, action: Vec<u8>) -> Result<(), RollupClientError> {
            Ok(())
        }
    }

}
