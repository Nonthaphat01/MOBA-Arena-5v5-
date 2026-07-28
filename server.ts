import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const server = http.createServer(app);

// JSON body parser
app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Room State Management
interface PlayerInfo {
  id: string;
  ws: WebSocket;
  name: string;
  team: 'BLUE' | 'RED';
  characterId: number;
  isReady: boolean;
}

interface Room {
  code: string;
  players: PlayerInfo[];
  status: 'LOBBY' | 'PLAYING';
  createdTime: number;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function sendTo(ws: WebSocket, message: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(room: Room, message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  room.players.forEach((p) => {
    if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  });
}

function sanitizeRoomState(room: Room) {
  return {
    code: room.code,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      characterId: p.characterId,
      isReady: p.isReady,
    })),
  };
}

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (process.env.NODE_ENV !== 'production') {
    // Let Vite handle non-/ws upgrades if needed
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket) => {
  let playerId = 'p_' + Math.random().toString(36).substring(2, 9);
  let currentRoomCode: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, payload } = msg;

      if (type === 'CREATE_ROOM') {
        let code = generateRoomCode();
        while (rooms.has(code)) {
          code = generateRoomCode();
        }

        const newPlayer: PlayerInfo = {
          id: playerId,
          ws,
          name: payload?.name || 'Player 1',
          team: 'BLUE',
          characterId: payload?.characterId ?? 0,
          isReady: false,
        };

        const room: Room = {
          code,
          players: [newPlayer],
          status: 'LOBBY',
          createdTime: Date.now(),
        };

        rooms.set(code, room);
        currentRoomCode = code;

        sendTo(ws, {
          type: 'ROOM_CREATED',
          payload: {
            room: sanitizeRoomState(room),
            playerId,
            team: 'BLUE',
          },
        });
      } else if (type === 'JOIN_ROOM') {
        const code = (payload?.code || '').trim().toUpperCase();
        const room = rooms.get(code);

        if (!room) {
          sendTo(ws, { type: 'ERROR', payload: { message: 'Room code not found!' } });
          return;
        }

        if (room.players.length >= 2) {
          sendTo(ws, { type: 'ERROR', payload: { message: 'Room is full (1v1 Max 2 players)!' } });
          return;
        }

        const newPlayer: PlayerInfo = {
          id: playerId,
          ws,
          name: payload?.name || 'Player 2',
          team: room.players[0].team === 'BLUE' ? 'RED' : 'BLUE',
          characterId: payload?.characterId ?? 1,
          isReady: false,
        };

        room.players.push(newPlayer);
        currentRoomCode = code;

        sendTo(ws, {
          type: 'ROOM_JOINED',
          payload: {
            room: sanitizeRoomState(room),
            playerId,
            team: newPlayer.team,
          },
        });

        broadcastToRoom(room, {
          type: 'ROOM_UPDATED',
          payload: { room: sanitizeRoomState(room) },
        });
      } else if (type === 'SELECT_CHARACTER') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const p = room.players.find((player) => player.id === playerId);
        if (p) {
          p.characterId = payload.characterId;
          broadcastToRoom(room, {
            type: 'ROOM_UPDATED',
            payload: { room: sanitizeRoomState(room) },
          });
        }
      } else if (type === 'SET_READY') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const p = room.players.find((player) => player.id === playerId);
        if (p) {
          p.isReady = payload.isReady;
          broadcastToRoom(room, {
            type: 'ROOM_UPDATED',
            payload: { room: sanitizeRoomState(room) },
          });

          // If both players are ready, auto-start or notify host
          if (room.players.length === 2 && room.players.every((player) => player.isReady)) {
            room.status = 'PLAYING';
            broadcastToRoom(room, {
              type: 'GAME_STARTING',
              payload: { room: sanitizeRoomState(room) },
            });
          }
        }
      } else if (type === 'GAME_STATE_UPDATE') {
        // High-frequency position & combat state relay to opponent
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        broadcastToRoom(
          room,
          {
            type: 'REMOTE_PLAYER_UPDATE',
            payload: {
              senderId: playerId,
              state: payload,
            },
          },
          ws
        );
      } else if (type === 'GAME_EVENT') {
        // Attack, skill cast, damage, capture, kill events
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        broadcastToRoom(
          room,
          {
            type: 'REMOTE_GAME_EVENT',
            payload: {
              senderId: playerId,
              event: payload,
            },
          },
          ws
        );
      } else if (type === 'CHAT_MESSAGE') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: 'CHAT_MESSAGE',
          payload: {
            senderId: playerId,
            senderName: payload.name,
            text: payload.text,
            time: Date.now(),
          },
        });
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.players = room.players.filter((p) => p.id !== playerId);
        if (room.players.length === 0) {
          rooms.delete(currentRoomCode);
        } else {
          broadcastToRoom(room, {
            type: 'PLAYER_DISCONNECTED',
            payload: { playerId, room: sanitizeRoomState(room) },
          });
        }
      }
    }
  });
});

// Clean up stale empty rooms older than 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.players.length === 0 || now - room.createdTime > 3600000) {
      rooms.delete(code);
    }
  }
}, 60000);

// Vite middleware / Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
