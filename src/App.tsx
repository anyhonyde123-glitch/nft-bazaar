import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Sparkles, Store } from 'lucide-react';
import WalletBar from './components/WalletBar';
import Stats from './components/Stats';
import FaucetCard from './components/FaucetCard';
import MintForm from './components/MintForm';
import MyNFTs, { OwnedNft } from './components/MyNFTs';
import MarketplaceView from './components/Marketplace';
import {
  disconnectWallet,
  openWalletPicker,
  restoreWallet,
} from './lib/wallet';
import {
  Listing,
  listMyNfts,
  marketActive,
  marketBuy,
  marketCancel,
  marketList,
  marketTotal,
  nftApprove,
  nftBalanceOf,
  nftMint,
  nftTokenUri,
  nftTotalSupply,
  payBalance,
  payClaimed,
  payFaucet,
  paySymbol as fetchPaySymbol,
} from './lib/stellar';
import { MARKETPLACE_ID, NFT_ID, PAYMENT_ID } from './lib/config';

type Tab = 'collection' | 'market';

interface Toast {
  kind: 'success' | 'error' | 'info';
  msg: string;
  hash?: string;
}

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('collection');
  const [toast, setToast] = useState<Toast | null>(null);

  const [paySym, setPaySym] = useState('');
  const [balance, setBalance] = useState<bigint>(0n);
  const [claimed, setClaimed] = useState(false);
  const [ownedNfts, setOwnedNfts] = useState<OwnedNft[]>([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [supply, setSupply] = useState(0);

  const [listings, setListings] = useState<Listing[]>([]);
  const [uriCache, setUriCache] = useState<Record<number, string>>({});

  const [busyFaucet, setBusyFaucet] = useState(false);
  const [busyMint, setBusyMint] = useState(false);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [loadingMarket, setLoadingMarket] = useState(false);

  const contractsConfigured = NFT_ID && PAYMENT_ID && MARKETPLACE_ID;

  // ─── toasts ──────────────────────────────────────────────────────────
  const showToast = useCallback((t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 6000);
  }, []);

  // ─── wallet ──────────────────────────────────────────────────────────
  useEffect(() => {
    restoreWallet().then((a) => setAddress(a));
  }, []);

  const onConnect = useCallback(async () => {
    try {
      const { address: a } = await openWalletPicker(true);
      setAddress(a);
    } catch (err) {
      if ((err as Error).message !== 'wallet selection cancelled') {
        showToast({ kind: 'error', msg: (err as Error).message });
      }
    }
  }, [showToast]);

  const onDisconnect = useCallback(() => {
    disconnectWallet();
    setAddress(null);
    setOwnedNfts([]);
    setBalance(0n);
    setClaimed(false);
  }, []);

  const onSwitch = useCallback(async () => {
    disconnectWallet();
    setAddress(null);
    try {
      const { address: a } = await openWalletPicker(true);
      setAddress(a);
    } catch {
      /* user cancelled */
    }
  }, []);

  // ─── load global data ────────────────────────────────────────────────
  const refreshGlobal = useCallback(async () => {
    if (!contractsConfigured) return;
    try {
      const [sym, total] = await Promise.all([fetchPaySymbol(), nftTotalSupply()]);
      setPaySym(sym);
      setSupply(total);
    } catch (e) {
      console.warn('global refresh failed', e);
    }
  }, [contractsConfigured]);

  const refreshMarket = useCallback(async () => {
    if (!contractsConfigured) return;
    setLoadingMarket(true);
    try {
      const total = await marketTotal();
      const all = total > 0 ? await marketActive(1, total) : [];
      setListings(all);
      // pre-fetch URIs for all listed token_ids in parallel
      const missing = all.filter((l) => !uriCache[l.token_id]);
      if (missing.length) {
        const entries = await Promise.all(
          missing.map(async (l) => [l.token_id, await nftTokenUri(l.token_id)] as const),
        );
        setUriCache((prev) => {
          const next = { ...prev };
          for (const [id, uri] of entries) next[id] = uri;
          return next;
        });
      }
    } catch (e) {
      console.warn('market refresh failed', e);
    } finally {
      setLoadingMarket(false);
    }
  }, [contractsConfigured, uriCache]);

  // ─── per-user data ───────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    if (!address || !contractsConfigured) return;
    setLoadingNfts(true);
    try {
      const [bal, isClaimed, count] = await Promise.all([
        payBalance(address),
        payClaimed(address),
        nftBalanceOf(address),
      ]);
      setBalance(bal);
      setClaimed(isClaimed);
      setOwnedCount(count);
      const mine = await listMyNfts(address);
      setOwnedNfts(mine);
    } catch (e) {
      console.warn('user refresh failed', e);
    } finally {
      setLoadingNfts(false);
    }
  }, [address, contractsConfigured]);

  useEffect(() => {
    refreshGlobal();
    refreshMarket();
  }, [refreshGlobal, refreshMarket]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // ─── actions ─────────────────────────────────────────────────────────
  const handleFaucet = async () => {
    if (!address) return;
    setBusyFaucet(true);
    try {
      const r = await payFaucet(address);
      showToast({ kind: 'success', msg: 'Claimed 1,000 ' + (paySym || 'BAZ'), hash: r.hash });
      await refreshUser();
    } catch (e) {
      showToast({ kind: 'error', msg: friendly(e) });
    } finally {
      setBusyFaucet(false);
    }
  };

  const handleMint = async (uri: string) => {
    if (!address) return;
    setBusyMint(true);
    try {
      const r = await nftMint(address, uri);
      showToast({ kind: 'success', msg: 'Minted NFT', hash: r.hash });
      await Promise.all([refreshUser(), refreshGlobal()]);
    } catch (e) {
      showToast({ kind: 'error', msg: friendly(e) });
    } finally {
      setBusyMint(false);
    }
  };

  const handleList = async (id: number, priceRaw: bigint) => {
    if (!address) return;
    try {
      // 1) approve marketplace as spender for this token
      await nftApprove(address, MARKETPLACE_ID, id);
      // 2) create listing
      const r = await marketList(address, id, priceRaw);
      showToast({ kind: 'success', msg: `Listed NFT #${id}`, hash: r.hash });
      await Promise.all([refreshMarket(), refreshUser()]);
    } catch (e) {
      showToast({ kind: 'error', msg: friendly(e) });
    }
  };

  const handleBuy = async (listingId: number) => {
    if (!address) return;
    try {
      const r = await marketBuy(address, listingId);
      showToast({ kind: 'success', msg: `Bought listing #${listingId}`, hash: r.hash });
      await Promise.all([refreshMarket(), refreshUser()]);
    } catch (e) {
      showToast({ kind: 'error', msg: friendly(e) });
    }
  };

  const handleCancel = async (listingId: number) => {
    if (!address) return;
    try {
      const r = await marketCancel(address, listingId);
      showToast({ kind: 'info', msg: `Cancelled listing #${listingId}`, hash: r.hash });
      await refreshMarket();
    } catch (e) {
      showToast({ kind: 'error', msg: friendly(e) });
    }
  };

  // ─── render ──────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: typeof Sparkles }[] = useMemo(
    () => [
      { key: 'collection', label: 'My Collection', icon: Sparkles },
      { key: 'market', label: 'Marketplace', icon: Store },
    ],
    [],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-bazaar-900/40 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-bazaar-500 to-fuchsia-500 p-2 shadow-lg shadow-bazaar-500/30">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-white">NFT Bazaar</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                Green Belt · Soroban
              </div>
            </div>
          </div>
          <WalletBar
            address={address}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onSwitch={onSwitch}
          />
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {!contractsConfigured && (
          <div className="card p-4 border-amber-700/40 bg-amber-900/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
              <div className="text-sm text-amber-100">
                Contract IDs are not configured. Set <code className="text-amber-300">VITE_NFT_ID</code>,{' '}
                <code className="text-amber-300">VITE_PAYMENT_ID</code> and{' '}
                <code className="text-amber-300">VITE_MARKETPLACE_ID</code> in your{' '}
                <code className="text-amber-300">.env.local</code> after deployment.
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div
            className={`card p-3 flex items-start gap-2 ${
              toast.kind === 'success'
                ? 'border-emerald-700/40 bg-emerald-900/20'
                : toast.kind === 'error'
                ? 'border-rose-700/40 bg-rose-900/20'
                : 'border-bazaar-700/40 bg-bazaar-900/20'
            }`}
          >
            {toast.kind === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : toast.kind === 'error' ? (
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-bazaar-400 shrink-0" />
            )}
            <div className="text-sm flex-1">
              <div className="text-white">{toast.msg}</div>
              {toast.hash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${toast.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-bazaar-300 hover:text-bazaar-200 mt-1"
                >
                  View on Stellar Expert <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        <Stats
          balance={balance}
          ownedNfts={ownedCount}
          activeListings={listings.length}
          totalSupply={supply}
          paySymbol={paySym}
        />

        {address ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <FaucetCard
                claimed={claimed}
                loading={busyFaucet}
                onClaim={handleFaucet}
                paySymbol={paySym}
              />
              <MintForm onMint={handleMint} busy={busyMint} />
            </div>

            <div className="flex gap-2 border-b border-slate-800">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                    tab === t.key
                      ? 'border-bazaar-400 text-bazaar-200'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'collection' ? (
              <MyNFTs nfts={ownedNfts} loading={loadingNfts} onList={handleList} />
            ) : (
              <MarketplaceView
                listings={listings}
                loading={loadingMarket}
                myAddress={address}
                uriById={uriCache}
                onBuy={handleBuy}
                onCancel={handleCancel}
              />
            )}
          </>
        ) : (
          <div className="card p-8 sm:p-12 text-center">
            <Store className="h-12 w-12 mx-auto text-bazaar-400 mb-3" />
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to NFT Bazaar</h2>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              Mint, list and trade Soroban NFTs. Connect a Stellar wallet to begin — claim free{' '}
              {paySym || 'BAZ'} tokens to try it instantly.
            </p>
            <button onClick={onConnect} className="btn-primary mx-auto">
              Connect wallet to start
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/60 mt-8">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>Soroban testnet · 3 contracts · {supply} NFTs minted</span>
          <a
            href="https://stellar.expert/explorer/testnet"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-300 inline-flex items-center gap-1"
          >
            Stellar Expert <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}

function friendly(e: unknown): string {
  const m = (e as Error)?.message || String(e);
  if (m.includes('AlreadyClaimed')) return 'You already claimed the faucet from this wallet.';
  if (m.includes('NotApproved')) return 'Marketplace not approved — please retry the listing.';
  if (m.includes('InsufficientBalance')) return 'Not enough tokens.';
  if (m.includes('SelfBuyForbidden')) return "You can't buy your own listing.";
  if (m.includes('ListingInactive')) return 'This listing is no longer active.';
  if (m.includes('NotSeller')) return 'Only the seller can do this.';
  if (m.includes('InvalidPrice')) return 'Price must be greater than zero.';
  if (m.includes('TokenNotFound')) return 'NFT does not exist.';
  return m.length > 200 ? m.slice(0, 200) + '…' : m;
}
