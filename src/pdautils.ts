import { PublicKey } from "@solana/web3.js";
import global_config from "./config";
import {
    TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

export function calcAddressWithSeed(seed: string, address: PublicKey): [PublicKey, number] {
    const buffers = [Buffer.from(seed, 'utf8'), address.toBuffer()];

    return PublicKey.findProgramAddressSync(
        buffers, new PublicKey(global_config.program_id)
    );
}

export function calcAddressWithTwoSeeds(seed: string, seed2: Buffer, address: PublicKey): [PublicKey, number] {
    const buffers = [Buffer.from(seed, 'utf8'), seed2, address.toBuffer()];

    return PublicKey.findProgramAddressSync(
        buffers, new PublicKey(global_config.program_id)
    );
}

export function getProgramPDA(seed: string): [PublicKey, number] {
    const buffers = [Buffer.from(seed, 'utf8')];

    return PublicKey.findProgramAddressSync(
        buffers, new PublicKey(global_config.program_id)
    );
}

export function string_to_buffer(val: string): number[] {
    
    let result = [];
    
    let lastIdx = 0;

    for (var idx of val.split('')) {
        result.push(idx.charCodeAt(0));
        lastIdx += 1;
    }

    result[lastIdx] = '\0';
    console.log('string value: ',result)
    
    return result;
}

export function findAssociatedTokenAddress(
    walletAddress: PublicKey,
    tokenMintAddress: PublicKey
): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            walletAddress.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
}