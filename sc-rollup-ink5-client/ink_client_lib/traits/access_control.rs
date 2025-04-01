use ink::env::DefaultEnvironment;
use ink::primitives::AccountId;

pub type RoleType = u32;

const ADMIN_ROLE: RoleType = ink::selector_id!("ADMIN_ROLE");

/*
#[derive(Default, Debug)]
#[ink::storage_item]
pub struct Data {
    pub roles: Mapping<(AccountId, RoleType), ()>,
}
*/


#[derive(Debug, Eq, PartialEq)]
#[ink::scale_derive(Encode, Decode, TypeInfo)]
pub enum AccessControlError {
  InvalidCaller,
  MissingRole,
  RoleRedundant,
}

/// Event emitted when the role is granted
#[ink::event]
pub struct RoleGranted {
  #[ink(topic)]
  role: RoleType,
  #[ink(topic)]
  grantee: AccountId,
  grantor: AccountId,
}

/// Event emitted when the role is revoked
#[ink::event]
pub struct RoleRevoked {
  #[ink(topic)]
  role: RoleType,
  #[ink(topic)]
  account: AccountId,
  sender: AccountId,
}

#[ink::trait_definition]
pub trait AccessControl {

  #[ink(message)]
  fn has_role(&self, role: RoleType, account: AccountId) -> bool;

  #[ink(message)]
  fn grant_role(&mut self, role: RoleType, account: AccountId) -> Result<(), AccessControlError>;

  #[ink(message)]
  fn revoke_role(&mut self, role: RoleType, account: AccountId) -> Result<(), AccessControlError>;

  #[ink(message)]
  fn renounce_role(&mut self, role: RoleType) -> Result<(), AccessControlError>;

}

pub trait BaseAccessControl {

  fn inner_has_role(&self, role: RoleType, account: AccountId) -> bool ;

  fn inner_check_role(&self, role: RoleType, account: AccountId) -> Result<(), AccessControlError> {
    if !self.inner_has_role(role, account) {
      return Err(AccessControlError::MissingRole);
    }
    Ok(())
  }

  fn inner_add_role(&mut self, role: RoleType, account: AccountId);

  fn inner_remove_role(&mut self, role: RoleType, account: AccountId);

  fn inner_grant_role(&mut self, role: RoleType, account: AccountId) -> Result<(), AccessControlError> {

    let caller = ::ink::env::caller::<DefaultEnvironment>();
    if !self.inner_has_role(ADMIN_ROLE, caller){
      return Err(AccessControlError::InvalidCaller)
    }

    if self.inner_has_role(role, account) {
      return Err(AccessControlError::RoleRedundant)
    }
    // add the role
    self.inner_add_role(role, account);
    // emit the event
    ::ink::env::emit_event::<DefaultEnvironment, RoleGranted>(RoleGranted{
      role,
      grantee: account,
      grantor: caller,
    });

    Ok(())
  }

  fn inner_revoke_role(&mut self, role: RoleType, account: AccountId) -> Result<(), AccessControlError> {

    let caller = ::ink::env::caller::<DefaultEnvironment>();
    if caller != account && !self.inner_has_role(ADMIN_ROLE, caller){
      return Err(AccessControlError::InvalidCaller)
    }
    // check the role
    self.inner_check_role(role, account)?;
    // remove the role
    self.inner_remove_role(role, account);
    // emit the event
    ::ink::env::emit_event::<DefaultEnvironment, RoleRevoked>(RoleRevoked{
      role,
      account,
      sender: caller,
    });

    Ok(())
  }

  fn inner_renounce_role(&mut self, role: RoleType) -> Result<(), AccessControlError> {
    self.inner_revoke_role(role, ::ink::env::caller::<DefaultEnvironment>())
  }

  fn init_with_admin(&mut self, admin: AccountId) {
    // set the owner
    self.inner_add_role(ADMIN_ROLE, admin);
    // emit the event
    ::ink::env::emit_event::<DefaultEnvironment, RoleGranted>(RoleGranted{
      role: ADMIN_ROLE,
      grantee: admin,
      grantor: ::ink::env::caller::<DefaultEnvironment>(),
    });
  }

}

