import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';
import { createGame, type GameState, type PlayerId } from '@boloss/shared';

export interface Seat {
  token: string;
  socket: Socket | null;
}

export interface Room {
  id: string;
  state: GameState;
  seats: Partial<Record<PlayerId, Seat>>;
  lastActivity: number;
}

const rooms = new Map<string, Room>();

export function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = { id: roomId, state: createGame(roomId), seats: {}, lastActivity: Date.now() };
    rooms.set(roomId, room);
  }
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

const SEAT_ORDER: PlayerId[] = ['A', 'B'];

export interface SeatAssignment {
  playerId: PlayerId;
  token: string;
  reconnected: boolean;
}

/**
 * Seat a socket in a room.
 *  - If a valid token is provided, reclaim that seat (reconnection).
 *  - Otherwise take the first free seat.
 *  - Returns null when the room is full and no matching token was given.
 */
export function seatPlayer(room: Room, socket: Socket, token?: string): SeatAssignment | null {
  // Reconnection by token.
  if (token) {
    for (const pid of SEAT_ORDER) {
      const seat = room.seats[pid];
      if (seat && seat.token === token) {
        seat.socket = socket;
        room.state.players[pid].connected = true;
        return { playerId: pid, token, reconnected: true };
      }
    }
  }
  // New seat.
  for (const pid of SEAT_ORDER) {
    if (!room.seats[pid]) {
      const newToken = randomUUID();
      room.seats[pid] = { token: newToken, socket };
      room.state.players[pid].connected = true;
      return { playerId: pid, token: newToken, reconnected: false };
    }
  }
  return null; // full
}

export function markDisconnected(room: Room, socket: Socket): PlayerId | null {
  for (const pid of SEAT_ORDER) {
    const seat = room.seats[pid];
    if (seat && seat.socket === socket) {
      seat.socket = null;
      room.state.players[pid].connected = false;
      return pid;
    }
  }
  return null;
}

export function occupiedSeats(room: Room): { playerId: PlayerId; seat: Seat }[] {
  const out: { playerId: PlayerId; seat: Seat }[] = [];
  for (const pid of SEAT_ORDER) {
    const seat = room.seats[pid];
    if (seat) out.push({ playerId: pid, seat });
  }
  return out;
}

/** Periodically drop idle, empty rooms so a long-lived process does not leak memory. */
export function reapIdleRooms(maxIdleMs = 1000 * 60 * 60): void {
  const now = Date.now();
  for (const [id, room] of rooms) {
    const anyConnected = occupiedSeats(room).some((s) => s.seat.socket);
    if (!anyConnected && now - room.lastActivity > maxIdleMs) rooms.delete(id);
  }
}
