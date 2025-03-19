const WebSocket = require('ws');

// Create a WebSocket connection
const WS_URL = 'wss://mainnet.helius-rpc.com/?api-key=8be6e198-1cfb-42c8-96c7-c646aae149c9';

// Function to send a request to the WebSocket server
function sendRequest(ws) {
    const request = {
        jsonrpc: "2.0",
        id: 420,
        method: "transactionSubscribe",
        params: [
            {   failed: false,
                accountInclude:    ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"]
            },
            {
                commitment: "confirmed",
                encoding: "jsonParsed",
                transactionDetails: "full",
                maxSupportedTransactionVersion: 0
            }
        ]
    };
    ws.send(JSON.stringify(request));
}

ws.on('open', function open() {
    console.log('WebSocket is open');
    sendRequest(ws);  // Send a request once the WebSocket is open
});

ws.on('message', async function incoming(data) {
    const messageStr = data.toString('utf8');
    try {
        const messageObj = JSON.parse(messageStr);

        const result = messageObj.params.result;
        const logs = result.transaction.meta.logMessages;
        const signature = result.signature; // Extract the signature
        const accountKeys = result.transaction.transaction.message.accountKeys.map(ak => ak.pubkey); // Extract only pubkeys

        if (logs && logs.some(log => log.includes("initialize2: InitializeInstruction2"))) {
            // Log the signature, and the public keys of the AMM ID
            console.log('Transaction signature:', signature);
            console.log('AMM ID:', accountKeys[2]); // Corrected to the third account for AMM ID
        }
    } catch (e) {
        
    }
});

ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
});

ws.on('close', function close() {
    console.log('WebSocket is closed');
});









// WebSocket URL with API key

// Function to connect WebSocket
function connectWebSocket() {
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('✅ WebSocket connected');
        sendRequest(ws);
    });

    ws.on('message', (data) => {
        try {
            const messageStr = data.toString('utf8');
            // console.log('📩 Full WebSocket Response:', messageStr);

            const messageObj = JSON.parse(messageStr);
            if (messageObj.error) {
                console.error('❌ WebSocket Error:', messageObj.error.message);
                return;
            }

            const result = messageObj?.params?.result;
            if (!result) {
                console.log('⚠️ No result in response');
                return;
            }

            // Logs from the transaction
            const logs = result?.value?.logs || [];
            const signature = result?.value?.signature || 'N/A';
            const accountKeys = result?.value?.accounts || [];

            // console.log('🔍 Logs:', logs);

            
            
            if (logs.some(log => log.includes('Instruction:'))) {
                // console.log('🔍 Detected Instructions in Logs:', logs.filter(log => log.includes('Instruction:')));
            }   
             
            if (logs.some(log => log.includes('Program log: Instruction: InitializeMint2'))) {
                console.log('\n🚀 New Pump.Fun Token Detected!');
                console.log('🔗 Transaction:', `https://solscan.io/tx/${signature}`);
                console.log('👤 Creator:', accountKeys[0] || 'N/A');
                console.log('💰 Token:', accountKeys[1] || 'N/A');
            }        
        } catch (e) {
            console.error('❌ Error processing WebSocket message:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('🔁 WebSocket closed, reconnecting...');
        setTimeout(connectWebSocket, 5000);
    });

    ws.on('error', (err) => console.error('❌ WebSocket error:', err.message));
}

// Function to send subscription request using `logsSubscribe`
function sendRequest(ws) {
    const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "logsSubscribe",
        params: [
            { mentions: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"] }, // Corrected parameter
            { commitment: "confirmed" }
        ]
    };
    console.log('📤 Sending Subscription Request:', JSON.stringify(request, null, 2));
    ws.send(JSON.stringify(request));
}

// Start WebSocket connection
connectWebSocket();
