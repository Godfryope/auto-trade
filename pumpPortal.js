import WebSocket from 'ws';

const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {

  // Subscribing to Raydium liquidity events
  const payload = {
      method: "subscribeRaydiumLiquidity",
    }
  ws.send(JSON.stringify(payload));
});

ws.on('message', function message(data) {
  console.log(JSON.parse(data));
});