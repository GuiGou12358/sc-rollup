use ink::env::DefaultEnvironment;
use ink::primitives::AccountId;
use ink::storage::Mapping;

pub type RoleType = u32;

pub const ADMIN_ROLE: RoleType = ink::selector_id!("ADMIN_ROLE");

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

#[derive(Default, Debug)]
#[ink::storage_item]
pub struct AccessControlData {
    pub roles: Mapping<(AccountId, RoleType), ()>,
}

#[macro_export]
macro_rules! only_role {
    ($access_control:ident, $role:ident) => {{
        $access_control.inner_check_role_caller($role)?
    }};
}

impl AccessControlData {
    pub fn new() -> Self {
        Self::default()
    }
}

pub trait AccessControlStorage {
    fn get_storage(&self) -> &AccessControlData;
    fn get_mut_storage(&mut self) -> &mut AccessControlData;
}

#[ink::trait_definition]
pub trait AccessControl {
    #[ink(message)]
    fn has_role(&self, role: RoleType, account: AccountId) -> bool;

    #[ink(message)]
    fn grant_role(&mut self, role: RoleType, account: AccountId) -> Result<(), AccessControlError>;

    #[ink(message)]
    fn revoke_role(&mut self, role: RoleType, account: AccountId)
        -> Result<(), AccessControlError>;

    #[ink(message)]
    fn renounce_role(&mut self, role: RoleType) -> Result<(), AccessControlError>;
}

pub trait BaseAccessControl: AccessControlStorage {
    fn inner_has_role(&self, role: RoleType, account: AccountId) -> bool {
        self.get_storage().roles.contains((account, role))
    }

    fn inner_add_role(&mut self, role: RoleType, account: AccountId) {
        self.get_mut_storage().roles.insert((account, role), &());
    }

    fn inner_remove_role(&mut self, role: RoleType, account: AccountId) {
        self.get_mut_storage().roles.remove((account, role));
    }

    fn inner_check_role_caller(&self, role: RoleType) -> Result<(), AccessControlError> {
        let caller = ::ink::env::caller::<DefaultEnvironment>();
        self.inner_check_role(role, caller)
    }

    fn inner_check_role(
        &self,
        role: RoleType,
        account: AccountId,
    ) -> Result<(), AccessControlError> {
        if !self.inner_has_role(role, account) {
            return Err(AccessControlError::MissingRole);
        }
        Ok(())
    }

    fn inner_grant_role(
        &mut self,
        role: RoleType,
        account: AccountId,
    ) -> Result<(), AccessControlError> {
        only_role!(self, ADMIN_ROLE);
        self.inner_grant_role_unchecked(role, account)
    }

    fn inner_grant_role_unchecked(
        &mut self,
        role: RoleType,
        account: AccountId,
    ) -> Result<(), AccessControlError> {
        if self.inner_has_role(role, account) {
            return Err(AccessControlError::RoleRedundant);
        }
        // add the role
        self.inner_add_role(role, account);
        // emit the event
        ::ink::env::emit_event::<DefaultEnvironment, RoleGranted>(RoleGranted {
            role,
            grantee: account,
            grantor: ::ink::env::caller::<DefaultEnvironment>(),
        });

        Ok(())
    }

    fn inner_revoke_role(
        &mut self,
        role: RoleType,
        account: AccountId,
    ) -> Result<(), AccessControlError> {
        only_role!(self, ADMIN_ROLE);
        self.inner_revoke_role_unchecked(role, account)
    }

    fn inner_revoke_role_unchecked(
        &mut self,
        role: RoleType,
        account: AccountId,
    ) -> Result<(), AccessControlError> {
        // check the role
        self.inner_check_role(role, account)?;
        // remove the role
        self.inner_remove_role(role, account);
        // emit the event
        ::ink::env::emit_event::<DefaultEnvironment, RoleRevoked>(RoleRevoked {
            role,
            account,
            sender: ::ink::env::caller::<DefaultEnvironment>(),
        });

        Ok(())
    }

    fn inner_renounce_role(&mut self, role: RoleType) -> Result<(), AccessControlError> {
        self.inner_revoke_role_unchecked(role, ::ink::env::caller::<DefaultEnvironment>())
    }

    fn init_with_admin(&mut self, admin: AccountId) {
        // set the owner
        self.inner_add_role(ADMIN_ROLE, admin);
        // emit the event
        ::ink::env::emit_event::<DefaultEnvironment, RoleGranted>(RoleGranted {
            role: ADMIN_ROLE,
            grantee: admin,
            grantor: ::ink::env::caller::<DefaultEnvironment>(),
        });
    }
}
