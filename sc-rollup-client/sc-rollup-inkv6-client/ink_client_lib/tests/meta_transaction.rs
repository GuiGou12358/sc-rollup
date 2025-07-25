mod contract;
mod test_utils;

use ink::env::test::{set_callee, set_caller};
use ink::primitives::{AccountIdMapper};
use ink::scale::Encode;
use ink::Address;
use inkv6_client_lib::traits::meta_transaction::*;
use inkv6_client_lib::traits::rollup_client::*;

use contract::test_contract::InkClient;
use inkv6_client_lib::traits::access_control::{AccessControl, AccessControlError};
use inkv6_client_lib::traits::RollupClientError;
use test_utils::accounts;

#[ink::test]
fn test_get_nonce() {
    let accounts = accounts();
    let contract = InkClient::new(accounts.bob);

    // no nonce (ie 0) for new account
    assert_eq!(0, contract.get_nonce(accounts.bob));
}

#[ink::test]
fn test_prepare() {
    let contract_address = Address::from([0xFFu8; 20]);
    set_callee(contract_address);

    let accounts = accounts();
    let contract = InkClient::new(accounts.bob);

    // ecdsa public key d'Alice
    let from = AccountIdMapper::to_address(
        &subxt_signer::ecdsa::dev::alice()
            .public_key()
            .to_account_id()
            .0,
    );

    let data = u8::encode(&5);

    // prepare the meta transaction
    let (request, _hash) = contract
        .prepare(from, data.clone())
        .expect("Error when preparing meta tx");

    assert_eq!(0, request.nonce);
    assert_eq!(from, request.from);
    assert_eq!(contract_address, request.to);
    assert_eq!(&data, &request.data);

    /*
    let expected_hash =
        hex_literal::hex!("9eb948928cf669f05801b791e5770419f1184637cf2ff3e8124c92e44d45e76f");
    assert_eq!(&expected_hash, &hash.as_ref());
     */
}

#[ink::test]
fn test_verify() {
    let contract_address = Address::from([0xFFu8; 20]);
    set_callee(contract_address);

    let accounts = accounts();
    let contract = InkClient::new(accounts.bob);

    // ecdsa public key d'Alice
    let keypair = subxt_signer::ecdsa::dev::alice();
    let from = AccountIdMapper::to_address(&keypair.public_key().to_account_id().0);

    let nonce: Nonce = 0;
    let data = u8::encode(&5);
    let request = ForwardRequest {
        from,
        to: contract_address,
        nonce,
        data: data.clone(),
    };

    let message = ink::scale::Encode::encode(&request);
    // Alice signs the message
    let signature = keypair.sign(&message).0;

    // the verification must succeed
    assert_eq!(Ok(()), contract.verify(&request, &signature));

    // incorrect 'from' => the verification must fail
    let request = ForwardRequest {
        from: accounts.bob,
        to: contract_address,
        nonce,
        data: data.clone(),
    };
    assert_eq!(
        Err(RollupClientError::PublicKeyNotMatch),
        contract.verify(&request, &signature)
    );

    // incorrect 'to' => the verification must fail
    let request = ForwardRequest {
        from,
        to: accounts.bob,
        nonce,
        data: data.clone(),
    };
    assert_eq!(
        Err(RollupClientError::InvalidDestination),
        contract.verify(&request, &signature)
    );

    // incorrect nonce => the verification must fail
    let request = ForwardRequest {
        from,
        to: contract_address,
        nonce: 1,
        data: data.clone(),
    };
    assert_eq!(
        Err(RollupClientError::NonceTooLow),
        contract.verify(&request, &signature)
    );

    // incorrect data => the verification must fail
    let request = ForwardRequest {
        from,
        to: contract_address,
        nonce,
        data: u8::encode(&55),
    };
    assert_eq!(
        Err(RollupClientError::PublicKeyNotMatch),
        contract.verify(&request, &signature)
    );
}

