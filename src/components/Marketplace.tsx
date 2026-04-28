import { useState } from 'react';
import { Loader2, ShoppingBag, ShoppingCart, X } from 'lucide-react';
import { fmtTokens, shortAddr } from '../lib/format';
import { TOKEN_SYMBOL } from '../lib/config';
import type { Listing } from '../lib/stellar';

interface Props {
  listings: Listing[];
  loading: boolean;
  myAddress: string | null;
  uriById: Record<number, string>;
  onBuy: (listingId: number) => Promise<void>;
  onCancel: (listingId: number) => Promise<void>;
}

export default function Marketplace({ listings, loading, myAddress, uriById, onBuy, onCancel }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading listings…
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400">
        <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-slate-600" />
        <p>No active listings yet.</p>
        <p className="text-sm mt-1">Mint an NFT and list it for sale to be the first!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {listings.map((l) => {
        const isMine = l.seller === myAddress;
        const uri = uriById[l.token_id];
        return (
          <div key={l.id} className="card overflow-hidden flex flex-col">
            <div className="aspect-square overflow-hidden bg-slate-900">
              {uri ? (
                <img src={uri} alt={`#${l.token_id}`} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-600 text-xs">
                  loading…
                </div>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Bazaar #{l.token_id}</span>
                <span className="chip text-[10px] px-1.5 py-0.5">#{l.id}</span>
              </div>
              <div className="mt-1 text-base font-bold text-bazaar-200">
                {fmtTokens(l.price)} <span className="text-xs text-slate-500">{TOKEN_SYMBOL}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">by {shortAddr(l.seller)}</div>
              {isMine ? (
                <button
                  className="btn-ghost mt-3 w-full px-2 py-1.5 text-xs"
                  disabled={busyId === l.id}
                  onClick={async () => {
                    setBusyId(l.id);
                    try {
                      await onCancel(l.id);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {busyId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Cancel
                </button>
              ) : (
                <button
                  className="btn-primary mt-3 w-full px-2 py-1.5 text-xs"
                  disabled={busyId === l.id || !myAddress}
                  onClick={async () => {
                    setBusyId(l.id);
                    try {
                      await onBuy(l.id);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {busyId === l.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-3.5 w-3.5" />
                  )}
                  Buy
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
