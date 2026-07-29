import React from 'react';
import { Volume2, VolumeX, Smartphone, Gamepad2, Maximize2, Minimize2 } from 'lucide-react';
import { CharacterAIContext } from '../engine/ai';
import { FlagZoneData, GameStats, ItemData, KillFeedEntry, Wall } from '../types';
import { MiniMap } from './MiniMap';
import { MobileControls } from './MobileControls';

interface HUDProps {
  player: CharacterAIContext;
  entities: CharacterAIContext[];
  flags: FlagZoneData[];
  items: ItemData[];
  walls: Wall[];
  bushes: any[];
  stats: GameStats;
  killFeed: KillFeedEntry[];
  isMuted: boolean;
  onToggleMute: () => void;
  mapWidth: number;
  mapHeight: number;
  isMobileControlsVisible: boolean;
  onToggleMobileControls: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onMoveMobile: (vector: { x: number; y: number } | null) => void;
  onAttackMobile: () => void;
  onSkillMobile: (skillIdx: number) => void;
}

export const HUD: React.FC<HUDProps> = ({
  player,
  entities,
  flags,
  items,
  walls,
  bushes,
  stats,
  killFeed,
  isMuted,
  onToggleMute,
  mapWidth,
  mapHeight,
  isMobileControlsVisible,
  onToggleMobileControls,
  isFullscreen,
  onToggleFullscreen,
  onMoveMobile,
  onAttackMobile,
  onSkillMobile,
}) => {
  const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (player.mp / player.maxMp) * 100));

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-3 select-none z-30 overflow-hidden">
      {/* Mobile Virtual Touch Controls Overlay */}
      {isMobileControlsVisible && !player.isDead && (
        <MobileControls
          player={player}
          onMove={onMoveMobile}
          onAttack={onAttackMobile}
          onSkill={onSkillMobile}
        />
      )}

      {/* Player Respawn Banner Overlay */}
      {player.isDead && (
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center z-40 pointer-events-none animate-fade-in">
          <div className="bg-slate-900 border-2 border-red-500/80 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-red-950/80 border-2 border-red-500 flex items-center justify-center text-3xl mb-3 shadow-[0_0_20px_#ef4444]">
              💀
            </div>
            <h2 className="text-2xl font-black text-red-400 tracking-wider mb-1">YOU WERE ELIMINATED</h2>
            <p className="text-xs text-slate-400 mb-4 font-medium">Respawning back at base...</p>
            <div className="text-4xl font-black text-amber-400 font-mono tracking-widest mb-3">
              {Math.max(0, Math.ceil(player.respawnTimer || 0))}s
            </div>
            <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-amber-400 transition-all duration-100"
                style={{ width: `${Math.max(0, Math.min(100, ((player.respawnTimer || 0) / 5) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Top-Left: MiniMap Tactical Radar */}
      <div className="absolute top-2 left-2 z-30 pointer-events-auto flex items-start gap-2">
        <MiniMap
          player={player}
          entities={entities}
          flags={flags}
          items={items}
          walls={walls}
          bushes={bushes}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
        />
      </div>

      {/* Top-Center Bar: Scores & Countdown */}
      <div className="flex items-center justify-between w-full max-w-xl sm:max-w-3xl mx-auto bg-slate-900/85 backdrop-blur-md px-3 sm:px-5 py-1 sm:py-1.5 rounded-xl border border-slate-700/80 shadow-2xl">
        {/* Blue Team Score */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
          <span className="font-black text-sky-400 text-xs sm:text-base tracking-wider">BLUE</span>
          <span className="font-extrabold text-sm sm:text-xl text-slate-100">{Math.floor(stats.blueScore)}</span>
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 tracking-widest">MATCH TIMER</div>
          <div className="text-base sm:text-xl font-black text-amber-400 tracking-wider font-mono">
            {formatTime(stats.matchTimer)}
          </div>
        </div>

        {/* Red Team Score */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-extrabold text-sm sm:text-xl text-slate-100">{Math.floor(stats.redScore)}</span>
          <span className="font-black text-red-400 text-xs sm:text-base tracking-wider">RED</span>
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400 shadow-[0_0_8px_#f87171]" />
        </div>
      </div>

      {/* Top-Right: Quick Controls Toolbar */}
      <div className="absolute top-2 right-2 z-30 pointer-events-auto flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl shadow-lg backdrop-blur-md">
        {/* Mobile Touch Controls Toggle */}
        <button
          onClick={onToggleMobileControls}
          title="Toggle Mobile Virtual Controls"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition-all cursor-pointer ${
            isMobileControlsVisible
              ? 'bg-sky-600 text-white shadow-md shadow-sky-500/30'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{isMobileControlsVisible ? 'TOUCH ON' : 'TOUCH OFF'}</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          title="Toggle Fullscreen Mode"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition-all cursor-pointer ${
            isFullscreen
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">EXIT</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">FULL</span>
            </>
          )}
        </button>

        {/* Mute Button */}
        <button
          onClick={onToggleMute}
          className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] sm:text-[11px] font-extrabold transition-all cursor-pointer"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
        </button>
      </div>

      {/* Kill Feed Overlay (Top Right Below Toolbar) */}
      <div className="absolute top-12 right-2 flex flex-col items-end gap-1 max-w-[200px] sm:max-w-xs z-10 pointer-events-none">
        {killFeed.slice(-3).map((entry) => (
          <div
            key={entry.id}
            className="bg-slate-900/90 border border-slate-800 text-[10px] sm:text-xs px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-md animate-fade-in flex items-center gap-1"
          >
            <span className={entry.killerTeam === 'BLUE' ? 'text-sky-400 font-bold' : 'text-red-400 font-bold'}>
              {entry.killerName}
            </span>
            <span className="text-slate-400">⚔️</span>
            <span className={entry.victimTeam === 'BLUE' ? 'text-sky-400 font-bold' : 'text-red-400 font-bold'}>
              {entry.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom Area: Health/Mana Status & Desktop Skill Bar */}
      <div className="flex items-end justify-between w-full gap-2">
        {/* Player Health & Mana Status (Compact in Touch Mode, Full in Desktop Mode) */}
        <div
          className={`bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto transition-all ${
            isMobileControlsVisible
              ? 'p-2 w-48 sm:w-56 mb-28 sm:mb-32' // Lift above virtual joystick in touch mode
              : 'p-3 w-60 sm:w-68'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg">{player.data.avatarIcon}</span>
              <div>
                <h3 className="font-extrabold text-slate-100 text-xs sm:text-sm leading-none">{player.data.name}</h3>
                <span className="text-[9px] text-sky-400 font-semibold">{player.data.roleTitle}</span>
              </div>
            </div>
            {player.speedBuffTimer > 0 && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600 animate-pulse">
                ⚡ SPEED
              </span>
            )}
          </div>

          {/* HP Bar */}
          <div className="mb-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-300 mb-0.5">
              <span>HP</span>
              <span>
                {Math.ceil(player.hp)} / {player.maxHp}
              </span>
            </div>
            <div className="w-full h-2.5 sm:h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-rose-400 transition-all duration-150 rounded-full"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* MP Bar */}
          <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-300 mb-0.5">
              <span>MP</span>
              <span>
                {Math.ceil(player.mp)} / {player.maxMp}
              </span>
            </div>
            <div className="w-full h-2 sm:h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-150 rounded-full"
                style={{ width: `${mpPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Desktop Skill Action Bar (ONLY shown when Mobile Touch Controls are OFF) */}
        {!isMobileControlsVisible && (
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-900/90 border border-slate-700/80 p-2 sm:p-3 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-auto mx-auto">
            {/* Basic Attack Key */}
            <div className="flex flex-col items-center">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-slate-800 border-2 border-slate-600 rounded-xl flex flex-col items-center justify-center shadow-inner">
                <span className="absolute top-1 left-1.5 text-[8px] sm:text-[9px] font-bold text-amber-400">AUTO</span>
                <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-200 mt-2">ATTACK</span>
                {player.atkCooldown > 0 && (
                  <div className="absolute inset-0 bg-slate-950/80 rounded-lg flex items-center justify-center font-bold text-amber-400 text-xs sm:text-sm">
                    {player.atkCooldown.toFixed(1)}s
                  </div>
                )}
              </div>
              <span className="text-[9px] font-semibold text-slate-400 mt-1">Melee Auto</span>
            </div>

            {/* Skills */}
            {player.data.skills.map((skill, idx) => {
              const cd = player.skillCDs[idx];
              const hasMp = player.mp >= skill.mp;

              return (
                <div key={idx} className="flex flex-col items-center">
                  <div
                    className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                      hasMp
                        ? 'bg-slate-800 border-amber-500/70 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-900 border-slate-700 opacity-60'
                    }`}
                  >
                    <span className="absolute top-1 left-1.5 text-[9px] sm:text-[10px] font-bold text-amber-400">
                      {skill.key}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-100 text-center px-1 leading-tight mt-1 truncate max-w-[48px]">
                      {skill.name}
                    </span>
                    <span className="absolute bottom-1 right-1.5 text-[8px] sm:text-[9px] font-extrabold text-sky-400">
                      {skill.mp}MP
                    </span>

                    {cd > 0 && (
                      <div className="absolute inset-0 bg-slate-950/85 rounded-lg flex items-center justify-center font-black text-amber-400 text-sm sm:text-base">
                        {Math.ceil(cd)}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold text-slate-400 mt-1">
                    CD {skill.cd}s
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
