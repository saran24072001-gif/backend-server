import { WebSocketServer, WebSocket } from 'ws';

let wss;

export const initWebSocket = (server) => {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    console.log('🔌 Client connected to WebSocket');

    ws.on('message', (message) => {
      console.log('📩 Received message from client:', message.toString());
    });

    ws.on('close', () => {
      console.log('🔌 Client disconnected from WebSocket');
    });

    ws.on('error', (error) => {
      console.error('⚠️ WebSocket error:', error);
    });
  });

  return wss;
};

export const broadcast = (data) => {
  if (!wss) {
    console.warn('⚠️ WebSocket server not initialized yet.');
    return;
  }

  const payload = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};
