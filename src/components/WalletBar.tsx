import { Copy, LogOut, RefreshCw, Wallet } from 'lucide-react';
import { useState } from 'react';
import { shortAddr } from '../lib/format';

interface Props {
  address: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitch: () => void;
}

export default function WalletBar({ address, onConnect, onDisconnect, onSwitch }: Props) {
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <button className="btn-primary" onClick={onConnect}>
        <Wallet className="h-4 w-4" />
        Connect wallet
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="chip">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        {shortAddr(address, 5, 4)}
        <button
          aria-label="copy address"
          className="ml-1 text-bazaar-300 hover:text-white"
          onClick={() => {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        {copied && <span className="text-xs text-emerald-300">copied</span>}
      </div>
      <button className="btn-ghost" onClick={onSwitch} title="Switch wallet/account">
        <RefreshCw className="h-4 w-4" />
        <span className="hidden sm:inline">Switch</span>
      </button>
      <button className="btn-ghost" onClick={onDisconnect} title="Disconnect">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
