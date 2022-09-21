import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import * as web3 from '@solana/web3.js'
import { WalletAdapter } from "@solana/wallet-adapter-base";
import { toast, ToastOptions, Icons } from 'react-toastify';
import { TxHandler } from "./handler";
import { CurrentTx, getCurrentTx, storeCurrentTx } from "./currenttx"
import { createRpcWrapper, execRpcTask, QueuedRpcRequest, SolanaRpc } from "./rpc";
import global_config from "./config";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes/index";
import { v4 as uuidv4 } from 'uuid';
import { useWallet } from '@solana/wallet-adapter-react';
import Api from "../api/api";
import { SdkProject } from "../api/api";
import ChainSdk from "../chain/sdk";
import { getActiveProject, setActiveProject } from "../components/projectContext";

export type TransactionType = "system" | "signup" | "platform" | "other" | "create_item"
export type SendTxFuncType = { (ixs: web3.TransactionInstruction[], typ: TransactionType, signers?: web3.Signer[], label?: string): Promise<web3.TransactionSignature> }

export enum AuthorizeState {
    initial,
    authorizing,
    rejected,
    noproject,
    authorized,
    signuptxwait
}

export interface AppContextType {

    authorizeState: AuthorizeState,
    authorized: boolean | null
    logout(),

    // solana 
    solanaConnection: SolanaRpc
    setSolanaNode: any

    // connected wallet adapter
    wallet: WalletAdapter | null
    setWalletAdapter: any

    sendTx: SendTxFuncType

    // lang: Lang,
    // setLang: { (value: Lang) }
    connection: web3.Connection

    // app 
    projects: SdkProject[],
    project_update_request: number,
}

