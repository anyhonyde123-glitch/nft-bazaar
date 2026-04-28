export const NETWORK_PASSPHRASE =
  (import.meta.env.VITE_NETWORK_PASSPHRASE as string) ||
  'Test SDF Network ; September 2015';

export const RPC_URL =
  (import.meta.env.VITE_RPC_URL as string) ||
  'https://soroban-testnet.stellar.org';

export const NFT_ID = (import.meta.env.VITE_NFT_ID as string) || '';
export const PAYMENT_ID = (import.meta.env.VITE_PAYMENT_ID as string) || '';
export const MARKETPLACE_ID = (import.meta.env.VITE_MARKETPLACE_ID as string) || '';

export const TOKEN_DECIMALS = 7;
export const TOKEN_SYMBOL = 'BAZ';
export const NFT_SYMBOL = 'BZR';

/** A small set of curated public-domain NFT image URLs users can mint. */
export const PRESET_IMAGES: { name: string; url: string }[] = [
  { name: 'Aurora', url: 'https://images.unsplash.com/photo-1539593395743-7da5ee10ff07?w=800&auto=format' },
  { name: 'Cosmic Wave', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&auto=format' },
  { name: 'Neon Dunes', url: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800&auto=format' },
  { name: 'Glass Crystal', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&auto=format' },
  { name: 'Pixel City', url: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&auto=format' },
  { name: 'Liquid Gold', url: 'https://images.unsplash.com/photo-1604079628040-94301bb21b91?w=800&auto=format' },
];
