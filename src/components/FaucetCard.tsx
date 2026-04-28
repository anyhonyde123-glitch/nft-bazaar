import { Droplet, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  claimed: boolean;
  loading: boolean;
  onClaim: () => void;
  paySymbol: string;
}

export default function FaucetCard({ claimed, loading, onClaim, paySymbol }: Props) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-bazaar-900/60 p-2.5 ring-1 ring-bazaar-700/40">
          <Droplet className="h-5 w-5 text-bazaar-300" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{paySymbol || 'BAZ'} Faucet</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Get <span className="text-bazaar-300 font-semibold">1,000 {paySymbol || 'BAZ'}</span> to start trading — one claim per wallet.
          </p>
        </div>
      </div>
      <button
        className={claimed ? 'btn-ghost mt-4 w-full' : 'btn-primary mt-4 w-full'}
        disabled={claimed || loading}
        onClick={onClaim}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Claiming…
          </>
        ) : claimed ? (
          <>
            <CheckCircle2 className="h-4 w-4" /> Already claimed
          </>
        ) : (
          <>
            <Droplet className="h-4 w-4" /> Claim 1,000 {paySymbol || 'BAZ'}
          </>
        )}
      </button>
    </div>
  );
}
