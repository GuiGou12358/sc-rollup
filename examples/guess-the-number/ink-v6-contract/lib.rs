#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod guess_the_number {
    use ink::codegen::StaticEnv;
    use ink::prelude::vec::Vec;
    use ink::storage::Mapping;
    use inkv6_client_lib::traits::access_control::*;
    use inkv6_client_lib::traits::kv_store::*;
    use inkv6_client_lib::traits::message_queue::*;
    use inkv6_client_lib::traits::meta_transaction::*;
    use inkv6_client_lib::traits::rollup_client::*;
    use inkv6_client_lib::traits::*;

    pub type GameNumber = u128;
    pub type Number = u16;

    const MAX_ATTEMPTS: u32 = 5;

    /// Clue linked to the last number: More or Less than <x>
    #[derive(Debug, PartialEq, Clone)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[cfg_attr(feature = "std", derive(ink::storage::traits::StorageLayout))]
    #[allow(clippy::cast_possible_truncation)]
    pub enum Clue {
        More,
        Less,
        Found,
    }

    /// Game
    #[derive(Debug, PartialEq)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[cfg_attr(feature = "std", derive(ink::storage::traits::StorageLayout))]
    pub struct Game {
        /// game id
        game_number: GameNumber,
        /// min number for this game
        min_number: Number,
        /// max number for this game
        max_number: Number,
        /// number of attempts
        attempt: u32,
        /// last guess made by the user
        last_guess: Option<Number>,
        /// last clue provided by the worker, linked to the last guess
        last_clue: Option<Clue>,
        /// number of max attempts
        max_attempts: u32,
        /// true if the game is over (i.e. the user won or lost)
        game_over: bool,
    }

    /// Storage
    #[derive(Default)]
    #[ink(storage)]
    pub struct GuessTheNumber {
        access_control: AccessControlData,
        kv_store: KvStoreData,
        meta_transaction: MetaTransactionData,
        /// game number incrementer
        next_game_number: GameNumber,
        /// current games. Only 1 game by address.
        games: Mapping<Address, Game>,
    }

    /// Event emitted when a new game is started
    #[ink(event)]
    pub struct NewGame {
        #[ink(topic)]
        game_number: GameNumber,
        #[ink(topic)]
        player: Address,
        min_number: Number,
        max_number: Number,
        max_attempts: u32,
    }

    /// Event emitted when the game is over
    #[ink(event)]
    pub struct GameOver {
        #[ink(topic)]
        game_number: GameNumber,
        #[ink(topic)]
        player: Address,
        win: bool,
        target: Number,
    }

    /// Event emitted when the game is cancelled
    #[ink(event)]
    pub struct GameCancelled {
        #[ink(topic)]
        game_number: GameNumber,
        #[ink(topic)]
        player: Address,
    }

    /// Event emitted when the player makes a guess
    #[ink(event)]
    pub struct GuessMade {
        #[ink(topic)]
        game_number: GameNumber,
        #[ink(topic)]
        player: Address,
        attempt: u32,
        guess: Number,
    }

    /// Event emitted when a clue is given
    #[ink(event)]
    pub struct ClueGiven {
        #[ink(topic)]
        game_number: GameNumber,
        #[ink(topic)]
        player: Address,
        attempt: u32,
        guess: Number,
        clue: Clue,
    }

    /// Event emitted when the max attempts is updated
    #[ink(event)]
    pub struct MaxAttemptsUpdated {
        #[ink(topic)]
        game_number: GameNumber,
        #[ink(topic)]
        player: Address,
        max_attempts: u32,
    }

    /// Errors occurred in the contract
    #[derive(Debug, Eq, PartialEq)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[allow(clippy::cast_possible_truncation)]
    pub enum ContractError {
        AccessControlError(AccessControlError),
        RollupClientError(RollupClientError),
        MinMaxIncorrect,
        GameNumberOverflow,
        AttemptOverflow,
        MissingGame,
        GameOver,
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

    /// Request message to generate a random number via the VRF and to give a clue about the guess made.
    /// Message pushed in the queue by this contract and read by the off-chain worker.
    #[ink::scale_derive(Encode, Decode)]
    struct RequestMessage {
        game_number: GameNumber,
        min_number: Number,
        max_number: Number,
        player: Address,
        attempt: u32,
        guess: Number,
        max_attempts: u32,
    }

    /// Response pushed by the off-chain worker to provide the clue
    #[ink::scale_derive(Encode, Decode)]
    struct ResponseMessage {
        game_number: GameNumber,
        player: Address,
        attempt: u32,
        guess: Number,
        clue: Clue,
        max_attempts: u32,
        target: Option<Number>,
    }

    impl GuessTheNumber {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            let caller = Self::env().caller();
            // set the admin of this contract
            BaseAccessControl::init_with_admin(&mut instance, caller);
            // set the attestor of this contract (todo change it)
            BaseAccessControl::inner_grant_role_unchecked(&mut instance, ATTESTOR_ROLE, caller)
                .expect("Grant the Attestor");
            instance
        }

        #[ink(message)]
        pub fn start_new_game(
            &mut self,
            min_number: Number,
            max_number: Number,
        ) -> Result<(), ContractError> {
            if min_number >= max_number {
                return Err(ContractError::MinMaxIncorrect);
            }

            // the caller is the player
            let player = Self::env().caller();
            let game_number = self.next_game_number;
            let max_attempts = MAX_ATTEMPTS;
            // we create a new game
            let game = Game {
                game_number,
                min_number,
                max_number,
                attempt: 0,
                last_clue: None,
                last_guess: None,
                max_attempts,
                game_over: false,
            };
            // this game is the current one (override the existing one).
            self.games.insert(player, &game);

            // increment the next game number
            self.next_game_number = self
                .next_game_number
                .checked_add(1)
                .ok_or(ContractError::GameNumberOverflow)?;

            // emit the event
            Self::env().emit_event(NewGame {
                game_number,
                player,
                min_number,
                max_number,
                max_attempts,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn guess(&mut self, guess: Number) -> Result<(), ContractError> {
            // the caller is the player
            let player = Self::env().caller();

            // get the current game
            match self.games.get(player) {
                Some(game) => {
                    // manage the game over
                    if game.game_over {
                        return Err(ContractError::GameOver);
                    }

                    // increment the attempt number
                    let attempt = game
                        .attempt
                        .checked_add(1)
                        .ok_or(ContractError::AttemptOverflow)?;
                    // update the storage with this guess
                    self.games.insert(
                        player,
                        &Game {
                            game_number: game.game_number,
                            min_number: game.min_number,
                            max_number: game.max_number,
                            attempt,
                            last_guess: Some(guess),
                            last_clue: None,
                            max_attempts: game.max_attempts,
                            game_over: game.game_over,
                        },
                    );
                    // push the message in the queue to request a clue from the worker
                    let message = RequestMessage {
                        game_number: game.game_number,
                        min_number: game.min_number,
                        max_number: game.max_number,
                        attempt,
                        max_attempts: game.max_attempts,
                        guess,
                        player,
                    };
                    self.push_message(&message)?;

                    // emit the event
                    Self::env().emit_event(GuessMade {
                        game_number: game.game_number,
                        player,
                        attempt,
                        guess,
                    });
                }
                _ => return Err(ContractError::MissingGame),
            };
            Ok(())
        }

        #[ink(message)]
        pub fn get_current_game(&self) -> Option<Game> {
            self.games.get(Self::env().caller())
        }

        #[ink(message)]
        pub fn get_current_game_from(&self, player: Address) -> Option<Game> {
            self.games.get(player)
        }

        #[ink(message)]
        pub fn get_attestor_role(&self) -> RoleType {
            ATTESTOR_ROLE
        }

        #[ink(message)]
        pub fn get_admin_role(&self) -> RoleType {
            ADMIN_ROLE
        }
    }

    /// Implement the business logic for the Rollup Client in the 'on_message_received' method
    impl BaseRollupClient for GuessTheNumber {
        fn on_message_received(&mut self, action: Vec<u8>) -> Result<(), RollupClientError> {
            // decode the response
            let response: ResponseMessage = ink::scale::Decode::decode(&mut &action[..])
                .or(Err(RollupClientError::FailedToDecode))?;

            let player = response.player;
            match self.games.get(player) {
                Some(game) => {
                    // update the current game (the player could start a new game without waiting the clue!)
                    // update the current attempt (the player could make a new guess without waiting the clue!)
                    if game.game_number == response.game_number && game.attempt == response.attempt
                    {
                        let max_attempts = response.max_attempts;
                        let win = response.clue.clone() == Clue::Found;
                        let game_over = win || game.attempt >= max_attempts;

                        // check if the max attempts is updated
                        if max_attempts != game.max_attempts {
                            // emit the event
                            Self::env().emit_event(MaxAttemptsUpdated {
                                game_number: response.game_number,
                                player,
                                max_attempts,
                            });
                        }

                        // manage when the game is over
                        if game_over {
                            // emit the event
                            Self::env().emit_event(GameOver {
                                game_number: response.game_number,
                                player,
                                target: response.target.unwrap_or(0),
                                win,
                            });
                        } else {
                            // emit the event
                            Self::env().emit_event(ClueGiven {
                                game_number: response.game_number,
                                player,
                                attempt: response.attempt,
                                guess: response.guess,
                                clue: response.clue.clone(),
                            });
                        }

                        // update the storage
                        self.games.insert(
                            player,
                            &Game {
                                game_number: game.game_number,
                                min_number: game.min_number,
                                max_number: game.max_number,
                                attempt: game.attempt,
                                max_attempts: max_attempts,
                                last_guess: Some(response.guess),
                                last_clue: Some(response.clue),
                                game_over: game_over,
                            },
                        );
                    }
                }
                _ => return Err(RollupClientError::BusinessError(1)),
            };
            Ok(())
        }
    }

    /// Boilerplate code to implement the access control
    impl AccessControlStorage for GuessTheNumber {
        fn get_storage(&self) -> &AccessControlData {
            &self.access_control
        }

        fn get_mut_storage(&mut self) -> &mut AccessControlData {
            &mut self.access_control
        }
    }

    impl BaseAccessControl for GuessTheNumber {}

    impl AccessControl for GuessTheNumber {
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
    impl KvStoreStorage for GuessTheNumber {
        fn get_storage(&self) -> &KvStoreData {
            &self.kv_store
        }

        fn get_mut_storage(&mut self) -> &mut KvStoreData {
            &mut self.kv_store
        }
    }

    impl KvStore for GuessTheNumber {}

    /// Boilerplate code to implement the Message Queue
    impl MessageQueue for GuessTheNumber {}

    /// Boilerplate code to implement the Rollup Client
    impl RollupClient for GuessTheNumber {
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
    impl MetaTransactionStorage for GuessTheNumber {
        fn get_storage(&self) -> &MetaTransactionData {
            &self.meta_transaction
        }

        fn get_mut_storage(&mut self) -> &mut MetaTransactionData {
            &mut self.meta_transaction
        }
    }

    impl BaseMetaTransaction for GuessTheNumber {}

    impl MetaTransaction for GuessTheNumber {
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
        use ink::env::DefaultEnvironment;
        use ink::primitives::AccountIdMapper;
        use ink::scale::Encode;
        use ink_e2e::{ContractsBackend, E2EBackend, InstantiationResult, Keypair};
        use std::fmt::Debug;

        type E2EResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

        async fn alice_instantiates_contract<Client>(
            client: &mut Client,
        ) -> InstantiationResult<
            DefaultEnvironment,
            <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
            ink::abi::Ink,
        >
        where
            Client: E2EBackend<DefaultEnvironment>,
            <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
        {
            let mut client_constructor = GuessTheNumberRef::new();
            let contract = client
                .instantiate(
                    "guess_the_number",
                    &ink_e2e::alice(),
                    &mut client_constructor,
                )
                .submit()
                .await
                .expect("instantiate failed");
            contract
        }

        async fn start_new_game<Client>(
            client: &mut Client,
            contract: &InstantiationResult<
                DefaultEnvironment,
                <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
                ink::abi::Ink,
            >,
            player: &Keypair,
        ) where
            Client: E2EBackend<DefaultEnvironment>,
            <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
        {
            // start a new game
            let start_new_game = contract
                .call_builder::<GuessTheNumber>()
                .start_new_game(1, 100);
            client
                .call(player, &start_new_game)
                .submit()
                .await
                .expect("start new game failed");
        }

        async fn guess<Client>(
            client: &mut Client,
            contract: &InstantiationResult<
                DefaultEnvironment,
                <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
                ink::abi::Ink,
            >,
            player: &Keypair,
            number: Number,
        ) where
            Client: E2EBackend<DefaultEnvironment>,
            <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
        {
            // start a new game
            let guess = contract.call_builder::<GuessTheNumber>().guess(number);
            client
                .call(player, &guess)
                .submit()
                .await
                .expect("Guess failed");
        }

        async fn alice_grants_bob_as_attestor<Client>(
            client: &mut Client,
            contract: &InstantiationResult<
                DefaultEnvironment,
                <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
                ink::abi::Ink,
            >,
        ) where
            Client: E2EBackend<DefaultEnvironment>,
            <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
        {
            // bob is granted as attestor
            let bob_address =
                AccountIdMapper::to_address(&ink_e2e::bob().public_key().to_account_id().0);
            let grant_role = contract
                .call_builder::<GuessTheNumber>()
                .grant_role(ATTESTOR_ROLE, bob_address);
            client
                .call(&ink_e2e::alice(), &grant_role)
                .submit()
                .await
                .expect("grant bob as attestor failed");
        }

        #[ink_e2e::test]
        async fn test_new_game<Client>(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            // read the current game and check it doesn't exist yet
            let get_current_game = contract.call_builder::<GuessTheNumber>().get_current_game();
            let get_res = client
                .call(&ink_e2e::charlie(), &get_current_game)
                .dry_run()
                .await
                .expect("fail to query get_current_game")
                .return_value();
            assert_eq!(None, get_res);

            // start a new game
            start_new_game(&mut client, &contract, &ink_e2e::charlie()).await;

            // read the current game and check it exists now
            let get_res = client
                .call(&ink_e2e::charlie(), &get_current_game)
                .dry_run()
                .await
                .expect("fail to query get_current_game")
                .return_value();
            match get_res {
                Some(game) => {
                    assert_eq!(0, game.game_number);
                    assert_eq!(1, game.min_number);
                    assert_eq!(100, game.max_number);
                    assert_eq!(0, game.attempt);
                    assert_eq!(None, game.last_guess);
                    assert_eq!(None, game.last_clue);
                    assert_eq!(false, game.game_over);
                    assert_eq!(MAX_ATTEMPTS, game.max_attempts);
                }
                _ => panic!("No game started"),
            }

            Ok(())
        }

        #[ink_e2e::test]
        async fn test_play<Client>(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            // bob is granted as attestor
            alice_grants_bob_as_attestor(&mut client, &contract).await;

            let charlie_address =
                AccountIdMapper::to_address(&ink_e2e::charlie().public_key().to_account_id().0);

            // start a new game
            start_new_game(&mut client, &contract, &ink_e2e::charlie()).await;

            // play - make a guess
            guess(&mut client, &contract, &ink_e2e::charlie(), 50).await;

            // read the current game and check if the guess is made
            let get_current_game = contract.call_builder::<GuessTheNumber>().get_current_game();
            let get_res = client
                .call(&ink_e2e::charlie(), &get_current_game)
                .dry_run()
                .await
                .expect("fail to query get_current_game")
                .return_value();
            match get_res {
                Some(game) => {
                    assert_eq!(0, game.game_number);
                    assert_eq!(1, game.min_number);
                    assert_eq!(100, game.max_number);
                    assert_eq!(1, game.attempt);
                    assert_eq!(Some(50), game.last_guess);
                    assert_eq!(None, game.last_clue);
                    assert_eq!(false, game.game_over);
                    assert_eq!(MAX_ATTEMPTS, game.max_attempts);
                }
                _ => panic!("No game found"),
            }

            // then bob sends the response
            let response = ResponseMessage {
                game_number: 0,
                player: charlie_address,
                attempt: 1,
                guess: 50,
                clue: Clue::More,
                target: None,
                max_attempts: MAX_ATTEMPTS,
            };

            let actions = vec![HandleActionInput::Reply(response.encode())];
            let rollup_cond_eq = contract.call_builder::<GuessTheNumber>().rollup_cond_eq(
                vec![],
                vec![],
                actions.clone(),
            );
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await
                .expect("rollup cond eq failed");

            // event ClueGiven
            assert!(result.contains_event("Revive", "ContractEmitted"));

            // read the current game and check if the clue is given
            let get_res = client
                .call(&ink_e2e::charlie(), &get_current_game)
                .dry_run()
                .await
                .expect("fail to query get_current_game")
                .return_value();
            match get_res {
                Some(game) => {
                    assert_eq!(0, game.game_number);
                    assert_eq!(1, game.min_number);
                    assert_eq!(100, game.max_number);
                    assert_eq!(1, game.attempt);
                    assert_eq!(Some(50), game.last_guess);
                    assert_eq!(Some(Clue::More), game.last_clue);
                    assert_eq!(false, game.game_over);
                    assert_eq!(MAX_ATTEMPTS, game.max_attempts);
                }
                _ => panic!("No game found"),
            }

            // play - make a guess
            guess(&mut client, &contract, &ink_e2e::charlie(), 80).await;

            // read the current game and check if the guess is made
            let get_res = client
                .call(&ink_e2e::charlie(), &get_current_game)
                .dry_run()
                .await
                .expect("fail to query get_current_game")
                .return_value();
            match get_res {
                Some(game) => {
                    assert_eq!(0, game.game_number);
                    assert_eq!(1, game.min_number);
                    assert_eq!(100, game.max_number);
                    assert_eq!(2, game.attempt);
                    assert_eq!(Some(80), game.last_guess);
                    assert_eq!(None, game.last_clue);
                    assert_eq!(false, game.game_over);
                    assert_eq!(MAX_ATTEMPTS, game.max_attempts);
                }
                _ => panic!("No game found"),
            }

            // then bob sends the response
            let response = ResponseMessage {
                game_number: 0,
                player: charlie_address,
                attempt: 2,
                guess: 80,
                clue: Clue::Less,
                target: None,
                max_attempts: MAX_ATTEMPTS,
            };

            let actions = vec![HandleActionInput::Reply(response.encode())];
            let rollup_cond_eq = contract.call_builder::<GuessTheNumber>().rollup_cond_eq(
                vec![],
                vec![],
                actions.clone(),
            );
            let result = client
                .call(&ink_e2e::bob(), &rollup_cond_eq)
                .submit()
                .await
                .expect("rollup cond eq failed");

            // event ClueGiven
            assert!(result.contains_event("Revive", "ContractEmitted"));

            // read the current game and check if the clue is given
            let get_res = client
                .call(&ink_e2e::charlie(), &get_current_game)
                .dry_run()
                .await
                .expect("fail to query get_current_game")
                .return_value();
            match get_res {
                Some(game) => {
                    assert_eq!(0, game.game_number);
                    assert_eq!(1, game.min_number);
                    assert_eq!(100, game.max_number);
                    assert_eq!(2, game.attempt);
                    assert_eq!(Some(80), game.last_guess);
                    assert_eq!(Some(Clue::Less), game.last_clue);
                    assert_eq!(false, game.game_over);
                    assert_eq!(MAX_ATTEMPTS, game.max_attempts);
                }
                _ => panic!("No game found"),
            }

            Ok(())
        }

        #[ink_e2e::test]
        async fn test_bad_attestor(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            // bob is not granted as attestor => it should not be able to send a message
            let rollup_cond_eq =
                contract
                    .call_builder::<GuessTheNumber>()
                    .rollup_cond_eq(vec![], vec![], vec![]);
            let result = client.call(&ink_e2e::bob(), &rollup_cond_eq).submit().await;
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
        async fn test_optimistic_locking(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // given
            let contract = alice_instantiates_contract(&mut client).await;

            // bob is granted as attestor
            alice_grants_bob_as_attestor(&mut client, &contract).await;

            // then bob sends a message
            // from v0 to v1 => it's ok
            let conditions = vec![(123u8.encode(), None)];
            let updates = vec![(123u8.encode(), Some(1u128.encode()))];
            let rollup_cond_eq = contract.call_builder::<GuessTheNumber>().rollup_cond_eq(
                conditions.clone(),
                updates.clone(),
                vec![],
            );
            let result = client.call(&ink_e2e::bob(), &rollup_cond_eq).submit().await;
            result.expect("This message should be proceed because the condition is met");

            // test idempotency it should fail because the conditions are not met
            let result = client.call(&ink_e2e::bob(), &rollup_cond_eq).submit().await;
            assert!(
                result.is_err(),
                "This message should not be proceed because the condition is not met"
            );

            // from v1 to v2 => it's ok
            let conditions = vec![(123u8.encode(), Some(1u128.encode()))];
            let updates = vec![(123u8.encode(), Some(2u128.encode()))];
            let rollup_cond_eq = contract.call_builder::<GuessTheNumber>().rollup_cond_eq(
                conditions.clone(),
                updates.clone(),
                vec![],
            );
            let result = client.call(&ink_e2e::bob(), &rollup_cond_eq).submit().await;
            result.expect("This message should be proceed because the condition is met");

            // test idempotency it should fail because the conditions are not met
            let result = client.call(&ink_e2e::bob(), &rollup_cond_eq).submit().await;
            assert!(
                result.is_err(),
                "This message should not be proceed because the condition is not met"
            );

            Ok(())
        }
    }
}