#[ink::test]
fn test_ensure_meta_tx_valid() {
    let contract_address = Address::from([0xFFu8; 20]);
    set_callee(contract_address);

    let accounts = accounts();
    let mut contract = InkClient::new(accounts.bob);

    // ecdsa public key d'Alice
    let keypair = subxt_signer::ecdsa::dev::alice();
    let from = AccountIdMapper::to_address(&keypair.public_key().to_account_id().0);

    let nonce: Nonce = 0;
    let data = u8::encode(&5);
    let request = ForwardRequest {
        from,
        to: contract_address,
        nonce,
        data: data.clone(),
    };

    // Alice signs the message
    let signature = keypair.sign(&ink::scale::Encode::encode(&request)).0;

    // the verification must succeed
    contract
        .ensure_meta_tx_valid(&request, &signature)
        .expect("Error when using meta tx");

    // check if the nonce has been updated
    assert_eq!(1, contract.get_nonce(from));

    // test we cannot reuse the same call
    // the verification must fail
    assert_eq!(
        Err(RollupClientError::NonceTooLow),
        contract.ensure_meta_tx_valid(&request, &signature)
    );
}

#[ink::test]
fn test_meta_tx_rollup_cond_eq() {
    let contract_address = Address::from([0xFFu8; 20]);
    set_callee(contract_address);

    let accounts = accounts();
    let mut contract = InkClient::new(accounts.alice);

    // ecdsa public key d'Alice
    let keypair = subxt_signer::ecdsa::dev::alice();
    let from = AccountIdMapper::to_address(&keypair.public_key().to_account_id().0);

    // add the role
    set_caller(accounts.alice);
    contract
        .grant_role(ATTESTOR_ROLE, from)
        .expect("Error when grant the role Attestor");

    set_caller(accounts.bob);

    let data = RollupCondEqMethodParams::encode(&(vec![], vec![], vec![]));

    let (request, _hash) = contract
        .prepare(from, data)
        .expect("Error when preparing meta tx");

    /*
    let expected_hash =
        hex_literal::hex!("8e00f5d6a0f721acb9f4244a1c28787f7d1cb628176b132b2010c880de153e2e");
    assert_eq!(&expected_hash, &hash.as_ref());
     */

    // Alice signs the message
    let signature = keypair.sign(&ink::scale::Encode::encode(&request)).0;

    set_caller(accounts.bob);
    assert_eq!(
        Ok(()),
        contract.meta_tx_rollup_cond_eq(request.clone(), signature)
    );

    // do it again => it must fail
    assert_eq!(
        Err(RollupClientError::NonceTooLow),
        contract.meta_tx_rollup_cond_eq(request.clone(), signature)
    );
}

#[ink::test]
fn test_meta_tx_rollup_cond_eq_missing_role() {
    let contract_address = Address::from([0xFFu8; 20]);
    set_callee(contract_address);

    let accounts = accounts();
    let mut contract = InkClient::new(accounts.alice);

    // ecdsa public key d'Alice
    let keypair = subxt_signer::ecdsa::dev::alice();
    let from = AccountIdMapper::to_address(&keypair.public_key().to_account_id().0);

    let data = RollupCondEqMethodParams::encode(&(vec![], vec![], vec![]));

    set_caller(accounts.bob);

    let (request, _hash) = contract
        .prepare(from, data.clone())
        .expect("Error when preparing meta tx");

    /*
    let expected_hash =
        hex_literal::hex!("8e00f5d6a0f721acb9f4244a1c28787f7d1cb628176b132b2010c880de153e2e");
    assert_eq!(&expected_hash, &hash.as_ref());
     */

    // Alice signs the message
    let signature = keypair.sign(&ink::scale::Encode::encode(&request)).0;

    // missing role
    assert_eq!(
        Err(RollupClientError::AccessControlError(
            AccessControlError::MissingRole
        )),
        contract.meta_tx_rollup_cond_eq(request.clone(), signature)
    );

    // add the role
    set_caller(accounts.alice);
    contract
        .grant_role(ATTESTOR_ROLE, from)
        .expect("Error when grant the role Attestor");

    // do it again
    set_caller(accounts.bob);
    let (request, _hash) = contract
        .prepare(from, data)
        .expect("Error when preparing meta tx");

    // Alice signs the message
    let signature = keypair.sign(&ink::scale::Encode::encode(&request)).0;

    // bob send the tx
    assert_eq!(
        Ok(()),
        contract.meta_tx_rollup_cond_eq(request.clone(), signature)
    );
}
