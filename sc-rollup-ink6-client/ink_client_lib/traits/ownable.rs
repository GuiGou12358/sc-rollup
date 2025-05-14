use ink::Address;
use ink::env::DefaultEnvironment;

#[derive(Default, Debug)]
#[ink::storage_item]
pub struct OwnableData {
    pub owner: Option<Address>,
}

impl OwnableData {
    pub fn new() -> Self {
        Self::default()
    }
}

pub trait OwnableStorage {
    fn get_storage(&self) -> &OwnableData;
    fn get_mut_storage(&mut self) -> &mut OwnableData;
}

#[macro_export]
macro_rules! ensure_owner {
    ($ownable:ident) => {
        if $ownable.inner_get_owner() != Some(::ink::env::caller()) {
            return Err(OwnableError::CallerIsNotOwner);
        }
    };
}

#[derive(Debug, Eq, PartialEq)]
#[ink::scale_derive(Encode, Decode, TypeInfo)]
pub enum OwnableError {
    CallerIsNotOwner,
}

/// Event emitted when the ownership is transferred
#[ink::event]
pub struct OwnershipTransferred {
    #[ink(topic)]
    old_owner: Option<Address>,
    #[ink(topic)]
    new_owner: Option<Address>,
}

#[ink::trait_definition]
pub trait Ownable {
    #[ink(message)]
    fn get_owner(&self) -> Option<Address>;

    #[ink(message)]
    fn renounce_ownership(&mut self) -> Result<(), OwnableError>;

    #[ink(message)]
    fn transfer_ownership(&mut self, new_owner: Option<Address>) -> Result<(), OwnableError>;
}

pub trait BaseOwnable: OwnableStorage {
    fn inner_get_owner(&self) -> Option<Address> {
        self.get_storage().owner
    }

    fn inner_set_owner(&mut self, owner: Option<Address>) {
        self.get_mut_storage().owner = owner;
    }

    fn inner_renounce_ownership(&mut self) -> Result<(), OwnableError> {
        self.inner_transfer_ownership(None)
    }

    fn inner_transfer_ownership(
        &mut self,
        new_owner: Option<Address>,
    ) -> Result<(), OwnableError> {
        // check the permission
        ensure_owner!(self);
        // get the current owner to put it in the event
        let old_owner = self.inner_get_owner();
        // set the new owner
        self.inner_set_owner(new_owner);
        // emit the event
        ::ink::env::emit_event::<DefaultEnvironment, OwnershipTransferred>(OwnershipTransferred {
            old_owner,
            new_owner,
        });

        Ok(())
    }

    fn init_with_owner(&mut self, owner: Address) {
        // set the owner
        self.inner_set_owner(Some(owner));
        // emit the event
        ::ink::env::emit_event::<DefaultEnvironment, OwnershipTransferred>(OwnershipTransferred {
            old_owner: None,
            new_owner: Some(owner),
        });
    }
}

/*
/// Throws if called by any account other than the owner.
///
#[modifier_definition]
pub fn only_owner<T, F, R, E>(instance: &mut T, body: F) -> Result<R, E>
where
T: Storage<Data>,
  F: FnOnce(&mut T) -> Result<R, E>,
  E: From<OwnableError>,
  {
    if instance.data().owner.get_or_default() != Some(T::env().caller()) {
  return Err(From::from(OwnableError::CallerIsNotOwner))
}
body(instance)
}
*/
