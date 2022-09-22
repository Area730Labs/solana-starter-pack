import { PublicKey } from "@solana/web3.js";


export const USDC_TOKEN = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const SOL_TOKEN = new PublicKey("So11111111111111111111111111111111111111112");

export interface PaymentToken {
    mint : PublicKey,
    decimals : number,
    name: string
}

export interface Config {
    disable_cache: boolean,
    cluster_url: string,
    rpc_request_interval: number,
    debug_simulate_tx: boolean,
    program_id: PublicKey,
    api_base_url: string,
    payment_tokens : PaymentToken[]
    default_payment_mint: PublicKey
}


const global_config: Config = {
    disable_cache: false,
    cluster_url: "https://api.devnet.solana.com",
    rpc_request_interval: 500,
    debug_simulate_tx: false,
    program_id: new PublicKey("GSdkVPb9aMMY43TNcHeocHvC1KCYxWiTs2ey79hKMsYN"),
    api_base_url : "https://cldfn.com/matosolana/",
    // api_base_url: 'http://localhost:8051/',
    payment_tokens : [
        {
            mint: USDC_TOKEN,
            decimals: 6,
            name: "USDC"
        },
        {
            mint: SOL_TOKEN,
            decimals: 9,
            name: "SOL"
        },
    ],
    default_payment_mint: USDC_TOKEN
};

export default global_config; 