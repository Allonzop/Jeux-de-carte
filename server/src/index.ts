import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { Server, type Socket } from 'socket.io';
import {
  applyAction,
  serializeFor,
  setCustomDeck,
  setFaction,
  setReady,
  type Faction,
  type GameAction,
} from '@boloss/shared';
import {
  getOrCreateRoom,
  getRoom,
  markDisconnected,
  occupiedSeats,
  reapIdleRooms,
  seatPlayer,
  type Room,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'boloss-server' }));

// Serve the built client in production (single-service deployment).
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/** Push each seated player their personalized (redacted) view of the room. */
function broadcast(room: Room): void {
  room.lastActivity = Date.now();
  for (const { playerId, seat } of occupiedSeats(room)) {
    seat.socket?.emit('state', serializeFor(room.state, playerId));
  }
}

interface SocketMeta {
  roomId: string;
  playerId: 'A' | 'B';
}
const meta = new WeakMap<Socket, SocketMeta>();

io.on('connection', (socket: Socket) => {
  socket.on('join', (payload: { roomId?: string; token?: string; name?: string }) => {
    const roomId = (payload?.roomId ?? '').trim();
    if (!roomId) {
      socket.emit('joinError', { error: 'Identifiant de partie manquant.' });
      return;
    }
    const room = getOrCreateRoom(roomId);
    const assignment = seatPlayer(room, socket, payload?.token);
    if (!assignment) {
      socket.emit('joinError', { error: 'Cette partie est déjà complète (2 joueurs).' });
      return;
    }
    meta.set(socket, { roomId, playerId: assignment.playerId });
    socket.join(roomId);
    if (payload?.name) room.state.players[assignment.playerId].name = payload.name.slice(0, 24);

    socket.emit('joined', {
      playerId: assignment.playerId,
      token: assignment.token,
      reconnected: assignment.reconnected,
    });
    broadcast(room);
  });

  socket.on('setFaction', (payload: { faction: Faction }) => {
    const m = meta.get(socket);
    if (!m) return;
    const room = getRoom(m.roomId);
    if (!room) return;
    const res = setFaction(room.state, m.playerId, payload.faction);
    if (!res.ok) socket.emit('actionError', { error: res.error });
    broadcast(room);
  });

  socket.on('setCustomDeck', (payload: { ids: string[] }) => {
    const m = meta.get(socket);
    if (!m) return;
    const room = getRoom(m.roomId);
    if (!room) return;
    const res = setCustomDeck(room.state, m.playerId, payload?.ids ?? []);
    if (!res.ok) socket.emit('actionError', { error: res.error });
    broadcast(room);
  });

  socket.on('setName', (payload: { name: string }) => {
    const m = meta.get(socket);
    if (!m) return;
    const room = getRoom(m.roomId);
    if (!room) return;
    room.state.players[m.playerId].name = (payload?.name ?? '').slice(0, 24) || room.state.players[m.playerId].name;
    broadcast(room);
  });

  socket.on('ready', (payload: { ready: boolean }) => {
    const m = meta.get(socket);
    if (!m) return;
    const room = getRoom(m.roomId);
    if (!room) return;
    const res = setReady(room.state, m.playerId, !!payload?.ready);
    if (!res.ok) socket.emit('actionError', { error: res.error });
    broadcast(room);
  });

  socket.on('action', (action: GameAction) => {
    const m = meta.get(socket);
    if (!m) return;
    const room = getRoom(m.roomId);
    if (!room) return;
    const res = applyAction(room.state, m.playerId, action);
    if (!res.ok) socket.emit('actionError', { error: res.error });
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const m = meta.get(socket);
    if (!m) return;
    const room = getRoom(m.roomId);
    if (!room) return;
    markDisconnected(room, socket);
    broadcast(room);
  });
});

setInterval(() => reapIdleRooms(), 1000 * 60 * 10).unref();

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🃏 BOLOSS server listening on http://localhost:${PORT}`);
});
