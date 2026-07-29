import React, { useRef, useState, useEffect } from 'react';
import { CharacterAIContext } from '../engine/ai';
import { Swords, Zap, Shield, Sparkles } from 'lucide-react';

interface MobileControlsProps {
  player: CharacterAIContext;
  onMove: (vector: { x: number; y: number } | null) => void;
  onAttack: () => void;
  onSkill: (skillIdx: number) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  player,
  onMove,
  onAttack,
  onSkill,
}) => {
  const joystickContainerRef = useRef<HTMLDivElement | null>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const JOYSTICK_RADIUS = 55; // max radius for knob offset

  // Handle Joystick Touch Start
  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (touchIdRef.current !== null) return; // already active

    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    originRef.current = { x: centerX, y: centerY };

    updateJoystickPosition(touch.clientX, touch.clientY, centerX, centerY);
    setJoystickActive(true);
  };

  // Handle Joystick Touch Move
  const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateJoystickPosition(
          touch.clientX,
          touch.clientY,
          originRef.current.x,
          originRef.current.y
        );
        break;
      }
    }
  };

  // Handle Joystick Touch End / Cancel
  const handleJoystickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setKnobPos({ x: 0, y: 0 });
        setJoystickActive(false);
        onMove(null);
        break;
      }
    }
  };

  const updateJoystickPosition = (
    clientX: number,
    clientY: number,
    centerX: number,
    centerY: number
  ) => {
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      setKnobPos({ x: 0, y: 0 });
      onMove(null);
      return;
    }

    const angle = Math.atan2(dy, dx);
    const clampedDistance = Math.min(distance, JOYSTICK_RADIUS);

    const knobX = Math.cos(angle) * clampedDistance;
    const knobY = Math.sin(angle) * clampedDistance;

    setKnobPos({ x: knobX, y: knobY });

    // Normalized vector -1 to 1
    const normX = Math.cos(angle) * (clampedDistance / JOYSTICK_RADIUS);
    const normY = Math.sin(angle) * (clampedDistance / JOYSTICK_RADIUS);

    onMove({ x: normX, y: normY });
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex justify-between items-end p-4 sm:p-6 overflow-hidden">
      {/* Left: Virtual Joystick */}
      <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center pointer-events-auto">
        <div
          ref={joystickContainerRef}
          onTouchStart={handleJoystickTouchStart}
          onTouchMove={handleJoystickTouchMove}
          onTouchEnd={handleJoystickTouchEnd}
          onTouchCancel={handleJoystickTouchEnd}
          className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 transition-colors flex items-center justify-center touch-none ${
            joystickActive
              ? 'bg-sky-950/70 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.4)]'
              : 'bg-slate-900/50 border-slate-700/80'
          }`}
        >
          {/* Inner Directional Ring */}
          <div className="absolute inset-2 rounded-full border border-dashed border-sky-500/30 pointer-events-none" />

          {/* Directional Guides */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
            <div className="w-full h-[1px] bg-sky-400" />
            <div className="absolute h-full w-[1px] bg-sky-400" />
          </div>

          {/* Joystick Thumb Knob */}
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center shadow-xl transition-transform ${
              joystickActive
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-500 border-white shadow-[0_0_15px_#38bdf8] scale-110'
                : 'bg-slate-800 border-slate-600'
            }`}
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            }}
          >
            <div className="w-5 h-5 rounded-full bg-white/80 shadow-inner" />
          </div>
        </div>
      </div>

      {/* Right: Action & Skill Touch Buttons Pad */}
      <div className="relative pointer-events-auto flex items-end justify-end gap-3 touch-none">
        {/* Skills Fan Layout */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56">
          {/* Main Auto-Attack Button (Bottom Right) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onAttack();
            }}
            onClick={onAttack}
            className="absolute bottom-1 right-1 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 border-2 border-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 transition-transform flex flex-col items-center justify-center text-slate-950 font-black cursor-pointer"
          >
            <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-slate-950 drop-shadow-md" />
            <span className="text-[10px] sm:text-xs tracking-wider uppercase font-black">ATTACK</span>
          </button>

          {/* Skill Buttons in Arch Around Attack Button */}
          {player.data.skills.map((skill, idx) => {
            const cd = player.skillCDs[idx] || 0;
            const hasMp = player.mp >= skill.mp;

            // Positioning skill buttons around attack button in an arc
            // Skill 0 (Top left of arc)
            // Skill 1 (Top middle of arc)
            // Skill 2 (Left of arc)
            const positions = [
              { bottom: '100px', right: '110px' }, // Skill 1
              { bottom: '135px', right: '35px' },  // Skill 2
              { bottom: '35px', right: '135px' },  // Skill 3 (Ult)
            ];

            const pos = positions[idx] || { bottom: '0px', right: '0px' };
            const isUlt = idx === 2;

            return (
              <button
                key={idx}
                type="button"
                disabled={cd > 0 || !hasMp}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (cd <= 0 && hasMp) onSkill(idx);
                }}
                onClick={() => {
                  if (cd <= 0 && hasMp) onSkill(idx);
                }}
                style={{ bottom: pos.bottom, right: pos.right }}
                className={`absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 flex flex-col items-center justify-center transition-all shadow-lg cursor-pointer active:scale-90 ${
                  isUlt
                    ? 'bg-gradient-to-br from-purple-700 to-indigo-600 border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                    : 'bg-slate-900/90 border-slate-600 text-slate-100'
                } ${!hasMp || cd > 0 ? 'opacity-50 grayscale' : 'hover:border-amber-400'}`}
              >
                {/* Skill Icon */}
                {isUlt ? (
                  <Sparkles className="w-5 h-5 text-amber-300" />
                ) : idx === 1 ? (
                  <Shield className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Zap className="w-5 h-5 text-sky-400" />
                )}

                <span className="text-[9px] font-extrabold truncate max-w-[48px] px-1 text-slate-200">
                  {skill.name}
                </span>

                <span className="text-[8px] font-black text-sky-300">
                  {skill.mp}MP
                </span>

                {/* Cooldown Overlay */}
                {cd > 0 && (
                  <div className="absolute inset-0 bg-slate-950/85 rounded-full flex items-center justify-center font-black text-amber-400 text-sm">
                    {Math.ceil(cd)}s
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
