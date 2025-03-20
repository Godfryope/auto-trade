import WebSocket from 'ws';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {
  // Subscribing to Raydium liquidity events
  const payload = {
    method: "subscribeNewToken",
  };
  ws.send(JSON.stringify(payload));
});

ws.on('message', function message(data) {
  const tokens = JSON.parse(data);
  io.emit('tokensDetected', tokens);
});

app.use(express.static('public'));

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});