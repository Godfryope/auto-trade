import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';

const web3Connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

async function getTransactionHistory(publicKey) {
  try {
    const signatures = await web3Connection.getSignaturesForAddress(publicKey, { limit: 10 }); // Fetch last 10 transactions
    const transactionHistory = [];

    for (const signatureInfo of signatures) {
      const transactionDetails = await web3Connection.getTransaction(signatureInfo.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });

      if (transactionDetails) {
        const { meta } = transactionDetails;

        if (meta) {
          const preBalances = meta.preBalances;
          const postBalances = meta.postBalances;

          // Calculate SOL spent or received
          const solChange = (postBalances[0] - preBalances[0]) / 1e9; // Convert lamports to SOL

          transactionHistory.push({
            amount: solChange,
            link: `https://solscan.io/tx/${signatureInfo.signature}`,
            signature: signatureInfo.signature,
          });
        }
      }
    }

    console.log(transactionHistory);
    return transactionHistory;
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return [];
  }
}

// Example usage
const walletPublicKey = new PublicKey("9r6gRD2H16YXB4Ccw3hSnXGznm65B1nN74eXUhqQdGXM"); // Replace with your wallet public key
getTransactionHistory(walletPublicKey);
