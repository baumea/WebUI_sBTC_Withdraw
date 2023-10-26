import { type UtxoWithTx } from 'sbtc';
import { type Transaction } from '@scure/btc-signer';
import { NETWORK, MEMPOOLTXAPIURL, STACKSAPIURL, MEMPOOLURLADDRESS, STACKSURLADDRESS, STACKSURLADDRESSPOST, MEMPOOLTXURL } from './netconfig';

export const getBalanceSBTC = async (addressSTX: string): Promise<number> => {
  const response = await fetch(`${STACKSAPIURL}${addressSTX}/balances`);
  const balances = await response.json();
  try {
    return balances.fungible_tokens[`${addressSTX}.asset::sbtc`].balance;
  } catch {
    return 0;
  }
}

export const transactionConfirmed = async (txid: string): Promise<boolean> => {
  const response = await fetch(`${MEMPOOLTXAPIURL}${txid}/status`);
  const status = await response.json();
  return status.confirmed
}

export const getURLAddressBTC = (addressBTC: string): string => {
  return `${MEMPOOLURLADDRESS}${addressBTC}`;
}

export const getURLAddressSTX = (addressSTX: string): string => {
  return `${STACKSURLADDRESS}${addressSTX}${STACKSURLADDRESSPOST}`;
}

export const getURLTxBTC = (txid: string): string => {
  return `${MEMPOOLTXURL}${txid}`;
}

export const getFeeRate = async (): Promise<number> => {
  try {
    return await NETWORK.estimateFeeRate('low');
  } catch {
    console.log("Failed to estimate fee rate!");
    return 1;
  }
}

export type stateType = "DISCONNECTED" | "CONNECTING" | "READY" | "NEED_TO_SIGN" | "INSUFFICIENT_FUNDS" | "REQUEST_SENT" | "CONFIRMED";

export type walletType = {
  decentralizedId: string | undefined,
  addressBTC:      string | undefined,
  balanceBTC:      number | undefined,
  publicKeyBTC:    string | undefined,
  balanceSBTC:     number | undefined,
  addressSTX:      string | undefined,
  utxos:           UtxoWithTx[] | undefined,
}

export type txInfoType = {
  addressPeg: string | undefined,
  feeRate:    number | undefined,
  tx:         Transaction | undefined,
  finalTx:    string | undefined,
  signature:  string | undefined,
}

export const emptyWallet: walletType = {
  decentralizedId: undefined,
  addressBTC:      undefined,
  balanceBTC:      undefined,
  publicKeyBTC:    undefined,
  balanceSBTC:     undefined,
  addressSTX:      undefined,
  utxos:           undefined,
}

export const emptyTxInfo: txInfoType = {
  addressPeg: undefined,
  feeRate:    undefined,
  tx:         undefined,
  finalTx:    undefined,
  signature:  undefined,
}

export const humanReadableNumber = (number: number): string => {
  if (1_000_000_000 <= number) {
    return `${(number/1_000_000_000).toLocaleString()}B`;
  } else if (1_000_000 <= number) {
    return `${(number/1_000_000).toLocaleString()}M`;
  } else if (1_000 <= number) {
    return `${(number/1_000).toLocaleString()}K`;
  } else {
    return `${number.toLocaleString()}`;
  }
}
