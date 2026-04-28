#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, Address,
    Env, Symbol, Vec,
};

#[contractclient(name = "NftClient")]
pub trait NftInterface {
    fn owner_of(env: Env, token_id: u32) -> Address;
    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, token_id: u32);
    fn get_approved(env: Env, token_id: u32) -> Option<Address>;
}

#[contractclient(name = "PaymentClient")]
pub trait PaymentInterface {
    fn balance(env: Env, id: Address) -> i128;
    fn transfer(env: Env, from: Address, to: Address, amount: i128);
}

#[contracttype]
#[derive(Clone)]
pub struct Listing {
    pub id: u32,
    pub seller: Address,
    pub token_id: u32,
    pub price: i128,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    NftAddr,
    PayAddr,
    FeeBps,
    Counter,
    Listing(u32),
}

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidPrice = 3,
    ListingNotFound = 4,
    ListingInactive = 5,
    NotSeller = 6,
    NotApproved = 7,
    SelfBuyForbidden = 8,
    InsufficientBalance = 9,
    InvalidFee = 10,
}

const TOPIC_LIST: Symbol = symbol_short!("list");
const TOPIC_BUY: Symbol = symbol_short!("buy");
const TOPIC_CANCEL: Symbol = symbol_short!("cancel");

#[contract]
pub struct Marketplace;

#[contractimpl]
impl Marketplace {
    pub fn init(
        env: Env,
        admin: Address,
        nft: Address,
        payment: Address,
        fee_bps: u32,
    ) -> Result<(), Error> {
        let storage = env.storage().instance();
        if storage.has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        if fee_bps > 1000 {
            // cap fee at 10 %
            return Err(Error::InvalidFee);
        }
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::NftAddr, &nft);
        storage.set(&DataKey::PayAddr, &payment);
        storage.set(&DataKey::FeeBps, &fee_bps);
        storage.set(&DataKey::Counter, &0u32);
        Ok(())
    }

    pub fn nft_address(env: Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::NftAddr).ok_or(Error::NotInitialized)
    }

    pub fn payment_address(env: Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::PayAddr).ok_or(Error::NotInitialized)
    }

    pub fn fee_bps(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0)
    }

    pub fn total_listings(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }

    /// Seller lists an NFT. They must already have approved the marketplace
    /// on the NFT contract (`nft.approve(seller, marketplace, token_id)`).
    pub fn list(env: Env, seller: Address, token_id: u32, price: i128) -> Result<u32, Error> {
        seller.require_auth();
        if price <= 0 {
            return Err(Error::InvalidPrice);
        }
        let nft_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::NftAddr)
            .ok_or(Error::NotInitialized)?;
        let nft = NftClient::new(&env, &nft_addr);
        // 1) seller must own the token
        let owner = nft.owner_of(&token_id);
        if owner != seller {
            return Err(Error::NotSeller);
        }
        // 2) the marketplace must be approved as the spender for this token
        let approved = nft.get_approved(&token_id);
        let market_addr = env.current_contract_address();
        match approved {
            Some(a) if a == market_addr => {}
            _ => return Err(Error::NotApproved),
        }

        let mut counter: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        counter += 1;
        let listing = Listing {
            id: counter,
            seller: seller.clone(),
            token_id,
            price,
            active: true,
        };
        env.storage().persistent().set(&DataKey::Listing(counter), &listing);
        env.storage().instance().set(&DataKey::Counter, &counter);

        env.events().publish((TOPIC_LIST, seller), (counter, token_id, price));
        Ok(counter)
    }

    pub fn cancel(env: Env, seller: Address, listing_id: u32) -> Result<(), Error> {
        seller.require_auth();
        let mut listing: Listing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(listing_id))
            .ok_or(Error::ListingNotFound)?;
        if !listing.active {
            return Err(Error::ListingInactive);
        }
        if listing.seller != seller {
            return Err(Error::NotSeller);
        }
        listing.active = false;
        env.storage().persistent().set(&DataKey::Listing(listing_id), &listing);
        env.events().publish((TOPIC_CANCEL, seller), listing_id);
        Ok(())
    }

    /// Buy an active listing. Performs **3 inter-contract calls**:
    ///   1. payment.transfer(buyer -> seller, price - fee)
    ///   2. payment.transfer(buyer -> admin, fee)
    ///   3. nft.transfer(seller -> buyer, token_id)
    pub fn buy(env: Env, buyer: Address, listing_id: u32) -> Result<(), Error> {
        buyer.require_auth();
        let mut listing: Listing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(listing_id))
            .ok_or(Error::ListingNotFound)?;
        if !listing.active {
            return Err(Error::ListingInactive);
        }
        if listing.seller == buyer {
            return Err(Error::SelfBuyForbidden);
        }

        let storage = env.storage().instance();
        let nft_addr: Address = storage.get(&DataKey::NftAddr).ok_or(Error::NotInitialized)?;
        let pay_addr: Address = storage.get(&DataKey::PayAddr).ok_or(Error::NotInitialized)?;
        let admin: Address = storage.get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        let fee_bps: u32 = storage.get(&DataKey::FeeBps).unwrap_or(0);

        let pay = PaymentClient::new(&env, &pay_addr);
        let nft = NftClient::new(&env, &nft_addr);

        // Pre-check buyer balance
        if pay.balance(&buyer) < listing.price {
            return Err(Error::InsufficientBalance);
        }

        let fee: i128 = (listing.price * fee_bps as i128) / 10_000;
        let net: i128 = listing.price - fee;

        // 1) Seller payout
        pay.transfer(&buyer, &listing.seller, &net);
        // 2) Marketplace fee
        if fee > 0 {
            pay.transfer(&buyer, &admin, &fee);
        }
        // 3) NFT delivery (marketplace was pre-approved by seller as spender)
        nft.transfer_from(&env.current_contract_address(), &listing.seller, &buyer, &listing.token_id);

        listing.active = false;
        env.storage().persistent().set(&DataKey::Listing(listing_id), &listing);

        env.events().publish((TOPIC_BUY, buyer), (listing_id, listing.token_id, listing.price));
        Ok(())
    }

    pub fn get_listing(env: Env, listing_id: u32) -> Result<Listing, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(listing_id))
            .ok_or(Error::ListingNotFound)
    }

    /// Returns up to `limit` active listings starting from `start_id`.
    pub fn active_listings(env: Env, start_id: u32, limit: u32) -> Vec<Listing> {
        let total: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        let mut out: Vec<Listing> = Vec::new(&env);
        let mut i = start_id;
        let mut found: u32 = 0;
        while i <= total && found < limit {
            if let Some(l) = env.storage().persistent().get::<DataKey, Listing>(&DataKey::Listing(i)) {
                if l.active {
                    out.push_back(l);
                    found += 1;
                }
            }
            i += 1;
        }
        out
    }
}

mod test;
