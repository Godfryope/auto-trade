const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');

const app = express();
app.use(bodyParser.json());

// Initialize WebSocket connection to PumpPortal API
const ws = new WebSocket('wss://pumpportal.fun/api/data');

let tokens = [];

ws.on('open', () => {
    console.log('✅ Connected to PumpPortal WebSocket');
    ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    ws.send(JSON.stringify({ method: "subscribeRaydiumLiquidity" }));
});

ws.on('message', (data) => {
    try {
        const tokenData = JSON.parse(data);
        
        const pricePerToken = tokenData.vSolInBondingCurve / tokenData.vTokensInBondingCurve;
        const tokenMarketCap = tokenData.vTokensInBondingCurve * pricePerToken;

        console.log('📩 Raw Data Received:', tokenData, 'tokenMarketCap: ', tokenMarketCap);

        if (tokenMarketCap >= 300000) {
            const token = {
                name: tokenData.name,
                symbol: tokenData.symbol,
                tokenMarketCap: tokenMarketCap,
                uri: tokenData.uri,
                imageUri: tokenData.uri.image,
                mint: tokenData.mint
            };

            tokens.push(token);

            console.log('✅ Token added:', token);
        }
    } catch (error) {
        console.error('❌ Error parsing message:', error);
    }
});

ws.on('error', (error) => {
    console.error('🚨 WebSocket Error:', error);
});

ws.on('close', (code, reason) => {
    console.log(`❌ Connection closed: ${code} - ${reason}`);
});

app.get('/api/tokens', (req, res) => {
    res.json(tokens);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});