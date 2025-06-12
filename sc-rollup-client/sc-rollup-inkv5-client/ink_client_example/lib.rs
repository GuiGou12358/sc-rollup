#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod ink_client {
    use ink::prelude::vec::Vec;
    use inkv5_client_lib::only_role;
    use inkv5_client_lib::traits::*;
    use inkv5_client_lib::traits::access_control::*;
    use inkv5_client_lib::traits::kv_store::*;
    use inkv5_client_lib::traits::message_queue::*;
    use inkv5_client_lib::traits::rollup_client::*;
    use inkv5_client_lib::traits::meta_transaction::*;

    #[derive(Default, Debug)]
    #[ink(storage)]
    pub struct InkClient {
        access_control: AccessControlData,
        kv_store: KvStoreData,
        meta_transaction: MetaTransactionData,
    }

    impl InkClient {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            BaseAccessControl::init_with_admin(&mut instance, Self::env().caller());
            BaseAccessControl::inner_grant_role(&mut instance, ATTESTOR_ROLE, Self::env().caller()).expect("grant attestor role");
            instance
        }

        #[ink(message)]
        pub fn push_message(&mut self, message: Vec<u8>) -> Result<QueueIndex, RollupClientError> {
            only_role!(self, ADMIN_ROLE);
            MessageQueue::push_message(self, &message)
        }

        #[ink(message)]
        pub fn has_pending_message(&self) -> bool {
            let tail = MessageQueue::get_queue_tail(self).unwrap_or_default();
            let head = MessageQueue::get_queue_head(self).unwrap_or_default();
            tail > head
        }

        #[ink(message)]
        pub fn get_admin_role(&self) -> RoleType {
            ADMIN_ROLE
        }

        #[ink(message)]
        pub fn get_attestor_role(&self) -> RoleType {
            inkv5_client_lib::traits::rollup_client::ATTESTOR_ROLE
        }
    }

    /// Implement the business logic for the Rollup Client in the 'on_message_received' method
    impl BaseRollupClient for InkClient {
        fn on_message_received(&mut self, _action: Vec<u8>) -> Result<(), RollupClientError> {
            // implement the business code here
            Ok(())
        }
    }

    /// Boilerplate code to implement the access control
    impl AccessControlStorage for InkClient {
        fn get_storage(&self) -> &AccessControlData {
            &self.access_control
        }

        fn get_mut_storage(&mut self) -> &mut AccessControlData {
            &mut self.access_control
        }
    }

    impl BaseAccessControl for InkClient {}

    impl AccessControl for InkClient {
        #[ink(message)]
        fn has_role(&self, role: RoleType, account: AccountId) -> bool {
            self.inner_has_role(role, account)
        }

        #[ink(message)]
        fn grant_role(
            &mut self,
            role: RoleType,
            account: AccountId,
        ) -> Result<(), AccessControlError> {
            self.inner_grant_role(role, account)
        }

        #[ink(message)]
        fn revoke_role(
            &mut self,
            role: RoleType,
            account: AccountId,
        ) -> Result<(), AccessControlError> {
            self.inner_revoke_role(role, account)
        }

        #[ink(message)]
        fn renounce_role(&mut self, role: RoleType) -> Result<(), AccessControlError> {
            self.inner_renounce_role(role)
        }
    }

    /// Boilerplate code to implement the Key Value Store
    impl KvStoreStorage for InkClient {
        fn get_storage(&self) -> &KvStoreData {
            &self.kv_store
        }

        fn get_mut_storage(&mut self) -> &mut KvStoreData {
            &mut self.kv_store
        }
    }

    impl KvStore for InkClient {}

    /// Boilerplate code to implement the Message Queue
    impl MessageQueue for InkClient {}

    /// Boilerplate code to implement the Rollup Client
    impl RollupClient for InkClient {
        #[ink(message)]
        fn get_value(&self, key: Key) -> Option<Value> {
            self.inner_get_value(&key)
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

    /// Boilerplate code to implement the Meta Transaction
    impl MetaTransactionStorage for InkClient {
        fn get_storage(&self) -> &MetaTransactionData {
            &self.meta_transaction
        }

        fn get_mut_storage(&mut self) -> &mut MetaTransactionData {
            &mut self.meta_transaction
        }
    }

    impl BaseMetaTransaction for InkClient {}

    impl MetaTransaction for InkClient {
        #[ink(message)]
        fn prepare(
            &self,
            from: AccountId,
            data: Vec<u8>,
        ) -> Result<(ForwardRequest, Hash), RollupClientError> {
            self.inner_prepare(from, data)
        }

        #[ink(message)]
        fn meta_tx_rollup_cond_eq(
            &mut self,
            request: ForwardRequest,
            signature: [u8; 65],
        ) -> Result<(), RollupClientError> {
            self.inner_meta_tx_rollup_cond_eq(request, signature)
        }
    }
}
