import { useState } from 'react';
import { Loader2, Tag, X } from 'lucide-react';
import { TOKEN_DECIMALS, TOKEN_SYMBOL } from '../lib/config';

export interface OwnedNft {
  id: number;
  uri: string;
}

interface Props {
  nfts: OwnedNft[];
  loading: boolean;
  onList: (id: number, priceRaw: bigint) => Promise<void>;
}

export default function MyNFTs({ nfts, loading, onList }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your collection…
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400">
        <p>You don't own any NFTs yet.</p>
        <p className="text-sm mt-1">Mint your first one above to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold mb-3 text-slate-200">My collection ({nfts.length})</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {nfts.map((n) => (
          <div key={n.id} className="card overflow-hidden flex flex-col">
            <div className="aspect-square overflow-hidden bg-slate-900">
              <img src={n.uri} alt={`#${n.id}`} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="p-3">
              <div className="text-xs text-slate-500">Bazaar #{n.id}</div>
              {activeId === n.id ? (
                <div className="mt-2 space-y-2">
                  <div className="relative">
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="input pr-12 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                      {TOKEN_SYMBOL}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      className="btn-ghost flex-1 px-2 py-1.5 text-xs"
                      onClick={() => {
                        setActiveId(null);
                        setPrice('');
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                    <button
                      className="btn-primary flex-1 px-2 py-1.5 text-xs"
                      disabled={!price || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const raw = BigInt(Math.floor(Number(price) * 10 ** TOKEN_DECIMALS));
                          await onList(n.id, raw);
                          setActiveId(null);
                          setPrice('');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                      List
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn-ghost mt-2 w-full px-2 py-1.5 text-xs"
                  onClick={() => setActiveId(n.id)}
                >
                  <Tag className="h-3.5 w-3.5" /> List for sale
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
