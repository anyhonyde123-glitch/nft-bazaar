#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol, symbol_short};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Owner(u32),
    Approved(u32),
    Uri(u32),
    Balance(Address),
    Counter,
    Name,
    Symbol,
}

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    TokenNotFound = 3,
    NotOwner = 4,
    NotAuthorized = 5,
    EmptyUri = 6,
}

const TOPIC_MINT: Symbol = symbol_short!("mint");
const TOPIC_XFER: Symbol = symbol_short!("xfer");
const TOPIC_APPR: Symbol = symbol_short!("appr");

#[contract]
pub struct NftContract;

#[contractimpl]
impl NftContract {
    /// Initialise collection metadata. Anyone can call once.
    pub fn init(env: Env, name: String, symbol: String) -> Result<(), Error> {
        let storage = env.storage().instance();
        if storage.has(&DataKey::Name) {
            return Err(Error::AlreadyInitialized);
        }
        storage.set(&DataKey::Name, &name);
        storage.set(&DataKey::Symbol, &symbol);
        storage.set(&DataKey::Counter, &0u32);
        Ok(())
    }

    /// Open mint — anyone can mint to themselves with a URI.
    pub fn mint(env: Env, to: Address, uri: String) -> Result<u32, Error> {
        to.require_auth();
        let storage = env.storage().instance();
        if !storage.has(&DataKey::Name) {
            return Err(Error::NotInitialized);
        }
        if uri.len() == 0 {
            return Err(Error::EmptyUri);
        }
        let mut counter: u32 = storage.get(&DataKey::Counter).unwrap_or(0);
        counter += 1;
        storage.set(&DataKey::Counter, &counter);

        let persistent = env.storage().persistent();
        persistent.set(&DataKey::Owner(counter), &to);
        persistent.set(&DataKey::Uri(counter), &uri);

        let bal: u32 = persistent.get(&DataKey::Balance(to.clone())).unwrap_or(0);
        persistent.set(&DataKey::Balance(to.clone()), &(bal + 1));

        env.events().publish((TOPIC_MINT, to.clone()), counter);
        Ok(counter)
    }

    pub fn owner_of(env: Env, token_id: u32) -> Result<Address, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .ok_or(Error::TokenNotFound)
    }

    pub fn token_uri(env: Env, token_id: u32) -> Result<String, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Uri(token_id))
            .ok_or(Error::TokenNotFound)
    }

    pub fn balance_of(env: Env, owner: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or(String::from_str(&env, ""))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or(String::from_str(&env, ""))
    }

    /// Owner approves a spender (e.g. the marketplace) for one specific token.
    pub fn approve(env: Env, owner: Address, spender: Address, token_id: u32) -> Result<(), Error> {
        owner.require_auth();
        let persistent = env.storage().persistent();
        let current_owner: Address = persistent
            .get(&DataKey::Owner(token_id))
            .ok_or(Error::TokenNotFound)?;
        if current_owner != owner {
            return Err(Error::NotOwner);
        }
        persistent.set(&DataKey::Approved(token_id), &spender);
        env.events().publish((TOPIC_APPR, owner, spender), token_id);
        Ok(())
    }

    pub fn get_approved(env: Env, token_id: u32) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Approved(token_id))
    }

    /// Owner-initiated transfer. `from` must sign and must be the current owner.
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u32) -> Result<(), Error> {
        from.require_auth();
        Self::do_transfer(&env, from, to, token_id)
    }

    /// Approved-spender transfer. `spender` must sign and must be the approved
    /// address for this token. Used by the marketplace contract.
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        token_id: u32,
    ) -> Result<(), Error> {
        spender.require_auth();
        let approved: Option<Address> = env.storage().persistent().get(&DataKey::Approved(token_id));
        if approved != Some(spender) {
            return Err(Error::NotAuthorized);
        }
        Self::do_transfer(&env, from, to, token_id)
    }

    fn do_transfer(env: &Env, from: Address, to: Address, token_id: u32) -> Result<(), Error> {
        let persistent = env.storage().persistent();
        let owner: Address = persistent
            .get(&DataKey::Owner(token_id))
            .ok_or(Error::TokenNotFound)?;
        if owner != from {
            return Err(Error::NotOwner);
        }
        persistent.set(&DataKey::Owner(token_id), &to);
        persistent.remove(&DataKey::Approved(token_id));

        let from_bal: u32 = persistent.get(&DataKey::Balance(from.clone())).unwrap_or(0);
        if from_bal > 0 {
            persistent.set(&DataKey::Balance(from.clone()), &(from_bal - 1));
        }
        let to_bal: u32 = persistent.get(&DataKey::Balance(to.clone())).unwrap_or(0);
        persistent.set(&DataKey::Balance(to.clone()), &(to_bal + 1));

        env.events().publish((TOPIC_XFER, from, to), token_id);
        Ok(())
    }
}

mod test;
