import http from 'http'; // Import HTTP module
import express from 'express'; // Import Express module
import { WebSocketServer } from 'ws'; // Import WebSocketServer from 'ws'
import WebSocket from 'ws'; // Import WebSocket from 'ws'
import fetch from 'node-fetch'; // Import node-fetch for HTTP requests

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

externalWs.on("message", async (data) => {
    try {
        const parsedData = JSON.parse(data);

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
            marketCap: marketCap > 0 ? `$${marketCap.toLocaleString()}` : "N/A",
            price: price > 0 ? `$${price.toFixed(8)}` : "N/A",
            bondingCurve: Math.trunc(parsedData.vSolInBondingCurve), // Convert to integer
            image: imageUrl || "../assets/images/faces/1.jpg", // Default image if not found
        };

        // Broadcast formatted token data to frontend
        broadcast({ type: "newToken", data: tokenData });

        // Check wallet balance before attempting to buy the token
        const walletBalanceResponse = await fetch("https://pumpportal.fun/api/wallet/balance?api-key=9n5megbk5wqpyrak6dw6wyk66586aykb8x8kedae61344jtb899p6v3md9rkjd9p6dhnjjub8n76yn2f5xq4rdtfb1gkexbndxqjyta5a1p6muuub4w6pwjjd147ervu8t438hkmewykuf5um6eaa94npggb35xp6yn9pd49rwncavrb58k8dbqddgm2t3ga1hmamk18h0kuf8");
        if (walletBalanceResponse.headers.get("content-type")?.includes("application/json")) {
            const walletBalanceData = await walletBalanceResponse.json();
        } else {
            console.error("Invalid response format for wallet balance");
            broadcast({ type: "error", message: "Invalid wallet balance response format!" });
            return;
        }

        if (walletBalanceData.balance >= 0.01) {
            // Attempt to buy the token immediately
            const buyResponse = await fetch("https://pumpportal.fun/api/trade?api-key=9n5megbk5wqpyrak6dw6wyk66586aykb8x8kedae61344jtb899p6v3md9rkjd9p6dhnjjub8n76yn2f5xq4rdtfb1gkexbndxqjyta5a1p6muuub4w6pwjjd147ervu8t438hkmewykuf5um6eaa94npggb35xp6yn9pd49rwncavrb58k8dbqddgm2t3ga1hmamk18h0kuf8", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "action": "buy",            // "buy" or "sell"
                    "mint": parsedData.mint,    // contract address of the token you want to trade
                    "amount": 0.01,             // amount of SOL or tokens to trade
                    "denominatedInSol": "true", // "true" if amount is SOL, "false" if amount is tokens
                    "slippage": 10,             // percent slippage allowed
                    "priorityFee": 0.00005,     // amount to use as Jito tip or priority fee
                    "pool": "pump"              // exchange to trade on. "pump", "raydium", "pump-amm" or "auto"
                })
            });
            const tradeData = await buyResponse.json();

            // Handle the trade response
            if (tradeData.error) {
                console.error("Error executing trade:", tradeData.error);
                broadcast({ type: "error", message: "Failed to execute trade!" });
            } else {
                console.log("Trade executed successfully:", tradeData);
                broadcast({ type: "tradeSuccess", data: tradeData });
            }
        } else {
            console.error("Insufficient wallet balance to execute trade.");
            broadcast({ type: "error", message: "Insufficient wallet balance!" });
        }
        const tradeData = await buyResponse.json();

        // Handle the trade response
        if (tradeData.error) {
            console.error("Error executing trade:", tradeData.error);
            broadcast({ type: "error", message: "Failed to execute trade!" });
        } else {
            console.log("Trade executed successfully:", tradeData);
            broadcast({ type: "tradeSuccess", data: tradeData });
        }

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