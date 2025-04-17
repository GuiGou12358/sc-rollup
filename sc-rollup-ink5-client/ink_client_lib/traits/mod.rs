use crate::traits::access_control::AccessControlError;

pub mod kv_store;
pub mod message_queue;
pub mod rollup_client;
pub mod ownable;
pub mod access_control;

#[derive(Debug, Eq, PartialEq)]
#[ink::scale_derive(Encode, Decode, TypeInfo)]
#[allow(clippy::cast_possible_truncation)]
pub enum RollupClientError {
    InvalidPopTarget,
    ConditionNotMet,
    UnsupportedAction,
    FailedToDecode,
    QueueIndexOverflow,
    NotGranted(AccessControlError),
    AccessControlError(AccessControlError),
    RuntimeError(u128),
    BusinessError(u128),
}

impl From<AccessControlError> for RollupClientError {
    fn from(error: AccessControlError) -> RollupClientError {
        RollupClientError::AccessControlError(error)
    }
}