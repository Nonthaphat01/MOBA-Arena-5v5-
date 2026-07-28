import {
  ref,
  set,
  get,
  update,
  onValue,
  onChildAdded,
  off,
  onDisconnect,
  push,
} from 'firebase/database';
import { rtdb } from './firebase';
import { RoomState, PlayerInfo } from '../types';

export type MultiplayerCallback = {
  onRoomCreated?: (room: RoomState, playerId: string, team: 'BLUE' | 'RED') => void;
  onRoomJoined?: (room: RoomState, playerId: string, team: 'BLUE' | 'RED') => void;
  onRoomUpdated?: (room: RoomState) => void;
  onGameStarting?: (room: RoomState) => void;
  onRemotePlayerUpdate?: (senderId: string, state: any) => void;
  onRemoteGameEvent?: (senderId: string, event: any) => void;
  onChatMessage?: (senderName: string, text: string) => void;
  onError?: (message: string) => void;
  onDisconnect?: () => void;
};

export class MultiplayerClient {
  public playerId: string | null = null;
  public roomCode: string | null = null;
  public roomState: RoomState | null = null;
  public team: 'BLUE' | 'RED' = 'BLUE';
  public callbacks: MultiplayerCallback = {};

  private roomUnsubscribe: (() => void) | null = null;
  private statesUnsubscribe: (() => void) | null = null;
  private eventsUnsubscribe: (() => void) | null = null;
  private chatUnsubscribe: (() => void) | null = null;
  private processedEventKeys = new Set<string>();

  constructor(callbacks: MultiplayerCallback = {}) {
    this.callbacks = callbacks;
  }