const AppContext = createContext<AppContextType>({} as AppContextType);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function AppProvider({ children }: { children: ReactNode }) {

    // const [lang, setLang] = useState<Lang>(getLanguageFromCache());
    const [solanaNode, setSolanaNode] = useState<string>(global_config.cluster_url)
    const [connectedWallet, setWallet] = useState<WalletAdapter | null>(null);

    const [curtx, setCurtx] = useState<CurrentTx | null>(null);
    const [userUpdatesCounter, setUserUpdatesCounter] = useState(0);

    const [rpcQueue, setRpcQueue] = useState<QueuedRpcRequest[]>([]);
    const [lastRpcRequest, setLastRpcRequestTime] = useState<number>(0);
    const [queueProcessorStarted, setStarted] = useState(false);

    const { publicKey, signMessage, connected, wallet } = useWallet();
    const [authorized, setAuthorized] = useState<boolean>(false);//getActiveWallet() != null);

    const [authorizeState, setAuthorizedState] = useState<AuthorizeState>(AuthorizeState.initial);
    const [projects, setProjects] = useState<SdkProject[]>([]);
    const [project_update_request,setProjectUpdateRequst] = useState(0);

    const logout = () => {
        setAuthorized(false);
        setAuthorizedState(AuthorizeState.initial);
    };

    const web3Handler = useMemo(() => {
        return new web3.Connection(solanaNode, {
            commitment: 'confirmed',
            disableRetryOnRateLimit: true,

        });
    }, [solanaNode]);

    useEffect(() => {
        if (connected) {
            setWallet(wallet.adapter);
        }
    }, [connected]);

    useEffect(() => {

        if (connectedWallet != null) {

            setAuthorizedState(AuthorizeState.authorizing);

            const timestamp = Math.floor(new Date().getTime() / 1000);

            let guid = uuidv4();
            let bytes = new TextEncoder().encode('authorize request; ' + guid + "; " + timestamp);

            let walletProjects = new Api(web3.SystemProgram.programId)
                .has_projects(connectedWallet.publicKey).then((has_projects) => {
                    if (has_projects) {

                        signMessage(bytes).then((signed) => {

                            let sig = bs58.encode(signed);

                            let request = {
                                guid,
                                signature: sig,
                                wallet: publicKey.toString(),
                                timestamp
                            }

                            setAuthorized(true);

                            new Api()
                                .wallet_projects(request).then((api_projects) => {
                                    setProjects(api_projects);
                                    
                                    let curProject = getActiveProject(connectedWallet.publicKey);
                                    if (curProject == null) {
                                        const first_project = api_projects[0].address;
                                        setActiveProject(new web3.PublicKey(first_project),connectedWallet.publicKey);
                                        toast.info(`set current project to ${first_project}`)
                                    }
                                });

                            setAuthorizedState(AuthorizeState.authorized);

                        }).catch((e) => {
                            setAuthorizedState(AuthorizeState.rejected);
                        });
                    } else {

                        console.log('wallet has no projects');
                        setAuthorizedState(AuthorizeState.noproject);

                        try {
                            const [addr, ix] = new ChainSdk(wallet.adapter).createProject();

                            sendTx([ix], 'signup').then(() => {
                                setActiveProject(addr, wallet.adapter.publicKey);
                            }).catch((e) => {
                                toast.error('Unable to create project: ' + e.message)
                                setAuthorizedState(AuthorizeState.rejected);
                            });
                        } catch (e) {
                            console.error('unable to create signup transaction', e)
                        }
                    }
                });

        } else {
            setWallet(null);
        }
    }, [connectedWallet]);

    // useEffect(() => {

    //     if (connectedWallet == null) {

    //         let phantomWallet = new phantom.PhantomWalletAdapter();

    //         phantomWallet.on("readyStateChange", (newState) => {
    //             console.log('newState => ', newState)

    //             if (!(phantomWallet.connected || phantomWallet.connecting)) {
    //                 phantomWallet.connect();
    //             }
    //         });

    //         phantomWallet.on("connect", () => {
    //             setWallet(phantomWallet);
    //             // toast.info(<>Wallet connected</>);
    //         });

    //         phantomWallet.on("disconnect", () => {
    //             setWallet(null);
    //             // clean nfts in wallet too
    //             // toast.info("wallet disconnected");
    //         })

    //         let currentWalletState = phantomWallet.readyState;
    //         console.log('current wallet state = ', currentWalletState);

    //         if (currentWalletState === WalletReadyState.Installed || currentWalletState === WalletReadyState.Loadable) {
    //             // toast.warn('wallet installed or loadable')
    //             phantomWallet.connect()
    //         }
    //     }
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [connectedWallet]);

    const rpc_wrapper: SolanaRpc = useMemo(() => {
        return createRpcWrapper({
            rpcQueue,
            setRpcQueue,
            setLastRpcRequestTime
        });
    }, [lastRpcRequest])

    // rate limitied :) solana rpc request processor
    useEffect(() => {
        if (!queueProcessorStarted) {
            setStarted(true);

            let promiseResolved = false;
            const queueuPromise = new Promise((resolve, reject) => {
                (async () => {

                    for (; ;) {

                        let task = rpcQueue.shift();

                        if (task != null) {
                            setRpcQueue(rpcQueue);
                            execRpcTask(web3Handler, task);
                        }


                        if (rpcQueue.length > 0) {
                            await sleep(global_config.rpc_request_interval);
                        } else {
                            break;
                        }
                    }

                    resolve(true);
                    promiseResolved = true;
                    setStarted(false);
                })();
            });

            setTimeout(function () {
                if (!promiseResolved) {
                    toast.promise(queueuPromise, {
                        pending: 'loading',
                        success: {
                            icon: Icons.success,
                            render() {
                                return "done"
                            }
                        },
                        error: 'unable to load data. refresh page and try again',
                    }, {
                        theme: "dark",
                        hideProgressBar: false,
                    } as ToastOptions);
                }
            }, 800);

        }
    }, [web3Handler, lastRpcRequest]);


    useEffect(() => {

        if (curtx != null) {

            const sigConfirmPromise = new Promise((resolve, reject) => {

                const interval = setInterval(() => {

                    const curtime = new Date().getTime() / 1000;
                    const diff = curtime - curtx.CreatedAt;

                    if (diff > 40) {
                        reject("unable to confirm tx in a time. try again later")
                        setCurTxWrapper(null);
                        clearInterval(interval);
                        return
                    }

                    web3Handler.getSignatureStatus(curtx.Signature).then((resp) => {
                        if (resp.value.confirmationStatus == 'confirmed') {
                            setCurTxWrapper(null);

                            if (curtx.Type === 'create_item') {
                                clearInterval(interval);
                                setTimeout(()  => {
                                    resolve("confirmed")
                                  
                                },10000);
                            } else {
                                resolve("confirmed")
                                clearInterval(interval);
                            }
                        }
                    });

                    console.log(`checking tx ${curtx.Signature} status...`)
                }, 3000)

            }).then((item: TransactionType) => {

                const tx_type = curtx.Type;

                switch (tx_type) {
                    // case 'claim': {
                    //     const timeTook = new Date().getTime() - curtx.CreatedAt;
                    //     console.log('calc income for time when tx were confirming', timeTook)
                    //     setUserUpdatesCounter(userUpdatesCounter + 1);
                    //     break;
                    // }
                    // case 'stake':
                    // case 'unstake': {
                    //     setUserUpdatesCounter(userUpdatesCounter + 1);
                    //     break;
                    // }
                    case 'system': {
                        break;
                    }
                    case 'signup': {
                        setAuthorized(true);
                        setAuthorizedState(AuthorizeState.authorized);
                        break;
                    }
                    case 'create_item': {

                        // trigger external contect update 
                        setProjectUpdateRequst(project_update_request + 1);

                        break;
                    }
                    default: {
                        toast.warn('unknown tx type got: ' + tx_type)
                    }
                }

                setCurTxWrapper(null);
            });

            toast.promise(sigConfirmPromise, {
                pending: curtx.label != "" ? curtx.label : ('Waiting ' + curtx.Type + ' operation'),
                success: {
                    icon: Icons.success,
                    render() {
                        return "Confirmed"
                    }
                },
                error: 'Unable to confirm tx, try again later',
            }, {
                theme: "dark",
                hideProgressBar: false,
            } as ToastOptions);
        }
    }, [curtx]);

    function setCurTxWrapper(tx: CurrentTx) {
        if (connectedWallet != null) {
            storeCurrentTx(tx, connectedWallet);
            setCurtx(tx);
        }
    }

    // initialization
    useEffect(() => {
        if (connectedWallet != null && connectedWallet.connected) {
            setCurtx(getCurrentTx(connectedWallet));
        } else {
            setCurTxWrapper(null);
        }
    }, [connectedWallet, userUpdatesCounter]);

    function sendTx(ixs: web3.TransactionInstruction[], typ: TransactionType = 'other', signers?: [], label: string = ""): Promise<web3.TransactionSignature> {

        if (curtx != null) {
            return Promise.reject(new Error("wait till current transaction is confirmed"));
        }

        const txhandler = new TxHandler(web3Handler, connectedWallet);

        if (global_config.debug_simulate_tx) {
            toast.warn("simulation of tx enabled. look into console for more info")
            txhandler.simulate(ixs, signers);
            return Promise.reject(new Error("simulation enabled, look into console"));
        } else {
            return txhandler.sendTransaction(ixs, signers).then((signature) => {

                if (typ != 'other' && typ != 'platform') {

                    setCurTxWrapper({
                        Signature: signature,
                        CreatedAt: new Date().getTime(),
                        Type: typ,
                        label: label
                    });
                }

                return signature;
            });
        }
    }

    const memoedValue = useMemo(() => {
        const curCtx: AppContextType = {

            authorized,
            authorizeState,
            logout,

            // wallet
            solanaConnection: rpc_wrapper,
            setSolanaNode,
            wallet: connectedWallet,
            setWalletAdapter: setWallet,


            sendTx,

            // // lang 
            // lang,
            // setLang,
            connection: web3Handler,

            projects,
            // newProjectAddress
            project_update_request
        };

        return curCtx

    }, [,
        authorized, authorizeState,logout,
        rpc_wrapper, connectedWallet,
        curtx, userUpdatesCounter,
        projects,
        project_update_request
        // newProjectAddress
        // lang, 
    ]);

    return (
        <AppContext.Provider value={memoedValue}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {

    const app = useContext(AppContext)

    if (!app) {
        toast.error(
            "useAppContext: `app` is undefined. Seems you forgot to wrap your app in ` < AppProvider /> `",
        )
    }

    return app;
}
