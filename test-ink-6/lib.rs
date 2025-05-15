#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod ink_client {
    use ink::storage::Mapping;

    pub type RoleType = u32;

    pub const ADMIN_ROLE: RoleType = ink::selector_id!("ADMIN_ROLE");
    pub const ATTESTOR_ROLE: RoleType = ink::selector_id!("ATTESTOR_ROLE");

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
        grantee: Address,
        grantor: Address,
    }

    /// Event emitted when the role is revoked
    #[ink::event]
    pub struct RoleRevoked {
        #[ink(topic)]
        role: RoleType,
        #[ink(topic)]
        account: Address,
        sender: Address,
    }


    #[derive(Default, Debug)]
    #[ink(storage)]
    pub struct InkClient {
        roles: Mapping<(Address, RoleType), bool>,
    }

    impl InkClient {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            let caller = Self::env().caller();

            // add the admin role
            instance.roles.insert((caller, ADMIN_ROLE), &true);

            // emit the event
            Self::env().emit_event(RoleGranted {
                role: ADMIN_ROLE,
                grantee: caller,
                grantor: caller,
            });

            instance
        }

        #[ink(message)]
        pub fn get_admin_role(&self) -> RoleType {
            ADMIN_ROLE
        }

        #[ink(message)]
        pub fn get_attestor_role(&self) -> RoleType {
            ATTESTOR_ROLE
        }


        #[ink(message)]
        pub fn get_caller_address(&self) -> Address {
            self.env().caller()
        }

        #[ink(message)]
        pub fn get_address(&self, account: Address) -> Address {
            account
        }


        #[ink(message)]
        pub fn only_admin(&self) -> Result<(), AccessControlError> {
            let caller = ::ink::env::caller();
            if !self.has_role(ADMIN_ROLE, caller) {
                return Err(AccessControlError::InvalidCaller);
            }
            Ok(())
        }

        #[ink(message)]
        pub fn only_attestor(&self) -> Result<(), AccessControlError> {
            let caller = ::ink::env::caller();
            if !self.has_role(ATTESTOR_ROLE, caller) {
                return Err(AccessControlError::InvalidCaller);
            }
            Ok(())
        }


        #[ink(message)]
        pub fn caller_has_attestor_role(&self) -> bool  {
            let caller = ::ink::env::caller();
            self.roles.contains((caller, ATTESTOR_ROLE))
        }

        #[ink(message)]
        pub fn caller_has_admin_role(&self) -> bool  {
            let caller = ::ink::env::caller();
            self.roles.contains((caller, ADMIN_ROLE))
        }

        #[ink(message)]
        pub fn caller_add_attestor_role(&mut self) -> Result<(), AccessControlError>  {
            let caller = ::ink::env::caller();
            self.grant_role(ATTESTOR_ROLE, caller)
        }

        #[ink(message)]
        pub fn caller_remove_attestor_role(&mut self) -> Result<(), AccessControlError>   {
            let caller = ::ink::env::caller();
            self.revoke_role(ATTESTOR_ROLE, caller)
        }


        #[ink(message)]
        pub fn has_attestor_role(&self, account: Address) -> bool  {
            self.roles.contains((account, ATTESTOR_ROLE))
        }

        #[ink(message)]
        pub fn has_role(&self, role: RoleType, account: Address) -> bool  {
            self.roles.contains((account, role))
        }

        #[ink(message)]
        pub fn grant_role(
            &mut self,
            role: RoleType,
            account: Address,
        ) -> Result<(), AccessControlError> {
            let caller = ::ink::env::caller();
            if !self.has_role(ADMIN_ROLE, caller) {
                return Err(AccessControlError::InvalidCaller);
            }
            if self.has_role(role, account) {
                return Err(AccessControlError::RoleRedundant);
            }
            // add the role
            self.roles.insert((account, role), &true);
            // emit the event
            self.env().emit_event(RoleGranted {
                role,
                grantee: account,
                grantor: caller,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn revoke_role(
            &mut self,
            role: RoleType,
            account: Address,
        ) -> Result<(), AccessControlError> {
            let caller = ::ink::env::caller();
            if caller != account && !self.has_role(ADMIN_ROLE, caller) {
                return Err(AccessControlError::InvalidCaller);
            }
            // check the role
            if !self.has_role(role, account) {
                return Err(AccessControlError::MissingRole);
            }
            // remove the role
            self.roles.remove((account, role));
            // emit the event
            self.env().emit_event(RoleRevoked {
                role,
                account,
                sender: caller,
            });

            Ok(())
        }
    }

}
