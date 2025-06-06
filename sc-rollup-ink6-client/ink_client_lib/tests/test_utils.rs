use ink::env::test::DefaultAccounts;
use ink::Address;

pub fn accounts() -> DefaultAccounts {
    ink::env::test::default_accounts()
}

pub fn change_caller(new_caller: Address) {
    ink::env::test::set_caller(new_caller);
}
