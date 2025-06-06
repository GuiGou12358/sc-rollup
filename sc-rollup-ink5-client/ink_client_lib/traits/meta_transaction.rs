use crate::traits::kv_store::{Key, Value};
use crate::traits::RollupClientError;
use ink::env::DefaultEnvironment;
use ink::env::hash::{Blake2x256, HashOutput};
use ink::prelude::vec::Vec;
use ink::primitives::{AccountId, Hash};
use ink::scale;
use ink::storage::Mapping;
use crate::traits::rollup_client::{BaseRollupClient, HandleActionInput};

pub type Nonce = u128;

type RollupCondEqMethodParams = (
    Vec<(Key, Option<Value>)>,
    Vec<(Key, Option<Value>)>,
    Vec<HandleActionInput>,
);

#[derive(Debug, Eq, PartialEq, Clone)]
#[ink::scale_derive(Encode, Decode, TypeInfo)]
pub struct ForwardRequest {
    pub from: AccountId,
    pub to: AccountId,
    pub nonce: Nonce,
    pub data: Vec<u8>,
}

/// Event emitted when a meta transaction is decoded
#[ink::event]
pub struct MetaTransactionDecoded {}

#[derive(Default, Debug)]
#[ink::storage_item]
pub struct MetaTransactionData {
    nonces: Mapping<AccountId, Nonce>,
}

impl MetaTransactionData {
    pub fn new() -> Self {
        Self::default()
    }
}

pub trait MetaTransactionStorage {
    fn get_storage(&self) -> &MetaTransactionData;
    fn get_mut_storage(&mut self) -> &mut MetaTransactionData;
}

#[ink::trait_definition]
pub trait MetaTransaction {

    #[ink(message)]
    fn prepare(
        &self,
        from: AccountId,
        data: Vec<u8>,
    ) -> Result<(ForwardRequest, Hash), RollupClientError>;

    #[ink(message)]
    fn meta_tx_rollup_cond_eq(
        &mut self,
        request: ForwardRequest,
        signature: [u8; 65],
    ) -> Result<(), RollupClientError>;
}


pub trait BaseMetaTransaction: MetaTransactionStorage + BaseRollupClient {

    fn inner_prepare(
        &self,
        from: AccountId,
        data: Vec<u8>,
    ) -> Result<(ForwardRequest, Hash), RollupClientError> {
        let nonce = self.get_nonce(from);
        let to = ::ink::env::account_id::<DefaultEnvironment>();

        let request = ForwardRequest {
            from,
            to,
            nonce,
            data,
        };
        let mut hash = <Blake2x256 as HashOutput>::Type::default();
        ink::env::hash_encoded::<Blake2x256, _>(&request, &mut hash);

        Ok((request, hash.into()))
    }

    fn get_nonce(&self, from: AccountId) -> Nonce {
        MetaTransactionStorage::get_storage(self).nonces.get(&from).unwrap_or(0)
    }

    fn verify(
        &self,
        request: &ForwardRequest,
        signature: &[u8; 65],
    ) -> Result<(), RollupClientError> {
        let to = ::ink::env::account_id::<DefaultEnvironment>();
        if request.to != to {
            return Err(RollupClientError::InvalidDestination);
        }

        let nonce_from = self.get_nonce(request.from);
        if request.nonce != nonce_from {
            return Err(RollupClientError::NonceTooLow);
        }

        // at the moment we can only verify ecdsa signatures
        let mut hash = <Blake2x256 as HashOutput>::Type::default();
        ink::env::hash_encoded::<Blake2x256, _>(&request, &mut hash);

        let mut public_key = [0u8; 33];
        ink::env::ecdsa_recover(signature, &hash, &mut public_key)
            .map_err(|_| RollupClientError::IncorrectSignature)?;
        
        ink::env::debug_println!("request.from : {:02x?}", request.from);
        ink::env::debug_println!("public_key : {:02x?}", public_key);
        ink::env::debug_println!("get_ecdsa_account_id(&public_key) : {:02x?}", get_ecdsa_account_id(&public_key));
        
        if request.from != get_ecdsa_account_id(&public_key) {
            return Err(RollupClientError::PublicKeyNotMatch);
        }
        /*
        ink::env::sr25519_verify(signature, &hash, request.from.as_ref())
            .map_err(|_| RollupClientError::PublicKeyNotMatch)?;
            
         */
        
        Ok(())
    }

    fn ensure_meta_tx_valid(
        &mut self,
        request: &ForwardRequest,
        signature: &[u8; 65],
    ) -> Result<(), RollupClientError> {
        // verify the signature
        self.verify(request, signature)?;
        // update the nonce
        let nonce = request
            .nonce
            .checked_add(1)
            .ok_or(RollupClientError::NonceOverflow)?;
        MetaTransactionStorage::get_mut_storage(self).nonces.insert(&request.from, &nonce);
        Ok(())
    }

    fn inner_meta_tx_rollup_cond_eq(
        &mut self,
        request: ForwardRequest,
        signature: [u8; 65],
    ) -> Result<(), RollupClientError> {
        // check the signature
        self.ensure_meta_tx_valid(&request, &signature)?;

        // decode the data
        let data: RollupCondEqMethodParams = scale::Decode::decode(&mut request.data.as_slice())
            .map_err(|_| RollupClientError::FailedToDecode)?;

        // emit the event
        ::ink::env::emit_event::<DefaultEnvironment, MetaTransactionDecoded>(MetaTransactionDecoded {});

        // call the rollup with the attestor role
        self.inner_rollup_cond_eq_with_attestor(request.from, data.0, data.1, data.2)?;

        Ok(())
    }
}

/// Hashing function for bytes
fn hash_blake2b256(input: &[u8]) -> [u8; 32] {
    use ink::env::hash;
    let mut output = <hash::Blake2x256 as hash::HashOutput>::Type::default();
    ink::env::hash_bytes::<hash::Blake2x256>(input, &mut output);
    output
}

/// Converts a compressed ECDSA public key to AccountId
fn get_ecdsa_account_id(pub_key: &[u8; 33]) -> AccountId {
    AccountId::from(hash_blake2b256(pub_key))
}