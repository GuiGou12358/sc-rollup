#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod ink_client {
    use ink::prelude::vec::Vec;
    use ink::prelude::string::String;
    use ink_client_lib::traits::access_control::{
        ADMIN_ROLE, AccessControl, AccessControlData, AccessControlError, AccessControlStorage,
        BaseAccessControl, RoleType,
    };
    use ink_client_lib::traits::kv_store::{Key, KvStore, KvStoreData, KvStoreStorage, Value};
    use ink_client_lib::traits::message_queue::{MessageQueue, QueueIndex};
    use ink_client_lib::traits::meta_transaction::{
        BaseMetaTransaction, ForwardRequest, MetaTransaction, MetaTransactionData,
        MetaTransactionStorage,
    };
    use ink_client_lib::traits::ownable::{
        BaseOwnable, Ownable, OwnableData, OwnableError, OwnableStorage,
    };
    use ink_client_lib::traits::rollup_client::{
        ATTESTOR_ROLE, BaseRollupClient, HandleActionInput, RollupClient,
    };
    use ink_client_lib::traits::RollupClientError;

    #[derive(Default, Debug)]
    #[ink(storage)]
    pub struct InkClient {
        owner: OwnableData,
        access_control: AccessControlData,
        kv_store: KvStoreData,
        meta_transaction: MetaTransactionData,
    }

    impl InkClient {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            BaseOwnable::init_with_owner(&mut instance, Self::env().caller());
            BaseAccessControl::init_with_admin(&mut instance, Self::env().caller());
            BaseAccessControl::inner_grant_role(&mut instance, ATTESTOR_ROLE, Self::env().caller());
            instance
        }

        #[ink(message)]
        pub fn push_message(&mut self, message: String) -> Result<QueueIndex, RollupClientError> {
            MessageQueue::push_message(self, &message)
        }

        #[ink(message)]
        pub fn get_admin_role(&self) -> RoleType {
            ADMIN_ROLE
        }

        #[ink(message)]
        pub fn get_attestor_role(&self) -> RoleType {
            ATTESTOR_ROLE
        }

        #[ink(message)]
        pub fn get_caller_address(&self) -> Address {
            self.env().caller()
        }

        #[ink(message)]
        pub fn get_address(&self, account: Address) -> Address {
            account
        }
    }

    /// Implement the business logic for the Rollup Client in the 'on_message_received' method
    impl BaseRollupClient for InkClient {
        fn on_message_received(&mut self, _action: Vec<u8>) -> Result<(), RollupClientError> {
            // implement the business code here
            Ok(())
        }
    }

    /// Boilerplate code to manage the ownership
    impl OwnableStorage for InkClient {
        fn get_storage(&self) -> &OwnableData {
            &self.owner
        }

        fn get_mut_storage(&mut self) -> &mut OwnableData {
            &mut self.owner
        }
    }

    impl BaseOwnable for InkClient {}

    impl Ownable for InkClient {
        #[ink(message)]
        fn get_owner(&self) -> Option<Address> {
            self.inner_get_owner()
        }

        #[ink(message)]
        fn renounce_ownership(&mut self) -> Result<(), OwnableError> {
            self.inner_renounce_ownership()
        }

        #[ink(message)]
        fn transfer_ownership(&mut self, new_owner: Option<Address>) -> Result<(), OwnableError> {
            self.inner_transfer_ownership(new_owner)
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
