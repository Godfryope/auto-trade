import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from "bs58";

const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"; // Solana RPC URL
const web3Connection = new Connection(
  RPC_ENDPOINT,
  'confirmed',
);

const signerKeyPair = Keypair.fromSecretKey(bs58.decode("4kVChKC5c7dpySqGWDvzwV6SPcRjBhQHSBnEGpmezvSP46C6mT22QTHbrK8FoW6tHnQwY4hZg5YLsahPo5AonQyR"));

async function sendPortalTransaction(action) {
  const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "publicKey": "9r6gRD2H16YXB4Ccw3hSnXGznm65B1nN74eXUhqQdGXM",  // Your wallet public key
      "action": action,               // "buy" or "sell"
      "mint": "96cBmN7XWZqsrmrgxH4mVS1xS6DeDdB2Q6XC87aipump",         // contract address of the token you want to trade
      "denominatedInSol": "true",     // "true" if amount is amount of SOL, "false" if amount is number of tokens
      "amount": 0.0000001,            // amount of SOL or tokens
      "slippage": 10,                 // percent slippage allowed
      "priorityFee": 0.00001,         // priority fee
      "pool": "pump"                  // exchange to trade on. "pump", "raydium", "pump-amm" or "auto"
    })
  });

  if (response.status === 200) { // successfully generated transaction
    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));
    tx.sign([signerKeyPair]);
    const signature = await web3Connection.sendTransaction(tx);
    console.log(`${action.toUpperCase()} Transaction: https://solscan.io/tx/${signature}`);
    return true;
  } else {
    console.log(`${action.toUpperCase()} Error: ${response.statusText}`);
    return false;
  }
}

async function executeTrade() {
  const buySuccess = await sendPortalTransaction("buy");
  if (buySuccess) {
    // Execute sell immediately after buy
    await sendPortalTransaction("sell");
  }
}

executeTrade();

