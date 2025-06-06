mod test_utils;
mod contract;

use inkv5_client_lib::traits::rollup_client::*;

use crate::test_utils::change_caller;
use contract::test_contract::InkClient;
use inkv5_client_lib::traits::access_control::AccessControl;
use inkv5_client_lib::traits::access_control::AccessControlError;
use inkv5_client_lib::traits::access_control::ADMIN_ROLE;
use test_utils::accounts;


#[ink::test]
fn test_grant_role() {
    let accounts = accounts();
    let mut contract = InkClient::new(accounts.alice);

    assert_eq!(true, contract.has_role(ADMIN_ROLE, accounts.alice));
    assert_eq!(false, contract.has_role(ATTESTOR_ROLE, accounts.alice));

    assert_eq!(false, contract.has_role(ADMIN_ROLE, accounts.bob));
    assert_eq!(false, contract.has_role(ATTESTOR_ROLE, accounts.bob));

    // only admin can grant the role
    change_caller(accounts.bob);
    assert_eq!(
        Err(AccessControlError::MissingRole),
        contract.grant_role(ATTESTOR_ROLE, accounts.bob)
    );
    assert_eq!(false, contract.has_role(ATTESTOR_ROLE, accounts.bob));

    // alice (admin) can grant the role
    change_caller(accounts.alice);
    contract
        .grant_role(ATTESTOR_ROLE, accounts.bob)
        .expect("Error when granting the role Attestor");
    assert_eq!(true, contract.has_role(ATTESTOR_ROLE, accounts.bob));

    // we can't grant twice the same role
    assert_eq!(
        Err(AccessControlError::RoleRedundant),
        contract.grant_role(ATTESTOR_ROLE, accounts.bob)
    );

}

#[ink::test]
fn test_revoke_role() {
    let accounts = accounts();
    change_caller(accounts.alice);
    let mut contract = InkClient::new(accounts.alice);

    contract
        .grant_role(ATTESTOR_ROLE, accounts.bob)
        .expect("Error when granting the role Attestor");

    assert_eq!(true, contract.has_role(ATTESTOR_ROLE, accounts.bob));

    // only admin can revoke the role
    change_caller(accounts.bob);
    assert_eq!(
        Err(AccessControlError::MissingRole),
        contract.revoke_role(ATTESTOR_ROLE, accounts.bob)
    );
    assert_eq!(true, contract.has_role(ATTESTOR_ROLE, accounts.bob));

    // alice (admin) can revoke the role
    change_caller(accounts.alice);
    contract
        .revoke_role(ATTESTOR_ROLE, accounts.bob)
        .expect("Error when granting the role Attestor");

    assert_eq!(false, contract.has_role(ATTESTOR_ROLE, accounts.bob));

    // we can't revoke a missing role
    assert_eq!(
        Err(AccessControlError::MissingRole),
        contract.revoke_role(ATTESTOR_ROLE, accounts.bob)
    );

}

#[ink::test]
fn test_renounce_role() {
    let accounts = accounts();
    change_caller(accounts.alice);
    let mut contract = InkClient::new(accounts.alice);

    contract
        .grant_role(ATTESTOR_ROLE, accounts.bob)
        .expect("Error when grant the role Attestor");

    assert_eq!(true, contract.has_role(ATTESTOR_ROLE, accounts.bob));

    change_caller(accounts.bob);
    contract
        .renounce_role(ATTESTOR_ROLE)
        .expect("Error when renouncing the role Attestor");

    assert_eq!(false, contract.has_role(ATTESTOR_ROLE, accounts.bob));

    // we can't renounce a missing role
    assert_eq!(
        Err(AccessControlError::MissingRole),
        contract.renounce_role(ATTESTOR_ROLE)
    );

}