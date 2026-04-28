#![cfg(test)]
use super::{PaymentToken, PaymentTokenClient, Error};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup<'a>() -> (Env, PaymentTokenClient<'a>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(PaymentToken, ());
    let client = PaymentTokenClient::new(&env, &id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    client.init(
        &admin,
        &7u32,
        &String::from_str(&env, "Bazaar Coin"),
        &String::from_str(&env, "BAZ"),
    );
    (env, client, admin, user)
}

#[test]
fn init_metadata() {
    let (env, c, _, _) = setup();
    assert_eq!(c.decimals(), 7);
    assert_eq!(c.name(), String::from_str(&env, "Bazaar Coin"));
    assert_eq!(c.symbol(), String::from_str(&env, "BAZ"));
}

#[test]
fn admin_mint_and_balance() {
    let (_env, c, _admin, user) = setup();
    c.mint(&user, &500);
    assert_eq!(c.balance(&user), 500);
}

#[test]
fn faucet_grants_once() {
    let (_env, c, _, user) = setup();
    let amt = c.faucet(&user);
    assert_eq!(amt, 10_000_000_000_i128); // 1000 BAZ * 10^7
    assert_eq!(c.balance(&user), 10_000_000_000_i128);
    assert!(c.claimed(&user));
}

#[test]
fn faucet_double_claim_rejected() {
    let (_env, c, _, user) = setup();
    c.faucet(&user);
    let res = c.try_faucet(&user);
    assert_eq!(res, Err(Ok(Error::AlreadyClaimed)));
}

#[test]
fn transfer_moves_balance() {
    let (env, c, _, user) = setup();
    let other = Address::generate(&env);
    c.faucet(&user);
    c.transfer(&user, &other, &200);
    assert_eq!(c.balance(&other), 200);
}

#[test]
fn transfer_insufficient_rejected() {
    let (env, c, _, user) = setup();
    let other = Address::generate(&env);
    let res = c.try_transfer(&user, &other, &100);
    assert_eq!(res, Err(Ok(Error::InsufficientBalance)));
}

#[test]
fn negative_amount_rejected() {
    let (_env, c, _admin, user) = setup();
    let res = c.try_mint(&user, &-1);
    assert_eq!(res, Err(Ok(Error::NegativeAmount)));
}
