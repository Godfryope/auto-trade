const socket = io();

socket.on('tokensDetected', function (token) {
  console.log('Received token:', token);
  
  if (typeof token !== 'object') {
    console.error('Expected token to be an object, but got:', token);
    return;
  }

  const tokenList = document.getElementById('tokenList');

  const tokenElement = document.createElement('div');
  tokenElement.className = 'token';
  tokenElement.innerText = token.mint; // Displaying mint as the identifier
  tokenElement.addEventListener('click', () => showChart(token.mint));
  tokenList.appendChild(tokenElement);
});

function showChart(symbol) {
  document.getElementById('tokenList').style.display = 'none';
  document.getElementById('chartContainer').style.display = 'block';

  new TradingView.widget({
    "autosize": true,
    "symbol": `BINANCE:${symbol}`,
    "interval": "240",
    "timezone": "Etc/Utc",
    "theme": "dark",
    "style": "1",
    "locale": "en",
    "toolbar-bg": "f1f3f6",
    "enable_publishing": true,
    "withdateranges": false,
    "hide_side_toolbar": true,
    "allow_symbol_change": true,
    "details": true,
    "hotlist": true,
    "calendar": true,
    "studies": [
      "STD;SMA"
    ],
    "container_id": "chart",
    "show-popup_button": true,
    "popup_width": "1000",
    "popup_height": "650"
  });
}