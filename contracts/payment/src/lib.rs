#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol, symbol_short};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Decimals,
    Name,
    Symbol,
    FaucetClaimed(Address),
}

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NegativeAmount = 3,
    InsufficientBalance = 4,
    AlreadyClaimed = 5,
    NotAuthorized = 6,
}

const FAUCET_AMOUNT: i128 = 10_000_000_000; // 1,000.0000000 with 7 decimals
const TOPIC_MINT: Symbol = symbol_short!("mint");
const TOPIC_XFER: Symbol = symbol_short!("xfer");
const TOPIC_FAUCET: Symbol = symbol_short!("faucet");

#[contract]
pub struct PaymentToken;

#[contractimpl]
impl PaymentToken {
    pub fn init(env: Env, admin: Address, decimal: u32, name: String, symbol: String) -> Result<(), Error> {
        let storage = env.storage().instance();
        if storage.has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::Decimals, &decimal);
        storage.set(&DataKey::Name, &name);
        storage.set(&DataKey::Symbol, &symbol);
        Ok(())
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).unwrap_or(String::from_str(&env, ""))
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).unwrap_or(String::from_str(&env, ""))
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap_or(7)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Balance(id)).unwrap_or(0)
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        if amount < 0 {
            return Err(Error::NegativeAmount);
        }
        let bal: i128 = env.storage().persistent().get(&DataKey::Balance(to.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(bal + amount));
        env.events().publish((TOPIC_MINT, to), amount);
        Ok(())
    }

    /// Open faucet — any user can claim 1000 BAZ once per address.
    pub fn faucet(env: Env, to: Address) -> Result<i128, Error> {
        to.require_auth();
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }
        if env
            .storage()
            .persistent()
            .get(&DataKey::FaucetClaimed(to.clone()))
            .unwrap_or(false)
        {
            return Err(Error::AlreadyClaimed);
        }
        env.storage().persistent().set(&DataKey::FaucetClaimed(to.clone()), &true);
        let bal: i128 = env.storage().persistent().get(&DataKey::Balance(to.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(bal + FAUCET_AMOUNT));
        env.events().publish((TOPIC_FAUCET, to), FAUCET_AMOUNT);
        Ok(FAUCET_AMOUNT)
    }

    pub fn claimed(env: Env, id: Address) -> bool {
        env.storage().persistent().get(&DataKey::FaucetClaimed(id)).unwrap_or(false)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount < 0 {
            return Err(Error::NegativeAmount);
        }
        let from_bal: i128 = env.storage().persistent().get(&DataKey::Balance(from.clone())).unwrap_or(0);
        if from_bal < amount {
            return Err(Error::InsufficientBalance);
        }
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(from_bal - amount));
        let to_bal: i128 = env.storage().persistent().get(&DataKey::Balance(to.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(to_bal + amount));
        env.events().publish((TOPIC_XFER, from, to), amount);
        Ok(())
    }
}

mod test;
