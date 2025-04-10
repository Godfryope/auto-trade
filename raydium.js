import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

const LAMPORTS_PER_SOL = 1_000_000_000; // Number of lamports in one SOL

async function updateSolanaBalance() {
    try {
        const walletAddress = '9r6gRD2H16YXB4Ccw3hSnXGznm65B1nN74eXUhqQdGXM';
        const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
        const publicKey = new PublicKey(walletAddress);
        const balance = await connection.getBalance(publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL; // Convert from lamports to SOL

        console.log(`📊 The Solana balance for wallet ${walletAddress} is: ${solBalance} SOL`);
        return solBalance;
    } catch (err) {
        console.log(`Error fetching balance for wallet: ${err.message}`);
        throw err;
    }
}

updateSolanaBalance();