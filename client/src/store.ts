import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import {
  getCard,
  getPlayRequirement,
  type BoardCard,
  type Faction,
  type GameAction,
  type PlayerId,
  type RedactedGameState,
} from '@boloss/shared';
import { detectAttack, type AttackFx } from './lib/fx';

const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ||
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

export type Interaction =
  | { mode: 'idle' }
  /** Carte sans cible sélectionnée : il faut confirmer pour la jouer. */
  | { mode: 'confirm-play'; handInstanceId: string }
  | { mode: 'play-target'; handInstanceId: string }
  /** Cible du plateau choisie ; reste à désigner une carte de sa main (Envie). */
  | { mode: 'play-hand-target'; handInstanceId: string; boardTargetId: string }
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
  /**
   * Carte affichée en grand. `sticky` = ouverture volontaire (clic droit, clic,
   * appui long) : elle reste à l'écran jusqu'à fermeture explicite, alors qu'un
   * simple survol se referme dès que la souris s'éloigne.
   */
  inspect: { cardId: string; board?: BoardCard; sticky?: boolean } | null;
  /** Dernière attaque repérée entre deux états — sert à animer la charge. */
  lastAttack: AttackFx | null;

  connect: (roomId: string, name?: string) => void;
  disconnect: () => void;

  setFaction: (faction: Faction) => void;
  setCustomDeck: (ids: string[]) => void;
  setName: (name: string) => void;
  toggleReady: () => void;

  mulligan: (instanceIds: string[]) => void;
  chooseHero: (instanceId: string) => void;
  setupPlace: (instanceId: string) => void;
  setupUnplace: (instanceId: string) => void;
  setupReady: () => void;

  selectHandCard: (handInstanceId: string) => void;
  /** Valide la pose d'une carte sans cible (2e étape). */
  confirmPlay: () => void;
  selectAttacker: (attackerInstanceId: string) => void;
  chooseTarget: (targetInstanceId: string) => void;
  cancelInteraction: () => void;

  nextPhase: () => void;
  endTurn: () => void;

  setPointer: (x: number, y: number) => void;
  clearError: () => void;
  showInspect: (cardId: string, board?: BoardCard, sticky?: boolean) => void;
  /** Ferme le zoom. `force` ferme aussi un zoom épinglé. */
  hideInspect: (force?: boolean) => void;
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
  inspect: null,
  lastAttack: null,

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
      // Comparaison avec l'état précédent pour savoir quoi animer.
      const attack = detectAttack(get().game, game);
      set({ game, interaction: { mode: 'idle' }, ...(attack ? { lastAttack: attack } : {}) });
    });
  },

  disconnect: () => {
    const { socket } = get();
    socket?.disconnect();
    set({ socket: null, connected: false, game: null, you: null, interaction: { mode: 'idle' }, lastAttack: null });
  },

  setFaction: (faction) => get().socket?.emit('setFaction', { faction }),
  setCustomDeck: (ids) => get().socket?.emit('setCustomDeck', { ids }),
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

  mulligan: (instanceIds) => get().socket?.emit('action', { type: 'MULLIGAN', instanceIds } as GameAction),
  chooseHero: (instanceId) => get().socket?.emit('action', { type: 'CHOOSE_HERO', instanceId } as GameAction),
  setupPlace: (instanceId) => get().socket?.emit('action', { type: 'SETUP_PLACE', instanceId } as GameAction),
  setupUnplace: (instanceId) => get().socket?.emit('action', { type: 'SETUP_UNPLACE', instanceId } as GameAction),
  setupReady: () => get().socket?.emit('action', { type: 'SETUP_DONE' } as GameAction),

  selectHandCard: (handInstanceId) => {
    const { game, you, interaction, socket } = get();
    if (!game || !you) return;

    // Seconde désignation en cours : ce clic choisit la carte de la main.
    if (interaction.mode === 'play-hand-target') {
      if (handInstanceId === interaction.handInstanceId) {
        set({ interaction: { mode: 'idle' } });
        return;
      }
      socket?.emit('action', {
        type: 'PLAY_CARD',
        instanceId: interaction.handInstanceId,
        targetInstanceId: interaction.boardTargetId,
        handTargetInstanceId: handInstanceId,
      } as GameAction);
      set({ interaction: { mode: 'idle' } });
      return;
    }

    // 2e clic sur une carte déjà sélectionnée et sans cible : on joue.
    if (interaction.mode === 'confirm-play' && interaction.handInstanceId === handInstanceId) {
      socket?.emit('action', { type: 'PLAY_CARD', instanceId: handInstanceId } as GameAction);
      set({ interaction: { mode: 'idle' } });
      return;
    }
    // Re-clic sur une carte en attente de cible : on annule.
    if (interaction.mode === 'play-target' && interaction.handInstanceId === handInstanceId) {
      set({ interaction: { mode: 'idle' } });
      return;
    }

    const inst = game.players[you].hand.find((c) => c && c.instanceId === handInstanceId);
    if (!inst) return;
    const def = getCard(inst.cardId);
    const req = getPlayRequirement(def);
    if (req.needsTarget) {
      set({ interaction: { mode: 'play-target', handInstanceId } });
      return;
    }
    // Poser une invocation reste immédiat : c'est l'action courante, et une
    // erreur y est bénigne. En revanche un acte sans cible partait au premier
    // clic — un simple clic de curiosité suffisait à jouer Paresse ou Orgueil
    // et à bloquer son propre plateau. Ceux-là demandent une confirmation.
    if (def.type === 'INVOCATION') {
      socket?.emit('action', { type: 'PLAY_CARD', instanceId: handInstanceId } as GameAction);
      set({ interaction: { mode: 'idle' } });
      return;
    }
    set({ interaction: { mode: 'confirm-play', handInstanceId } });
  },

  confirmPlay: () => {
    const { interaction, socket } = get();
    if (interaction.mode !== 'confirm-play') return;
    socket?.emit('action', { type: 'PLAY_CARD', instanceId: interaction.handInstanceId } as GameAction);
    set({ interaction: { mode: 'idle' } });
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
    const { interaction, socket, game, you } = get();
    if (interaction.mode === 'play-target') {
      const inst = game && you ? game.players[you].hand.find((c) => c && c.instanceId === interaction.handInstanceId) : null;
      const def = inst ? getCard(inst.cardId) : null;
      // Envie demande une 2e désignation : quelle carte de la main prend la place.
      if (def && getPlayRequirement(def).handPick) {
        set({ interaction: { mode: 'play-hand-target', handInstanceId: interaction.handInstanceId, boardTargetId: targetInstanceId } });
        return;
      }
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
  showInspect: (cardId, board, sticky) => set({ inspect: { cardId, board, sticky } }),
  hideInspect: (force) =>
    set((s) => (s.inspect?.sticky && !force ? s : { inspect: null })),
}));
