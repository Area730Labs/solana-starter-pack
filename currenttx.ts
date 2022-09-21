import { WalletAdapter } from "@solana/wallet-adapter-base";
import { TransactionType } from "./appcontext";

const current_tx_cache_prefix = "current_tx";

function getCurrentTxCacheKey(wallet: WalletAdapter): string {
    return `${current_tx_cache_prefix}_${wallet.publicKey}`;
}

export interface CurrentTx {
    CreatedAt: number
    Signature: string
    Type: TransactionType
    label: string
}

function storeCurrentTx(item: CurrentTx, wallet: WalletAdapter) {
    if (item == null) {
        cleanupCurrentTx(wallet);
    } else {
        localStorage.setItem(getCurrentTxCacheKey(wallet), JSON.stringify(item))
    }
}

function cleanupCurrentTx(wallet: WalletAdapter) {
    localStorage.removeItem(getCurrentTxCacheKey(wallet))
}

function getCurrentTx(wallet: WalletAdapter): CurrentTx | null {
    const cached = localStorage.getItem(getCurrentTxCacheKey(wallet));
    if (cached == null) {
        return null;
    } else {
        return JSON.parse(cached) as CurrentTx
    }
}

export {
    getCurrentTx, storeCurrentTx
}