import { PublicKey } from "@solana/web3.js";

export const AUTHORIZED_WALLET = "authorized_wallet";

export function setActiveWallet(wallet: PublicKey) {

    if (typeof window !== 'undefined') {
        let cache_key = AUTHORIZED_WALLET;
        localStorage.setItem(cache_key, wallet.toString())
    }
}
export function getActiveWallet(): PublicKey | null {
    if (typeof window !== 'undefined') {
        let cache_key = AUTHORIZED_WALLET;

        let addr = localStorage.getItem(cache_key);
        if (addr != null) {
            return new PublicKey(addr);
        } else {
            return null;
        }
    }

    return null;
}
