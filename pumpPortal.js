const WebSocket = require('ws');

const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', () => {
    console.log('✅ Connected to PumpPortal WebSocket');

    // Subscribe to new token events
    const payload = {
        method: "subscribeNewToken"
    };
    ws.send(JSON.stringify(payload));
});

ws.on('message', (data) => {
    try {
        const tokenData = JSON.parse(data);
        console.log('📩 Raw Data Received:', tokenData);

        // Ensure necessary fields exist
        if (tokenData.vTokensInBondingCurve && tokenData.vSolInBondingCurve) {
            const boundingCurvePercentage = (tokenData.vTokensInBondingCurve / 
                (tokenData.vTokensInBondingCurve + tokenData.vSolInBondingCurve)) * 100;

            console.log(`🔍 ${tokenData.name} (${tokenData.symbol}) - Bounding Curve: ${boundingCurvePercentage.toFixed(2)}%`);

            // Show only tokens at 98%+
            if (boundingCurvePercentage >= 98) {
                console.log('🔥 98%+ Bounding Curve Token:', {
                    name: tokenData.name,
                    symbol: tokenData.symbol,
                    boundingCurve: boundingCurvePercentage.toFixed(2),
                    marketCapSol: tokenData.marketCapSol,
                    uri: tokenData.uri
                });
            }
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
