"use client";
import { useState, useEffect } from 'react';
import type { UserData } from '@stacks/connect';
import { AppConfig, UserSession, showConnect, openSignatureRequestPopup } from "@stacks/connect";
import { StacksTestnet } from "@stacks/network";
import { bytesToHex, hexToBytes } from '@stacks/common';
import { sbtcDepositHelper, sbtcWithdrawHelper, sbtcWithdrawMessage, WALLET_00 } from 'sbtc';
import type { UtxoWithTx } from 'sbtc';
import * as btc from '@scure/btc-signer';

// Network configuration
import { NETWORK } from './netconfig';

// Library
import type { stateType, walletType, txInfoType } from './lib';
import { emptyWallet, emptyTxInfo } from './lib';
import { getBalanceSBTC, transactionConfirmed, getURLAddressBTC,
  getURLAddressSTX, getURLTxBTC, getFeeRate } from './lib';
import { humanReadableNumber as hrn } from './lib';

// UI
import { LogWindow } from './logwindow';
import { Alert, Badge, Banner, Button, Card, Spinner } from 'flowbite-react';

// Setting: How much to deposit / withdraw
const DEPOSITAMOUNT : number = 10_000;
const WITHDRAWAMOUNT : number = 10_000;

// Main component
export default function Home() {
  // State and wallet
  const [state, setState] = useState<stateType>("DISCONNECTED");
  const [wallet, setWallet] = useState<walletType>(emptyWallet);
  const [txInfo, setTxInfo] = useState<txInfoType>(emptyTxInfo);
  const [userData, setUserData] = useState<UserData | null>(null);
  
  // Log current state for debug purposes
  // useEffect(() => {
  //   console.log("NEW STATE: ", state);
  //   console.log("WALLET: ", wallet);
  //   console.log("DEPOSIT INFO: ", depositInfo);
  // }, [state]);

  // Reset application
  const reset = () : void => {
    setState("DISCONNECTED");
    setWallet(emptyWallet);
    setTxInfo(emptyTxInfo);
    setUserData(null);
    if (userSession) {
      userSession.signUserOut();
    }
  }
  
  // Connect with Leather/Hiro Wallet
  const appConfig = new AppConfig();
  const userSession = new UserSession({ appConfig });

  useEffect(() => {
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((userData) => {
        setUserData(userData);
      });
    } else if (userSession.isUserSignedIn()) {
      setUserData(userSession.loadUserData());
    }
  }, []);

  // Retrieve necessary information from the wallet and from the network
  // This method depends on the network we are on. For now, it is implemented
  // for the local Development Network. Also, there are a few issues:
  // 
  // setBtcAddress(userData.profile.btcAddress.p2wpkh.testnet);
  // setBtcPublicKey(userData.profile.btcPublicKey.p2wpkh);
  // Because of some quirks with Leather, we need to pull our BTC wallet using
  // the helper if we are on devnet
  // The following, as noted in the documentation, fails.
  // According to Leather, the STX Address is the same as on the testnet.
  // In fact, it coincides with the SBTC_FT_ADDRESS_DEVENV in the constants
  // file (sbc).
  // setStxAddress(bitcoinAccountA.tr.address);
  // setFeeRate(await network.estimateFeeRate('low'));
  // setSbtcPegAddress(await network.getSbtcPegAddress());
  const getWalletAndTxDetails = async (userData:UserData) => {
    const bitcoinAccountA = await NETWORK.getBitcoinAccount(WALLET_00);
    const addressBTC = bitcoinAccountA.wpkh.address;
    const addressSTX = userData.profile.stxAddress.testnet;
    const balanceBTC = await NETWORK.getBalance(addressBTC);
    const balanceSBTC = await getBalanceSBTC(addressSTX);
    setWallet({ ...wallet, 
      decentralizedId: userData.decentralizedID , 
      addressSTX: addressSTX,
      addressBTC: addressBTC,
      publicKeyBTC: bitcoinAccountA.publicKey.buffer.toString(),
      balanceBTC: balanceBTC,
      balanceSBTC: balanceSBTC, 
      utxos: await NETWORK.fetchUtxos(addressBTC),
    });
    // Deposit Information
    // const feeRate = 1;
    const feeRate = await getFeeRate();
    // const feeRates = await NETWORK.estimateFeeRates();
    // console.log(feeRates);
    // const feeRate = await NETWORK.estimateFeeRate('low');
    setTxInfo({ ...txInfo,
      addressPeg: await NETWORK.getSbtcPegAddress(),
      feeRate: feeRate,
    });
    setState("NEED_TO_SIGN");
  }

  // Hook to get wallet and network information.
  useEffect(() => {
    if (userData) {
      if(!!userData.profile) {
        setState("CONNECTING");
        getWalletAndTxDetails(userData);
      }
    }
  }, [userData]);

  // Hook to connect to the Leather wallet
  const connectWallet = () => {
    showConnect({
      userSession,
      network: StacksTestnet,
      appDetails: {
        name: "sBTC Withdraw",
        icon: "https://freesvg.org/img/bitcoin.png",
      },
      onFinish: () => {
        window.location.reload();
      },
      onCancel: () => {
        reset();
      },
    });
  }

  // Continue fetching sBTC and BTC balance
  const fetchBalanceForever = async () => {
    const balanceBTC = await NETWORK.getBalance(wallet.addressBTC as string);
    const balanceSBTC = await getBalanceSBTC(wallet.addressSTX as string);
    setWallet({ ...wallet, balanceBTC: balanceBTC, balanceSBTC: balanceSBTC });
  }

  // Check transaction
  const waitUntilConfirmed = async (txid : string, intervalId : NodeJS.Timeout) => {
    const confirmed = await transactionConfirmed(txid);
    if (confirmed) {
      setState("CONFIRMED");
      clearInterval(intervalId);
      setInterval(() => {
        fetchBalanceForever();
      }, 10000);
    }
  }

  // Hook to check for confirmations
  const waitForConfirmation = (txid : string) => {
    const intervalId = setInterval(() => {
      waitUntilConfirmed(txid, intervalId);
        // fetch(`${mempoolTxAPIUrl}${txid}/status`,{mode: 'no-cors'})
        //   .then((response) => response.json())
        //   .then((status) => {
        //     if (status.confirmed) {
        //       console.log("checkTX: CONFIRMED!");
        //       setConfirmed(true);
        //       clearInterval(intervalId);
        //     }
        //   })
        //   .catch((err) => console.error(err));
    }, 10000);
  }

  // Hook to start deposit
  const deposit = async () => {
    const tx = await sbtcDepositHelper({
      // network: TESTNET,
      // pegAddress: sbtcPegAddress,
      stacksAddress:        wallet.addressSTX as string,
      amountSats:           DEPOSITAMOUNT,
      feeRate:              txInfo.feeRate as number,
      utxos:                wallet.utxos as UtxoWithTx[],
      bitcoinChangeAddress: wallet.addressBTC as string,
    });
    setTxInfo({ ...txInfo, tx: tx });
    // Sign and broadcast
    const psbt = tx.toPSBT();
    const requestParams = {
      publicKey: wallet.publicKeyBTC as string,
      hex: bytesToHex(psbt),
    };
    const txResponse = await window.btc.request("signPsbt", requestParams);
    const formattedTx = btc.Transaction.fromPSBT(
      hexToBytes(txResponse.result.hex)
    );
    formattedTx.finalize();
    const finalTx : string = await NETWORK.broadcastTx(formattedTx);
    setTxInfo({ ...txInfo, finalTx: finalTx });
    // Wait for confirmatins
    setState("REQUEST_SENT");
    waitForConfirmation(finalTx);
  }

  // Hook to start withdraw
  const withdraw = async () => {
    const sbtcWalletAddress = wallet.addressSTX;
    const btcAddress = wallet.addressBTC;
    const satoshis = WITHDRAWAMOUNT;
    const signature = txInfo.signature;
    const utxos = wallet.utxos;
    const tx = await sbtcWithdrawHelper({
      // paymentPublicKey: sbtcWalletAddress,
      sbtcWalletAddress,
      bitcoinAddress: btcAddress,
      amountSats: satoshis,
      signature,
      feeRate: await NETWORK.estimateFeeRate("low"),
      fulfillmentFeeSats: 2000,
      utxos,
      bitcoinChangeAddress: btcAddress,
    });
    // const tx = await sbtcWithdrawHelper({
    //   // network: TESTNET,
    //   wallet.addressSTX,
    //   bitcoinAddress: wallet.addressBTC as string,
    //   amountSats: WITHDRAWAMOUNT,
    //   txInfo.signature,
    //   fulfillmentFeeSats: 1, // TODO: What is this?
    //   bitcoinChangeAddress: wallet.addressBTC as string,
    //   // pegAddress: 
    //   feeRate: txInfo.feeRate as number,
    //   utxos: wallet.utxos as UtxoWithTx[],
    //   // utxoToSpendabe: 
    //   // paymentPublicKey: 
    // // network?: BitcoinNetwork;
    // // amountSats: number;
    // // signature: string;
    // // fulfillmentFeeSats: number;
    // // bitcoinAddress: string;
    // // bitcoinChangeAddress: string;
    // // pegAddress?: string;
    // // feeRate: number;
    // // utxos: UtxoWithTx[];
    // // utxoToSpendable?: Partial<SpendableByScriptTypes>;
    // // paymentPublicKey?: string;
    // });
    console.log("TX PREPARED");
    console.log(tx);
    setTxInfo({ ...txInfo, tx: tx });
    // Sign and broadcast
    const psbt = tx.toPSBT();
    const requestParams = {
      publicKey: wallet.publicKeyBTC as string,
      hex: bytesToHex(psbt),
    };
    const txResponse = await window.btc.request("signPsbt", requestParams);
    const formattedTx = btc.Transaction.fromPSBT(
      hexToBytes(txResponse.result.hex)
    );
    formattedTx.finalize();
    console.log("FormattedTx: ", formattedTx);
    const finalTx : string = await NETWORK.broadcastTx(formattedTx);
    console.log("FinalTX: ", finalTx);
    setTxInfo({ ...txInfo, finalTx: finalTx });
    // Wait for confirmatins
    setState("REQUEST_SENT");
    waitForConfirmation(finalTx);
  }

  const sign = async () => {
    const message = sbtcWithdrawMessage({
      // network: TESTNET,
      amountSats: WITHDRAWAMOUNT,
      bitcoinAddress: wallet.addressBTC as string
    });

    openSignatureRequestPopup({
      message,
      userSession,
      network: new StacksTestnet(),
      onFinish: (data) => {
        console.log("SIGNATURE: ");
        console.log(data);
        setTxInfo({ ...txInfo, signature: data.signature });
        setState("READY");
      },
    });
  }

  // Main component
  return (
    <main>
      <Banner>
        <div className="fixed top-0 left-0 z-50 flex justify-between w-full p-4 border-b border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
          <div className="flex items-center mx-auto">
            <p className="flex items-center text-sm font-normal text-gray-500 dark:text-gray-400">
              <span>
                {
                  (state != "DISCONNECTED" && state != "CONNECTING") ? (
                    <>You currently hold {hrn(wallet.balanceBTC as number)} BTCs and {hrn(wallet.balanceSBTC as number)} sBTCs.</>
                  ) : (
                      (state == "DISCONNECTED") ? (
                        <>Connect to proceed</>
                      ) : (
                          <>Loading ...</>
                        )
                    )
                }
              </span>
            </p>
          </div>
        </div>
      </Banner>
      <div className="h-screen flex flex-col">
        <div className="grow flex items-center justify-center bg-gradient-to-b from-gray-500 to-black">
          <Card className="w-1/2">
            <h1 className="text-4xl font-bold text-black">
              <p>
                Withdraw your sBTC.
              </p>
            </h1>
            <div className="text-regular">
              <p>
                Reclaim your {hrn(WITHDRAWAMOUNT)} satoshis from the peg-out.
              </p>
            </div>
            <div>
              { 
                (state == "DISCONNECTED") ? (
                  <Button
                    onClick={connectWallet}
                  >
                    Connect Wallet
                  </Button>
                ) : null
              }
              {
                (state == "CONNECTING") ? (
                  <Alert
                    withBorderAccent
                    className="w-full"
                  >
                    <span>
                      <p>
                        <span>
                          <Spinner aria-label="Loading..." />
                        </span>
                        &nbsp;&nbsp;
                        Loading necessary data from your wallet and the chain...
                      </p>
                    </span>
                  </Alert>
                ) : null
              }
              {
                (state == "READY" || state == "NEED_TO_SIGN") ? (
                  <>
                    <span className="py-2">
                      <Alert
                        withBorderAccent
                        className="w-full"
                      >
                        <span>
                          The sats will be sent from your&nbsp;
                          <a 
                            href={getURLAddressBTC(wallet.addressBTC as string)} 
                            target="_blank"
                            className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
                          >
                            BTC address
                          </a>
                          &nbsp; to the&nbsp;
                          <a
                            href={getURLAddressBTC(txInfo.addressPeg as string)} 
                            target="_blank"
                            className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
                          >
                            peg address.
                          </a>
                          &nbsp;You will recieve the equal amount of sBTC to your&nbsp;
                          <a
                            href={getURLAddressSTX(wallet.addressSTX as string)}
                            target="_blank"
                            className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
                          >
                            STX Address.
                          </a>
                        </span>
                        <span className="flex justify-end">
                          <Badge
                            color="warning"
                          >
                            {txInfo.feeRate as number} sat/byte fee
                          </Badge>
                        </span>
                      </Alert>
                    </span>
                    <span>
                      <Button.Group>
                        <Button
                          onClick={(state=="READY") ? withdraw : sign}
                        >
                          {(state=="READY") ? "Withdraw" : "Sign"}
                        </Button>
                        <Button
                          onClick={reset}
                        >
                          Disconnect Wallet
                        </Button>
                      </Button.Group>
                    </span>
                  </>
                ) : null
              }
              {
                (state == "INSUFFICIENT_FUNDS") ? (
                  <>
                    <span className="py-2">
                      <Alert
                        color="failure"
                        withBorderAccent
                        className="w-full items-center"
                      >
                        <p>
                          Your BTC account does not contain enough Satoshis.
                          Top it up before proceeding.
                        </p>
                      </Alert>
                    </span>
                    <span>
                      <Button
                        onClick={reset}
                      >
                        Disconnect Wallet
                      </Button>
                    </span>
                  </>
                ) : null
              }
              {
                (state == "REQUEST_SENT") ? (
                  <Alert
                    withBorderAccent
                    className="w-full"
                  >
                    <span>
                      <p>
                        <span>
                          <Spinner aria-label="Waiting for transaction" />
                        </span>
                        &nbsp;&nbsp;
                        Waiting for confirmations (see&nbsp;
                        <a 
                          href={getURLTxBTC(txInfo.finalTx as string)}
                          target="_blank"
                          className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
                        >
                          transaction details
                        </a>
                        )
                      </p>
                    </span>
                  </Alert>
                ) : null
              }
              {
                (state == "CONFIRMED") ? (
                  <>
                    <span className="py-2">
                      <Alert
                        withBorderAccent
                        color="success"
                        className="w-full"
                      >
                        <span>
                          <p>
                            Transaction confirmed (see&nbsp;
                            <a 
                              href={getURLTxBTC(txInfo.finalTx as string)}
                              target="_blank"
                              className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
                            >
                              transaction details
                            </a>
                            )
                          </p>
                        </span>
                      </Alert>
                    </span>
                    <span>
                      <Button
                        onClick={reset}
                      >
                        Disconnect Wallet
                      </Button>
                    </span>
                  </>
                ) : null
              }
            </div>
          </Card>
        </div>
        <LogWindow
          wallet = { wallet }
          txInfo = { txInfo }
          state={ state }
          />
      </div>
    </main>
  )
}
