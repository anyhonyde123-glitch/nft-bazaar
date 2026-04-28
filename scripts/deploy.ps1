# NFT Bazaar — one-shot Soroban testnet deployment script
# Prerequisites:
#   - stellar CLI ≥ 22 installed and on PATH
#   - A funded testnet identity (default name: "alice")
#       stellar keys generate --global alice --network testnet --fund
#   - Rust toolchain with target wasm32v1-none

param(
    [string] $Identity = "alice",
    [string] $Name = "Bazaar Coin",
    [string] $Symbol = "BAZ",
    [string] $NftName = "NFT Bazaar",
    [string] $NftSymbol = "BZR",
    [int]    $FeeBps = 250
)

$ErrorActionPreference = "Stop"
$env:STELLAR_NETWORK = "testnet"

Write-Host "▶ Building contracts (release wasm)..." -ForegroundColor Cyan
Push-Location contracts
stellar contract build
Pop-Location

$wasmDir = "contracts/target/wasm32v1-none/release"
$adminAddr = stellar keys address $Identity
Write-Host "Admin: $adminAddr" -ForegroundColor Yellow

# 1) Deploy + init NFT
Write-Host "`n▶ Deploying NFT contract..." -ForegroundColor Cyan
$nftId = stellar contract deploy `
    --wasm "$wasmDir/nft.wasm" `
    --source $Identity --network testnet
Write-Host "NFT_ID = $nftId" -ForegroundColor Green
$nftId | Out-File ".nft-id.txt" -Encoding utf8 -NoNewline

stellar contract invoke --id $nftId --source $Identity --network testnet -- init `
    --name $NftName --symbol $NftSymbol | Out-Null

# 2) Deploy + init payment token
Write-Host "`n▶ Deploying payment token..." -ForegroundColor Cyan
$payId = stellar contract deploy `
    --wasm "$wasmDir/payment.wasm" `
    --source $Identity --network testnet
Write-Host "PAYMENT_ID = $payId" -ForegroundColor Green
$payId | Out-File ".payment-id.txt" -Encoding utf8 -NoNewline

stellar contract invoke --id $payId --source $Identity --network testnet -- init `
    --admin $adminAddr --decimal 7 --name $Name --symbol $Symbol | Out-Null

# 3) Deploy + init marketplace
Write-Host "`n▶ Deploying marketplace..." -ForegroundColor Cyan
$marketId = stellar contract deploy `
    --wasm "$wasmDir/marketplace.wasm" `
    --source $Identity --network testnet
Write-Host "MARKETPLACE_ID = $marketId" -ForegroundColor Green
$marketId | Out-File ".marketplace-id.txt" -Encoding utf8 -NoNewline

stellar contract invoke --id $marketId --source $Identity --network testnet -- init `
    --admin $adminAddr --nft $nftId --payment $payId --fee_bps $FeeBps | Out-Null

# 4) Write .env.local
Write-Host "`n▶ Writing .env.local..." -ForegroundColor Cyan
@"
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NFT_ID=$nftId
VITE_PAYMENT_ID=$payId
VITE_MARKETPLACE_ID=$marketId
"@ | Out-File ".env.local" -Encoding utf8

Write-Host "`n✓ All 3 contracts deployed and initialised." -ForegroundColor Green
Write-Host "  NFT_ID         = $nftId"
Write-Host "  PAYMENT_ID     = $payId"
Write-Host "  MARKETPLACE_ID = $marketId"
Write-Host "`nNow run 'npm install && npm run dev' to launch the dApp." -ForegroundColor Cyan
