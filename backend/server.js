const express = require('express');
const cors = require('cors');
const http = require('http');

const { log } = require('./utils/logger');
const { config } = require('./config');
const { setupWebSocket } = require('./websocket');

const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const apiRoutes = require('./routes');

const app = express();
const server = http.createServer(app);

if (config.backend.ignoreTlsErrors) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log('warn', '⚠️ TLS désactivé (IGNORE_TLS_ERRORS=true)');
}

app.use(cors({ origin: config.backend.corsOrigin }));
app.use(express.json({ limit: config.backend.maxJsonSize }));
app.use(apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Start WebSocket server
const wss = setupWebSocket(server);

// Start test simulation if enabled
if (config.backend.useTestSim) {
  const { startTestSimulation } = require('./simulation');
  startTestSimulation(2000); // 2 sec intervalle
}

const port = config.backend.port || 3200;
server.listen(port, () => {
  log('info', `✅ Backend DroneWeb démarré sur http://localhost:${port}`);
});
