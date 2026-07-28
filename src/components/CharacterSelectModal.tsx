import React from 'react';
import { CHARACTERS } from '../data/mapData';
import { CharacterData, GameMode, RoomState } from '../types';
import { Users, Bot, Copy, Check, Shield, Swords } from 'lucide-react';

interface CharacterSelectModalProps {
  selectedCharId: number;
  onSelectChar: (id: number) => void;
  gameMode: GameMode;
  onSelectGameMode: (mode: GameMode) => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  roomCodeInput: string;
  onRoomCodeInputChange: (code: string) => void;
  roomState: RoomState | null;
  isRoomHost: boolean;
  isReady: boolean;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onToggleReady: () => void;
  onStartMatch: () => void;
  errorMessage: string | null;
}

export const CharacterSelectModal: React.FC<CharacterSelectModalProps> = ({
  selectedCharId,
  onSelectChar,
  gameMode,
  onSelectGameMode,
  playerName,
  onPlayerNameChange,
  roomCodeInput,
  onRoomCodeInputChange,
  roomState,
  isRoomHost,
  isReady,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onStartMatch,
  errorMessage,
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

  return (
    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-start p-4 sm:p-6 text-slate-100 select-none overflow-y-auto">
      {/* Title */}
      <div className="text-center mt-2 mb-4">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-sky-400 to-purple-400 uppercase">
          ARENA MOBA 2D
        </h1>
        <p className="text-xs md:text-sm text-slate-400 mt-1">
          Choose Game Mode • Select Your Hero • Battle in Giant Arena
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center justify-center gap-3 mb-6 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl max-w-xl w-full">
        <button
          onClick={() => onSelectGameMode('MULTIPLAYER_1V1')}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            gameMode === 'MULTIPLAYER_1V1'
              ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Swords className="w-4 h-4 text-sky-300" />
          <span>1v1 ONLINE DUEL (NO BOTS)</span>
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

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 bg-red-950/80 border border-red-600 text-red-200 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg animate-bounce">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* MULTIPLAYER ROOM LOBBY PANEL */}
      {gameMode === 'MULTIPLAYER_1V1' && (
        <div className="max-w-4xl w-full bg-slate-900/90 border-2 border-sky-600/40 rounded-2xl p-4 sm:p-5 mb-6 backdrop-blur-md shadow-2xl">
          {!roomState ? (
            /* Lobby Entry Controls */
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1 w-full">
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

              <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-5">
                <button
                  onClick={onCreateRoom}
                  className="flex-1 md:flex-none px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  CREATE ROOM
                </button>

                <div className="flex items-center gap-2 flex-1 md:flex-none">
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => onRoomCodeInputChange(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    maxLength={4}
                    className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-mono font-black text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={onJoinRoom}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    JOIN
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Inside Active Room Lobby */
            <div className="space-y-4">
              {/* Room Code Bar */}
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

                <div className="text-xs font-bold text-sky-400 bg-sky-950/80 px-3 py-1 rounded-lg border border-sky-800">
                  1v1 DUEL LOBBY ({roomState.players.length}/2 PLAYERS)
                </div>
              </div>

              {/* 2 Players Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Player 1 (Blue) */}
                {roomState.players[0] ? (
                  <div className="bg-sky-950/40 border-2 border-sky-500/60 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center font-bold text-lg text-white">
                        {CHARACTERS.find((c) => c.id === roomState.players[0].characterId)?.avatarIcon || '🛡️'}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-sky-300 flex items-center gap-1.5">
                          <span>{roomState.players[0].name}</span>
                          <span className="text-[10px] bg-sky-900 text-sky-200 px-1.5 py-0.5 rounded font-mono">BLUE</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Hero: {CHARACTERS.find((c) => c.id === roomState.players[0].characterId)?.name}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        roomState.players[0].isReady
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {roomState.players[0].isReady ? 'READY' : 'WAITING'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-slate-950/50 border border-dashed border-slate-700 p-3.5 rounded-xl text-center text-xs text-slate-500 font-bold">
                    WAITING FOR BLUE PLAYER...
                  </div>
                )}

                {/* Player 2 (Red) */}
                {roomState.players[1] ? (
                  <div className="bg-red-950/40 border-2 border-red-500/60 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-bold text-lg text-white">
                        {CHARACTERS.find((c) => c.id === roomState.players[1].characterId)?.avatarIcon || '⚔️'}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-red-300 flex items-center gap-1.5">
                          <span>{roomState.players[1].name}</span>
                          <span className="text-[10px] bg-red-900 text-red-200 px-1.5 py-0.5 rounded font-mono">RED</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Hero: {CHARACTERS.find((c) => c.id === roomState.players[1].characterId)?.name}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        roomState.players[1].isReady
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {roomState.players[1].isReady ? 'READY' : 'WAITING'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-slate-950/50 border border-dashed border-slate-700 p-3.5 rounded-xl text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
                    <span>WAITING FOR OPPONENT TO JOIN WITH CODE ({roomState.code})</span>
                  </div>
                )}
              </div>

              {/* Ready Button for Multiplayer */}
              <div className="flex justify-center mt-2">
                <button
                  onClick={onToggleReady}
                  className={`px-8 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-lg ${
                    isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {isReady ? '✓ YOU ARE READY!' : 'CLICK TO READY UP FOR 1v1'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid of Character Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-6xl w-full mb-5">
        {CHARACTERS.map((char: CharacterData) => {
          const isSelected = char.id === selectedCharId;
          return (
            <button
              key={char.id}
              onClick={() => onSelectChar(char.id)}
              className={`relative group p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col items-center cursor-pointer ${
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

      {/* Detailed Skill & Stat Panel */}
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

      {/* Main Start Button for Practice 5v5 Mode */}
      {gameMode === 'PRACTICE_5V5' && (
        <button
          onClick={onStartMatch}
          className="px-10 py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-extrabold text-base rounded-full shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105 active:scale-95 cursor-pointer mb-4"
        >
          START 5v5 AI BOT ARENA
        </button>
      )}
    </div>
  );
};
