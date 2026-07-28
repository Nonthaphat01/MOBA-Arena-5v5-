import React from 'react';
import { GameStats } from '../types';

interface GameOverModalProps {
  stats: GameStats;
  playerKills: number;
  playerDeaths: number;
  onPlayAgain: () => void;
  onReturnToSelect: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  playerKills,
  playerDeaths,
  onPlayAgain,
  onReturnToSelect,
}) => {
  const blueWon = Math.floor(stats.blueScore) > Math.floor(stats.redScore);
  const redWon = Math.floor(stats.redScore) > Math.floor(stats.blueScore);

  return (
    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 select-none animate-fade-in">
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl backdrop-blur-md">
        <h1
          className={`text-4xl md:text-5xl font-black mb-2 ${
            blueWon
              ? 'text-sky-400 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]'
              : redWon
              ? 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]'
              : 'text-amber-400'
          }`}
        >
          {blueWon ? 'BLUE TEAM VICTORY!' : redWon ? 'RED TEAM VICTORY!' : 'DRAW MATCH!'}
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Strategic Flag Control & Elimination Recap
        </p>

        {/* Score Grid */}
        <div className="grid grid-cols-2 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 mb-6">
          <div className="p-3 bg-sky-950/40 rounded-lg border border-sky-800/50">
            <span className="text-xs font-bold text-sky-400 block mb-1">BLUE TEAM</span>
            <div className="text-2xl font-black text-sky-200">{Math.floor(stats.blueScore)} pts</div>
            <div className="text-xs text-sky-400/80 mt-1">{stats.blueKills} Kills</div>
          </div>
          <div className="p-3 bg-red-950/40 rounded-lg border border-red-800/50">
            <span className="text-xs font-bold text-red-400 block mb-1">RED TEAM</span>
            <div className="text-2xl font-black text-red-200">{Math.floor(stats.redScore)} pts</div>
            <div className="text-xs text-red-400/80 mt-1">{stats.redKills} Kills</div>
          </div>
        </div>

        {/* Player Stats */}
        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 mb-6 flex justify-around text-xs">
          <div>
            <span className="text-slate-400 block">Your Kills</span>
            <span className="font-extrabold text-amber-400 text-lg">{playerKills}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Your Deaths</span>
            <span className="font-extrabold text-slate-200 text-lg">{playerDeaths}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Performance Rating</span>
            <span className="font-extrabold text-emerald-400 text-lg">
              {playerKills > playerDeaths ? 'S+ MVP' : playerKills === playerDeaths ? 'A Tier' : 'B Tier'}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={onReturnToSelect}
            className="flex-1 py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            CHANGE HERO
          </button>
        </div>
      </div>
    </div>
  );
};
