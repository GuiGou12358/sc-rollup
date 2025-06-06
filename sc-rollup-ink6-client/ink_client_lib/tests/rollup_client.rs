mod contract;
mod test_utils;
use contract::test_contract::InkClient;
use ink::prelude::vec::Vec;
use ink::scale::Encode;
use inkv6_client_lib::traits::access_control::{AccessControl, AccessControlError};
use inkv6_client_lib::traits::message_queue::MessageQueue;
use inkv6_client_lib::traits::rollup_client::*;
use inkv6_client_lib::traits::RollupClientError;
use test_utils::{accounts, change_caller};

#[ink::test]
fn test_conditions() {
    let accounts = accounts();
    change_caller(accounts.alice);

    let mut contract = InkClient::new(accounts.alice);
    assert_eq!(Ok(()), contract.grant_role(ATTESTOR_ROLE, accounts.alice));

    // no condition, no update, no action => it should work
    assert_eq!(contract.rollup_cond_eq(vec![], vec![], vec![]), Ok(()));

    // test with correct condition
    let conditions = vec![(123u8.encode(), None)];
    assert_eq!(contract.rollup_cond_eq(conditions, vec![], vec![]), Ok(()));

    // update a value
    let updates = vec![(123u8.encode(), Some(456u128.encode()))];
    assert_eq!(contract.rollup_cond_eq(vec![], updates, vec![]), Ok(()));

    // test with the correct condition
    let conditions = vec![(123u8.encode(), Some(456u128.encode()))];
    assert_eq!(contract.rollup_cond_eq(conditions, vec![], vec![]), Ok(()));

    // test with incorrect condition (incorrect value)
    let conditions = vec![(123u8.encode(), Some(789u128.encode()))];
    assert_eq!(
        contract.rollup_cond_eq(conditions, vec![], vec![]),
        Err(RollupClientError::ConditionNotMet)
    );

    // test with incorrect condition (incorrect value)
    let conditions = vec![(123u8.encode(), None)];
    assert_eq!(
        contract.rollup_cond_eq(conditions, vec![], vec![]),
        Err(RollupClientError::ConditionNotMet)
    );

    // test with incorrect condition (incorrect key)
    let conditions = vec![
        (123u8.encode(), Some(456u128.encode())),
        (124u8.encode(), Some(456u128.encode())),
    ];
    assert_eq!(
        contract.rollup_cond_eq(conditions, vec![], vec![]),
        Err(RollupClientError::ConditionNotMet)
    );
}

#[ink::test]
fn test_action_pop_to() {
    let accounts = accounts();
    change_caller(accounts.alice);

    let mut contract = InkClient::new(accounts.alice);
    assert_eq!(Ok(()), contract.grant_role(ATTESTOR_ROLE, accounts.alice));

    // no condition, no update, no action
    let mut actions = Vec::new();
    actions.push(HandleActionInput::SetQueueHead(2));

    assert_eq!(
        contract.rollup_cond_eq(vec![], vec![], actions.clone()),
        Err(RollupClientError::InvalidPopTarget)
    );

    let message = 4589u16;
    contract.push_message(&message).unwrap();
    contract.push_message(&message).unwrap();

    assert_eq!(contract.rollup_cond_eq(vec![], vec![], actions), Ok(()));
}

#[ink::test]
fn test_action_reply() {
    let accounts = accounts();
    change_caller(accounts.alice);

    let mut contract = InkClient::new(accounts.alice);
    assert_eq!(Ok(()), contract.grant_role(ATTESTOR_ROLE, accounts.alice));

    let actions = vec![HandleActionInput::Reply(012u8.encode())];

    assert_eq!(contract.rollup_cond_eq(vec![], vec![], actions), Ok(()));
}

#[ink::test]
fn test_grant_revoke_attestor() {
    let accounts = accounts();
    change_caller(accounts.alice);

    let mut contract = InkClient::new(accounts.alice);
    assert_eq!(Ok(()), contract.grant_role(ATTESTOR_ROLE, accounts.alice));

    assert_eq!(false, contract.has_role(ATTESTOR_ROLE, accounts.bob));
    let actions = vec![HandleActionInput::GrantAttestor(accounts.bob)];
    assert_eq!(contract.rollup_cond_eq(vec![], vec![], actions), Ok(()));

    assert_eq!(true, contract.has_role(ATTESTOR_ROLE, accounts.bob));
    let actions = vec![HandleActionInput::RevokeAttestor(accounts.bob)];
    assert_eq!(contract.rollup_cond_eq(vec![], vec![], actions), Ok(()));

    assert_eq!(false, contract.has_role(ATTESTOR_ROLE, accounts.bob));
}

#[ink::test]
fn test_rollup_cond_eq_role_attestor() {
    let accounts = accounts();
    let mut contract = InkClient::new(accounts.alice);

    change_caller(accounts.bob);

    assert_eq!(
        Err(RollupClientError::AccessControlError(
            AccessControlError::MissingRole
        )),
        contract.rollup_cond_eq(vec![], vec![], vec![])
    );

    change_caller(accounts.alice);
    contract
        .grant_role(ATTESTOR_ROLE, accounts.bob)
        .expect("Error when grant the role Attestor");

    change_caller(accounts.bob);
    assert_eq!(Ok(()), contract.rollup_cond_eq(vec![], vec![], vec![]));
}
