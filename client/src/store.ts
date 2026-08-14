import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import {
  getCard,
  getPlayRequirement,
  type Faction,
  type GameAction,
  type PlayerId,
  type RedactedGameState,
} from '@boloss/shared';

const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ||
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

export type Interaction =
  | { mode: 'idle' }
  | { mode: 'play-target'; handInstanceId: string }
  | { mode: 'attack'; attackerInstanceId: string };

interface StoreState {
  socket: Socket | null;
  roomId: string | null;
  you: PlayerId | null;
  connected: boolean;
  game: RedactedGameState | null;
  error: string | null;
  interaction: Interaction;
  pointer: { x: number; y: number };

  connect: (roomId: string, name?: string) => void;
  disconnect: () => void;

  setFaction: (faction: Faction) => void;
  setName: (name: string) => void;
  toggleReady: () => void;

  setupPlace: (instanceId: string) => void;
  setupUnplace: (instanceId: string) => void;
  setupReady: () => void;

  selectHandCard: (handInstanceId: string) => void;
  selectAttacker: (attackerInstanceId: string) => void;
  chooseTarget: (targetInstanceId: string) => void;
  cancelInteraction: () => void;

  nextPhase: () => void;
  endTurn: () => void;

  setPointer: (x: number, y: number) => void;
  clearError: () => void;
}

function tokenKey(roomId: string) {
  return `boloss:token:${roomId}`;
}

export const useStore = create<StoreState>((set, get) => ({
  socket: null,
  roomId: null,
  you: null,
  connected: false,
  game: null,
  error: null,
  interaction: { mode: 'idle' },
  pointer: { x: 0, y: 0 },

  connect: (roomId, name) => {
    if (get().socket) return;
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    set({ socket, roomId });

    socket.on('connect', () => {
      set({ connected: true });
      const token = localStorage.getItem(tokenKey(roomId)) ?? undefined;
      const storedName = name || localStorage.getItem('boloss:name') || undefined;
      socket.emit('join', { roomId, token, name: storedName });
    });

    socket.on('disconnect', () => set({ connected: false }));

    socket.on('joined', (payload: { playerId: PlayerId; token: string }) => {
      localStorage.setItem(tokenKey(roomId), payload.token);
      set({ you: payload.playerId });
    });

    socket.on('joinError', (payload: { error: string }) => set({ error: payload.error }));
    socket.on('actionError', (payload: { error: string }) => set({ error: payload.error }));

    socket.on('state', (game: RedactedGameState) => {
      set({ game, interaction: { mode: 'idle' } });
    });
  },

  disconnect: () => {
    const { socket } = get();
    socket?.disconnect();
    set({ socket: null, connected: false, game: null, you: null, interaction: { mode: 'idle' } });
  },

  setFaction: (faction) => get().socket?.emit('setFaction', { faction }),
  setName: (name) => {
    localStorage.setItem('boloss:name', name);
    get().socket?.emit('setName', { name });
  },
  toggleReady: () => {
    const g = get().game;
    const you = get().you;
    if (!g || !you) return;
    get().socket?.emit('ready', { ready: !g.players[you].ready });
  },

  setupPlace: (instanceId) => get().socket?.emit('action', { type: 'SETUP_PLACE', instanceId } as GameAction),
  setupUnplace: (instanceId) => get().socket?.emit('action', { type: 'SETUP_UNPLACE', instanceId } as GameAction),
  setupReady: () => get().socket?.emit('action', { type: 'SETUP_DONE' } as GameAction),

  selectHandCard: (handInstanceId) => {
    const { game, you, interaction, socket } = get();
    if (!game || !you) return;
    // Toggle off if re-selecting the same card.
    if (interaction.mode === 'play-target' && interaction.handInstanceId === handInstanceId) {
      set({ interaction: { mode: 'idle' } });
      return;
    }
    const inst = game.players[you].hand.find((c) => c && c.instanceId === handInstanceId);
    if (!inst) return;
    const def = getCard(inst.cardId);
    const req = getPlayRequirement(def);
    if (!req.needsTarget) {
      const action: GameAction = { type: 'PLAY_CARD', instanceId: handInstanceId };
      socket?.emit('action', action);
      set({ interaction: { mode: 'idle' } });
    } else {
      set({ interaction: { mode: 'play-target', handInstanceId } });
    }
  },

  selectAttacker: (attackerInstanceId) => {
    const { interaction } = get();
    if (interaction.mode === 'attack' && interaction.attackerInstanceId === attackerInstanceId) {
      set({ interaction: { mode: 'idle' } });
      return;
    }
    set({ interaction: { mode: 'attack', attackerInstanceId } });
  },

  chooseTarget: (targetInstanceId) => {
    const { interaction, socket } = get();
    if (interaction.mode === 'play-target') {
      const action: GameAction = { type: 'PLAY_CARD', instanceId: interaction.handInstanceId, targetInstanceId };
      socket?.emit('action', action);
    } else if (interaction.mode === 'attack') {
      const action: GameAction = { type: 'ATTACK', attackerInstanceId: interaction.attackerInstanceId, targetInstanceId };
      socket?.emit('action', action);
    }
    set({ interaction: { mode: 'idle' } });
  },

  cancelInteraction: () => set({ interaction: { mode: 'idle' } }),

  nextPhase: () => get().socket?.emit('action', { type: 'NEXT_PHASE' } as GameAction),
  endTurn: () => get().socket?.emit('action', { type: 'END_TURN' } as GameAction),

  setPointer: (x, y) => set({ pointer: { x, y } }),
  clearError: () => set({ error: null }),
}));
