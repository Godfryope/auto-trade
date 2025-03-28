// npm install ws
import WebSocket from 'ws';
 
(async function () {
    // Connect
    const ws = new WebSocket('wss://api.solanastreaming.com/', undefined,
        {
            headers: {
                'X-API-KEY': 'bfda16ff9287f3ddc9c48ad89428619a'
            }
        }
    );
    ws.on('error', console.error);
    ws.on('open', () => {
        // Start the pair / price stream
        ws.send('{"id":1,"method":"newPairSubscribe"}');
    });
    ws.on('message', (data) => {
        // Continuously read pairs / prices
        console.log('received: %s', data);
    });
})();