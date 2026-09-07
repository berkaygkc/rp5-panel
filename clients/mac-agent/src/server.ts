import { WebSocketServer, WebSocket } from "ws";
import type { ClientCommand, ServerMessage, WireMediaState } from "./protocol.js";

const VALID_COMMANDS = new Set([
  "togglePlay",
  "next",
  "prev",
  "seekTo",
  "setVolume",
  "run",
  "claudeSubscribe",
  "claudeFeed",
  "mailSubscribe",
]);

export interface Client {
  id: number;
  ws: WebSocket;
  /** Claude Code oturum listesine abone mi */
  claude: boolean;
  /** Posta kutusuna abone mi */
  mail: boolean;
}

export function createServer(
  port: number,
  getState: () => WireMediaState | null,
  handlers: {
    onConnect?: (reply: (msg: ServerMessage) => void) => void;
    onCommand: (cmd: ClientCommand, client: Client, reply: (msg: ServerMessage) => void) => void;
    onClose: (client: Client) => void;
  }
) {
  const wss = new WebSocketServer({ port, host: "0.0.0.0" });
  const clients = new Set<Client>();
  let seq = 0;

  const sendTo = (ws: WebSocket, msg: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  wss.on("connection", (ws, req) => {
    const client: Client = { id: ++seq, ws, claude: false, mail: false };
    clients.add(client);
    console.log(`[ws] bağlandı: ${req.socket.remoteAddress}`);

    const state = getState();
    if (state) sendTo(ws, { type: "state", state });

    const reply = (msg: ServerMessage) => sendTo(ws, msg);
    handlers.onConnect?.(reply);

    ws.on("message", (data) => {
      try {
        const cmd = JSON.parse(String(data)) as ClientCommand;
        if (!VALID_COMMANDS.has(cmd.type)) return;
        handlers.onCommand(cmd, client, reply);
      } catch {
        /* bozuk mesajı yok say */
      }
    });

    ws.on("close", () => {
      clients.delete(client);
      handlers.onClose(client);
    });
  });

  return {
    broadcast(state: WireMediaState) {
      for (const c of clients) sendTo(c.ws, { type: "state", state });
    },
    broadcastAll(msg: ServerMessage) {
      for (const c of clients) sendTo(c.ws, msg);
    },
    broadcastClaude(msg: ServerMessage) {
      for (const c of clients) if (c.claude) sendTo(c.ws, msg);
    },
    broadcastMail(msg: ServerMessage) {
      for (const c of clients) if (c.mail) sendTo(c.ws, msg);
    },
    hasMailSubscribers: () => [...clients].some((c) => c.mail),
    hasClaudeSubscribers: () => [...clients].some((c) => c.claude),
    clientCount: () => clients.size,
  };
}
