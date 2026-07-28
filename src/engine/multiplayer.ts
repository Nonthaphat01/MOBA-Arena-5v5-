import { RoomState } from '../types';

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
  private ws: WebSocket | null = null;
  public playerId: string | null = null;
  public roomState: RoomState | null = null;
  public team: 'BLUE' | 'RED' = 'BLUE';
  public callbacks: MultiplayerCallback = {};

  constructor(callbacks: MultiplayerCallback = {}) {
    this.callbacks = callbacks;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ Connected to Multiplayer WebSocket Server');
        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('❌ WebSocket Connection Error:', err);
        if (this.callbacks.onError) {
          this.callbacks.onError('Failed to connect to multiplayer server.');
        }
        reject(err);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket Disconnected');
        if (this.callbacks.onDisconnect) {
          this.callbacks.onDisconnect();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { type, payload } = msg;

          switch (type) {
            case 'ROOM_CREATED':
              this.playerId = payload.playerId;
              this.team = payload.team;
              this.roomState = payload.room;
              this.callbacks.onRoomCreated?.(payload.room, payload.playerId, payload.team);
              break;

            case 'ROOM_JOINED':
              this.playerId = payload.playerId;
              this.team = payload.team;
              this.roomState = payload.room;
              this.callbacks.onRoomJoined?.(payload.room, payload.playerId, payload.team);
              break;

            case 'ROOM_UPDATED':
              this.roomState = payload.room;
              this.callbacks.onRoomUpdated?.(payload.room);
              break;

            case 'GAME_STARTING':
              this.roomState = payload.room;
              this.callbacks.onGameStarting?.(payload.room);
              break;

            case 'REMOTE_PLAYER_UPDATE':
              this.callbacks.onRemotePlayerUpdate?.(payload.senderId, payload.state);
              break;

            case 'REMOTE_GAME_EVENT':
              this.callbacks.onRemoteGameEvent?.(payload.senderId, payload.event);
              break;

            case 'CHAT_MESSAGE':
              this.callbacks.onChatMessage?.(payload.senderName, payload.text);
              break;

            case 'ERROR':
              this.callbacks.onError?.(payload.message || 'An error occurred.');
              break;

            default:
              break;
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };
    });
  }

  public createRoom(playerName: string, characterId: number) {
    this.send('CREATE_ROOM', { name: playerName, characterId });
  }

  public joinRoom(roomCode: string, playerName: string, characterId: number) {
    this.send('JOIN_ROOM', { code: roomCode, name: playerName, characterId });
  }

  public selectCharacter(characterId: number) {
    this.send('SELECT_CHARACTER', { characterId });
  }

  public setReady(isReady: boolean) {
    this.send('SET_READY', { isReady });
  }

  public sendStateUpdate(state: any) {
    this.send('GAME_STATE_UPDATE', state);
  }

  public sendGameEvent(event: any) {
    this.send('GAME_EVENT', event);
  }

  public sendChatMessage(name: string, text: string) {
    this.send('CHAT_MESSAGE', { name, text });
  }

  private send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
