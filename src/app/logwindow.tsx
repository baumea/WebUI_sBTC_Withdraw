import type { stateType, walletType, txInfoType } from './lib';
export function LogWindow({wallet, txInfo, state}: {wallet: walletType, txInfo: txInfoType, state: stateType}) {
  return(
    <div className="h-max bg-black font-mono text-slate-900 hover:text-slate-700">
      <p>State: {state}</p>
      {
        wallet.decentralizedId ? (<p>Decentralized ID: {wallet.decentralizedId}</p>) : (<p>Fetching Decentralized ID...</p>)
      }
      {
        wallet.addressBTC ? (<p>BTC Address: {wallet.addressBTC}</p>) : (<p>Fetching BTC Address...</p>)
      }
      {
        wallet.addressSTX ? (<p>STX Address: {wallet.addressSTX}</p>) : (<p>Fetching STX Address...</p>)
      }
      {
        wallet.publicKeyBTC ? (<p>BTC Public Key: {wallet.publicKeyBTC}</p>) : (<p>Fetching BTC Public Key...</p>)
      }
      {
        wallet.balanceBTC ? (<p>BTC Balance: {wallet.balanceBTC}</p>) : (<p>Fetching BTC Balance...</p>)
      }
      {
        wallet.balanceSBTC ? (<p>sBTC Balance: {wallet.balanceSBTC}</p>) : (<p>Fetching sBTC Balance...</p>)
      }
      { 
        wallet.utxos ? (<p>Number of UTXOs: {wallet.utxos.length}</p>) : (<p>Fetching UTXOs...</p>)
      }
      {
        txInfo.addressPeg ? (<p>sBTC Peg Address: {txInfo.addressPeg}</p>) : (<p>Fetching sBTC Peg Address...</p>)
      }
      {
        txInfo.feeRate ? (<p>Fee Rate: {txInfo.feeRate}</p>) : (<p>Fetching Fee Rate...</p>)
      }
      {
        txInfo.tx ? (<p>Transaction prepared</p>) : (<p>Transaction not prepared...</p>)
      }
      {
        txInfo.finalTx ? (<p>Transaction finalized: {txInfo.finalTx}</p>) : (<p>Transaction not finalized...</p>)
      }
    </div>
  );
}
