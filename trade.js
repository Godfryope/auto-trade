import http from 'http'; // Import HTTP module
import express from 'express'; // Import Express module
import { WebSocketServer } from 'ws'; // Import WebSocketServer from 'ws'
import WebSocket from 'ws'; // Import WebSocket from 'ws'
import fetch from 'node-fetch'; // Import node-fetch for HTTP requests
import { PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'; // Import Solana Web3 classes

const app = express(); // Initialize Express app

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files (HTML, JS)
app.use(express.static('public'));

// Connect to the external WebSocket API
const externalWs = new WebSocket('wss://pumpportal.fun/api/data');

externalWs.on('open', () => {
    console.log("Connected to external WebSocket");

    // Subscribe to new token creation events
    const payload = { method: "subscribeNewToken" };
    externalWs.send(JSON.stringify(payload));

    // Notify frontend about successful connection
    broadcast({ type: "success", message: "Connected to token updates!" });
});

async function fetchTokenMetadata(uri) {
    try {
        const response = await fetch(uri);
        const metadata = await response.json();
        return metadata.image || null; // Extract the image URL
    } catch (error) {
        console.error("Error fetching token metadata:", error);
        return null;
    }
}

externalWs.on("message", async (rawData) => {
    try {
        const parsedData = JSON.parse(rawData);
        console.log("Received data:", parsedData);
        
        // Convert marketCap and price properly
        const marketCap = Number(parsedData.marketCapSol) || 0;
        const price = parsedData.initialBuy
            ? Number(parsedData.solAmount) / Number(parsedData.initialBuy)
            : 0;

        // Fetch token image from metadata URI
        const imageUrl = parsedData.uri ? await fetchTokenMetadata(parsedData.uri) : null;

        const tokenData = {
            name: parsedData.name || "Unknown",
            symbol: parsedData.symbol || "N/A",
            mint: parsedData.mint || "N/A",
            uri: parsedData.uri || "N/A",
            creator: parsedData.creator || "N/A",
            tokenAddress: parsedData.tokenAddress || "N/A",
            tokenType: parsedData.tokenType || "N/A",
            tokenStandard: parsedData.tokenStandard || "N/A",
            tokenDecimals: parsedData.tokenDecimals || 0,
            tokenAmount: parsedData.tokenAmount || 0,
            tokenPrice: parsedData.tokenPrice || 0,
            tokenSupply: parsedData.tokenSupply || 0,
            tokenVolume: parsedData.tokenVolume || 0,
            tokenLiquidity: parsedData.tokenLiquidity || 0,
            tokenLiquiditySol: parsedData.tokenLiquiditySol || 0,
            tokenLiquidityUsdc: parsedData.tokenLiquidityUsdc || 0,
            tokenLiquidityUsdt: parsedData.tokenLiquidityUsdt || 0,
            tokenLiquidityEth: parsedData.tokenLiquidityEth || 0,
            tokenLiquidityBtc: parsedData.tokenLiquidityBtc || 0,
            marketCap: marketCap > 0 ? `$${marketCap.toLocaleString()}` : "N/A",
            price: price > 0 ? `$${price.toFixed(8)}` : "N/A",
            bondingCurve: Math.trunc(parsedData.vSolInBondingCurve), // Convert to integer
            image: imageUrl || "../assets/images/faces/1.jpg", // Default image if not found
        };

        // Broadcast formatted token data to frontend
        broadcast({ type: "newToken", data: tokenData });

        // Check wallet balance before attempting to buy the token
        const walletAddress = '9r6gRD2H16YXB4Ccw3hSnXGznm65B1nN74eXUhqQdGXM';
        const publicKey = new PublicKey(walletAddress);
        const connection = new Connection('https://api.mainnet-beta.solana.com'); // Initialize Solana connection
        const balance = await connection.getBalance(publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL; // Convert from lamports to SOL

        console.log(`📊 The Solana balance for wallet ${walletAddress} is: ${solBalance} SOL`);

        // Log wallet balance instead of unused variable
        console.log(`Wallet balance data: ${solBalance} SOL`);

        const response = await fetch("https://pumpportal.fun/api/trade?api-key=6x84uhatb12pwguu9526crubddvkge1kc92n6gk76tnngxjpad8kaduhe0v2pp356gv32cj8e17prcubb9r4pwageh174h32dcv6wkvea1q7mjj3b0t7ahvkdnc5jkbd8945exaqcwyku6gupcebtf50mawtb9wumyva1b489wmpmhbdnc3edvfedrpuwj7cwu4gha2anvkuf8", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "action": "buy",            // "buy" or "sell"
                "mint": parsedData.mint,     // contract address of the token you want to trade
                "amount": 1,                // amount of SOL or tokens to trade (minimum 1 token)
                "denominatedInSol": "true", // "true" if amount is SOL, "false" if amount is tokens
                "slippage": 10,             // percent slippage allowed
                "priorityFee": 0.00005,       // amount to use as Jito tip or priority fee
                "pool": "pump"              // exchange to trade on. "pump", "raydium", "pump-amm" or "auto"
            })
        });
        const data = await response.json();  // JSON object with tx signature or error(s)
        console.log("Trade response:", data);
    } catch (error) {
        console.error("Error parsing message:", error);
        broadcast({ type: "error", message: "Failed to process token data!" });
    }
});

externalWs.on('close', () => {
    console.log("External WebSocket closed");
    broadcast({ type: "error", message: "Connection closed! Trying to reconnect..." });
});

externalWs.on('error', (err) => {
    console.error("WebSocket error:", err);
    broadcast({ type: "error", message: "WebSocket error occurred!" });
});

// Function to send data to all connected frontend clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}