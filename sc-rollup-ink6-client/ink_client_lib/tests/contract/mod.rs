#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod test_contract {
    use inkv6_client_lib::traits::access_control::{
        AccessControl, AccessControlData, AccessControlError, AccessControlStorage,
        BaseAccessControl, RoleType,
    };
    use inkv6_client_lib::traits::kv_store::{Key, KvStore, KvStoreData, KvStoreStorage, Value};
    use inkv6_client_lib::traits::message_queue::MessageQueue;
    use inkv6_client_lib::traits::meta_transaction::{
        BaseMetaTransaction, ForwardRequest, MetaTransaction, MetaTransactionData,
        MetaTransactionStorage,
    };
    use inkv6_client_lib::traits::rollup_client::{
        BaseRollupClient, HandleActionInput, RollupClient,
    };
    use inkv6_client_lib::traits::RollupClientError;

    #[derive(Default)]
    #[ink(storage)]
    pub struct InkClient {
        access_control: AccessControlData,
        kv_store: KvStoreData,
        meta_transaction: MetaTransactionData,
    }

    impl InkClient {
        #[ink(constructor)]
        pub fn new(admin: Address) -> Self {
            let mut instance = Self::default();
            BaseAccessControl::init_with_admin(&mut instance, admin);
            instance
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
        fn has_role(&self, role: RoleType, account: Address) -> bool {
            self.inner_has_role(role, account)
        }

        #[ink(message)]
        fn grant_role(
            &mut self,
            role: RoleType,
            account: Address,
        ) -> Result<(), AccessControlError> {
            self.inner_grant_role(role, account)
        }

        #[ink(message)]
        fn revoke_role(
            &mut self,
            role: RoleType,
            account: Address,
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
            from: Address,
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
