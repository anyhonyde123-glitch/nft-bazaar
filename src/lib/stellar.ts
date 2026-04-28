import {
  rpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Address,
  Account,
  Keypair,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  NFT_ID,
  PAYMENT_ID,
  MARKETPLACE_ID,
} from './config';
import { signXdr } from './wallet';

export const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });

// Read simulations need a syntactically-valid public key, not a real funded account.
const DUMMY = Keypair.random().publicKey();

async function simulate(contractId: string, method: string, args: xdr.ScVal[] = []) {
  const tx = new TransactionBuilder(new Account(DUMMY, '0'), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!('result' in sim) || !sim.result) throw new Error('No simulation result');
  return scValToNative(sim.result.retval);
}

async function sendTx(
  caller: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<{ hash: string; result: unknown }> {
  const account = await server.getAccount(caller);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(built);
  const signed = await signXdr(prepared.toXDR());
  const tx = TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE);
  const send = await server.sendTransaction(tx);
  if (send.status === 'ERROR') {
    throw new Error(`Send failed: ${JSON.stringify(send.errorResult ?? send)}`);
  }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await server.getTransaction(send.hash);
    if (status.status === 'SUCCESS') {
      let result: unknown = null;
      try {
        const ret = (status as { returnValue?: xdr.ScVal }).returnValue;
        if (ret) result = scValToNative(ret);
      } catch {
        /* ignore */
      }
      return { hash: send.hash, result };
    }
    if (status.status === 'FAILED') throw new Error('Transaction failed on-chain');
  }
  throw new Error('Transaction timed out');
}

const addr = (a: string) => new Address(a).toScVal();
const u32 = (n: number) => nativeToScVal(n, { type: 'u32' });
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' });
const str = (s: string) => nativeToScVal(s, { type: 'string' });

// ─── NFT reads ──────────────────────────────────────────────────────────
export async function nftSymbol(): Promise<string> {
  if (!NFT_ID) return '';
  return String(await simulate(NFT_ID, 'symbol'));
}
export async function nftTotalSupply(): Promise<number> {
  if (!NFT_ID) return 0;
  return Number(await simulate(NFT_ID, 'total_supply'));
}
export async function nftBalanceOf(a: string): Promise<number> {
  if (!NFT_ID) return 0;
  return Number(await simulate(NFT_ID, 'balance_of', [addr(a)]));
}
export async function nftOwnerOf(id: number): Promise<string | null> {
  try {
    return String(await simulate(NFT_ID, 'owner_of', [u32(id)]));
  } catch {
    return null;
  }
}
export async function nftTokenUri(id: number): Promise<string> {
  return String(await simulate(NFT_ID, 'token_uri', [u32(id)]));
}
export async function nftGetApproved(id: number): Promise<string | null> {
  const v = await simulate(NFT_ID, 'get_approved', [u32(id)]);
  return v ? String(v) : null;
}

// ─── NFT writes ─────────────────────────────────────────────────────────
export async function nftMint(user: string, uri: string) {
  return sendTx(user, NFT_ID, 'mint', [addr(user), str(uri)]);
}
export async function nftApprove(owner: string, spender: string, id: number) {
  return sendTx(owner, NFT_ID, 'approve', [addr(owner), addr(spender), u32(id)]);
}
export async function nftTransfer(from: string, to: string, id: number) {
  return sendTx(from, NFT_ID, 'transfer', [addr(from), addr(to), u32(id)]);
}

// ─── Payment reads ──────────────────────────────────────────────────────
export async function paySymbol(): Promise<string> {
  if (!PAYMENT_ID) return '';
  return String(await simulate(PAYMENT_ID, 'symbol'));
}
export async function payBalance(a: string): Promise<bigint> {
  if (!PAYMENT_ID) return 0n;
  return BigInt(await simulate(PAYMENT_ID, 'balance', [addr(a)]));
}
export async function payClaimed(a: string): Promise<boolean> {
  if (!PAYMENT_ID) return false;
  return Boolean(await simulate(PAYMENT_ID, 'claimed', [addr(a)]));
}

// ─── Payment writes ─────────────────────────────────────────────────────
export async function payFaucet(user: string) {
  return sendTx(user, PAYMENT_ID, 'faucet', [addr(user)]);
}

// ─── Marketplace reads ──────────────────────────────────────────────────
export interface Listing {
  id: number;
  seller: string;
  token_id: number;
  price: bigint;
  active: boolean;
}

export async function marketFeeBps(): Promise<number> {
  if (!MARKETPLACE_ID) return 0;
  return Number(await simulate(MARKETPLACE_ID, 'fee_bps'));
}
export async function marketTotal(): Promise<number> {
  if (!MARKETPLACE_ID) return 0;
  return Number(await simulate(MARKETPLACE_ID, 'total_listings'));
}
export async function marketActive(start: number, limit: number): Promise<Listing[]> {
  if (!MARKETPLACE_ID) return [];
  const raw = (await simulate(MARKETPLACE_ID, 'active_listings', [u32(start), u32(limit)])) as Listing[];
  return raw.map((l) => ({
    id: Number(l.id),
    seller: String(l.seller),
    token_id: Number(l.token_id),
    price: BigInt(l.price),
    active: Boolean(l.active),
  }));
}

// ─── Marketplace writes ─────────────────────────────────────────────────
export async function marketList(seller: string, tokenId: number, price: bigint) {
  return sendTx(seller, MARKETPLACE_ID, 'list', [addr(seller), u32(tokenId), i128(price)]);
}
export async function marketBuy(buyer: string, listingId: number) {
  return sendTx(buyer, MARKETPLACE_ID, 'buy', [addr(buyer), u32(listingId)]);
}
export async function marketCancel(seller: string, listingId: number) {
  return sendTx(seller, MARKETPLACE_ID, 'cancel', [addr(seller), u32(listingId)]);
}

// ─── Helper: scan all NFTs to find ones owned by a user ─────────────────
export async function listMyNfts(owner: string): Promise<Array<{ id: number; uri: string }>> {
  const total = await nftTotalSupply();
  const out: Array<{ id: number; uri: string }> = [];
  // Run in parallel batches of 5
  const batch = 5;
  for (let i = 1; i <= total; i += batch) {
    const ids = Array.from({ length: Math.min(batch, total - i + 1) }, (_, k) => i + k);
    const results = await Promise.all(
      ids.map(async (id) => {
        const o = await nftOwnerOf(id);
        if (o !== owner) return null;
        const uri = await nftTokenUri(id);
        return { id, uri };
      }),
    );
    for (const r of results) if (r) out.push(r);
  }
  return out;
}
