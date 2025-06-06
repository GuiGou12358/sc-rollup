mod contract;
mod test_utils;

use contract::test_contract::InkClient;
use inkv5_client_lib::traits::message_queue::MessageQueue;
use inkv5_client_lib::traits::RollupClientError;
use test_utils::accounts;

#[ink::test]
fn test_push_and_pop_message() {
    let accounts = accounts();
    let mut contract = InkClient::new(accounts.alice);

    assert_eq!(0, contract.get_queue_tail().unwrap());
    assert_eq!(0, contract.get_queue_head().unwrap());
    assert_eq!(false, contract.has_message().unwrap());

    // push the first message in the queue
    let message1 = 123456u128;
    let queue_index = contract.push_message(&message1).unwrap();
    assert_eq!(0, queue_index);
    assert_eq!(0, contract.get_queue_head().unwrap());
    assert_eq!(1, contract.get_queue_tail().unwrap());
    assert_eq!(true, contract.has_message().unwrap());

    // push the second message in the queue
    let message2 = 4589u16;
    let queue_index = contract.push_message(&message2).unwrap();
    assert_eq!(1, queue_index);
    assert_eq!(0, contract.get_queue_head().unwrap());
    assert_eq!(2, contract.get_queue_tail().unwrap());
    assert_eq!(true, contract.has_message().unwrap());

    // get the first message
    let message_in_queue: Option<u128> = contract.get_message(0).unwrap();
    assert_eq!(
        message1,
        message_in_queue.expect("we expect a message in the queue")
    );

    // get the seconde message
    let message_in_queue: Option<u16> = contract.get_message(1).unwrap();
    assert_eq!(
        message2,
        message_in_queue.expect("we expect a message in the queue")
    );

    // pop the two messages
    contract.pop_to(2).unwrap();
    assert_eq!(2, contract.get_queue_head().unwrap());
    assert_eq!(2, contract.get_queue_tail().unwrap());
    assert_eq!(false, contract.has_message().unwrap());
}

#[ink::test]
fn test_pop_messages() {
    let accounts = accounts();
    let mut contract = InkClient::new(accounts.alice);

    // pop to the future => error
    assert_eq!(Err(RollupClientError::InvalidPopTarget), contract.pop_to(2));

    let message = 4589u16;
    contract.push_message(&message).unwrap();
    contract.push_message(&message).unwrap();
    contract.push_message(&message).unwrap();
    contract.push_message(&message).unwrap();
    contract.push_message(&message).unwrap();

    assert_eq!(0, contract.get_queue_head().unwrap());
    assert_eq!(5, contract.get_queue_tail().unwrap());

    assert_eq!(Ok(()), contract.pop_to(2));

    assert_eq!(2, contract.get_queue_head().unwrap());
    assert_eq!(5, contract.get_queue_tail().unwrap());

    // we do nothing
    assert_eq!(Ok(()), contract.pop_to(2));

    assert_eq!(2, contract.get_queue_head().unwrap());
    assert_eq!(5, contract.get_queue_tail().unwrap());

    // pop to the past => error
    assert_eq!(Err(RollupClientError::InvalidPopTarget), contract.pop_to(1));

    // we do nothing
    assert_eq!(Ok(()), contract.pop_to(5));

    assert_eq!(5, contract.get_queue_head().unwrap());
    assert_eq!(5, contract.get_queue_tail().unwrap());
}
