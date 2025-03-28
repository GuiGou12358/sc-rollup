use ink::codegen::StaticEnv;
use ink::env::DefaultEnvironment;
use crate::traits::kv_store::{Key, KvStore, Value};
use crate::traits::{Result, RollupClientError};
use ink::prelude::vec::Vec;
use ink::scale::{Decode, Encode};
use crate::traits::rollup_client::HandleActionInput;

pub type QueueIndex = u32;

const QUEUE_PREFIX: &[u8] = b"q/";
const QUEUE_HEAD_KEY: &[u8] = b"_head";
const QUEUE_TAIL_KEY: &[u8] = b"_tail";

macro_rules! get_key {
    ($id:ident) => {
        [QUEUE_PREFIX, &$id.encode()].concat()
    };
}

macro_rules! get_tail_key {
    () => {
        [QUEUE_PREFIX, QUEUE_TAIL_KEY].concat()
    };
}

macro_rules! get_head_key {
    () => {
        [QUEUE_PREFIX, QUEUE_HEAD_KEY].concat()
    };
}

macro_rules! get_queue_index {
    ($kv:ident, $key:ident) => {{
        match $kv.inner_get_value(&$key) {
            Some(v) => QueueIndex::decode(&mut v.as_slice())
                .map_err(|_| RollupClientError::FailedToDecode)?,
            _ => 0,
        }
    }};
}

/// Event emitted when a message is push in the queue
#[ink::event]
pub struct MessageQueued {
    #[ink(topic)]
    id: QueueIndex,
    data: Vec<u8>,
}

/// Event emitted when a message is processed
#[ink::event]
pub struct MessageProcessed {
    #[ink(topic)]
    id: QueueIndex,
}

//#[ink::trait_definition]
pub trait MessageQueue: KvStore {
    fn push_message<M: ink::scale::Encode>(&mut self, data: &M) -> Result<QueueIndex> {
        let id = self.get_queue_tail()?;
        let key = get_key!(id);
        let encoded_value = data.encode();
        self.inner_set_value(&key, Some(&encoded_value));

        self.set_queue_tail(
            id.checked_add(1)
                .ok_or(RollupClientError::QueueIndexOverflow)?,
        );

        ::ink::env::emit_event::<DefaultEnvironment, MessageQueued>(MessageQueued{
            id, data: encoded_value
        });

        Ok(id)
    }

    fn get_message<M: ink::scale::Decode>(&self, id: QueueIndex) -> Result<Option<M>> {
        let key = get_key!(id);
        match self.inner_get_value(&key) {
            Some(v) => {
                let message =
                    M::decode(&mut v.as_slice()).map_err(|_| RollupClientError::FailedToDecode)?;
                Ok(Some(message))
            }
            _ => Ok(None),
        }
    }

    fn has_message(&self) -> Result<bool> {
        let current_tail_id = self.get_queue_tail()?;
        let current_head_id = self.get_queue_head()?;
        Ok(current_tail_id > current_head_id)
    }

    fn get_queue_tail(&self) -> Result<QueueIndex> {
        let key = get_tail_key!();
        let index = get_queue_index!(self, key);
        Ok(index)
    }

    fn get_queue_head(&self) -> Result<QueueIndex> {
        let key = get_head_key!();
        let index = get_queue_index!(self, key);
        Ok(index)
    }

    fn pop_to(&mut self, target_id: QueueIndex) -> Result<()> {
        let current_tail_id = self.get_queue_tail()?;
        if target_id > current_tail_id {
            return Err(RollupClientError::InvalidPopTarget);
        }

        let current_head_id = self.get_queue_head()?;
        if target_id < current_head_id {
            return Err(RollupClientError::InvalidPopTarget);
        }

        if target_id == current_head_id {
            // nothing to do
            return Ok(());
        }

        for id in current_head_id..target_id {
            let key = get_key!(id);
            self.inner_set_value(&key, None);
        }

        self.set_queue_head(target_id);

        ::ink::env::emit_event::<DefaultEnvironment, MessageProcessed>(MessageProcessed{
            id: target_id
        });


        Ok(())
    }

    fn set_queue_tail(&mut self, id: QueueIndex) {
        let key = get_tail_key!();
        self.inner_set_value(&key, Some(&id.encode()));
    }

    fn set_queue_head(&mut self, id: QueueIndex) {
        let key = get_head_key!();
        self.inner_set_value(&key, Some(&id.encode()));
    }
}
