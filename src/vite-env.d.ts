/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_NFT_ID?: string;
  readonly VITE_PAYMENT_ID?: string;
  readonly VITE_MARKETPLACE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
