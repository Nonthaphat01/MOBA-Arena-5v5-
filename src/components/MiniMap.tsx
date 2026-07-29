import React, { useEffect, useRef, useState } from 'react';
import { CharacterAIContext } from '../engine/ai';
import { isEntityVisibleToTeam } from '../engine/physics';
import { BushZone, FlagZoneData, ItemData, Wall } from '../types';
import { Maximize2, Minimize2 } from 'lucide-react';

interface MiniMapProps {
  player: CharacterAIContext;
  entities: CharacterAIContext[];
  flags: FlagZoneData[];
  items: ItemData[];
  walls: Wall[];
  bushes: BushZone[];
  mapWidth: number;
  mapHeight: number;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  player,
  entities,
  flags,
  items,
  walls,
  bushes,
  mapWidth,
  mapHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mapSize, setMapSize] = useState<'compact' | 'medium' | 'large'>('compact');
  const [isExpanded, setIsExpanded] = useState(false);

  // Canvas size presets (Width x Height, matching 1400:800 map aspect ratio 1.75)
  const hudMapDimensions =
    mapSize === 'compact'
      ? { w: 175, h: 100 }
      : mapSize === 'medium'
      ? { w: 260, h: 148 }
      : { w: 360, h: 205 };

  // Toggle map with 'M' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        setIsExpanded((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const drawMap = (
    canvas: HTMLCanvasElement | null,
    isDetailed: boolean
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const scaleX = w / mapWidth;
    const scaleY = h / mapHeight;

    // Base background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Grid lines for tactical feel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = isDetailed ? 40 : 25;
    for (let gx = 0; gx < w; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // River
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fillRect(1330 * scaleX, 0, 140 * scaleX, h);

    // Walls
    ctx.fillStyle = '#334155';
    walls.forEach((wall) => {
      ctx.fillRect(wall.x * scaleX, wall.y * scaleY, wall.w * scaleX, wall.h * scaleY);
    });

    // Bushes
    ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
    bushes.forEach((b) => {
      ctx.fillRect(b.x * scaleX, b.y * scaleY, b.w * scaleX, b.h * scaleY);
    });

    // Altars / Flags
    flags.forEach((f) => {
      const radius = isDetailed ? 14 : 9;
      // Capture radius ring
      ctx.beginPath();
      ctx.arc(f.x * scaleX, f.y * scaleY, radius * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle =
        f.owner === 'BLUE' ? 'rgba(56, 189, 248, 0.25)' : f.owner === 'RED' ? 'rgba(248, 113, 113, 0.25)' : 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Main Altar point
      ctx.beginPath();
      ctx.arc(f.x * scaleX, f.y * scaleY, radius, 0, Math.PI * 2);
      ctx.fillStyle =
        f.owner === 'BLUE' ? '#38bdf8' : f.owner === 'RED' ? '#f87171' : '#94a3b8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isDetailed ? 2.5 : 1.5;
      ctx.stroke();

      if (isDetailed) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.name || f.id, f.x * scaleX, f.y * scaleY - radius - 6);
      }
    });

    // Items
    ctx.fillStyle = '#fbbf24';
    items.forEach((it) => {
      ctx.beginPath();
      ctx.arc(it.x * scaleX, it.y * scaleY, isDetailed ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Dynamic Fog of War overlay
    ctx.fillStyle = 'rgba(3, 7, 18, 0.72)';
    ctx.fillRect(0, 0, w, h);

    // Carve out vision circles around living team members
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    entities.forEach((e) => {
      if (!e.isDead && e.team === player.team) {
        const visRadius = (e === player ? 350 : 270) * scaleX;
        const grad = ctx.createRadialGradient(
          e.x * scaleX,
          e.y * scaleY,
          visRadius * 0.2,
          e.x * scaleX,
          e.y * scaleY,
          visRadius
        );
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.x * scaleX, e.y * scaleY, visRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    // Entities
    entities.forEach((e) => {
      if (e.isDead) return;
      const isPlayer = e === player;
      const isTeammate = e.team === player.team;

      if (!isTeammate) {
        const visible = isEntityVisibleToTeam(player.team, e, entities, bushes, walls);
        if (!visible) return;
      }

      const entityRadius = isDetailed ? (isPlayer ? 10 : 7) : (isPlayer ? 8 : 5);

      // Entity dot
      ctx.beginPath();
      ctx.arc(e.x * scaleX, e.y * scaleY, entityRadius, 0, Math.PI * 2);
      ctx.fillStyle = isTeammate ? '#38bdf8' : '#f87171';
      if (isPlayer) ctx.fillStyle = '#fbbf24';
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isPlayer ? 2.5 : 1.5;
      ctx.stroke();

      if (isDetailed) {
        // Character Name & HP bar on expanded map
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.data.name, e.x * scaleX, e.y * scaleY - entityRadius - 8);

        // HP bar background
        const barW = 32;
        const barH = 4;
        const bx = e.x * scaleX - barW / 2;
        const by = e.x * scaleX - barH / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx, e.y * scaleY + entityRadius + 4, barW, barH);

        const hpPct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.2 ? '#eab308' : '#ef4444';
        ctx.fillRect(bx, e.y * scaleY + entityRadius + 4, barW * hpPct, barH);
      }
    });

    // Camera Viewport Indicator Box
    if (player) {
      const camX = Math.max(0, Math.min(mapWidth - 1400, player.x - 700));
      const camY = Math.max(0, Math.min(mapHeight - 800, player.y - 400));
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(camX * scaleX, camY * scaleY, 1400 * scaleX, 800 * scaleY);
      ctx.setLineDash([]);
    }

    // Outer border
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  };

  useEffect(() => {
    drawMap(canvasRef.current, true);
    if (isExpanded) {
      drawMap(modalCanvasRef.current, true);
    }
  }, [player, entities, flags, items, walls, bushes, mapWidth, mapHeight, isExpanded, mapSize]);

  return (
    <>
      {/* Massive Tactical Arena Map Box in HUD */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700/90 shadow-2xl bg-slate-950/95 backdrop-blur-md group transition-all duration-200">
        <canvas
          ref={canvasRef}
          width={hudMapDimensions.w}
          height={hudMapDimensions.h}
          className="block max-w-full h-auto"
        />

        {/* Top Control Header */}
        <div className="absolute top-1 left-1 right-1 flex items-center justify-between pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-[9px] font-black text-slate-100 tracking-wider bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-700/80 flex items-center gap-1 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>MAP</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950/90 p-0.5 rounded border border-slate-700/80 shadow-lg">
            <button
              onClick={() => setMapSize('compact')}
              className={`px-1 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                mapSize === 'compact'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              S
            </button>
            <button
              onClick={() => setMapSize('medium')}
              className={`px-1 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                mapSize === 'medium'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              M
            </button>
            <button
              onClick={() => setIsExpanded(true)}
              className="bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white px-1 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer flex items-center gap-0.5"
              title="Expand Fullscreen Map (Key M)"
            >
              <Maximize2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Giant Fullscreen Command Map Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="relative bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 shadow-2xl flex flex-col items-center max-w-[95vw] max-h-[95vh]">
            <div className="w-full flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-sky-400 animate-ping" />
                <h2 className="text-xl font-black text-slate-100 tracking-wider uppercase">
                  FULL TACTICAL ARENA COMMAND MAP
                </h2>
                <span className="text-xs text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 font-mono font-bold">
                  Press [M] or ESC to Exit
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white px-4 py-2 rounded-xl border border-slate-700 flex items-center gap-2 font-bold text-xs transition-all cursor-pointer shadow-lg"
              >
                <Minimize2 className="w-4 h-4" />
                CLOSE MAP
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-slate-950">
              <canvas ref={modalCanvasRef} width={1050} height={600} className="block max-w-full h-auto" />
            </div>

            <div className="flex items-center justify-center gap-8 mt-4 text-xs font-bold text-slate-300 bg-slate-950/80 px-6 py-2 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-[0_0_8px_#fbbf24]" />
                <span>You (Player)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                <span>Blue Team</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-red-400 shadow-[0_0_8px_#f87171]" />
                <span>Red Team (Visible)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/50 border-2 border-emerald-400" />
                <span>Stealth Bush</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                <span>Power Up Items</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

