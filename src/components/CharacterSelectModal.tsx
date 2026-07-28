import React from 'react';
import { CHARACTERS } from '../data/mapData';
import { CharacterData, GameMode, RoomState, RoomSizeMode } from '../types';
import { Users, Bot, Copy, Check, Swords, Server, Timer, Lock, ArrowLeft, Trash2, LogOut } from 'lucide-react';

interface CharacterSelectModalProps {
  selectedCharId: number;
  onSelectChar: (id: number) => void;
  gameMode: GameMode;
  onSelectGameMode: (mode: GameMode) => void;
  roomSizeMode: RoomSizeMode;
  onSelectRoomSizeMode: (mode: RoomSizeMode) => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  roomCodeInput: string;
  onRoomCodeInputChange: (code: string) => void;
  roomState: RoomState | null;
  isRoomHost: boolean;
  isReady: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (code?: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onStartMatch: () => void;
  errorMessage: string | null;
  activeOnlineRooms: RoomState[];
  draftTimer: number;
  isDrafting: boolean;
  onStartDraft5v5: () => void;
  onLockInHero: () => void;
  isLockedIn: boolean;
  myPlayerId: string | null;
}

export const CharacterSelectModal: React.FC<CharacterSelectModalProps> = ({
  selectedCharId,
  onSelectChar,
  gameMode,
  onSelectGameMode,
  roomSizeMode,
  onSelectRoomSizeMode,
  playerName,
  onPlayerNameChange,
  roomCodeInput,
  onRoomCodeInputChange,
  roomState,
  isRoomHost,
  isReady,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onStartMatch,
  errorMessage,
  activeOnlineRooms,
  draftTimer,
  isDrafting,
  onStartDraft5v5,
  onLockInHero,
  isLockedIn,
  myPlayerId,
}) => {
  const selectedChar = CHARACTERS.find((c) => c.id === selectedCharId) || CHARACTERS[0];
  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = () => {
    if (roomState?.code) {
      navigator.clipboard.writeText(roomState.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const roomModesList: RoomSizeMode[] = ['1v1', '2v2', '3v3', '4v4', '5v5'];

  return (
    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-start p-4 sm:p-6 text-slate-100 select-none overflow-y-auto">
      {/* Title */}
      <div className="text-center mt-2 mb-4">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-sky-400 to-purple-400 uppercase">
          ARENA MOBA 2D
        </h1>
        <p className="text-xs md:text-sm text-slate-400 mt-1">
          Online Multi-Mode Server Browser (1-1, 2-2, 3-3, 4-4, 5-5) • 30s Hero Selection Draft • 2.5D Arena
        </p>
      </div>

      {/* Mode Selector Tabs (Hidden during 30s Hero Draft) */}
      {!isDrafting && (
        <div className="flex items-center justify-center gap-3 mb-5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl max-w-xl w-full">
          <button
            onClick={() => onSelectGameMode('MULTIPLAYER_1V1')}
            className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
              gameMode === 'MULTIPLAYER_1V1'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Swords className="w-4 h-4 text-sky-300" />
            <span>MULTIPLAYER ONLINE (1-1 to 5-5)</span>
          </button>

          <button
            onClick={() => onSelectGameMode('PRACTICE_5V5')}
            className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
              gameMode === 'PRACTICE_5V5'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Bot className="w-4 h-4 text-amber-300" />
            <span>5v5 AI BOT MATCH</span>
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 bg-red-950/80 border border-red-600 text-red-200 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg animate-bounce">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* MULTIPLAYER ROOM LOBBY & ONLINE SERVERS BROWSER */}
      {gameMode === 'MULTIPLAYER_1V1' && !isDrafting && (
        <div className="max-w-4xl w-full bg-slate-900/90 border-2 border-sky-600/40 rounded-2xl p-4 sm:p-5 mb-6 backdrop-blur-md shadow-2xl">
          {!roomState ? (
            /* Lobby Entry Controls & Online Servers List */
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row items-end justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="w-full md:w-1/3">
                  <label className="block text-xs font-bold text-slate-300 mb-1">PLAYER NAME</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => onPlayerNameChange(e.target.value)}
                    maxLength={12}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-sky-500"
                    placeholder="Enter your name"
                  />
                </div>

                <div className="w-full md:w-2/3 flex flex-col sm:flex-row items-center gap-3">
                  {/* Select Room Size Buttons */}
                  <div className="w-full sm:flex-1">
                    <label className="block text-[11px] font-extrabold text-amber-400 uppercase mb-1">
                      SELECT ROOM SIZE (เลือกขนาดห้อง)
                    </label>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      {roomModesList.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onSelectRoomSizeMode(mode)}
                          className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            roomSizeMode === mode
                              ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/30 ring-1 ring-sky-300'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {mode.replace('v', '-')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={onCreateRoom}
                    className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-auto shrink-0"
                  >
                    <Users className="w-4 h-4" />
                    CREATE ROOM
                  </button>
                </div>
              </div>

              {/* Direct Code Join Input */}
              <div className="flex items-center justify-end gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-xs font-bold text-slate-400">JOIN EXISTING ROOM:</span>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => onRoomCodeInputChange(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  maxLength={4}
                  className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-center text-sm font-mono font-black text-amber-400 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => onJoinRoom(roomCodeInput)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  JOIN ROOM
                </button>
              </div>

              {/* ONLINE SERVERS / CREATED ROOMS BROWSER */}
              <div className="border-t border-slate-800/80 pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <h3 className="text-xs font-black tracking-wider text-emerald-400 uppercase">
                      ONLINE SERVERS & CREATED ROOMS ({activeOnlineRooms.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded font-mono">
                    REALTIME FIREBASE SYNC
                  </span>
                </div>

                {activeOnlineRooms.length === 0 ? (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center">
                    <p className="text-xs text-slate-400 font-medium">
                      No active online rooms right now. Select a room size (<strong className="text-sky-400">1-1, 2-2, 3-3, 4-4, 5-5</strong>) and click <strong className="text-sky-400">CREATE ROOM</strong> above to host a server!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                    {activeOnlineRooms.map((room) => {
                      const host = room.players[0];
                      const maxP = (room.maxPlayersPerTeam || 1) * 2;
                      const isFull = room.players.length >= maxP;
                      const modeLabel = room.roomMode ? room.roomMode.replace('v', '-') : '1-1';
                      const statusLabel =
                        room.status === 'LOBBY'
                          ? 'LOBBY'
                          : room.status === 'SELECTING'
                          ? '30s DRAFT'
                          : 'IN GAME';
                      const statusColor =
                        room.status === 'LOBBY'
                          ? 'text-emerald-400 bg-emerald-950/80 border-emerald-700'
                          : room.status === 'SELECTING'
                          ? 'text-amber-400 bg-amber-950/80 border-amber-700'
                          : 'text-purple-400 bg-purple-950/80 border-purple-700';

                      return (
                        <div
                          key={room.code}
                          className="bg-slate-950/80 border border-slate-800 hover:border-sky-500/50 p-3 rounded-xl flex items-center justify-between gap-3 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-amber-400 text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                #{room.code}
                              </span>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                                {modeLabel}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-200 mt-1 truncate">
                              Host: {host?.name || 'Player'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Players: {room.players.length}/{maxP} {isFull ? '(FULL)' : ''}
                            </p>
                          </div>

                          <button
                            onClick={() => onJoinRoom(room.code)}
                            disabled={isFull}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                              isFull
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                            }`}
                          >
                            {isFull ? 'FULL' : 'JOIN ROOM'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : roomState.status === 'LOBBY' ? (
            /* Inside Active Room Lobby (Waiting to Start Draft) */
            <div className="space-y-4">
              {/* Room Code & Info Bar */}
              <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400">ROOM CODE:</span>
                  <span className="text-xl font-black font-mono text-amber-400 tracking-wider bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
                    {roomState.code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'COPIED!' : 'COPY'}</span>
                  </button>
                </div>

                {(() => {
                  const maxPerTeam = roomState.maxPlayersPerTeam || 1;
                  const totalMax = maxPerTeam * 2;
                  const modeTag = roomState.roomMode ? roomState.roomMode.replace('v', '-') : `${maxPerTeam}-${maxPerTeam}`;
                  return (
                    <div className="text-xs font-bold text-sky-400 bg-sky-950/80 px-3 py-1 rounded-lg border border-sky-800 uppercase flex items-center gap-2">
                      <span className="bg-sky-500 text-slate-950 px-2 py-0.5 rounded font-black">{modeTag} MODE</span>
                      <span>LOBBY ({roomState.players.length}/{totalMax} PLAYERS)</span>
                    </div>
                  );
                })()}
              </div>

              {/* Dynamic Teams Grid (Blue vs Red) */}
              {(() => {
                const maxPerTeam = roomState.maxPlayersPerTeam || 1;
                const bluePlayers = roomState.players.filter((p) => p.team === 'BLUE');
                const redPlayers = roomState.players.filter((p) => p.team === 'RED');

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* BLUE TEAM COLUMN */}
                    <div className="bg-sky-950/20 border border-sky-600/30 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-sky-600/30 pb-2 mb-2">
                        <span className="font-black text-xs text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                          BLUE TEAM ({bluePlayers.length}/{maxPerTeam})
                        </span>
                      </div>

                      {Array.from({ length: maxPerTeam }).map((_, idx) => {
                        const player = bluePlayers[idx];
                        if (player) {
                          const char = CHARACTERS.find((c) => c.id === player.characterId) || CHARACTERS[0];
                          return (
                            <div
                              key={player.id}
                              className="bg-sky-950/60 border border-sky-500/50 p-2.5 rounded-xl flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
                                  {char.avatarIcon}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-xs text-sky-300 truncate">
                                    {player.name} {player.id === myPlayerId ? '(YOU)' : ''}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-bold">{char.name}</span>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                  player.isReady
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {player.isReady ? 'READY' : 'WAITING'}
                              </span>
                            </div>
                          );
                        } else {
                          return (
                            <div
                              key={`empty_blue_${idx}`}
                              className="bg-slate-950/40 border border-dashed border-slate-800 p-2.5 rounded-xl text-center text-[11px] text-slate-500 font-bold"
                            >
                              WAITING FOR BLUE PLAYER ({idx + 1}/{maxPerTeam})...
                            </div>
                          );
                        }
                      })}
                    </div>

                    {/* RED TEAM COLUMN */}
                    <div className="bg-red-950/20 border border-red-600/30 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-red-600/30 pb-2 mb-2">
                        <span className="font-black text-xs text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                          RED TEAM ({redPlayers.length}/{maxPerTeam})
                        </span>
                      </div>

                      {Array.from({ length: maxPerTeam }).map((_, idx) => {
                        const player = redPlayers[idx];
                        if (player) {
                          const char = CHARACTERS.find((c) => c.id === player.characterId) || CHARACTERS[0];
                          return (
                            <div
                              key={player.id}
                              className="bg-red-950/60 border border-red-500/50 p-2.5 rounded-xl flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
                                  {char.avatarIcon}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-xs text-red-300 truncate">
                                    {player.name} {player.id === myPlayerId ? '(YOU)' : ''}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-bold">{char.name}</span>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                  player.isReady
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {player.isReady ? 'READY' : 'WAITING'}
                              </span>
                            </div>
                          );
                        } else {
                          return (
                            <div
                              key={`empty_red_${idx}`}
                              className="bg-slate-950/40 border border-dashed border-slate-800 p-2.5 rounded-xl text-center text-[11px] text-slate-500 font-bold"
                            >
                              WAITING FOR RED PLAYER ({idx + 1}/{maxPerTeam})...
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Lobby Action Bar: Back / Delete Room & Ready Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <button
                  onClick={onLeaveRoom}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-950/80 hover:bg-red-900 text-red-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-red-700/80 shadow-md"
                >
                  {isRoomHost ? <Trash2 className="w-4 h-4 text-red-400" /> : <LogOut className="w-4 h-4 text-red-400" />}
                  <span>{isRoomHost ? 'ย้อนกลับ / ลบห้อง (Delete Room)' : 'ย้อนกลับ / ออกจากห้อง (Leave Room)'}</span>
                </button>

                <button
                  onClick={onToggleReady}
                  className={`w-full sm:w-auto px-8 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-lg ${
                    isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {isReady ? '✓ READY! (WAITING FOR PLAYERS)' : 'READY UP FOR 30s HERO DRAFT'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Start Button for 5v5 Mode (Only visible before entering hero draft) */}
      {gameMode === 'PRACTICE_5V5' && !isDrafting && (
        <button
          onClick={onStartDraft5v5}
          className="px-10 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-black text-base rounded-full shadow-xl shadow-amber-500/30 transition-all transform hover:scale-105 active:scale-95 cursor-pointer mb-6 flex items-center gap-3 border-2 border-amber-300/40"
        >
          <Timer className="w-6 h-6 text-slate-950" />
          <span>START 30s HERO SELECTION DRAFT</span>
        </button>
      )}

      {/* 30-SECOND HERO DRAFT SELECTION PANEL (ONLY DISPLAYED WHEN DRAFTING) */}
      {isDrafting && (
        <div className="max-w-6xl w-full flex flex-col items-center">
          {/* Draft Timer Header */}
          <div className="w-full max-w-4xl bg-slate-900/95 border-2 border-amber-500/80 rounded-2xl p-4 sm:p-5 mb-5 backdrop-blur-md shadow-2xl animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center font-black text-2xl text-amber-400 animate-pulse">
                  {draftTimer}s
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-amber-400 tracking-wide flex items-center gap-2">
                    <Timer className="w-5 h-5 text-amber-400" />
                    <span>30-SECOND HERO SELECTION DRAFT</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Choose your hero class now and lock in before the timer expires!
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-56 bg-slate-950 h-3.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(draftTimer / 30) * 100}%` }}
                />
              </div>
            </div>

            {/* Live Player Picks in 1v1 Online Mode */}
            {roomState && (
              <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                {roomState.players.map((p) => {
                  const char = CHARACTERS.find((c) => c.id === p.characterId) || CHARACTERS[0];
                  const isMe = p.id === myPlayerId;
                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between ${
                        p.team === 'BLUE' ? 'bg-sky-950/40 border-sky-600/50' : 'bg-red-950/40 border-red-600/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{char.avatarIcon}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-200">
                            {p.name} {isMe ? '(YOU)' : ''}
                          </p>
                          <p className="text-xs text-amber-400 font-extrabold">{char.name}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded ${
                          p.isLockedIn
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                            : 'bg-amber-950 text-amber-400 border border-amber-700 animate-pulse'
                        }`}
                      >
                        {p.isLockedIn ? '✓ LOCKED' : 'CHOOSING...'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lock In Button */}
            <div className="flex justify-center mt-2">
              <button
                onClick={onLockInHero}
                disabled={isLockedIn}
                className={`px-8 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                  isLockedIn
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 transform hover:scale-105 active:scale-95'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>{isLockedIn ? '✓ HERO LOCKED IN - WAITING FOR MATCH' : 'LOCK IN SELECTED HERO'}</span>
              </button>
            </div>
          </div>

          {/* Grid of Character Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-6xl w-full mb-5">
            {CHARACTERS.map((char: CharacterData) => {
              const isSelected = char.id === selectedCharId;
              return (
                <button
                  key={char.id}
                  onClick={() => onSelectChar(char.id)}
                  disabled={isLockedIn}
                  className={`relative group p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col items-center cursor-pointer ${
                    isLockedIn ? 'opacity-75 cursor-not-allowed' : ''
                  } ${
                    isSelected
                      ? 'bg-slate-800/90 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/10 -translate-y-1'
                      : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/60'
                  }`}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-2 shadow-lg border border-white/20 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: char.color, color: '#0f172a' }}
                  >
                    {char.avatarIcon}
                  </div>

                  <div className="text-center">
                    <h3 className="font-bold text-base text-slate-100">{char.name}</h3>
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-950 text-sky-400 border border-sky-800 my-1">
                      {char.role}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center line-clamp-2 mt-1">
                    {char.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Detailed Skill & Stat Panel for Currently Selected Hero */}
          <div className="max-w-4xl w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 mb-6 backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-5">
              {/* Stats Column */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{selectedChar.avatarIcon}</span>
                  <div>
                    <h2 className="text-lg font-extrabold text-amber-400">{selectedChar.name}</h2>
                    <p className="text-[11px] text-slate-400">{selectedChar.roleTitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400">Base HP: </span>
                    <span className="font-bold text-emerald-400">{100 + selectedChar.str * 2}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Base MP: </span>
                    <span className="font-bold text-sky-400">{selectedChar.int * 2}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">STR: </span>
                    <span className="font-bold text-amber-300">{selectedChar.str}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">AGI: </span>
                    <span className="font-bold text-emerald-300">{selectedChar.agi}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">INT: </span>
                    <span className="font-bold text-purple-300">{selectedChar.int}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Armor: </span>
                    <span className="font-bold text-slate-200">{selectedChar.arm}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Attack Range: </span>
                    <span className="font-bold text-amber-400">{selectedChar.atkRange} px</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Move Speed: </span>
                    <span className="font-bold text-cyan-400">{selectedChar.spd}</span>
                  </div>
                </div>
              </div>

              {/* Skills Breakdown */}
              <div className="flex-1 w-full">
                <h4 className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5">HERO SKILLS & ABILITIES</h4>
                <div className="space-y-1.5">
                  {selectedChar.skills.map((skill, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/60 border border-slate-800 p-2 rounded-lg flex items-start gap-2.5"
                    >
                      <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/50 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
                        {skill.key}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-200">{skill.name}</span>
                          <span className="text-[10px] text-sky-400 font-semibold">
                            {skill.mp} MP | {skill.cd}s CD
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{skill.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
