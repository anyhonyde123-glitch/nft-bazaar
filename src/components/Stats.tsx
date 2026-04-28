import { Coins, Image as ImageIcon, ShoppingBag, TrendingUp } from 'lucide-react';
import { fmtTokens } from '../lib/format';

interface Props {
  balance: bigint;
  ownedNfts: number;
  activeListings: number;
  totalSupply: number;
  paySymbol: string;
}

export default function Stats({ balance, ownedNfts, activeListings, totalSupply, paySymbol }: Props) {
  const items = [
    {
      icon: Coins,
      label: 'Wallet',
      value: fmtTokens(balance),
      sub: `${paySymbol || 'BAZ'} balance`,
      color: 'text-bazaar-300',
    },
    {
      icon: ImageIcon,
      label: 'My NFTs',
      value: String(ownedNfts),
      sub: 'tokens owned',
      color: 'text-fuchsia-300',
    },
    {
      icon: ShoppingBag,
      label: 'Listings',
      value: String(activeListings),
      sub: 'active in market',
      color: 'text-emerald-300',
    },
    {
      icon: TrendingUp,
      label: 'Supply',
      value: String(totalSupply),
      sub: 'minted overall',
      color: 'text-sky-300',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((s) => (
        <div key={s.label} className="card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            {s.label}
          </div>
          <div className={`mt-1.5 text-2xl sm:text-3xl font-bold ${s.color} truncate`}>{s.value}</div>
          <div className="text-xs text-slate-500">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
