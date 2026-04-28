import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { PRESET_IMAGES } from '../lib/config';

interface Props {
  onMint: (uri: string) => Promise<void>;
  busy: boolean;
}

export default function MintForm({ onMint, busy }: Props) {
  const [uri, setUri] = useState(PRESET_IMAGES[0].url);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [custom, setCustom] = useState(false);

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-xl bg-fuchsia-900/40 p-2.5 ring-1 ring-fuchsia-700/40">
          <Sparkles className="h-5 w-5 text-fuchsia-300" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Mint a new NFT</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Pick from the curated gallery or paste your own image URL.
          </p>
        </div>
      </div>

      {!custom && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {PRESET_IMAGES.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => {
                setSelectedIdx(i);
                setUri(p.url);
              }}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                selectedIdx === i
                  ? 'border-bazaar-400 ring-2 ring-bazaar-500/40'
                  : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <img src={p.url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white truncate">
                {p.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {custom && (
        <input
          className="input mb-3"
          placeholder="https://… (image URL)"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost flex-1 sm:flex-none"
          onClick={() => setCustom((c) => !c)}
        >
          {custom ? 'Use gallery' : 'Custom URL'}
        </button>
        <button
          type="button"
          disabled={!uri.trim() || busy}
          className="btn-primary flex-1"
          onClick={() => onMint(uri.trim())}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Minting…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Mint NFT
            </>
          )}
        </button>
      </div>
    </div>
  );
}
