#![cfg(test)]
use super::{Error, Marketplace, MarketplaceClient};
use nft::{NftContract, NftContractClient};
use payment::{PaymentToken, PaymentTokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

struct Ctx<'a> {
    env: Env,
    market: MarketplaceClient<'a>,
    nft: NftContractClient<'a>,
    pay: PaymentTokenClient<'a>,
    admin: Address,
    alice: Address,
    bob: Address,
    market_addr: Address,
}

fn setup<'a>() -> Ctx<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    // Deploy NFT
    let nft_id = env.register(NftContract, ());
    let nft = NftContractClient::new(&env, &nft_id);
    nft.init(&String::from_str(&env, "Bazaar"), &String::from_str(&env, "BZR"));

    // Deploy payment token
    let pay_id = env.register(PaymentToken, ());
    let pay = PaymentTokenClient::new(&env, &pay_id);
    pay.init(
        &admin,
        &7u32,
        &String::from_str(&env, "Bazaar Coin"),
        &String::from_str(&env, "BAZ"),
    );

    // Deploy marketplace
    let m_id = env.register(Marketplace, ());
    let market = MarketplaceClient::new(&env, &m_id);
    market.init(&admin, &nft_id, &pay_id, &250u32); // 2.5 % fee

    Ctx {
        env,
        market,
        nft,
        pay,
        admin,
        alice,
        bob,
        market_addr: m_id,
    }
}

#[test]
fn init_stores_addresses() {
    let c = setup();
    assert_eq!(c.market.fee_bps(), 250);
    assert_eq!(c.market.total_listings(), 0);
}

#[test]
fn double_init_rejected() {
    let c = setup();
    let res = c
        .market
        .try_init(&c.admin, &c.market_addr, &c.market_addr, &0u32);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn fee_above_cap_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let nft_id = env.register(NftContract, ());
    let pay_id = env.register(PaymentToken, ());
    let m_id = env.register(Marketplace, ());
    let m = MarketplaceClient::new(&env, &m_id);
    let res = m.try_init(&admin, &nft_id, &pay_id, &1500u32);
    assert_eq!(res, Err(Ok(Error::InvalidFee)));
}

#[test]
fn list_requires_approval() {
    let c = setup();
    let token_id = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
    // No approve yet
    let res = c.market.try_list(&c.alice, &token_id, &1000_i128);
    assert_eq!(res, Err(Ok(Error::NotApproved)));
}

#[test]
fn list_success_after_approve() {
    let c = setup();
    let token_id = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
    c.nft.approve(&c.alice, &c.market_addr, &token_id);
    let lid = c.market.list(&c.alice, &token_id, &1000_i128);
    assert_eq!(lid, 1);
    assert_eq!(c.market.total_listings(), 1);
    let l = c.market.get_listing(&lid);
    assert_eq!(l.price, 1000);
    assert!(l.active);
}

#[test]
fn invalid_price_rejected() {
    let c = setup();
    let token_id = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
    c.nft.approve(&c.alice, &c.market_addr, &token_id);
    let res = c.market.try_list(&c.alice, &token_id, &0_i128);
    assert_eq!(res, Err(Ok(Error::InvalidPrice)));
}

#[test]
fn cancel_only_by_seller() {
    let c = setup();
    let token_id = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
    c.nft.approve(&c.alice, &c.market_addr, &token_id);
    let lid = c.market.list(&c.alice, &token_id, &500);
    let res = c.market.try_cancel(&c.bob, &lid);
    assert_eq!(res, Err(Ok(Error::NotSeller)));
    c.market.cancel(&c.alice, &lid);
    let l = c.market.get_listing(&lid);
    assert!(!l.active);
}

#[test]
fn buy_transfers_tokens_and_nft() {
    let c = setup();
    let token_id = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
    c.nft.approve(&c.alice, &c.market_addr, &token_id);
    let price: i128 = 10_000_000_000; // 1000 BAZ
    let lid = c.market.list(&c.alice, &token_id, &price);

    // Bob claims faucet so he has 1000 BAZ exactly
    c.pay.faucet(&c.bob);
    assert_eq!(c.pay.balance(&c.bob), price);

    c.market.buy(&c.bob, &lid);

    // NFT now belongs to bob
    assert_eq!(c.nft.owner_of(&token_id), c.bob);
    // Bob spent everything
    assert_eq!(c.pay.balance(&c.bob), 0);
    // Fee = 2.5 % of 1000 = 25
    let fee: i128 = price * 250 / 10_000;
    assert_eq!(c.pay.balance(&c.admin), fee);
    // Alice (seller) received the rest
    assert_eq!(c.pay.balance(&c.alice), price - fee);
    // Listing now inactive
    let l = c.market.get_listing(&lid);
    assert!(!l.active);
}

#[test]
fn buy_self_rejected() {
    let c = setup();
    let token_id = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
    c.nft.approve(&c.alice, &c.market_addr, &token_id);
    let lid = c.market.list(&c.alice, &token_id, &100);
    let res = c.market.try_buy(&c.alice, &lid);
    assert_eq!(res, Err(Ok(Error::SelfBuyForbidden)));
}

#[test]
fn buy_insufficient_balance() {
    let c = setup();
    let token_id = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
    c.nft.approve(&c.alice, &c.market_addr, &token_id);
    let lid = c.market.list(&c.alice, &token_id, &100);
    let res = c.market.try_buy(&c.bob, &lid);
    assert_eq!(res, Err(Ok(Error::InsufficientBalance)));
}

#[test]
fn buy_inactive_rejected() {
    let c = setup();
    let token_id = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
    c.nft.approve(&c.alice, &c.market_addr, &token_id);
    let lid = c.market.list(&c.alice, &token_id, &100);
    c.market.cancel(&c.alice, &lid);
    let res = c.market.try_buy(&c.bob, &lid);
    assert_eq!(res, Err(Ok(Error::ListingInactive)));
}

#[test]
fn active_listings_pagination() {
    let c = setup();
    for i in 0..3 {
        let _ = i;
        let tid = c.nft.mint(&c.alice, &String::from_str(&c.env, "u"));
        c.nft.approve(&c.alice, &c.market_addr, &tid);
        c.market.list(&c.alice, &tid, &100);
    }
    let listings = c.market.active_listings(&1, &10);
    assert_eq!(listings.len(), 3);
}
