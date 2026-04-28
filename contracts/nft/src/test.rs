#![cfg(test)]
use super::{NftContract, NftContractClient, Error};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup<'a>() -> (Env, NftContractClient<'a>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(NftContract, ());
    let client = NftContractClient::new(&env, &id);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.init(&String::from_str(&env, "Bazaar"), &String::from_str(&env, "BZR"));
    (env, client, alice, bob)
}

#[test]
fn init_sets_metadata() {
    let (env, c, _, _) = setup();
    assert_eq!(c.name(), String::from_str(&env, "Bazaar"));
    assert_eq!(c.symbol(), String::from_str(&env, "BZR"));
    assert_eq!(c.total_supply(), 0);
}

#[test]
fn double_init_rejected() {
    let (env, c, _, _) = setup();
    let res = c.try_init(&String::from_str(&env, "X"), &String::from_str(&env, "X"));
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn mint_assigns_owner_and_uri() {
    let (env, c, alice, _) = setup();
    let id = c.mint(&alice, &String::from_str(&env, "ipfs://abc"));
    assert_eq!(id, 1);
    assert_eq!(c.owner_of(&id), alice);
    assert_eq!(c.token_uri(&id), String::from_str(&env, "ipfs://abc"));
    assert_eq!(c.balance_of(&alice), 1);
    assert_eq!(c.total_supply(), 1);
}

#[test]
fn empty_uri_rejected() {
    let (env, c, alice, _) = setup();
    let res = c.try_mint(&alice, &String::from_str(&env, ""));
    assert_eq!(res, Err(Ok(Error::EmptyUri)));
}

#[test]
fn transfer_moves_ownership() {
    let (env, c, alice, bob) = setup();
    let id = c.mint(&alice, &String::from_str(&env, "u"));
    c.transfer(&alice, &bob, &id);
    assert_eq!(c.owner_of(&id), bob);
    assert_eq!(c.balance_of(&alice), 0);
    assert_eq!(c.balance_of(&bob), 1);
}

#[test]
fn transfer_non_owner_rejected() {
    let (env, c, alice, bob) = setup();
    let id = c.mint(&alice, &String::from_str(&env, "u"));
    let res = c.try_transfer(&bob, &alice, &id);
    assert_eq!(res, Err(Ok(Error::NotOwner)));
}

#[test]
fn approve_lets_spender_transfer() {
    let (env, c, alice, bob) = setup();
    let id = c.mint(&alice, &String::from_str(&env, "u"));
    c.approve(&alice, &bob, &id);
    assert_eq!(c.get_approved(&id), Some(bob.clone()));
    // bob now triggers transfer
    c.transfer(&alice, &bob, &id);
    assert_eq!(c.owner_of(&id), bob);
    // approval cleared after transfer
    assert_eq!(c.get_approved(&id), None);
}

#[test]
fn unknown_token_returns_error() {
    let (_env, c, _, _) = setup();
    let res = c.try_owner_of(&999);
    assert_eq!(res, Err(Ok(Error::TokenNotFound)));
}