  public async connect(): Promise<void> {
    // Firebase Realtime Database connects automatically upon reference usage
    return Promise.resolve();
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public async createRoom(playerName: string, characterId: number) {
    try {
      const code = this.generateCode();
      const playerId = 'p_' + Math.random().toString(36).substr(2, 8);

      this.playerId = playerId;
      this.roomCode = code;
      this.team = 'BLUE';

      const playerObj: PlayerInfo = {
        id: playerId,
        name: playerName || 'Player 1',
        team: 'BLUE',
        characterId,
        isHost: true,
        isReady: false,
      };

      const roomData = {
        code,
        status: 'LOBBY',
        players: {
          [playerId]: playerObj,
        },
      };

      const roomRef = ref(rtdb, `moba_rooms/${code}`);
      await set(roomRef, roomData);

      // Setup disconnect handler for host
      const playerRef = ref(rtdb, `moba_rooms/${code}/players/${playerId}`);
      onDisconnect(playerRef).remove();

      this.listenToRoom(code);

      const initialRoomState: RoomState = {
        code,
        status: 'LOBBY',
        players: [playerObj],
      };
      this.roomState = initialRoomState;
      this.callbacks.onRoomCreated?.(initialRoomState, playerId, 'BLUE');
    } catch (err: any) {
      console.error('Create room error:', err);
      this.callbacks.onError?.('Failed to create room in Firebase Realtime Database.');
    }
  }

  public async joinRoom(roomCodeInput: string, playerName: string, characterId: number) {
    try {
      const code = roomCodeInput.trim().toUpperCase();
      if (!code || code.length !== 4) {
        this.callbacks.onError?.('Please enter a valid 4-character room code.');
        return;
      }

      const roomRef = ref(rtdb, `moba_rooms/${code}`);
      const snapshot = await get(roomRef);

      if (!snapshot.exists()) {
        this.callbacks.onError?.(`Room "${code}" not found! Please check the code.`);
        return;
      }

      const rawRoom = snapshot.val();
      const rawPlayers = rawRoom.players ? Object.values(rawRoom.players) as PlayerInfo[] : [];

      if (rawPlayers.length >= 2) {
        this.callbacks.onError?.(`Room "${code}" is already full (2/2 players).`);
        return;
      }

      const playerId = 'p_' + Math.random().toString(36).substr(2, 8);
      this.playerId = playerId;
      this.roomCode = code;
      this.team = 'RED';

      const playerObj: PlayerInfo = {
        id: playerId,
        name: playerName || 'Player 2',
        team: 'RED',
        characterId,
        isHost: false,
        isReady: false,
      };

      // Add player to Firebase RTDB
      const playerRef = ref(rtdb, `moba_rooms/${code}/players/${playerId}`);
      await set(playerRef, playerObj);
      onDisconnect(playerRef).remove();

      this.listenToRoom(code);

      const updatedPlayers = [...rawPlayers, playerObj];
      const joinedRoomState: RoomState = {
        code,
        status: rawRoom.status || 'LOBBY',
        players: updatedPlayers,
      };
      this.roomState = joinedRoomState;
      this.callbacks.onRoomJoined?.(joinedRoomState, playerId, 'RED');
    } catch (err: any) {
      console.error('Join room error:', err);
      this.callbacks.onError?.('Failed to join room via Firebase Realtime Database.');
    }
  }

  private listenToRoom(code: string) {
    this.cleanupListeners();

    // 1. Listen to Room State & Players
    const roomRef = ref(rtdb, `moba_rooms/${code}`);
    this.roomUnsubscribe = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.callbacks.onError?.('Room was closed or deleted.');
        this.callbacks.onDisconnect?.();
        return;
      }

      const data = snapshot.val();
      const playersList: PlayerInfo[] = data.players ? Object.values(data.players) : [];

      const prevStatus = this.roomState?.status;
      const newStatus = data.status || 'LOBBY';

      const updatedRoomState: RoomState = {
        code,
        status: newStatus,
        players: playersList,
      };

      this.roomState = updatedRoomState;
      this.callbacks.onRoomUpdated?.(updatedRoomState);

      // Check for Game Start
      if (prevStatus === 'LOBBY' && newStatus === 'PLAYING') {
        this.callbacks.onGameStarting?.(updatedRoomState);
      }

      // Auto-start when both players are ready (Host handles transition)
      const myPlayer = playersList.find((p) => p.id === this.playerId);
      if (myPlayer?.isHost && newStatus === 'LOBBY' && playersList.length === 2 && playersList.every((p) => p.isReady)) {
        update(ref(rtdb, `moba_rooms/${code}`), { status: 'PLAYING' });
      }
    });

    // 2. Listen to Remote Player Positional State Updates
    const statesRef = ref(rtdb, `moba_rooms/${code}/states`);
    this.statesUnsubscribe = onValue(statesRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const states = snapshot.val();
      for (const pId in states) {
        if (pId !== this.playerId) {
          this.callbacks.onRemotePlayerUpdate?.(pId, states[pId]);
        }
      }
    });

    // 3. Listen to Game Events (Attacks, Damage, Spells)
    const eventsRef = ref(rtdb, `moba_rooms/${code}/events`);
    this.eventsUnsubscribe = onChildAdded(eventsRef, (snapshot) => {
      const key = snapshot.key;
      if (key && this.processedEventKeys.has(key)) return;
      if (key) this.processedEventKeys.add(key);

      const val = snapshot.val();
      if (val && val.senderId !== this.playerId) {
        this.callbacks.onRemoteGameEvent?.(val.senderId, val.event);
      }
    });

    // 4. Listen to Chat
    const chatRef = ref(rtdb, `moba_rooms/${code}/chat`);
    this.chatUnsubscribe = onChildAdded(chatRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        this.callbacks.onChatMessage?.(val.senderName, val.text);
      }
    });
  }

  public async selectCharacter(characterId: number) {
    if (!this.roomCode || !this.playerId) return;
    try {
      await update(ref(rtdb, `moba_rooms/${this.roomCode}/players/${this.playerId}`), {
        characterId,
      });
    } catch (e) {
      console.error('Select character error:', e);
    }
  }

  public async setReady(isReady: boolean) {
    if (!this.roomCode || !this.playerId) return;
    try {
      await update(ref(rtdb, `moba_rooms/${this.roomCode}/players/${this.playerId}`), {
        isReady,
      });
    } catch (e) {
      console.error('Set ready error:', e);
    }
  }

  public sendStateUpdate(state: any) {
    if (!this.roomCode || !this.playerId) return;
    try {
      set(ref(rtdb, `moba_rooms/${this.roomCode}/states/${this.playerId}`), state);
    } catch (e) {
      // Throttle or ignore intermittent errors
    }
  }

  public sendGameEvent(event: any) {
    if (!this.roomCode || !this.playerId) return;
    try {
      const eventsRef = ref(rtdb, `moba_rooms/${this.roomCode}/events`);
      push(eventsRef, {
        senderId: this.playerId,
        event,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('Send event error:', e);
    }
  }

  public sendChatMessage(name: string, text: string) {
    if (!this.roomCode) return;
    try {
      const chatRef = ref(rtdb, `moba_rooms/${this.roomCode}/chat`);
      push(chatRef, {
        senderName: name,
        text,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('Send chat error:', e);
    }
  }

  public cleanupListeners() {
    if (this.roomCode) {
      if (this.roomUnsubscribe) off(ref(rtdb, `moba_rooms/${this.roomCode}`));
      if (this.statesUnsubscribe) off(ref(rtdb, `moba_rooms/${this.roomCode}/states`));
      if (this.eventsUnsubscribe) off(ref(rtdb, `moba_rooms/${this.roomCode}/events`));
      if (this.chatUnsubscribe) off(ref(rtdb, `moba_rooms/${this.roomCode}/chat`));
    }
    this.roomUnsubscribe = null;
    this.statesUnsubscribe = null;
    this.eventsUnsubscribe = null;
    this.chatUnsubscribe = null;
  }

  public disconnect() {
    this.cleanupListeners();
    this.roomCode = null;
    this.playerId = null;
    this.roomState = null;
  }
}
