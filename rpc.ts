import { getMinimumBalanceForRentExemptAccount } from "@solana/spl-token";
import { AccountInfo, Commitment, Connection, GetProgramAccountsConfig, ParsedAccountData, PublicKey, RpcResponseAndContext, TokenAccountsFilter } from "@solana/web3.js";
import moment from "moment";

export interface SolanaRpc {

    getProgramAccounts(
        programId: PublicKey,
        configOrCommitment?: GetProgramAccountsConfig | Commitment,
    ): Promise<
        Array<{
            pubkey: PublicKey;
            account: AccountInfo<Buffer>;
        }>
    >;

    getAccountInfo(
        publicKey: PublicKey,
        commitment?: Commitment,
    ): Promise<AccountInfo<Buffer> | null>;

    getParsedTokenAccountsByOwner(
        ownerAddress: PublicKey,
        filter: TokenAccountsFilter,
        commitment?: Commitment,
    ): Promise<
        RpcResponseAndContext<
            Array<{
                pubkey: PublicKey;
                account: AccountInfo<ParsedAccountData>;
            }>
        >
    >;

    getMinimumBalanceForRentExemptAccount(): Promise<number>,
}

export enum QueuedRpcRequestType {
    get_token_min_rent,
    get_parsed_token_accs,
    get_account_info,
    get_program_accs,
}

export interface QueuedRpcRequest {
    type: QueuedRpcRequestType,
    args: any[],
    resolve: any,
    reject: any
}

export function execRpcTask(web3Handler: Connection, task : QueuedRpcRequest) : Promise<any> {
    switch (task.type) {
        case QueuedRpcRequestType.get_account_info: {
           return web3Handler.getAccountInfo(task.args[0], task.args[1])
                .then((result) => {
                    task.resolve(result);
                }).catch((reason) => {
                    task.reject(reason);
                });

        } break;

        case QueuedRpcRequestType.get_parsed_token_accs: {
            return web3Handler.getParsedTokenAccountsByOwner(task.args[0], task.args[1], task.args[2])
                .then((result) => {
                    task.resolve(result);
                }).catch((reason) => {
                    task.reject(reason);
                });
        } break;
        case QueuedRpcRequestType.get_program_accs: {

            return web3Handler.getProgramAccounts(task.args[0], task.args[1])
                .then((result) => {
                    task.resolve(result);
                }).catch((reason) => {
                    task.reject(reason);
                });
        } break;
        case QueuedRpcRequestType.get_token_min_rent: {
            return getMinimumBalanceForRentExemptAccount(web3Handler, task.args[0])
                .then((result) => {
                    task.resolve(result);
                }).catch((reason) => {
                    task.reject(reason);
                });

        } break;
    }
}


export interface RpcWrapperContextType {
    rpcQueue: any,
    setRpcQueue(any),
    setLastRpcRequestTime(number)
}

export function createRpcWrapper(args : RpcWrapperContextType): SolanaRpc {

    let {rpcQueue,setRpcQueue,setLastRpcRequestTime} = args;

    return {
        getAccountInfo(publicKey, commitment?) {
            return this.generate_result_promise(QueuedRpcRequestType.get_account_info, [
                publicKey,
                commitment
            ]);
        },
        getProgramAccounts(
            programId: PublicKey,
            configOrCommitment?: GetProgramAccountsConfig | Commitment,
        ): Promise<
            Array<{
                pubkey: PublicKey;
                account: AccountInfo<Buffer>;
            }>
        > {
            return this.generate_result_promise(QueuedRpcRequestType.get_program_accs, [
                programId,
                configOrCommitment
            ]);
        },
        getParsedTokenAccountsByOwner(
            ownerAddress: PublicKey,
            filter: TokenAccountsFilter,
            commitment?: Commitment,
        ): Promise<
            RpcResponseAndContext<
                Array<{
                    pubkey: PublicKey;
                    account: AccountInfo<ParsedAccountData>;
                }>
            >
        > {
            return this.generate_result_promise(QueuedRpcRequestType.get_parsed_token_accs, [
                ownerAddress,
                filter,
                commitment
            ]);
        },
        getMinimumBalanceForRentExemptAccount(): Promise<number> {
            return this.generate_result_promise(QueuedRpcRequestType.get_token_min_rent, [

            ]);
        },
        generate_result_promise(typ: QueuedRpcRequestType, args_value: any[]): Promise<any> {

            return new Promise<any>((resolve, reject) => {

                rpcQueue.push({
                    type: typ,
                    args: args_value,
                    resolve: resolve,
                    reject: reject,
                } as QueuedRpcRequest);

                setRpcQueue(rpcQueue);
                
                setLastRpcRequestTime( moment.now());

            });
        }


    } as SolanaRpc;
}