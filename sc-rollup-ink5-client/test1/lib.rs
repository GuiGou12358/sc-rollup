#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod test1 {
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;
    use ink::storage::Mapping;
    use ink_client_lib::traits::access_control::{AccessControl, AccessControlError, BaseAccessControl, RoleType, ADMIN_ROLE};
    use ink_client_lib::traits::kv_store::{Key, KvStore, Value};
    use ink_client_lib::traits::message_queue::{MessageQueue, QueueIndex};
    use ink_client_lib::traits::ownable::{BaseOwnable, Ownable, OwnableError};
    use ink_client_lib::traits::rollup_client::{BaseRollupAnchor, HandleActionInput, RollupClient, ATTESTOR_ROLE};
    use ink_client_lib::traits::RollupClientError;
    use ink::codegen::Env;


    #[derive(Default, Debug)]
    #[ink(storage)]
    pub struct InkClient {
        pub kv_store: Mapping<Key, Value>,
        pub owner: Option<AccountId>,
        pub roles: Mapping<(AccountId, RoleType), ()>,
        pub flip: bool,
        pub nb_updates: u128,
        pub last_update: u64,
    }

    impl InkClient {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            BaseOwnable::init_with_owner(&mut instance, Self::env().caller());
            BaseAccessControl::init_with_admin(&mut instance, Self::env().caller());
            instance
        }

        #[ink(message)]
        pub fn push_message(&mut self, message: String) -> Result<QueueIndex, RollupClientError>  {
            MessageQueue::push_message(self, &message)
        }

        #[ink(message)]
        pub fn get_admin_role(&self) -> RoleType{
            ADMIN_ROLE
        }

        #[ink(message)]
        pub fn get_attestor_role(&self) -> RoleType{
            ATTESTOR_ROLE
        }

        #[ink(message)]
        pub fn get_flip_value(&self) -> bool {
            self.flip
        }

        #[ink(message)]
        pub fn get_nb_updates(&self) -> u128 {
            self.nb_updates
        }

        #[ink(message)]
        pub fn get_last_update(&self) -> u64 {
            self.last_update
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
            self.inner_transfer_ownership(new_owner)
        }
    }

    impl BaseAccessControl for InkClient {
        fn inner_has_role(&self, role: RoleType, account: AccountId) -> bool {
            self.roles.contains((account, role))
        }

        fn inner_add_role(&mut self, role: RoleType, account: AccountId) {
            self.roles.insert((account, role), &());
        }

        fn inner_remove_role(&mut self, role: RoleType, account: AccountId) {
            self.roles.remove((account, role));
        }
    }


    impl AccessControl for InkClient {

        #[ink(message)]
        fn has_role(&self, role: RoleType, account: AccountId) -> bool {
            self.inner_has_role(role, account)
        }

        #[ink(message)]
        fn grant_role(&mut self, role: RoleType, account: AccountId) -> Result<(), AccessControlError> {
            self.inner_grant_role(role, account)
        }

        #[ink(message)]
        fn revoke_role(&mut self, role: RoleType, account: AccountId) -> Result<(), AccessControlError> {
            self.inner_revoke_role(role, account)
        }

        #[ink(message)]
        fn renounce_role(&mut self, role: RoleType) -> Result<(), AccessControlError> {
            self.inner_renounce_role(role)
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

    impl BaseRollupAnchor for InkClient {
        fn on_message_received(&mut self, _action: Vec<u8>) -> Result<(), RollupClientError> {
            self.flip = !self.flip;
            self.nb_updates = self.nb_updates.checked_add(1).ok_or(RollupClientError::RuntimeError(1))?;
            self.last_update = self.env().block_timestamp();
            Ok(())
        }
    }

    impl RollupClient for InkClient {

        #[ink(message)]
        fn get_value(&self, key: Key) -> Option<Value> {
            KvStore::inner_get_value(self, &key)
        }

        #[ink(message)]
        fn has_message(&self) -> Result<bool, RollupClientError> {
            MessageQueue::has_message(self)
        }

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

}
