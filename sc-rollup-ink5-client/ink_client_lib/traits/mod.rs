pub mod kv_store;
pub mod message_queue;
pub mod rollup_client;
pub mod ownable;

#[derive(Debug, Eq, PartialEq)]
#[ink::scale_derive(Encode, Decode, TypeInfo)]
#[allow(clippy::cast_possible_truncation)]
pub enum RollupClientError {
    InvalidPopTarget,
    ConditionNotMet,
    FailedToDecode,
    UnsupportedAction,
    AccessControlError,
    QueueIndexOverflow,
}
