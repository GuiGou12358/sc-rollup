
use ink::env::{
    test::DefaultAccounts,
    DefaultEnvironment,
    Environment,
};

pub fn accounts() -> DefaultAccounts<DefaultEnvironment> {
    ink::env::test::default_accounts::<DefaultEnvironment>()
}

pub fn change_caller(new_caller: <DefaultEnvironment as Environment>::AccountId) {
    ink::env::test::set_caller::<ink::env::DefaultEnvironment>(new_caller);
}
