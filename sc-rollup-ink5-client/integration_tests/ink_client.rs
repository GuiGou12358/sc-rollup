use ink::env::{DefaultEnvironment};
use ink_e2e::{ContractsBackend, E2EBackend, InstantiationResult};
use ink::scale::Encode;

use ink_client::{ink_client};

use inkv5_client_lib::traits::access_control::{AccessControl};
use inkv5_client_lib::traits::meta_transaction::{MetaTransaction};
use inkv5_client_lib::traits::rollup_client::{
    HandleActionInput, RollupClient, ATTESTOR_ROLE, RollupCondEqMethodParams
};
use std::fmt::Debug;


type E2EResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

async fn alice_instantiates_client<Client>(
    client: &mut Client,
//) -> <Contract as ContractCallBuilder>::Type
//) -> CallBuilder<DefaultEnvironment, Args, RetType, B>
) -> InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
    //Contract: ContractCallBuilder,
    //Contract::Type: FromAccountId<DefaultEnvironment>,
    //Args: Encode + Clone,
    //RetType: Send + Decode,
    //B: BuilderClient<DefaultEnvironment>,
{
    let mut client_constructor = ink_client::InkClientRef::new();
    let contract = client
        .instantiate(
            "ink_client",
            &ink_e2e::alice(),
            &mut client_constructor
        )
        .submit()
        .await
        .expect("instantiate failed");
    contract
    //contract.call_builder::<ink_client::Contract>()
}

async fn alice_grants_bob_as_attestor<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment, <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    // bob is granted as attestor
    let bob_address = ink::primitives::AccountId::from(ink_e2e::bob().public_key().0);
    let grant_role =
        contract.call_builder::<ink_client::InkClient>()
            .grant_role(ATTESTOR_ROLE, bob_address);
    client
        .call(&ink_e2e::alice(), &grant_role)
        .submit()
        .await
        .expect("grant bob as attestor failed");
}

async fn alice_push_message<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment, <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{

    let message = vec![0];
    let push_message =
        contract.call_builder::<ink_client::InkClient>()
            .push_message(message);

    client
        .call(&ink_e2e::alice(), &push_message)
        .submit()
        .await
        .expect("push message failed");
}

async fn has_pending_message<Client: E2EBackend>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment, <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
) -> bool
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let has_pending_message =
        contract.call_builder::<ink_client::InkClient>()
            .has_pending_message();

    client
        .call(&ink_e2e::alice(), &has_pending_message)
        .dry_run()
        .await
        .expect("fail to query has_pending_message")
        .return_value()
}

#[ink_e2e::test]
async fn test_reply(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_client(&mut client).await;

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract).await;

    // send a reply
    let actions = vec![HandleActionInput::Reply(58u128.encode())];
    let rollup_cond_eq =
        contract.call_builder::<ink_client::InkClient>()
            .rollup_cond_eq(vec![], vec![], actions.clone());
    client.call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("reply failed");

    Ok(())
}

#[ink_e2e::test]
async fn test_set_queue_head<Client: E2EBackend>(mut client: Client) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_client(&mut client).await;

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract).await;

    // check the message queue
    assert_eq!(false, has_pending_message(&mut client, &contract).await);

    // push the raffle
    alice_push_message(&mut client, &contract).await;

    // check the message queue
    assert_eq!(true, has_pending_message(&mut client, &contract).await);

    // remove the message from the queue
    let actions = vec![HandleActionInput::SetQueueHead(1)];
    let rollup_cond_eq =
        contract.call_builder::<ink_client::InkClient>()
            .rollup_cond_eq(vec![], vec![], actions.clone());
    client.call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("reply failed");

    // check the message queue
    assert_eq!(false, has_pending_message(&mut client, &contract).await);

    Ok(())
}

#[ink_e2e::test]
async fn test_grant_revoke_attestor<Client: E2EBackend>(mut client: Client) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_client(&mut client).await;

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract).await;

    // bob grants charlie as attestor
    let charlie_address = ink::primitives::AccountId::from(ink_e2e::charlie().public_key().to_account_id().0);
    let actions = vec![HandleActionInput::GrantAttestor(charlie_address)];
    let rollup_cond_eq =
        contract.call_builder::<ink_client::InkClient>()
            .rollup_cond_eq(vec![], vec![], actions.clone());
    client.call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("grant attestor failed");

    // charlie revokes bob as attestor
    let bob_address = ink::primitives::AccountId::from(ink_e2e::bob().public_key().to_account_id().0);
    let actions = vec![HandleActionInput::RevokeAttestor(bob_address)];
    let rollup_cond_eq =
        contract.call_builder::<ink_client::InkClient>()
            .rollup_cond_eq(vec![], vec![], actions.clone());
    client.call(&ink_e2e::charlie(), &rollup_cond_eq)
        .submit()
        .await
        .expect("revoke attestor failed");

    // bob is not granted as attestor => it should not be able to send a message
    let rollup_cond_eq =
        contract.call_builder::<ink_client::InkClient>()
            .rollup_cond_eq(vec![], vec![], vec![]);
    let result = client.call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await;
    assert!(
        result.is_err(),
        "only attestor should be able to send messages"
    );

    Ok(())
}


#[ink_e2e::test]
async fn test_bad_attestor(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_client(&mut client).await;

    // bob is not granted as attestor => it should not be able to send a message
    let rollup_cond_eq =
        contract.call_builder::<ink_client::InkClient>()
            .rollup_cond_eq(vec![], vec![], vec![]);
    let result = client.call(&ink_e2e::bob(), &rollup_cond_eq)
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
    //assert!(!result.contains_event("Contracts", "ContractEmitted"));

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
    let contract = alice_instantiates_client(&mut client).await;

    // Bob is the attestor
    // use the ecsda account because we are not able to verify the sr25519 signature
    let bob_keypair = subxt_signer::ecdsa::dev::bob();
    let from = ink::primitives::AccountId::from(bob_keypair.public_key().to_account_id().0);

    // add the role => it should succeed
    let grant_role =
        contract.call_builder::<ink_client::InkClient>()
            .grant_role(ATTESTOR_ROLE, from);
    client
        .call(&ink_e2e::alice(), &grant_role)
        .submit()
        .await
        .expect("grant the attestor failed");

    // prepare the meta transaction
    let data = RollupCondEqMethodParams::encode(&(vec![], vec![], vec![]));
    let prepare_meta_tx =
        contract.call_builder::<ink_client::InkClient>()
            .prepare(from, data.clone());
    let result = client
        .call(&ink_e2e::charlie(), &prepare_meta_tx)
        .dry_run()
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
    let meta_tx_rollup_cond_eq =
        contract.call_builder::<ink_client::InkClient>()
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
