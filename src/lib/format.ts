import { TOKEN_DECIMALS } from './config';

export function shortAddr(addr: string | null | undefined, head = 4, tail = 4): string {
  if (!addr) return '';
  if (addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function fromRaw(raw: bigint | number, decimals = TOKEN_DECIMALS): string {
  const big = typeof raw === 'bigint' ? raw : BigInt(raw);
  const neg = big < 0n;
  const abs = neg ? -big : big;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  const txt = fracStr ? `${whole}.${fracStr}` : `${whole}`;
  return neg ? `-${txt}` : txt;
}

export function toRaw(human: string, decimals = TOKEN_DECIMALS): bigint {
  if (!human) return 0n;
  const [w = '0', f = ''] = human.replace(/,/g, '').split('.');
  const padded = (f + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

export function fmtTokens(raw: bigint | number, decimals = TOKEN_DECIMALS, max = 4): string {
  const human = fromRaw(raw, decimals);
  const [w, f] = human.split('.');
  if (!f) return Number(w).toLocaleString();
  return `${Number(w).toLocaleString()}.${f.slice(0, max)}`;
}
