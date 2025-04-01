use crate::traits::access_control::{BaseAccessControl, RoleType};
use crate::traits::kv_store::{Key, Value};
use crate::traits::message_queue::{MessageQueue, QueueIndex};
use crate::traits::RollupClientError;
use ink::env::DefaultEnvironment;
use ink::prelude::vec::Vec;
use ink::primitives::AccountId;

const ATTESTOR_ROLE: RoleType = ink::selector_id!("ATTESTOR_ROLE");

#[derive(Debug, Eq, PartialEq, Clone)]
#[ink::scale_derive(Encode, Decode, TypeInfo)]
#[allow(clippy::cast_possible_truncation)]
pub enum HandleActionInput {
    Reply(Vec<u8>),
    SetQueueHead(QueueIndex),
    GrantAttestor(AccountId),
    RevokeAttestor(AccountId),
}

pub type RollupCondEqMethodParams = (
    Vec<(Key, Option<Value>)>,
    Vec<(Key, Option<Value>)>,
    Vec<HandleActionInput>,
);

#[ink::trait_definition]
pub trait RollupClient {

    #[ink(message)]
    fn get_value(&self, key: Key) -> Option<Value>;

    #[ink(message)]
    fn has_message(&self) -> Result<bool, RollupClientError>;

    #[ink(message)]
    fn rollup_cond_eq(
        &mut self,
        conditions: Vec<(Key, Option<Value>)>,
        updates: Vec<(Key, Option<Value>)>,
        actions: Vec<HandleActionInput>,
    ) -> Result<(), RollupClientError>;
}


pub trait BaseRollupAnchor: MessageQueue + BaseAccessControl {

    fn inner_rollup_cond_eq(
        &mut self,
        conditions: Vec<(Key, Option<Value>)>,
        updates: Vec<(Key, Option<Value>)>,
        actions: Vec<HandleActionInput>,
    ) -> Result<(), RollupClientError> {

        self.inner_check_role(ATTESTOR_ROLE, ::ink::env::caller::<DefaultEnvironment>())?;

        // check the conditions
        for cond in conditions {
            let key = cond.0;
            let current_value = self.inner_get_value(&key);
            let expected_value = cond.1;
            match (current_value, expected_value) {
                (None, None) => {}
                (Some(v1), Some(v2)) => {
                    if v1.ne(&v2) {
                        // condition is not met
                        return Err(RollupClientError::ConditionNotMet);
                    }
                }
                (_, _) => return Err(RollupClientError::ConditionNotMet),
            }
        }

        // apply the updates
        for update in updates {
            self.inner_set_value(&update.0, update.1.as_ref());
        }

        // apply the actions
        for action in actions {
            self.handle_action(action)?;
        }

        Ok(())
    }

    fn handle_action(&mut self, input: HandleActionInput) -> Result<(), RollupClientError> {
        match input {
            HandleActionInput::Reply(action) => self.on_message_received(action)?,
            HandleActionInput::SetQueueHead(id) => self.pop_to(id)?,
            HandleActionInput::GrantAttestor(address) => {
                self.inner_grant_role(ATTESTOR_ROLE, address)?
            }
            HandleActionInput::RevokeAttestor(address) => {
                self.inner_revoke_role(ATTESTOR_ROLE, address)?
            }
        }
        Ok(())
    }

    fn on_message_received(&mut self, action: Vec<u8>) -> Result<(), RollupClientError>;

}
