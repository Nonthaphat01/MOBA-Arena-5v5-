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

  const JOYSTICK_RADIUS = 38; // compact max radius for knob offset

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
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex justify-between items-end p-2 sm:p-4 overflow-hidden">
      {/* Left: Compact Virtual Joystick */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center pointer-events-auto">
        <div
          ref={joystickContainerRef}
          onTouchStart={handleJoystickTouchStart}
          onTouchMove={handleJoystickTouchMove}
          onTouchEnd={handleJoystickTouchEnd}
          onTouchCancel={handleJoystickTouchEnd}
          className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-sky-400/50 transition-colors flex items-center justify-center touch-none ${
            joystickActive
              ? 'bg-sky-950/80 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]'
              : 'bg-slate-900/60 border-slate-700/80'
          }`}
        >
          {/* Directional Guides */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
            <div className="w-full h-[1px] bg-sky-400" />
            <div className="absolute h-full w-[1px] bg-sky-400" />
          </div>

          {/* Joystick Thumb Knob */}
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center shadow-lg transition-transform ${
              joystickActive
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-500 border-white shadow-[0_0_10px_#38bdf8] scale-105'
                : 'bg-slate-800 border-slate-600'
            }`}
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            }}
          >
            <div className="w-3 h-3 rounded-full bg-white/90 shadow-inner" />
          </div>
        </div>
      </div>

      {/* Right: Compact Skill & Attack Pad */}
      <div className="relative pointer-events-auto flex items-end justify-end touch-none">
        <div className="relative w-36 h-36 sm:w-40 sm:h-40">
          {/* Main Auto-Attack Button (Bottom Right) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onAttack();
            }}
            onClick={onAttack}
            className="absolute bottom-1 right-1 w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border border-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.5)] active:scale-90 transition-transform flex flex-col items-center justify-center text-slate-950 font-black cursor-pointer"
          >
            <Swords className="w-5 h-5 text-slate-950" />
            <span className="text-[8px] uppercase font-black">ATK</span>
          </button>

          {/* Skill Buttons in Arch Around Attack Button */}
          {player.data.skills.map((skill, idx) => {
            const cd = player.skillCDs[idx] || 0;
            const hasMp = player.mp >= skill.mp;

            // Compact Arc distances around attack button
            const positions = [
              { bottom: '52px', right: '58px' }, // Skill 1
              { bottom: '62px', right: '8px' },  // Skill 2
              { bottom: '8px', right: '62px' },  // Skill 3 (Ult)
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
                className={`absolute w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex flex-col items-center justify-center transition-all shadow-md cursor-pointer active:scale-90 ${
                  isUlt
                    ? 'bg-gradient-to-br from-purple-700 to-indigo-600 border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                    : 'bg-slate-900/90 border-slate-600 text-slate-100'
                } ${!hasMp || cd > 0 ? 'opacity-50 grayscale' : 'hover:border-amber-400'}`}
              >
                {/* Skill Icon */}
                {isUlt ? (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                ) : idx === 1 ? (
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                )}

                <span className="text-[7px] font-black text-sky-300 leading-none">
                  {skill.mp}M
                </span>

                {/* Cooldown Overlay */}
                {cd > 0 && (
                  <div className="absolute inset-0 bg-slate-950/85 rounded-full flex items-center justify-center font-black text-amber-400 text-xs">
                    {Math.ceil(cd)}
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
