# Rollup Client for ink! smart contract 

Library for ink! smart contract to help you build off-chain rollup client deployed on the `contracts` pallet.
It provides the following features:
 - `AccessControl`: Access control management
 - `KvStore`: key-value store that allows off-chain rollup to perform read/write operations.
 - `MessageQueue`: Message Queue, enabling a request-response programming model for the smart-contract while ensuring that each request received exactly one response. It uses the KV Store to save the messages. 
 - `RollupClient`: Use the kv-store and the message queue to allow off-chain rollup transactions.
 - `MetaTransaction`: Allow the off-chain rollup to do transactions without paying the gas fee. The fee will be paid by a third party (the relayer).


## Build the crate

To build the crate:

```bash
cargo build
```

## Run the unit tests

To run the unit tests:
```bash
cargo test
```

## Use this crate in your library

### Add the dependencies

The default toml of your project

```toml

[dependencies]
ink = { version = "5.1.1", default-features = false }
inkv5_client_lib = { path = "../ink_client_lib", default-features = false}

[features]
default = ["std"]
std = [
    "ink/std",
    "inkv5_client_lib/std",
]
```

### Add imports

Import everything from `inkv5_client_lib::traits::access_control`, `inkv5_client_lib::traits::kv_store`, `inkv5_client_lib::traits::message_queue`, `inkv5_client_lib::traits::rollup_client`.

```rust
#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[openbrush::implementation(Ownable, AccessControl)]
#[openbrush::contract]
pub mod ink_client {

    use inkv5_client_lib::traits::access_control::*;
    use inkv5_client_lib::traits::kv_store::*;
    use inkv5_client_lib::traits::message_queue::*;
    use inkv5_client_lib::traits::rollup_client::*; 
...
```

### Define storage

Declare storage struct and declare the fields related to the modules.

```rust
#[derive(Default, Debug)]
#[ink(storage)]
pub struct InkClient {
    access_control: AccessControlData,
    kv_store: KvStoreData,
    meta_transaction: MetaTransactionData,
    ...
}
```

### Define constructor
```rust
impl InkClient {
    #[ink(constructor)]
    pub fn new() -> Self {
        let mut instance = Self::default();
        BaseAccessControl::init_with_admin(&mut instance, Self::env().caller());
        instance
    }
}
```

### Traits to implement

### Implement the business logic for the Rollup Client

Implement the `rollup_client::BaseRollupClient` trait to put your business logic when a message is received.
```rust
    /// Implement the business logic for the Rollup Client in the 'on_message_received' method
    impl BaseRollupClient for InkClient {
        fn on_message_received(&mut self, _action: Vec<u8>) -> Result<(), RollupClientError> {
            // implement the business code here
            Ok(())
        }
    }
```

### Boilerplate code to implement the access control

Add this Boilerplate code to manage the access control

```rust
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
```

### Boilerplate code to implement the Key Value Store

Add this Boilerplate code to implement the Key Value Store

```rust
impl KvStoreStorage for InkClient {
    fn get_storage(&self) -> &KvStoreData {
        &self.kv_store
    }

    fn get_mut_storage(&mut self) -> &mut KvStoreData {
        &mut self.kv_store
    }
}

impl KvStore for InkClient {}
```


### Boilerplate code to implement the message queue

Add this Boilerplate code to implement the message queue

```rust
impl MessageQueue for InkClient {}
```


### Boilerplate code to implement the Rollup Client

Add this Boilerplate code to implement the Rollup Client

```rust
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
```


### Boilerplate code to implement the Meta Transaction

Add this Boilerplate code to implement the Meta Transaction

```rust
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
```

### Final code 
Here the final code of Ink Contract Example

```rust
#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod ink_client {
    use ink::prelude::vec::Vec;
    use inkv5_client_lib::traits::access_control::*;
    use inkv5_client_lib::traits::kv_store::*;
    use inkv5_client_lib::traits::message_queue::*;
    use inkv5_client_lib::traits::meta_transaction::*;
    use inkv5_client_lib::traits::rollup_client::*;

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
```