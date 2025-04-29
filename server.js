const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app); 

const wss = new WebSocket.Server({ server });
app.use(express.static(path.join(__dirname, "public")));

const clients = new Map();
const activeCalls = new Map();

wss.on("connection", (ws) => {
  let clientName = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "register") {
        clientName = data.name;
        clients.set(clientName, ws);
        broadcastClients();
      }

      if (data.type === "offer") {
        if (activeCalls.has(data.target)) {
          const oldCaller = activeCalls.get(data.target);
          if (clients.has(oldCaller)) {
            clients.get(oldCaller).send(JSON.stringify({ type: "endCall" }));
          }
        }
        activeCalls.set(data.target, data.sender);
        activeCalls.set(data.sender, data.target);
        forwardMessage(data);
      }

      if (["answer", "candidate"].includes(data.type)) {
        forwardMessage(data);
      }

      if (data.type === "endCall") {
        endCall(data.sender);
      }
    } catch (err) {
      console.error("Lỗi xử lý tin nhắn:", err);
    }
  });

  ws.on("close", () => {
    if (clientName) {
      endCall(clientName);
      clients.delete(clientName);
      broadcastClients();
    }
  });
});

function broadcastClients() {
  const clientList = Array.from(clients.keys());
  clients.forEach((ws) => {
    ws.send(JSON.stringify({ type: "clientList", clients: clientList }));
  });
}

function forwardMessage(data) {
  const target = clients.get(data.target);
  if (target && target.readyState === WebSocket.OPEN) {
    target.send(JSON.stringify(data));
  }
}

function endCall(client) {
  const partner = activeCalls.get(client);
  if (partner) {
    activeCalls.delete(client);
    activeCalls.delete(partner);
    forwardMessage({ type: "endCall", target: partner });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
