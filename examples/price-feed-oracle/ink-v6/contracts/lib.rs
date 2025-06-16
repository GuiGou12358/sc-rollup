#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod price_feed_consumer {
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;
    use ink::storage::Mapping;
    use inkv6_client_lib::only_role;
    use inkv6_client_lib::traits::*;
    use inkv6_client_lib::traits::access_control::*;
    use inkv6_client_lib::traits::kv_store::*;
    use inkv6_client_lib::traits::message_queue::*;
    use inkv6_client_lib::traits::rollup_client::*;
    use inkv6_client_lib::traits::meta_transaction::*;
    use ink::codegen::Env;

    pub type TradingPairId = u32;

    pub const MANAGER_ROLE: RoleType = ink::selector_id!("MANAGER_ROLE");

    /// Events emitted when a price is received
    #[ink(event)]
    pub struct PriceReceived {
        trading_pair_id: TradingPairId,
        price: u128,
    }

    /// Events emitted when an error is received
    #[ink(event)]
    pub struct ErrorReceived {
        trading_pair_id: TradingPairId,
        err_no: u128,
    }

    /// Errors occurred in the contract
    #[derive(Debug, Eq, PartialEq)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[allow(clippy::cast_possible_truncation)]
    pub enum ContractError {
        AccessControlError(AccessControlError),
        RollupClientError(RollupClientError),
        MissingTradingPair,
    }
    /// convertor from AccessControlError to ContractError
    impl From<AccessControlError> for ContractError {
        fn from(error: AccessControlError) -> Self {
            ContractError::AccessControlError(error)
        }
    }
    /// convertor from RollupClientError to ContractError
    impl From<RollupClientError> for ContractError {
        fn from(error: RollupClientError) -> Self {
            ContractError::RollupClientError(error)
        }
    }

    /// Message to request the price of the trading pair
    /// message pushed in the queue by this contract and read by the offchain rollup
    #[ink::scale_derive(Encode, Decode)]
    struct PriceRequestMessage {
        /// id of the pair (use as key in the Mapping)
        trading_pair_id: TradingPairId,
        /// trading pair like 'polkdatot/usd'
        /// Note: it will be better to not save this data in the storage
        token0: String,
        token1: String,
    }
    /// Message sent to provide the price of the trading pair
    /// response pushed in the queue by the offchain rollup and read by this contract
    #[ink::scale_derive(Encode, Decode)]
    struct PriceResponseMessage {
        /// Type of response
        resp_type: u8,
        /// id of the pair
        trading_pair_id: TradingPairId,
        /// price of the trading pair
        price: Option<u128>,
        /// when the price is read
        err_no: Option<u128>,
    }

    /// Type of response when the offchain rollup communicates with this contract
    const TYPE_ERROR: u8 = 0;
    const TYPE_RESPONSE: u8 = 10;
    const TYPE_FEED: u8 = 11;

    /// Data storage
    #[derive(Default, Eq, PartialEq, Clone, Debug)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[cfg_attr(
        feature = "std",
        derive(ink::storage::traits::StorageLayout)
    )]
    pub struct TradingPair {
        /// trading pair like 'polkdatot/usd'
        /// Note: it will be better to not save this data outside of the storage
        token0: String,
        token1: String,
        /// value of the trading pair
        value: u128,
        /// number of updates of the value
        nb_updates: u16,
        /// when the last value has been updated
        last_update: u64,
    }

    #[derive(Default)]
    #[ink(storage)]
    pub struct PriceFeedConsumer {
        access_control: AccessControlData,
        kv_store: KvStoreData,
        meta_transaction: MetaTransactionData,
        trading_pairs: Mapping<TradingPairId, TradingPair>,
    }

    impl PriceFeedConsumer {

        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            let caller = instance.env().caller();
            // set the admin of this contract
            BaseAccessControl::init_with_admin(&mut instance, caller);
            // grant the role manager
            BaseAccessControl::inner_grant_role(&mut instance, MANAGER_ROLE, caller)
                .expect("Should grant the role MANAGER_ROLE");
            instance
        }

        #[ink(message)]
        pub fn create_trading_pair(
            &mut self,
            trading_pair_id: TradingPairId,
            token0: String,
            token1: String,
        ) -> Result<(), ContractError> {
            // only the manager role
            only_role!(self, MANAGER_ROLE);
            // we create a new trading pair or override an existing one
            let trading_pair = TradingPair {
                token0,
                token1,
                value: 0,
                nb_updates: 0,
                last_update: 0,
            };
            self.trading_pairs.insert(trading_pair_id, &trading_pair);
            Ok(())
        }

        #[ink(message)]
        pub fn request_price(
            &mut self,
            trading_pair_id: TradingPairId,
        ) -> Result<QueueIndex, ContractError> {
            // only the manager role
            only_role!(self, MANAGER_ROLE);
            let index = match self.trading_pairs.get(trading_pair_id) {
                Some(t) => {
                    // push the message in the queue
                    let message = PriceRequestMessage {
                        trading_pair_id,
                        token0: t.token0,
                        token1: t.token1,
                    };
                    self.push_message(&message)?
                }
                _ => return Err(ContractError::MissingTradingPair),
            };

            Ok(index)
        }

        #[ink(message)]
        pub fn get_trading_pair(&self, trading_pair_id: TradingPairId) -> Option<TradingPair> {
            self.trading_pairs.get(trading_pair_id)
        }

        #[ink(message)]
        pub fn get_attestor_role(&self) -> RoleType {
            ATTESTOR_ROLE
        }

        #[ink(message)]
        pub fn get_admin_role(&self) -> RoleType {
            ADMIN_ROLE
        }

        #[ink(message)]
        pub fn get_manager_role(&self) -> RoleType {
            MANAGER_ROLE
        }
        
    }



    /// Implement the business logic for the Rollup Client in the 'on_message_received' method
    impl BaseRollupClient for PriceFeedConsumer {
        fn on_message_received(&mut self, action: Vec<u8>) -> Result<(), RollupClientError> {

            // parse the response
            let message: PriceResponseMessage =
                ink::scale::Decode::decode(&mut &action[..]).or(Err(RollupClientError::FailedToDecode))?;

            // handle the response
            if message.resp_type == TYPE_RESPONSE || message.resp_type == TYPE_FEED {
                // we received the price
                // register the info
                let mut trading_pair = self
                    .trading_pairs
                    .get(message.trading_pair_id)
                    .unwrap_or_default();
                trading_pair.value = message.price.unwrap_or_default();
                trading_pair.nb_updates = trading_pair.nb_updates
                    .checked_add(1)
                    .ok_or(RollupClientError::RuntimeError(0))?; // TODO improve the error
                trading_pair.last_update = self.env().block_timestamp();
                self.trading_pairs
                    .insert(message.trading_pair_id, &trading_pair);

                // emmit te event
                self.env().emit_event(PriceReceived {
                    trading_pair_id: message.trading_pair_id,
                    price: message.price.unwrap_or_default(),
                });
            } else if message.resp_type == TYPE_ERROR {
                // we received an error
                self.env().emit_event(ErrorReceived {
                    trading_pair_id: message.trading_pair_id,
                    err_no: message.err_no.unwrap_or_default(),
                });
            } else {
                // response type unknown
                return Err(RollupClientError::UnsupportedAction);
            }

            Ok(())
        }
    }

    /// Boilerplate code to implement the access control
    impl AccessControlStorage for PriceFeedConsumer {
        fn get_storage(&self) -> &AccessControlData {
            &self.access_control
        }

        fn get_mut_storage(&mut self) -> &mut AccessControlData {
            &mut self.access_control
        }
    }

    impl BaseAccessControl for PriceFeedConsumer {}

    impl AccessControl for PriceFeedConsumer {
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
    impl KvStoreStorage for PriceFeedConsumer {
        fn get_storage(&self) -> &KvStoreData {
            &self.kv_store
        }

        fn get_mut_storage(&mut self) -> &mut KvStoreData {
            &mut self.kv_store
        }
    }

    impl KvStore for PriceFeedConsumer {}

    /// Boilerplate code to implement the Message Queue
    impl MessageQueue for PriceFeedConsumer {}

    /// Boilerplate code to implement the Rollup Client
    impl RollupClient for PriceFeedConsumer {
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
    impl MetaTransactionStorage for PriceFeedConsumer {
        fn get_storage(&self) -> &MetaTransactionData {
            &self.meta_transaction
        }

        fn get_mut_storage(&mut self) -> &mut MetaTransactionData {
            &mut self.meta_transaction
        }
    }

    impl BaseMetaTransaction for PriceFeedConsumer {}

    impl MetaTransaction for PriceFeedConsumer {
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
    


    #[cfg(all(test, feature = "e2e-tests"))]
    mod e2e_tests {
        use super::*;
        use ink::env::{DefaultEnvironment};
        use ink::primitives::AccountIdMapper;
        use ink_e2e::{ContractsBackend, E2EBackend, InstantiationResult};
        use ink::scale::Encode;
        use std::fmt::Debug;

        type E2EResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;
        
        async fn alice_instantiates_contract<Client>(
            client: &mut Client,
        ) -> InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>
        where
            Client: E2EBackend,
            <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
        {
            let mut client_constructor = PriceFeedConsumerRef::new();
            let contract = client
                .instantiate(
                    "price_feed_consumer",
                    &ink_e2e::alice(),
                    &mut client_constructor
                )
                .submit()
                .await
                .expect("instantiate failed");
            contract
        }
        async fn alice_creates_trading_pair<Client>(
            client: &mut Client,
            contract: &InstantiationResult<DefaultEnvironment, <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
            trading_pair_id: &TradingPairId,
        ) where
            Client: E2EBackend,
            <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
        {
            // create the trading pair
            let create_trading_pair =
                contract.call_builder::<PriceFeedConsumer>()
                    .create_trading_pair(
                        trading_pair_id.clone(),
                        String::from("polkadot"),
                        String::from("usd"),
                    );
            client
                .call(&ink_e2e::alice(), &create_trading_pair)
                .submit()
                .await
                .expect("create trading pair failed");
        }

        async fn alice_grants_bob_as_attestor<Client>(
            client: &mut Client,
            contract: &InstantiationResult<DefaultEnvironment, <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
        ) where
            Client: E2EBackend,
            <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
        {
            // bob is granted as attestor
            let bob_address = AccountIdMapper::to_address(&ink_e2e::bob().public_key().to_account_id().0);
            let grant_role =
                contract.call_builder::<PriceFeedConsumer>()
                    .grant_role(ATTESTOR_ROLE, bob_address);
            client
                .call(&ink_e2e::alice(), &grant_role)
                .submit()
                .await
                .expect("grant bob as attestor failed");
        }

        #[ink_e2e::test]
        async fn test_create_trading_pair<Client>(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            let trading_pair_id = 10;

            // read the trading pair and check it doesn't exist yet
            let get_trading_pair = contract.call_builder::<PriceFeedConsumer>()
                .get_trading_pair(trading_pair_id);
            let get_res = client
                .call(&ink_e2e::bob(), &get_trading_pair)
                .dry_run()
                .await
                .expect("fail to query get_trading_pair")
                .return_value();
            assert_eq!(None, get_res);

            // bob is not granted as manager => it should not be able to create the trading pair
            let create_trading_pair =
                contract.call_builder::<PriceFeedConsumer>()
                    .create_trading_pair(
                        trading_pair_id,
                        String::from("polkadot"),
                        String::from("usd"),
                    );
            let result = client
                .call(&ink_e2e::bob(), &create_trading_pair)
                .submit()
                .await;
            assert!(
                result.is_err(),
                "only manager should not be able to create trading pair"
            );

            // bob is granted as manager
            let bob_address = AccountIdMapper::to_address(&ink_e2e::bob().public_key().to_account_id().0);

            let grant_role = contract.call_builder::<PriceFeedConsumer>()
                .grant_role(MANAGER_ROLE, bob_address);
            client
                .call(&ink_e2e::alice(), &grant_role)
                .submit()
                .await
                .expect("grant bob as manager failed");

            //create the trading pair
            client
                .call(&ink_e2e::bob(), &create_trading_pair)
                .submit()
                .await
                .expect("create trading pair failed");

            // then check if the trading pair exists
            let get_res = client
                .call(&ink_e2e::bob(), &get_trading_pair)
                .dry_run()
                .await
                .expect("fail to query get_trading_pair")
                .return_value();
            let expected_trading_pair = TradingPair {
                token0: String::from("polkadot"),
                token1: String::from("usd"),
                value: 0,
                nb_updates: 0,
                last_update: 0,
            };
            assert_eq!(Some(expected_trading_pair), get_res);

            Ok(())
        }

        #[ink_e2e::test]
        async fn test_feed_price(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            let trading_pair_id = 10;

            // create the trading pair
            alice_creates_trading_pair(
                &mut client,
                &contract,
                &trading_pair_id
            )
            .await;

            // bob is granted as attestor
            alice_grants_bob_as_attestor(&mut client, &contract).await;

            // then bob feeds the price
            let value: u128 = 150_000_000_000_000_000_000;
            let payload = PriceResponseMessage {
                resp_type: TYPE_FEED,
                trading_pair_id,
                price: Some(value),
                err_no: None,
            };
            let actions = vec![HandleActionInput::Reply(payload.encode())];
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(vec![], vec![], actions.clone());
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await
                .expect("rollup cond eq failed");
            // events PriceReceived
            assert!(result.contains_event("Revive", "ContractEmitted"));

            // and check if the price is filled
            let get_trading_pair = contract.call_builder::<PriceFeedConsumer>()
                .get_trading_pair(trading_pair_id);
            let trading_pair = client
                .call(&ink_e2e::bob(), &get_trading_pair)
                .dry_run()
                .await
                .expect("fail to query get_trading_pair")
                .return_value()
                .expect("Trading pair not found");

            assert_eq!(value, trading_pair.value);
            assert_eq!(1, trading_pair.nb_updates);
            assert_ne!(0, trading_pair.last_update);

            Ok(())
        }

        #[ink_e2e::test]
        async fn test_receive_reply(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            let trading_pair_id = 10;

            // create the trading pair
            alice_creates_trading_pair(
                &mut client,
                &contract,
                &trading_pair_id
            )
            .await;

            // bob is granted as attestor
            alice_grants_bob_as_attestor(&mut client, &contract).await;

            // a price request is sent
            let request_price = contract.call_builder::<PriceFeedConsumer>()
                .request_price(trading_pair_id);
            let result = client
                .call(&ink_e2e::alice(), &request_price)
                .submit()
                .await
                .expect("Request price should be sent");
            // event MessageQueued
            assert!(result.contains_event("Revive", "ContractEmitted"));

            let request_id = result.return_value().expect("Request id not found");

            // then a response is received
            let value: u128 = 150_000_000_000_000_000_000;
            let payload = PriceResponseMessage {
                resp_type: TYPE_RESPONSE,
                trading_pair_id,
                price: Some(value),
                err_no: None,
            };
            let actions = vec![
                HandleActionInput::Reply(payload.encode()),
                HandleActionInput::SetQueueHead(request_id + 1),
            ];
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(vec![], vec![], actions.clone());
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await
                .expect("rollup cond eq should be ok");
            // two events : MessageProcessedTo and PricesRecieved
            assert!(result.contains_event("Revive", "ContractEmitted"));

            // and check if the price is filled
            let get_trading_pair = contract.call_builder::<PriceFeedConsumer>()
                .get_trading_pair(trading_pair_id);
            let trading_pair = client
                .call(&ink_e2e::bob(), &get_trading_pair)
                .dry_run()
                .await
                .expect("fail to query get_trading_pair")
                .return_value()
                .expect("Trading pair not found");

            assert_eq!(value, trading_pair.value);
            assert_eq!(1, trading_pair.nb_updates);
            assert_ne!(0, trading_pair.last_update);

            // reply in the future should fail
            let actions = vec![
                HandleActionInput::Reply(payload.encode()),
                HandleActionInput::SetQueueHead(request_id + 2),
            ];
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(vec![], vec![], actions.clone());
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await;
            assert!(
                result.is_err(),
                "Rollup should fail because we try to pop in the future"
            );

            // reply in the past should fail
            let actions = vec![
                HandleActionInput::Reply(payload.encode()),
                HandleActionInput::SetQueueHead(request_id),
            ];
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(vec![], vec![], actions.clone());
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await;
            assert!(
                result.is_err(),
                "Rollup should fail because we try to pop in the past"
            );

            Ok(())
        }

        #[ink_e2e::test]
        async fn test_receive_error(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            let trading_pair_id = 10;

            // create the trading pair
            alice_creates_trading_pair(
                &mut client,
                &contract,
                &trading_pair_id
            )
            .await;

            // bob is granted as attestor
            alice_grants_bob_as_attestor(&mut client, &contract).await;

            // a price request is sent
            let request_price = contract.call_builder::<PriceFeedConsumer>()
                .request_price(trading_pair_id);
            let result = client
                .call(&ink_e2e::alice(), &request_price)
                .submit()
                .await
                .expect("Request price should be sent");
            // event : MessageQueued
            assert!(result.contains_event("Revive", "ContractEmitted"));

            let request_id = result.return_value().expect("Request id not found");

            // then a response is received
            let payload = PriceResponseMessage {
                resp_type: TYPE_ERROR,
                trading_pair_id,
                price: None,
                err_no: Some(12356),
            };
            let actions = vec![
                HandleActionInput::Reply(payload.encode()),
                HandleActionInput::SetQueueHead(request_id + 1),
            ];
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(vec![], vec![], actions.clone());
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await
                .expect("we should proceed error message");
            // two events : MessageProcessedTo and PricesReceived
            assert!(result.contains_event("Revive", "ContractEmitted"));

            Ok(())
        }

        #[ink_e2e::test]
        async fn test_bad_attestor(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            // bob is not granted as attestor => it should not be able to send a message
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(vec![], vec![], vec![]);
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await;
            assert!(
                result.is_err(),
                "only attestor should be able to send messages"
            );

            // bob is granted as attestor
            alice_grants_bob_as_attestor(&mut client, &contract).await;

            // then bob is able to send a message
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await
                .expect("rollup cond eq failed");
            // no event
            assert!(!result.contains_event("Revive", "ContractEmitted"));

            Ok(())
        }

        #[ink_e2e::test]
        async fn test_bad_messages(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            let trading_pair_id = 10;

            // create the trading pair
            alice_creates_trading_pair(
                &mut client,
                &contract,
                &trading_pair_id
            )
            .await;

            // bob is granted as attestor
            alice_grants_bob_as_attestor(&mut client, &contract).await;

            // then bob sends a message
            let actions = vec![HandleActionInput::Reply(58u128.encode())];
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(vec![], vec![], actions.clone());
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await;
            assert!(
                result.is_err(),
                "we should not be able to proceed bad messages"
            );

            Ok(())
        }

        #[ink_e2e::test]
        async fn test_optimistic_locking(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            // bob is granted as attestor
            alice_grants_bob_as_attestor(&mut client, &contract).await;

            // then bob sends a message
            // from v0 to v1 => it's ok
            let conditions = vec![(123u8.encode(), None)];
            let updates = vec![(123u8.encode(), Some(1u128.encode()))];
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(conditions.clone(), updates.clone(), vec![]);
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await;
            result.expect("This message should be proceed because the condition is met");

            // test idempotency it should fail because the conditions are not met
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await;
            assert!(
                result.is_err(),
                "This message should not be proceed because the condition is not met"
            );

            // from v1 to v2 => it's ok
            let conditions = vec![(123u8.encode(), Some(1u128.encode()))];
            let updates = vec![(123u8.encode(), Some(2u128.encode()))];
            let rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .rollup_cond_eq(conditions.clone(), updates.clone(), vec![]);
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await;
            result.expect("This message should be proceed because the condition is met");

            // test idempotency it should fail because the conditions are not met
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await;
            assert!(
                result.is_err(),
                "This message should not be proceed because the condition is not met"
            );

            Ok(())
        }

        ///
        /// Test the meta transactions
        /// Alice is the owner
        /// Bob is the attestor
        /// Charlie is the sender (ie the payer)
        ///
        #[ink_e2e::test]
        async fn test_meta_tx_rollup_cond_eq(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            let contract = alice_instantiates_contract(&mut client).await;

            // Bob is the attestor
            // use the ecsda account because we are not able to verify the sr25519 signature
            let bob_keypair = subxt_signer::ecdsa::dev::bob();
            let from = AccountIdMapper::to_address(&bob_keypair.public_key().to_account_id().0);

            // add the role => it should be succeed
            let grant_role = contract.call_builder::<PriceFeedConsumer>()
                .grant_role(ATTESTOR_ROLE, from);
            client
                .call(&ink_e2e::alice(), &grant_role)
                .submit()
                .await
                .expect("grant the attestor failed");

            // prepare the meta transaction
            let data = RollupCondEqMethodParams::encode(&(vec![], vec![], vec![]));
            let prepare_meta_tx = contract.call_builder::<PriceFeedConsumer>()
                .prepare(from, data.clone());
            let result = client
                .call(&ink_e2e::bob(), &prepare_meta_tx)
                .submit()
                .await
                .expect("We should be able to prepare the meta tx");

            let (request, _hash) = result
                .return_value()
                .expect("Expected value when preparing meta tx");

            assert_eq!(0, request.nonce);
            assert_eq!(from, request.from);
            assert_eq!(&data, &request.data);

            // Bob signs the message
            let signature = bob_keypair.sign(&ink::scale::Encode::encode(&request)).0;

            // do the meta tx: charlie sends the message
            let meta_tx_rollup_cond_eq = contract.call_builder::<PriceFeedConsumer>()
                .meta_tx_rollup_cond_eq(request.clone(), signature);
            client
                .call(&ink_e2e::charlie(), &meta_tx_rollup_cond_eq)
                .submit()
                .await
                .expect("meta tx rollup cond eq should not failed");

            // do it again => it must fail
            let result = client
                .call(&ink_e2e::charlie(), &meta_tx_rollup_cond_eq)
                .submit()
                .await;
            assert!(
                result.is_err(),
                "This message should not be proceed because the nonce is obsolete"
            );

            Ok(())
        }
    }
}
