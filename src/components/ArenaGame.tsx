import React, { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundSystem';
import {
  CHARACTERS,
  INITIAL_CRATES,
  MAP_BUSHES,
  MAP_FLAGS,
  MAP_SPEED_PADS,
  MAP_TORCHES,
  MAP_WALLS,
  MAP_WATERS,
} from '../data/mapData';
import { CharacterAIContext, SmartAIEngine } from '../engine/ai';
import { LightingEngine } from '../engine/lighting';
import { ParticleSystem } from '../engine/particles';
import { MultiplayerClient } from '../engine/multiplayer';
import {
  checkSpeedPad,
  circleToBoxCollision,
  getBushAt,
  isEntityVisibleTo,
  isEntityVisibleToTeam,
  isInWater,
  isPointInBush,
} from '../engine/physics';
import {
  BushZone,
  CharacterData,
  DestructibleCrate,
  FlagZoneData,
  GameMode,
  GameStats,
  ItemData,
  KillFeedEntry,
  LightSource,
  RoomState,
  SpeedPad,
  Wall,
  WaterZone,
} from '../types';
import { CharacterSelectModal } from './CharacterSelectModal';
import { GameOverModal } from './GameOverModal';
import { HUD } from './HUD';

const MAP_WIDTH = 2800;
const MAP_HEIGHT = 1600;
const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 800;

export const ArenaGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera offset refs
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Game Lifecycle States
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAMEOVER'>('MENU');
  const [selectedCharId, setSelectedCharId] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Multiplayer & Room States
  const [gameMode, setGameMode] = useState<GameMode>('MULTIPLAYER_1V1');
  const [playerName, setPlayerName] = useState<string>('Hero');
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mpClientRef = useRef<MultiplayerClient | null>(null);
  const remotePlayerRef = useRef<CharacterAIContext | null>(null);
  const triggerDeathRef = useRef<((p: CharacterAIContext, killerName: string) => void) | null>(null);

  // Match Stats
  const [stats, setStats] = useState<GameStats>({
    blueScore: 0,
    redScore: 0,
    matchTimer: 120,
    blueKills: 0,
    redKills: 0,
  });
  const [playerKills, setPlayerKills] = useState<number>(0);
  const [playerDeaths, setPlayerDeaths] = useState<number>(0);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);

  // Engine References
  const particleSysRef = useRef<ParticleSystem>(new ParticleSystem());
  const lightingEngRef = useRef<LightingEngine>(
    new LightingEngine(MAP_WIDTH, MAP_HEIGHT)
  );

  // Entities & World State
  const entitiesRef = useRef<CharacterAIContext[]>([]);
  const playerRef = useRef<CharacterAIContext | null>(null);
  const flagsRef = useRef<FlagZoneData[]>([]);
  const itemsRef = useRef<ItemData[]>([]);
  const cratesRef = useRef<DestructibleCrate[]>([]);

  // Input Tracking
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMouseDownRef = useRef<boolean>(false);

  const itemSpawnTimerRef = useRef<number>(0);

  // Sound Mute Toggle
  const handleToggleMute = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  // --- WebSocket Connection & Multiplayer Handler ---
  useEffect(() => {
    const client = new MultiplayerClient({
      onRoomCreated: (room) => {
        setRoomState(room);
        setErrorMessage(null);
      },
      onRoomJoined: (room) => {
        setRoomState(room);
        setErrorMessage(null);
      },
      onRoomUpdated: (room) => {
        setRoomState(room);
      },
      onGameStarting: (room) => {
        setRoomState(room);
        startMatch(room);
      },
      onRemotePlayerUpdate: (senderId, state) => {
        const remote = remotePlayerRef.current;
        if (remote) {
          remote.x = state.x;
          remote.y = state.y;
          remote.vx = state.vx;
          remote.vy = state.vy;
          remote.angle = state.angle;
          remote.hp = state.hp;
          remote.maxHp = state.maxHp;
          remote.mp = state.mp;
          remote.maxMp = state.maxMp;
          
          const wasDead = remote.isDead;
          remote.isDead = !!state.isDead;
          if (remote.isDead && !wasDead && (!remote.respawnTimer || remote.respawnTimer <= 0)) {
            remote.respawnTimer = 5.0;
          }

          remote.swingTimer = state.swingTimer;
          remote.hitFlashTimer = state.hitFlashTimer;
          remote.stunTimer = state.stunTimer;
        }
      },
      onRemoteGameEvent: (senderId, event) => {
        if (event.type === 'ACTION_ATTACK') {
          const remote = remotePlayerRef.current;
          if (remote) {
            // Execute attack visual for remote opponent
            remote.swingTimer = 0.22;
            remote.swingDuration = 0.22;
            remote.swingStartAngle = event.targetAngle - Math.PI / 2.5;
            if (event.skillIdx !== undefined) {
              particleSysRef.current.addShockwave(remote.x, remote.y, remote.data.color, 120);
            } else {
              soundEngine.playSlash(1.0);
              particleSysRef.current.addSlash(remote.x, remote.y, event.targetAngle, remote.data.color, remote.data.atkRange);
            }
          }
        } else if (event.type === 'DAMAGE_DEALT') {
          const player = playerRef.current;
          if (player && player.team === event.targetTeam) {
            player.hp -= event.amount;
            player.hitFlashTimer = 0.18;
            particleSysRef.current.addBloodSplatter(player.x, player.y, event.hitAngle, event.isCrit ? 16 : 8);
            particleSysRef.current.addDamageText(
              player.x,
              player.y,
              Math.round(event.amount).toString(),
              event.isCrit ? '#f59e0b' : '#ffffff',
              event.isCrit
            );
            soundEngine.playImpact(event.isCrit);

            if (player.hp <= 0 && !player.isDead) {
              triggerDeathRef.current?.(player, event.attackerName || 'Enemy');
            }
          }
        } else if (event.type === 'PLAYER_KILLED') {
          const remote = remotePlayerRef.current;
          const player = playerRef.current;
          if (remote) {
            remote.isDead = true;
            remote.hp = 0;
            remote.respawnTimer = 5.0;
            particleSysRef.current.addSparkSplatter(remote.x, remote.y, '#ef4444', 24);
          }
          if (player) {
            setPlayerKills((k) => k + 1);
            if (player.team === 'BLUE') {
              setStats((s) => ({ ...s, blueKills: s.blueKills + 1 }));
            } else {
              setStats((s) => ({ ...s, redKills: s.redKills + 1 }));
            }
            soundEngine.playAnnounce('Enemy Slain!');
          }
          const killMsg: KillFeedEntry = {
            id: Math.random().toString(),
            killerName: event.killerName || 'Hero',
            killerTeam: event.killerTeam || 'BLUE',
            victimName: event.victimName || 'Enemy',
            victimTeam: event.victimTeam || 'RED',
            timestamp: Date.now(),
            text: `${event.killerName} eliminated ${event.victimName}`,
          };
          setKillFeed((kf) => [...kf, killMsg]);
        }
      },
      onError: (msg) => {
        setErrorMessage(msg);
      },
    });

    client.connect().catch((err) => console.log('WS Connect:', err));
    mpClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  const handleCreateRoom = () => {
    if (mpClientRef.current) {
      mpClientRef.current.createRoom(playerName || 'Player 1', selectedCharId);
    }
  };

  const handleJoinRoom = () => {
    if (!roomCodeInput.trim()) {
      setErrorMessage('Please enter a 4-character room code!');
      return;
    }
    if (mpClientRef.current) {
      mpClientRef.current.joinRoom(roomCodeInput, playerName || 'Player 2', selectedCharId);
    }
  };

  const handleSelectChar = (id: number) => {
    setSelectedCharId(id);
    if (gameMode === 'MULTIPLAYER_1V1' && mpClientRef.current && roomState) {
      mpClientRef.current.selectCharacter(id);
    }
  };

  const handleToggleReady = () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    if (mpClientRef.current) {
      mpClientRef.current.setReady(nextReady);
    }
  };

  // --- 1. Start Match Initialization ---
  const startMatch = useCallback((activeRoom?: RoomState | null) => {
    const currentRoom = activeRoom || roomState;

    // Reset World State
    flagsRef.current = MAP_FLAGS.map((f) => ({ ...f, progress: 0, owner: 'NEUTRAL' }));
    cratesRef.current = INITIAL_CRATES.map((c) => ({ ...c }));
    itemsRef.current = [];
    particleSysRef.current = new ParticleSystem();

    // Reset Match Stats
    setStats({
      blueScore: 0,
      redScore: 0,
      matchTimer: 120,
      blueKills: 0,
      redKills: 0,
    });
    setPlayerKills(0);
    setPlayerDeaths(0);
    setKillFeed([]);

    const newEntities: CharacterAIContext[] = [];

    if (gameMode === 'MULTIPLAYER_1V1' && currentRoom && currentRoom.players.length === 2) {
      // --- 1v1 Online Mode (NO BOTS) ---
      const myPlayerInfo = currentRoom.players.find((p) => p.id === mpClientRef.current?.playerId);
      const opponentInfo = currentRoom.players.find((p) => p.id !== mpClientRef.current?.playerId);

      const myTeam = myPlayerInfo?.team || 'BLUE';
      const myCharData = CHARACTERS.find((c) => c.id === (myPlayerInfo?.characterId ?? selectedCharId)) || CHARACTERS[0];
      const mySpawnX = myTeam === 'BLUE' ? 220 : MAP_WIDTH - 220;
      const mySpawnY = MAP_HEIGHT / 2;

      const playerEntity: CharacterAIContext = {
        x: mySpawnX,
        y: mySpawnY,
        spawnX: mySpawnX,
        spawnY: mySpawnY,
        respawnTimer: 0,
        vx: 0,
        vy: 0,
        angle: myTeam === 'BLUE' ? 0 : Math.PI,
        targetAngle: myTeam === 'BLUE' ? 0 : Math.PI,
        impulseX: 0,
        impulseY: 0,
        walkCycle: 0,
        swingTimer: 0,
        swingDuration: 0.22,
        swingStartAngle: 0,
        hitFlashTimer: 0,
        hp: 100 + myCharData.str * 2,
        maxHp: 100 + myCharData.str * 2,
        mp: myCharData.int * 2,
        maxMp: myCharData.int * 2,
        team: myTeam,
        data: myCharData,
        bStr: 0,
        bAgi: 0,
        bInt: 0,
        isDead: false,
        atkCooldown: 0,
        skillCDs: [0, 0, 0],
        speedBuffTimer: 0,
        stunTimer: 0,
        radius: 18,
      };

      const oppTeam = myTeam === 'BLUE' ? 'RED' : 'BLUE';
      const oppCharData = CHARACTERS.find((c) => c.id === (opponentInfo?.characterId ?? 1)) || CHARACTERS[1];
      const oppSpawnX = oppTeam === 'BLUE' ? 220 : MAP_WIDTH - 220;
      const oppSpawnY = MAP_HEIGHT / 2;

      const remoteEntity: CharacterAIContext = {
        x: oppSpawnX,
        y: oppSpawnY,
        spawnX: oppSpawnX,
        spawnY: oppSpawnY,
        respawnTimer: 0,
        vx: 0,
        vy: 0,
        angle: oppTeam === 'BLUE' ? 0 : Math.PI,
        targetAngle: oppTeam === 'BLUE' ? 0 : Math.PI,
        impulseX: 0,
        impulseY: 0,
        walkCycle: 0,
        swingTimer: 0,
        swingDuration: 0.22,
        swingStartAngle: 0,
        hitFlashTimer: 0,
        hp: 100 + oppCharData.str * 2,
        maxHp: 100 + oppCharData.str * 2,
        mp: oppCharData.int * 2,
        maxMp: oppCharData.int * 2,
        team: oppTeam,
        data: oppCharData,
        bStr: 0,
        bAgi: 0,
        bInt: 0,
        isDead: false,
        atkCooldown: 0,
        skillCDs: [0, 0, 0],
        speedBuffTimer: 0,
        stunTimer: 0,
        radius: 18,
      };

      if (myTeam === 'BLUE') {
        newEntities.push(playerEntity);
        newEntities.push(remoteEntity);
      } else {
        newEntities.push(remoteEntity);
        newEntities.push(playerEntity);
      }

      playerRef.current = playerEntity;
      remotePlayerRef.current = remoteEntity;
    } else {
      // --- 5v5 Practice Mode (AI BOTS) ---
      const playerCharData = CHARACTERS.find((c) => c.id === selectedCharId) || CHARACTERS[0];
      const playerEntity: CharacterAIContext = {
        x: 220,
        y: MAP_HEIGHT / 2,
        spawnX: 220,
        spawnY: MAP_HEIGHT / 2,
        respawnTimer: 0,
        vx: 0,
        vy: 0,
        angle: 0,
        targetAngle: 0,
        impulseX: 0,
        impulseY: 0,
        walkCycle: 0,
        swingTimer: 0,
        swingDuration: 0.22,
        swingStartAngle: 0,
        hitFlashTimer: 0,
        hp: 100 + playerCharData.str * 2,
        maxHp: 100 + playerCharData.str * 2,
        mp: playerCharData.int * 2,
        maxMp: playerCharData.int * 2,
        team: 'BLUE',
        data: playerCharData,
        bStr: 0,
        bAgi: 0,
        bInt: 0,
        isDead: false,
        atkCooldown: 0,
        skillCDs: [0, 0, 0],
        speedBuffTimer: 0,
        stunTimer: 0,
        radius: 18,
      };
      newEntities.push(playerEntity);
      playerRef.current = playerEntity;

      // 4 Blue Bots
      let botIndex = 0;
      CHARACTERS.forEach((cData) => {
        if (cData.id !== selectedCharId && botIndex < 4) {
          newEntities.push({
            x: 200,
            y: 450 + botIndex * 180,
            spawnX: 200,
            spawnY: 450 + botIndex * 180,
            respawnTimer: 0,
            vx: 0,
            vy: 0,
            angle: 0,
            targetAngle: 0,
            impulseX: 0,
            impulseY: 0,
            walkCycle: 0,
            swingTimer: 0,
            swingDuration: 0.22,
            swingStartAngle: 0,
            hitFlashTimer: 0,
            hp: 100 + cData.str * 2,
            maxHp: 100 + cData.str * 2,
            mp: cData.int * 2,
            maxMp: cData.int * 2,
            team: 'BLUE',
            data: cData,
            bStr: 0,
            bAgi: 0,
            bInt: 0,
            isDead: false,
            atkCooldown: 0,
            skillCDs: [0, 0, 0],
            speedBuffTimer: 0,
            stunTimer: 0,
            radius: 18,
          });
          botIndex++;
        }
      });

      // 5 Red Bots
      CHARACTERS.forEach((cData, i) => {
        newEntities.push({
          x: MAP_WIDTH - 200,
          y: 450 + i * 180,
          spawnX: MAP_WIDTH - 200,
          spawnY: 450 + i * 180,
          respawnTimer: 0,
          vx: 0,
          vy: 0,
          angle: Math.PI,
          targetAngle: Math.PI,
          impulseX: 0,
          impulseY: 0,
          walkCycle: 0,
          swingTimer: 0,
          swingDuration: 0.22,
          swingStartAngle: Math.PI,
          hitFlashTimer: 0,
          hp: 100 + cData.str * 2,
          maxHp: 100 + cData.str * 2,
          mp: cData.int * 2,
          maxMp: cData.int * 2,
          team: 'RED',
          data: cData,
          bStr: 0,
          bAgi: 0,
          bInt: 0,
          isDead: false,
          atkCooldown: 0,
          skillCDs: [0, 0, 0],
          speedBuffTimer: 0,
          stunTimer: 0,
          radius: 18,
        });
      });
    }

    entitiesRef.current = newEntities;
    setGameState('PLAYING');
    soundEngine.playAnnounce(
      gameMode === 'MULTIPLAYER_1V1'
        ? '1v1 Online Duel Started! Victory awaits!'
        : 'Match Started! Secure the zones!'
    );
  }, [selectedCharId, gameMode, roomState]);

  // Handle Key Down / Key Up
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- 2. Main 60FPS Game Loop ---
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.08);
      lastTime = currentTime;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const particles = particleSysRef.current;
      const lighting = lightingEngRef.current;
      const entities = entitiesRef.current;
      const player = playerRef.current;

      // 1. Update Match Timer
      setStats((prev) => {
        const nextTimer = Math.max(0, prev.matchTimer - dt);
        if (nextTimer <= 0 && gameState === 'PLAYING') {
          setGameState('GAMEOVER');
          soundEngine.playAnnounce('Match Complete!');
        }
        return { ...prev, matchTimer: nextTimer };
      });

      // 2. Spawn Random Jungle Items
      itemSpawnTimerRef.current += dt;
      if (itemSpawnTimerRef.current > 6 && itemsRef.current.length < 8) {
        itemSpawnTimerRef.current = 0;
        const itemTypes: ('HP' | 'SPEED' | 'STAT')[] = ['HP', 'SPEED', 'STAT'];
        itemsRef.current.push({
          id: Math.random().toString(),
          x: 400 + Math.random() * 2000,
          y: 200 + Math.random() * 1200,
          type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
          radius: 14,
          hover: 0,
          despawnTimer: 20,
        });
      }

      // 3. Update Flag Capture Progress
      flagsRef.current.forEach((flag) => {
        let blueCount = 0;
        let redCount = 0;

        entities.forEach((e) => {
          if (!e.isDead && Math.hypot(e.x - flag.x, e.y - flag.y) < flag.radius) {
            if (e.team === 'BLUE') blueCount++;
            else redCount++;
          }
        });

        const captureRate = 40 * dt;
        if (blueCount > redCount) {
          flag.progress += captureRate;
          if (flag.progress >= 100) {
            flag.progress = 100;
            if (flag.owner !== 'BLUE') {
              flag.owner = 'BLUE';
              particles.addShockwave(flag.x, flag.y, '#38bdf8', flag.radius * 1.5);
              soundEngine.playCapturePing();
            }
          }
        } else if (redCount > blueCount) {
          flag.progress -= captureRate;
          if (flag.progress <= -100) {
            flag.progress = -100;
            if (flag.owner !== 'RED') {
              flag.owner = 'RED';
              particles.addShockwave(flag.x, flag.y, '#f87171', flag.radius * 1.5);
              soundEngine.playCapturePing();
            }
          }
        }

        // Add Score from captured zones
        if (flag.owner === 'BLUE') {
          setStats((s) => ({ ...s, blueScore: s.blueScore + 1.2 * dt }));
        } else if (flag.owner === 'RED') {
          setStats((s) => ({ ...s, redScore: s.redScore + 1.2 * dt }));
        }
      });

      // Helper function to perform character skill attack
      const executeCharacterAttack = (
        char: CharacterAIContext,
        targetAngle: number,
        skillIdx?: number
      ) => {
        const isSkill = skillIdx !== undefined;

        // Set weapon swing animation trigger
        char.swingTimer = 0.22;
        char.swingDuration = 0.22;
        char.swingStartAngle = targetAngle - Math.PI / 2.5;

        if (gameMode === 'MULTIPLAYER_1V1' && char === playerRef.current) {
          mpClientRef.current?.sendGameEvent({
            type: 'ACTION_ATTACK',
            skillIdx,
            targetAngle,
          });
        }

        if (isSkill) {
          const sk = char.data.skills[skillIdx];
          if (char.skillCDs[skillIdx] > 0 || char.mp < sk.mp) return;

          char.mp -= sk.mp;
          char.skillCDs[skillIdx] = sk.cd;

          const pwr = char.data.str + char.bStr;

          if (skillIdx === 0) {
            // Skill 1: Heavy Slash / Bash
            soundEngine.playSlash(1.2);
            particles.addSlash(char.x, char.y, targetAngle, char.data.color, char.data.atkRange * 1.2);

            entities.forEach((e) => {
              if (e.team !== char.team && !e.isDead) {
                const dist = Math.hypot(e.x - char.x, e.y - char.y);
                if (dist < char.radius + e.radius + char.data.atkRange * 1.1) {
                  applyDamage(e, pwr * 1.3, char, targetAngle);
                }
              }
            });
          } else if (skillIdx === 1) {
            // Skill 2: Dash / Shadow Step / Heal
            if (sk.type === 'heal') {
              soundEngine.playHeal();
              particles.addShockwave(char.x, char.y, '#4ade80', 120);
              // Heal teammates
              entities.forEach((e) => {
                if (e.team === char.team && !e.isDead && Math.hypot(e.x - char.x, e.y - char.y) < 220) {
                  e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.35);
                  particles.addDamageText(e.x, e.y, '+HEAL', '#4ade80');
                }
              });
            } else {
              soundEngine.playDash();
              const dashDist = 110;
              const steps = 10;
              const dx = (Math.cos(targetAngle) * dashDist) / steps;
              const dy = (Math.sin(targetAngle) * dashDist) / steps;
              for (let s = 0; s < steps; s++) {
                char.x += dx;
                char.y += dy;
                let hitWall = false;
                MAP_WALLS.forEach((wall) => {
                  const col = circleToBoxCollision(char.x, char.y, char.radius, wall);
                  if (col.hit) {
                    char.x += col.normalX * col.overlap;
                    char.y += col.normalY * col.overlap;
                    hitWall = true;
                  }
                });
                if (hitWall) break;
              }
              char.speedBuffTimer = 3.5;
              particles.addSparkSplatter(char.x, char.y, char.data.color, 16);
            }
          } else if (skillIdx === 2) {
            // Skill 3: Ultimate
            soundEngine.playMagicCast();
            particles.triggerScreenShake(8, 0.4);
            particles.addShockwave(char.x, char.y, char.data.color, 180);

            entities.forEach((e) => {
              if (e.team !== char.team && !e.isDead) {
                const dist = Math.hypot(e.x - char.x, e.y - char.y);
                if (dist < 180) {
                  applyDamage(e, pwr * 2.2, char, targetAngle, true);
                }
              }
            });
          }
        } else {
          // Basic Attack
          char.atkCooldown = Math.max(0.3, 1.2 / char.data.atkSpeed);
          soundEngine.playSlash(1.0);
          particles.addSlash(char.x, char.y, targetAngle, char.data.color, char.data.atkRange);

          // Check hit vs crates
          cratesRef.current.forEach((crate) => {
            if (crate.hp > 0 && Math.hypot(crate.x - char.x, crate.y - char.y) < char.radius + crate.radius + char.data.atkRange) {
              crate.hp -= char.data.str;
              particles.addWallDebris(crate.x, crate.y);
              if (crate.hp <= 0) {
                soundEngine.playItemPickup();
                itemsRef.current.push({
                  id: Math.random().toString(),
                  x: crate.x,
                  y: crate.y,
                  type: 'STAT',
                  radius: 14,
                  hover: 0,
                  despawnTimer: 25,
                });
              }
            }
          });

          // Check hit vs enemies
          entities.forEach((e) => {
            if (e.team !== char.team && !e.isDead) {
              const dist = Math.hypot(e.x - char.x, e.y - char.y);
              if (dist < char.radius + e.radius + char.data.atkRange) {
                applyDamage(e, char.data.str + char.bStr, char, targetAngle);
              }
            }
          });
        }
      };

      // Helper function to handle local player death & multiplayer notification
      const triggerPlayerDeath = (p: CharacterAIContext, killerName: string) => {
        p.isDead = true;
        p.hp = 0;
        p.respawnTimer = 5.0;
        particles.addSparkSplatter(p.x, p.y, '#ef4444', 24);

        setPlayerDeaths((d) => d + 1);
        const killerTeam = p.team === 'BLUE' ? 'RED' : 'BLUE';
        if (killerTeam === 'BLUE') {
          setStats((s) => ({ ...s, blueKills: s.blueKills + 1 }));
        } else {
          setStats((s) => ({ ...s, redKills: s.redKills + 1 }));
        }

        const killMsg: KillFeedEntry = {
          id: Math.random().toString(),
          killerName: killerName,
          killerTeam: killerTeam,
          victimName: p.data.name,
          victimTeam: p.team,
          timestamp: Date.now(),
          text: `${killerName} eliminated ${p.data.name}`,
        };
        setKillFeed((kf) => [...kf, killMsg]);
        soundEngine.playAnnounce('You were slain!');

        if (gameMode === 'MULTIPLAYER_1V1') {
          mpClientRef.current?.sendGameEvent({
            type: 'PLAYER_KILLED',
            killerName: killerName,
            killerTeam: killerTeam,
            victimName: p.data.name,
            victimTeam: p.team,
          });

          mpClientRef.current?.sendStateUpdate({
            x: p.x,
            y: p.y,
            vx: 0,
            vy: 0,
            angle: p.angle,
            hp: 0,
            maxHp: p.maxHp,
            mp: p.mp,
            maxMp: p.maxMp,
            isDead: true,
            swingTimer: 0,
            hitFlashTimer: 0,
            stunTimer: 0,
          });
        }
      };
      triggerDeathRef.current = triggerPlayerDeath;

      // Helper function to apply damage with knockback and wall slam physics
      const applyDamage = (
        victim: CharacterAIContext,
        amount: number,
        attacker: CharacterAIContext,
        hitAngle: number,
        isCrit: boolean = false
      ) => {
        const armReduction = Math.min(0.35, victim.data.arm * 0.01);
        const finalDmg = amount * (1 - armReduction);

        victim.hp -= finalDmg;
        victim.hitFlashTimer = 0.18;
        particles.addBloodSplatter(victim.x, victim.y, hitAngle, isCrit ? 16 : 8);
        particles.addDamageText(victim.x, victim.y, Math.round(finalDmg).toString(), isCrit ? '#f59e0b' : '#ffffff', isCrit);
        soundEngine.playImpact(isCrit);

        if (gameMode === 'MULTIPLAYER_1V1' && attacker === playerRef.current) {
          mpClientRef.current?.sendGameEvent({
            type: 'DAMAGE_DEALT',
            targetTeam: victim.team,
            amount: finalDmg,
            hitAngle,
            isCrit,
            attackerName: attacker.data.name,
          });
        }

        // Knockback Impulse (Smooth separate vector)
        const knockSpeed = isCrit ? 12 : 6;
        victim.impulseX = (victim.impulseX || 0) + Math.cos(hitAngle) * knockSpeed;
        victim.impulseY = (victim.impulseY || 0) + Math.sin(hitAngle) * knockSpeed;

        // Wall Slam check
        MAP_WALLS.forEach((wall) => {
          const col = circleToBoxCollision(
            victim.x + Math.cos(hitAngle) * 15,
            victim.y + Math.sin(hitAngle) * 15,
            victim.radius,
            wall
          );
          if (col.hit) {
            // Extra wall slam crush damage + stun
            victim.hp -= 20;
            victim.stunTimer = 0.8;
            soundEngine.playWallSlam();
            particles.addWallDebris(victim.x, victim.y);
            particles.addDamageText(victim.x, victim.y, 'WALL CRUSH!', '#f87171', true);
          }
        });

        // Check Elimination
        if (victim.hp <= 0 && !victim.isDead) {
          if (victim === player) {
            triggerPlayerDeath(victim, attacker.data.name);
          } else {
            victim.isDead = true;
            victim.hp = 0;
            victim.respawnTimer = 5.0;
            particles.addSparkSplatter(victim.x, victim.y, '#ef4444', 24);

            if (attacker.team === 'BLUE') {
              setStats((s) => ({ ...s, blueKills: s.blueKills + 1 }));
              if (attacker === player) setPlayerKills((k) => k + 1);
            } else {
              setStats((s) => ({ ...s, redKills: s.redKills + 1 }));
            }

            const killMsg: KillFeedEntry = {
              id: Math.random().toString(),
              killerName: attacker.data.name,
              killerTeam: attacker.team,
              victimName: victim.data.name,
              victimTeam: victim.team,
              timestamp: Date.now(),
              text: `${attacker.data.name} eliminated ${victim.data.name}`,
            };
            setKillFeed((kf) => [...kf, killMsg]);

            if (attacker === player) {
              soundEngine.playAnnounce('Enemy Slain!');
            }
          }
        }
      };

      // 4. Update Character Positions & AI Logic
      entities.forEach((entity) => {
        if (entity.isDead) {
          if (entity.respawnTimer !== undefined && entity.respawnTimer > 0) {
            entity.respawnTimer -= dt;
            if (entity.respawnTimer <= 0) {
              entity.isDead = false;
              entity.respawnTimer = 0;
              entity.hp = entity.maxHp;
              entity.mp = entity.maxMp;
              entity.stunTimer = 0;
              entity.atkCooldown = 0;
              entity.skillCDs = [0, 0, 0];
              entity.x = entity.spawnX ?? (entity.team === 'BLUE' ? 220 : MAP_WIDTH - 220);
              entity.y = entity.spawnY ?? MAP_HEIGHT / 2;
              entity.vx = 0;
              entity.vy = 0;
              entity.impulseX = 0;
              entity.impulseY = 0;
              particles.addSparkSplatter(entity.x, entity.y, entity.team === 'BLUE' ? '#38bdf8' : '#f87171', 24);
              if (entity === player) {
                soundEngine.playAnnounce('Respawned!');
                if (gameMode === 'MULTIPLAYER_1V1') {
                  mpClientRef.current?.sendStateUpdate({
                    x: entity.x,
                    y: entity.y,
                    vx: 0,
                    vy: 0,
                    angle: entity.angle,
                    hp: entity.maxHp,
                    maxHp: entity.maxHp,
                    mp: entity.maxMp,
                    maxMp: entity.maxMp,
                    isDead: false,
                    swingTimer: 0,
                    hitFlashTimer: 0,
                    stunTimer: 0,
                  });
                }
              }
            }
          }

          if (gameMode === 'MULTIPLAYER_1V1' && entity === player) {
            mpClientRef.current?.sendStateUpdate({
              x: entity.x,
              y: entity.y,
              vx: 0,
              vy: 0,
              angle: entity.angle,
              hp: 0,
              maxHp: entity.maxHp,
              mp: entity.mp,
              maxMp: entity.maxMp,
              isDead: true,
              swingTimer: 0,
              hitFlashTimer: 0,
              stunTimer: 0,
            });
          }
          return;
        }

        // Safety check for character HP dropping to 0
        if (entity.hp <= 0 && !entity.isDead) {
          if (entity === player) {
            triggerPlayerDeath(entity, 'Enemy');
          } else {
            entity.isDead = true;
            entity.hp = 0;
            entity.respawnTimer = 5.0;
            particles.addSparkSplatter(entity.x, entity.y, '#ef4444', 24);
          }
          return;
        }

        // Timers
        if (entity.atkCooldown > 0) entity.atkCooldown -= dt;
        for (let i = 0; i < 3; i++) if (entity.skillCDs[i] > 0) entity.skillCDs[i] -= dt;
        if (entity.speedBuffTimer > 0) entity.speedBuffTimer -= dt;

        // Natural HP & MP regeneration
        if (entity.hp < entity.maxHp) entity.hp = Math.min(entity.maxHp, entity.hp + entity.data.healthReg * dt);
        if (entity.mp < entity.maxMp) entity.mp = Math.min(entity.maxMp, entity.mp + 6 * dt);

        if (entity.stunTimer > 0) {
          entity.stunTimer -= dt;
          return;
        }

        // Bush & Water Interaction
        const inBush = isPointInBush(entity.x, entity.y, MAP_BUSHES);
        const inWat = isInWater(entity.x, entity.y, MAP_WATERS);
        const padBoost = checkSpeedPad(entity.x, entity.y, MAP_SPEED_PADS);

        if (inBush && (Math.abs(entity.vx) > 0.1 || Math.abs(entity.vy) > 0.1)) {
          if (Math.random() < 0.15) {
            particles.addLeafRustle(entity.x, entity.y);
            soundEngine.playBushRustle();
          }
        }

        if (inWat) {
          particles.addWaterRipple(entity.x, entity.y);
        }

        // Determine Controls (Player vs Smart AI)
        if (entity === player) {
          // Keyboard Player Control
          let dirX = 0;
          let dirY = 0;
          const k = keysRef.current;
          if (k['KeyW'] || k['ArrowUp']) dirY -= 1;
          if (k['KeyS'] || k['ArrowDown']) dirY += 1;
          if (k['KeyA'] || k['ArrowLeft']) dirX -= 1;
          if (k['KeyD'] || k['ArrowRight']) dirX += 1;

          if (dirX !== 0 && dirY !== 0) {
            dirX *= 0.7071;
            dirY *= 0.7071;
          }

          entity.vx = dirX;
          entity.vy = dirY;
          if (dirX !== 0 || dirY !== 0) {
            entity.targetAngle = Math.atan2(dirY, dirX);
          }

          // Attack / Skill Keys
          if (k['KeyJ'] && entity.atkCooldown <= 0) {
            executeCharacterAttack(entity, entity.angle);
          }
          if (k['KeyK']) executeCharacterAttack(entity, entity.angle, 0);
          if (k['KeyL']) executeCharacterAttack(entity, entity.angle, 1);
          if (k['KeyU']) executeCharacterAttack(entity, entity.angle, 2);

          // Broadcast local player state to multiplayer opponent
          if (gameMode === 'MULTIPLAYER_1V1') {
            mpClientRef.current?.sendStateUpdate({
              x: entity.x,
              y: entity.y,
              vx: entity.vx,
              vy: entity.vy,
              angle: entity.angle,
              hp: entity.hp,
              maxHp: entity.maxHp,
              mp: entity.mp,
              maxMp: entity.maxMp,
              isDead: entity.isDead,
              swingTimer: entity.swingTimer,
              hitFlashTimer: entity.hitFlashTimer,
              stunTimer: entity.stunTimer,
            });
          }
        } else if (gameMode === 'PRACTICE_5V5') {
          // Smart AI Control for Bots
          const aiDecision = SmartAIEngine.computeBotInput(
            entity,
            entities,
            flagsRef.current,
            itemsRef.current,
            MAP_BUSHES,
            MAP_WALLS,
            cratesRef.current,
            MAP_SPEED_PADS
          );

          entity.vx = aiDecision.targetVx;
          entity.vy = aiDecision.targetVy;
          entity.targetAngle = aiDecision.targetAngle;

          if (aiDecision.wantAttack && entity.atkCooldown <= 0) {
            executeCharacterAttack(entity, entity.targetAngle);
          }
          if (aiDecision.wantSkill !== null) {
            executeCharacterAttack(entity, entity.targetAngle, aiDecision.wantSkill);
          }
        }

        // Smooth Heading Rotation Interpolation
        if (entity.targetAngle !== undefined) {
          let diff = entity.targetAngle - entity.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          entity.angle += diff * Math.min(1.0, 16 * dt);
        }

        // Walk Cycle & Animation Timers
        const currentSpeed = Math.hypot(entity.vx, entity.vy);
        if (currentSpeed > 0.05) {
          entity.walkCycle = (entity.walkCycle || 0) + dt * 14;
        } else {
          entity.walkCycle = 0;
        }

        if (entity.swingTimer > 0) entity.swingTimer -= dt;
        if (entity.hitFlashTimer > 0) entity.hitFlashTimer -= dt;

        // Apply Velocity & Speed Modifiers
        let moveSpeed = (entity.data.spd + entity.bAgi / 10) * 0.01 * dt * 60;
        if (entity.speedBuffTimer > 0) moveSpeed *= 1.45;
        if (inWat) moveSpeed *= 0.8; // Water slowdown
        if (padBoost.boost) moveSpeed *= 1.8; // Speed pad boost

        entity.x += entity.vx * moveSpeed;
        entity.y += entity.vy * moveSpeed;

        // Apply Knockback / Impulse Physics
        if (entity.impulseX || entity.impulseY) {
          entity.x += (entity.impulseX || 0) * 35 * dt;
          entity.y += (entity.impulseY || 0) * 35 * dt;
          entity.impulseX = (entity.impulseX || 0) * Math.pow(0.02, dt);
          entity.impulseY = (entity.impulseY || 0) * Math.pow(0.02, dt);
          if (Math.hypot(entity.impulseX, entity.impulseY) < 0.1) {
            entity.impulseX = 0;
            entity.impulseY = 0;
          }
        }

        // Arena Bounds
        entity.x = Math.max(entity.radius, Math.min(MAP_WIDTH - entity.radius, entity.x));
        entity.y = Math.max(entity.radius, Math.min(MAP_HEIGHT - entity.radius, entity.y));

        // Wall Collisions (with smooth velocity sliding)
        MAP_WALLS.forEach((wall) => {
          const col = circleToBoxCollision(entity.x, entity.y, entity.radius, wall);
          if (col.hit) {
            entity.x += col.normalX * col.overlap;
            entity.y += col.normalY * col.overlap;
            const dot = entity.vx * col.normalX + entity.vy * col.normalY;
            if (dot < 0) {
              entity.vx -= dot * col.normalX;
              entity.vy -= dot * col.normalY;
            }
          }
        });

        // Destructible Crate Collisions
        cratesRef.current.forEach((crate) => {
          if (crate.hp <= 0) return;
          const crateBox = {
            x: crate.x - crate.radius,
            y: crate.y - crate.radius,
            w: crate.radius * 2,
            h: crate.radius * 2,
          };
          const col = circleToBoxCollision(entity.x, entity.y, entity.radius, crateBox);
          if (col.hit) {
            entity.x += col.normalX * col.overlap;
            entity.y += col.normalY * col.overlap;
            const dot = entity.vx * col.normalX + entity.vy * col.normalY;
            if (dot < 0) {
              entity.vx -= dot * col.normalX;
              entity.vy -= dot * col.normalY;
            }
          }
        });

        // Item Collection
        for (let i = itemsRef.current.length - 1; i >= 0; i--) {
          const item = itemsRef.current[i];
          if (Math.hypot(entity.x - item.x, entity.y - item.y) < entity.radius + item.radius) {
            soundEngine.playItemPickup();
            if (item.type === 'HP') {
              entity.hp = Math.min(entity.maxHp, entity.hp + entity.maxHp * 0.35);
              particles.addDamageText(entity.x, entity.y, '+HP REGEN', '#4ade80');
            } else if (item.type === 'SPEED') {
              entity.speedBuffTimer = 5;
              particles.addDamageText(entity.x, entity.y, 'SPEED BOOST!', '#fbbf24');
            } else if (item.type === 'STAT') {
              entity.bStr += 8;
              entity.bAgi += 8;
              particles.addDamageText(entity.x, entity.y, 'POWER UP!', '#a855f7');
            }
            itemsRef.current.splice(i, 1);
          }
        }
      });

      // Low HP Heartbeat
      if (player) {
        const lowHP = player.hp < player.maxHp * 0.25 && !player.isDead;
        soundEngine.setLowHPHeartbeat(lowHP);
      }

      // Compute Camera Offset centered on player
      let camX = 0;
      let camY = 0;
      if (player) {
        camX = Math.max(0, Math.min(MAP_WIDTH - CANVAS_WIDTH, player.x - CANVAS_WIDTH / 2));
        camY = Math.max(0, Math.min(MAP_HEIGHT - CANVAS_HEIGHT, player.y - CANVAS_HEIGHT / 2));
        cameraRef.current = { x: camX, y: camY };
      }

      // --- 5. RENDER CANVAS SCENE (SEMI-3D / 2.5D VISUAL STYLE) ---
      ctx.save();

      // Apply Screen Shake transform
      if (particles.screenShakeTime > 0) {
        const shakeX = (Math.random() - 0.5) * particles.screenShakeIntensity;
        const shakeY = (Math.random() - 0.5) * particles.screenShakeIntensity;
        ctx.translate(shakeX, shakeY);
      }

      // Apply Camera View Translation
      ctx.translate(-camX, -camY);

      // Background Canvas Floor (Dark Slate Arena)
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // 3D Tile Grid Floor Lines
      const tileSize = 70;
      for (let x = 0; x < MAP_WIDTH; x += tileSize) {
        for (let y = 0; y < MAP_HEIGHT; y += tileSize) {
          const isAlt = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
          ctx.fillStyle = isAlt ? 'rgba(14, 22, 40, 0.4)' : 'rgba(19, 30, 54, 0.2)';
          ctx.fillRect(x, y, tileSize, tileSize);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, tileSize, tileSize);
        }
      }

      // Render Recessed 3D River Bed
      MAP_WATERS.forEach((wat) => {
        // Inner Drop Shadow (Recessed depth)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(wat.x - 2, wat.y - 2, wat.w + 4, wat.h + 4);

        // Water surface gradient
        const watGrad = ctx.createLinearGradient(wat.x, wat.y, wat.x, wat.y + wat.h);
        watGrad.addColorStop(0, 'rgba(14, 116, 144, 0.35)');
        watGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
        watGrad.addColorStop(1, 'rgba(14, 116, 144, 0.35)');
        ctx.fillStyle = watGrad;
        ctx.fillRect(wat.x, wat.y, wat.w, wat.h);

        // Water shore edge bevel
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(wat.x, wat.y, wat.w, wat.h);

        // Animated Water Waves / Caustics
        const waveTime = Date.now() * 0.002;
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
        ctx.lineWidth = 1.5;
        for (let wx = wat.x + 10; wx < wat.x + wat.w - 10; wx += 35) {
          ctx.beginPath();
          const wy = wat.y + wat.h / 2 + Math.sin(wx * 0.05 + waveTime) * 6;
          ctx.arc(wx, wy, 8, 0, Math.PI);
          ctx.stroke();
        }
      });

      // Render 3D Speed Pads
      MAP_SPEED_PADS.forEach((pad) => {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
        ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.strokeRect(pad.x, pad.y, pad.w, pad.h);

        // Animated Speed Chevrons (3D arrows)
        const arrowOffset = (Date.now() * 0.08) % 20;
        ctx.fillStyle = '#fbbf24';
        const isHoriz = Math.abs(pad.dirX) > Math.abs(pad.dirY);
        if (isHoriz) {
          for (let ax = pad.x + arrowOffset; ax < pad.x + pad.w; ax += 20) {
            ctx.beginPath();
            ctx.moveTo(ax, pad.y + 4);
            ctx.lineTo(ax + pad.dirX * 8, pad.y + pad.h / 2);
            ctx.lineTo(ax, pad.y + pad.h - 4);
            ctx.lineTo(ax - pad.dirX * 3, pad.y + pad.h / 2);
            ctx.fill();
          }
        }
      });

      // Render 3D Altar Capture Zones & Flags
      flagsRef.current.forEach((flag) => {
        flag.pulseAngle += dt * 2;
        const pulse = Math.sin(flag.pulseAngle) * 4;

        ctx.save();

        // 1. Base Altar Ground Shadow
        ctx.beginPath();
        ctx.ellipse(flag.x + 4, flag.y + 6, flag.radius + 6, (flag.radius + 6) * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fill();

        // 2. 3D Tiered Stone Pedestal
        // Outer Stone Ring
        ctx.beginPath();
        ctx.arc(flag.x, flag.y, flag.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = flag.owner === 'BLUE' ? 'rgba(56, 189, 248, 0.2)' : flag.owner === 'RED' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(148, 163, 184, 0.12)';
        ctx.fill();
        ctx.strokeStyle = flag.owner === 'BLUE' ? '#38bdf8' : flag.owner === 'RED' ? '#f87171' : '#64748b';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner Pedestal Center
        ctx.beginPath();
        ctx.arc(flag.x, flag.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. 3D Banner Pole & Flag
        // Pole Ground Shadow
        ctx.beginPath();
        ctx.moveTo(flag.x, flag.y);
        ctx.lineTo(flag.x + 18, flag.y + 12);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Metallic Pole (Extruded Upward)
        const poleGrad = ctx.createLinearGradient(flag.x - 3, flag.y, flag.x + 3, flag.y);
        poleGrad.addColorStop(0, '#64748b');
        poleGrad.addColorStop(0.5, '#f8fafc');
        poleGrad.addColorStop(1, '#334155');
        ctx.fillStyle = poleGrad;
        ctx.fillRect(flag.x - 3, flag.y - 36, 6, 38);

        // Gold Sphere Finial Top
        ctx.beginPath();
        ctx.arc(flag.x, flag.y - 38, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();

        // Waving 3D Flag Fabric
        const wave = Math.sin(Date.now() * 0.005) * 3;
        const flagColor = flag.owner === 'BLUE' ? '#0284c7' : flag.owner === 'RED' ? '#dc2626' : '#64748b';
        const flagColorLight = flag.owner === 'BLUE' ? '#38bdf8' : flag.owner === 'RED' ? '#f87171' : '#94a3b8';

        ctx.fillStyle = flagColor;
        ctx.beginPath();
        ctx.moveTo(flag.x + 3, flag.y - 36);
        ctx.quadraticCurveTo(flag.x + 18, flag.y - 28 + wave, flag.x + 32, flag.y - 24);
        ctx.quadraticCurveTo(flag.x + 18, flag.y - 12 + wave, flag.x + 3, flag.y - 10);
        ctx.fill();

        ctx.strokeStyle = flagColorLight;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
      });

      // Render 3D Bushes (Volumetric Foliage)
      MAP_BUSHES.forEach((bush) => {
        // Bush Soft Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(bush.x + 4, bush.y + 6, bush.w, bush.h);

        // Bush Base Leaf Layer
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(bush.x, bush.y, bush.w, bush.h);

        // 3D Foliage Clumps
        const clumpR = 14;
        ctx.fillStyle = '#047857';
        for (let bx = bush.x + 10; bx <= bush.x + bush.w - 10; bx += 20) {
          for (let by = bush.y + 10; by <= bush.y + bush.h - 10; by += 20) {
            ctx.beginPath();
            ctx.arc(bx, by, clumpR, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Top Highlight Foliage Clumps (Elevated 3D Tops)
        ctx.fillStyle = '#10b981';
        for (let bx = bush.x + 12; bx <= bush.x + bush.w - 12; bx += 22) {
          for (let by = bush.y + 8; by <= bush.y + bush.h - 12; by += 22) {
            ctx.beginPath();
            ctx.arc(bx - 2, by - 3, clumpR * 0.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2;
        ctx.strokeRect(bush.x, bush.y, bush.w, bush.h);
      });

      // Render 3D Jungle Power-Up Items
      itemsRef.current.forEach((item) => {
        item.hover += 0.08;
        const floatZ = Math.sin(item.hover) * 6;
        const floatY = item.y - 8 + floatZ;

        // Ground Drop Shadow (Expands/contracts with float height)
        const shadowScale = 1 - floatZ * 0.03;
        ctx.beginPath();
        ctx.ellipse(item.x, item.y + 10, item.radius * shadowScale, item.radius * 0.5 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();

        // 3D Gem / Orb with Radial Lighting
        ctx.save();
        const mainColor = item.type === 'HP' ? '#ef4444' : item.type === 'SPEED' ? '#fbbf24' : '#a855f7';
        const lightColor = item.type === 'HP' ? '#fca5a5' : item.type === 'SPEED' ? '#fef08a' : '#e9d5ff';

        const itemGrad = ctx.createRadialGradient(item.x - 3, floatY - 3, 1, item.x, floatY, item.radius);
        itemGrad.addColorStop(0, lightColor);
        itemGrad.addColorStop(0.6, mainColor);
        itemGrad.addColorStop(1, '#0f172a');

        ctx.beginPath();
        ctx.arc(item.x, floatY, item.radius, 0, Math.PI * 2);
        ctx.fillStyle = itemGrad;
        ctx.fill();
        ctx.strokeStyle = lightColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Outer Glow Ring
        ctx.beginPath();
        ctx.arc(item.x, floatY, item.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      });

      // --- 3D DEPTH SORTING FOR ENTITIES, CRATES & WALLS ---
      const wallExtrusion = 18; // 3D wall height extrusion in pixels

      // Render 3D Wall Shadows First
      MAP_WALLS.forEach((wall) => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.moveTo(wall.x + 12, wall.y + wall.h + 16);
        ctx.lineTo(wall.x + wall.w + 16, wall.y + wall.h + 16);
        ctx.lineTo(wall.x + wall.w + 16, wall.y + 16);
        ctx.lineTo(wall.x + wall.w, wall.y + wall.h);
        ctx.lineTo(wall.x, wall.y + wall.h);
        ctx.closePath();
        ctx.fill();
      });

      // Render 3D Extruded Wall Fronts & Sides
      MAP_WALLS.forEach((wall) => {
        // Front Vertical Face
        const frontGrad = ctx.createLinearGradient(wall.x, wall.y + wall.h - wallExtrusion, wall.x, wall.y + wall.h);
        frontGrad.addColorStop(0, '#1e293b');
        frontGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = frontGrad;
        ctx.fillRect(wall.x, wall.y + wall.h - wallExtrusion, wall.w, wallExtrusion);

        // Brick texture lines on front face
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.strokeRect(wall.x, wall.y + wall.h - wallExtrusion, wall.w, wallExtrusion);

        // Top Slate Roof Face (Elevated 3D Roof)
        const topGrad = ctx.createLinearGradient(wall.x, wall.y - wallExtrusion, wall.x + wall.w, wall.y - wallExtrusion + wall.h);
        topGrad.addColorStop(0, '#475569');
        topGrad.addColorStop(1, '#334155');
        ctx.fillStyle = topGrad;
        ctx.fillRect(wall.x, wall.y - wallExtrusion, wall.w, wall.h);

        // 3D Bevel Highlights
        ctx.strokeStyle = '#64748b'; // Top-left light highlight
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wall.x, wall.y - wallExtrusion + wall.h);
        ctx.lineTo(wall.x, wall.y - wallExtrusion);
        ctx.lineTo(wall.x + wall.w, wall.y - wallExtrusion);
        ctx.stroke();

        ctx.strokeStyle = '#0f172a'; // Bottom-right shadow
        ctx.beginPath();
        ctx.moveTo(wall.x + wall.w, wall.y - wallExtrusion);
        ctx.lineTo(wall.x + wall.w, wall.y - wallExtrusion + wall.h);
        ctx.lineTo(wall.x, wall.y - wallExtrusion + wall.h);
        ctx.stroke();
      });

      // Y-Sort Crates and Characters for true 2.5D rendering depth
      interface RenderableObject {
        type: 'CRATE' | 'CHARACTER';
        sortY: number;
        data: any;
      }

      const renderList: RenderableObject[] = [];

      cratesRef.current.forEach((crate) => {
        if (crate.hp > 0) {
          renderList.push({ type: 'CRATE', sortY: crate.y + crate.radius, data: crate });
        }
      });

      entities.forEach((entity) => {
        if (!entity.isDead) {
          if (!player || isEntityVisibleToTeam('BLUE', entity, entities, MAP_BUSHES, MAP_WALLS)) {
            renderList.push({ type: 'CHARACTER', sortY: entity.y + entity.radius, data: entity });
          }
        }
      });

      renderList.sort((a, b) => a.sortY - b.sortY);

      // Render Sorted Objects
      renderList.forEach((obj) => {
        if (obj.type === 'CRATE') {
          const crate = obj.data as DestructibleCrate;
          const crateH = 12;
          const cX = crate.x - crate.radius;
          const cY = crate.y - crate.radius;
          const cW = crate.radius * 2;
          const cH = crate.radius * 2;

          // Crate Ground Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fillRect(cX + 6, cY + crateH + 6, cW, cH);

          // 3D Front Face (Wood Planks)
          const frontWood = ctx.createLinearGradient(cX, cY + cH - crateH, cX, cY + cH);
          frontWood.addColorStop(0, '#78350f');
          frontWood.addColorStop(1, '#451a03');
          ctx.fillStyle = frontWood;
          ctx.fillRect(cX, cY + cH - crateH, cW, crateH);

          // 3D Top Lid (Lighter Wood)
          const topWood = ctx.createLinearGradient(cX, cY - crateH, cX + cW, cY - crateH + cH);
          topWood.addColorStop(0, '#d97706');
          topWood.addColorStop(1, '#b45309');
          ctx.fillStyle = topWood;
          ctx.fillRect(cX, cY - crateH, cW, cH);

          // Iron Braces & "X" Frame on Crate Top
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 2;
          ctx.strokeRect(cX, cY - crateH, cW, cH);
          ctx.beginPath();
          ctx.moveTo(cX, cY - crateH);
          ctx.lineTo(cX + cW, cY - crateH + cH);
          ctx.moveTo(cX + cW, cY - crateH);
          ctx.lineTo(cX, cY - crateH + cH);
          ctx.stroke();

          // Iron Metal Corners
          ctx.fillStyle = '#64748b';
          ctx.fillRect(cX, cY - crateH, 5, 5);
          ctx.fillRect(cX + cW - 5, cY - crateH, 5, 5);
          ctx.fillRect(cX, cY - crateH + cH - 5, 5, 5);
          ctx.fillRect(cX + cW - 5, cY - crateH + cH - 5, 5, 5);
        } else if (obj.type === 'CHARACTER') {
          const entity = obj.data as CharacterAIContext;

          ctx.save();
          ctx.translate(entity.x, entity.y);

          // 1. Dynamic 3D Character Oval Ground Shadow
          ctx.beginPath();
          ctx.ellipse(0, 12, entity.radius * 0.95, entity.radius * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fill();

          // Rotate character according to facing angle
          ctx.save();
          ctx.rotate(entity.angle);

          // 2. 3D Animated Feet (Stride cycle)
          const currentSpeed = Math.hypot(entity.vx, entity.vy);
          const footW = 5;
          const footH = 10;
          const walkOffset = currentSpeed > 0.05 ? Math.sin(entity.walkCycle || 0) * 6 : 0;

          ctx.fillStyle = '#0f172a';
          // Left Foot (Armored Boot)
          ctx.fillRect(-2 + walkOffset, -entity.radius - 2, footH, footW);
          // Right Foot (Armored Boot)
          ctx.fillRect(-2 - walkOffset, entity.radius - 3, footH, footW);

          // 3. TEAM COLOR PALETTE SETUP
          const isRedTeam = entity.team === 'RED';
          let baseColor = isRedTeam ? '#dc2626' : '#0284c7';
          let highlightColor = isRedTeam ? '#f87171' : '#38bdf8';
          let darkShadeColor = isRedTeam ? '#7f1d1d' : '#0369a1';
          let outlineColor = isRedTeam ? '#ef4444' : '#38bdf8';

          if (entity.hitFlashTimer > 0) {
            baseColor = '#ffffff';
            highlightColor = '#ffffff';
            outlineColor = '#ffffff';
          } else if (entity.speedBuffTimer > 0) {
            baseColor = '#d97706';
            highlightColor = '#fbbf24';
            outlineColor = '#f59e0b';
          }

          const role = entity.data.id; // 0: Warrior, 1: Tank, 2: Assassin, 3: Lancer, 4: Mage

          // 4. CLASS-SPECIFIC 3D BODY GEOMETRIES & OUTFITS (NOT GENERIC CIRCLES)
          if (role === 1) {
            // --- TANK (Shield Master): Heavy Bulky Square Fortress Body & Spiked Pauldrons ---
            const bodyW = entity.radius * 2.1;
            const bodyH = entity.radius * 1.8;

            // Spiked Heavy Pauldrons
            ctx.fillStyle = '#334155';
            ctx.fillRect(-14, -bodyH / 2 - 6, 12, 8);
            ctx.fillRect(-14, bodyH / 2 - 2, 12, 8);

            // Tank Chestplate
            const tankGrad = ctx.createLinearGradient(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2);
            tankGrad.addColorStop(0, highlightColor);
            tankGrad.addColorStop(0.5, baseColor);
            tankGrad.addColorStop(1, darkShadeColor);
            ctx.fillStyle = tankGrad;
            ctx.fillRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);

            // Greathelm Head
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-6, -8, 12, 16);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-6, -8, 12, 16);
            // Visor Slit
            ctx.fillStyle = isRedTeam ? '#ef4444' : '#38bdf8';
            ctx.fillRect(1, -5, 4, 10);

            // Giant Spiked Tower Shield on Left Arm
            ctx.fillStyle = isRedTeam ? '#991b1b' : '#1e3a8a';
            ctx.fillRect(4, -entity.radius - 8, 14, 22);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.strokeRect(4, -entity.radius - 8, 14, 22);
            // Shield Emblem Cross
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(11, -entity.radius - 8);
            ctx.lineTo(11, -entity.radius + 14);
            ctx.moveTo(4, -entity.radius + 3);
            ctx.lineTo(18, -entity.radius + 3);
            ctx.stroke();

          } else if (role === 2) {
            // --- ASSASSIN (Dual Blade): Sleek Diamond / Triangle Stealth Silhouette & Scimitars ---
            const r = entity.radius;

            // Flowing Cloak Scarf Tails (Back)
            ctx.fillStyle = darkShadeColor;
            ctx.beginPath();
            ctx.moveTo(-r, -6);
            ctx.lineTo(-r - 12, -12);
            ctx.lineTo(-r - 8, 0);
            ctx.lineTo(-r - 14, 12);
            ctx.lineTo(-r, 6);
            ctx.fill();

            // Diamond Sleek Bodysuit
            ctx.beginPath();
            ctx.moveTo(r * 1.1, 0); // Nose tip
            ctx.lineTo(0, -r * 0.95); // Right shoulder
            ctx.lineTo(-r * 0.8, 0); // Tail
            ctx.lineTo(0, r * 0.95); // Left shoulder
            ctx.closePath();

            const assGrad = ctx.createRadialGradient(-2, 0, 2, 0, 0, r);
            assGrad.addColorStop(0, highlightColor);
            assGrad.addColorStop(0.7, baseColor);
            assGrad.addColorStop(1, '#020617');
            ctx.fillStyle = assGrad;
            ctx.fill();
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Ninja Shadow Hood
            ctx.beginPath();
            ctx.arc(-2, 0, r * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = '#090d16';
            ctx.fill();

            // Offhand Curved Scimitar
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(4, -r + 2);
            ctx.quadraticCurveTo(18, -r - 4, 22, -r + 10);
            ctx.lineTo(16, -r + 4);
            ctx.fill();

          } else if (role === 3) {
            // --- LANCER (Spear Master): Pentagonal Plate Armor & Extra Long Dragoon Trident ---
            const r = entity.radius;

            // Pentagonal Tapered Torso
            ctx.beginPath();
            ctx.moveTo(r * 1.05, 0); // Front
            ctx.lineTo(r * 0.3, -r * 0.9); // Right shoulder
            ctx.lineTo(-r * 0.7, -r * 0.6); // Right hip
            ctx.lineTo(-r * 0.7, r * 0.6); // Left hip
            ctx.lineTo(r * 0.3, r * 0.9); // Left shoulder
            ctx.closePath();

            const lanGrad = ctx.createLinearGradient(-r, 0, r, 0);
            lanGrad.addColorStop(0, darkShadeColor);
            lanGrad.addColorStop(0.6, baseColor);
            lanGrad.addColorStop(1, highlightColor);
            ctx.fillStyle = lanGrad;
            ctx.fill();
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Winged Shoulder Guards
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(r * 0.2, -r * 0.8, 6, 0, Math.PI * 2);
            ctx.arc(r * 0.2, r * 0.8, 6, 0, Math.PI * 2);
            ctx.fill();

            // Dragoon Horned Visor
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(2, 0, 7, 0, Math.PI * 2);
            ctx.fill();

          } else if (role === 4) {
            // --- MAGE (Rune Knight): Flared Star Wizard Robes & Orbiting Magic Crystals ---
            const r = entity.radius;

            // Flared Star / Octagonal Wizard Robe
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI) / 4;
              const rad = i % 2 === 0 ? r * 1.1 : r * 0.75;
              const px = Math.cos(a) * rad;
              const py = Math.sin(a) * rad;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();

            const mageGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.1);
            mageGrad.addColorStop(0, '#e9d5ff');
            mageGrad.addColorStop(0.5, baseColor);
            mageGrad.addColorStop(1, '#3b0764');
            ctx.fillStyle = mageGrad;
            ctx.fill();
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Pointed Wizard Hat / Hood Center
            ctx.beginPath();
            ctx.arc(-2, 0, r * 0.55, 0, Math.PI * 2);
            ctx.fillStyle = '#1e1b4b';
            ctx.fill();
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 3 Orbiting Arcane Rune Crystals
            const orbTime = Date.now() * 0.004;
            for (let c = 0; c < 3; c++) {
              const ca = orbTime + (c * Math.PI * 2) / 3;
              const cx = Math.cos(ca) * (r + 7);
              const cy = Math.sin(ca) * (r + 7);
              ctx.beginPath();
              ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
              ctx.fillStyle = '#f0abfc';
              ctx.fill();
            }

          } else {
            // --- WARRIOR (Sword Man): Hexagonal V-Torso & Heavy Shoulder Pauldrons ---
            const r = entity.radius;

            // Rear Waving Cape
            ctx.fillStyle = darkShadeColor;
            ctx.beginPath();
            ctx.moveTo(-r, -r * 0.7);
            ctx.lineTo(-r - 10, -r * 0.9);
            ctx.lineTo(-r - 12, 0);
            ctx.lineTo(-r - 10, r * 0.9);
            ctx.lineTo(-r, r * 0.7);
            ctx.fill();

            // Broad Hexagonal V-Torso
            ctx.beginPath();
            ctx.moveTo(r * 1.05, 0); // Chest tip
            ctx.lineTo(r * 0.4, -r * 0.95); // Right pauldron
            ctx.lineTo(-r * 0.6, -r * 0.7); // Right waist
            ctx.lineTo(-r * 0.8, 0); // Back
            ctx.lineTo(-r * 0.6, r * 0.7); // Left waist
            ctx.lineTo(r * 0.4, r * 0.95); // Left pauldron
            ctx.closePath();

            const warGrad = ctx.createLinearGradient(-r, 0, r, 0);
            warGrad.addColorStop(0, darkShadeColor);
            warGrad.addColorStop(0.5, baseColor);
            warGrad.addColorStop(1, highlightColor);
            ctx.fillStyle = warGrad;
            ctx.fill();
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Knight Helmet Feathery Crest Plume
            ctx.fillStyle = isRedTeam ? '#ef4444' : '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(-r * 0.2, 0);
            ctx.quadraticCurveTo(-r * 0.8, -4, -r * 1.2, 0);
            ctx.quadraticCurveTo(-r * 0.8, 4, -r * 0.2, 0);
            ctx.fill();
          }

          // Golden Highlight Ring around Player Character
          if (entity === player) {
            ctx.beginPath();
            ctx.arc(0, 0, entity.radius + 7, 0, Math.PI * 2);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          // 5. Weapon Rendering according to Role
          ctx.save();
          if (entity.swingTimer > 0 && entity.swingDuration > 0) {
            const swingProg = 1 - entity.swingTimer / entity.swingDuration;
            const swingAngle = -Math.PI / 2.2 + swingProg * (Math.PI * 0.9);
            ctx.rotate(swingAngle);

            // Glowing 3D Slash Arc Blade Trail
            ctx.beginPath();
            ctx.arc(0, 0, entity.data.atkRange + 14, -Math.PI / 3, Math.PI / 3);
            ctx.strokeStyle = isRedTeam ? '#ef4444' : entity.data.color;
            ctx.lineWidth = 5;
            ctx.globalAlpha = Math.max(0, 1 - swingProg);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          // 3D Metallic Weapon
          if (role === 3) {
            // Long Dragoon Spear / Trident
            const spearGrad = ctx.createLinearGradient(6, 0, 48, 0);
            spearGrad.addColorStop(0, '#475569');
            spearGrad.addColorStop(0.7, '#f8fafc');
            spearGrad.addColorStop(1, '#fbbf24');
            ctx.fillStyle = spearGrad;
            ctx.fillRect(6, 3, 42, 4);

            // Trident Prongs
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(48, 5);
            ctx.lineTo(56, 1);
            ctx.lineTo(56, 9);
            ctx.fill();
            ctx.fillRect(44, -2, 3, 14); // Crossbar
          } else if (role === 4) {
            // Arcane Staff with Gem
            ctx.fillStyle = '#78350f';
            ctx.fillRect(6, 3, 30, 4);
            // Crystal Gem Top
            ctx.beginPath();
            ctx.arc(38, 5, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#c084fc';
            ctx.fill();
            ctx.strokeStyle = '#f0abfc';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (role === 1) {
            // Heavy Spiked War Hammer
            ctx.fillStyle = '#475569';
            ctx.fillRect(6, 3, 26, 4);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(32, -2, 10, 14); // Hammerhead
          } else if (role === 0) {
            // Greatsword
            const swGrad = ctx.createLinearGradient(8, 0, 36, 0);
            swGrad.addColorStop(0, '#64748b');
            swGrad.addColorStop(0.5, '#f8fafc');
            swGrad.addColorStop(1, '#94a3b8');
            ctx.fillStyle = swGrad;
            ctx.fillRect(8, 3, 28, 6);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(6, -1, 4, 14); // Golden Crossguard
          } else {
            // Assassin Main Dagger
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(8, 4, 18, 5);
          }
          ctx.restore();

          // 6. Glowing Visor Eyes (Red for Enemy, Cyan for Ally)
          ctx.fillStyle = isRedTeam ? '#ef4444' : '#38bdf8';
          ctx.beginPath();
          ctx.arc(entity.radius * 0.45, -3.5, 2.5, 0, Math.PI * 2);
          ctx.arc(entity.radius * 0.45, 3.5, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore(); // Restore character angle rotation

          // 7. Overhead 3D HP Bar & Status Overlay (Unrotated)
          const barW = 42;
          const barH = 6;
          const barX = -barW / 2;
          const barY = -entity.radius - 18;

          // Dark Bar Frame Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

          // Fill HP Progress Bar
          const hpRatio = Math.max(0, entity.hp / entity.maxHp);
          const hpGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
          if (isRedTeam) {
            hpGrad.addColorStop(0, '#b91c1c');
            hpGrad.addColorStop(1, '#ef4444');
          } else {
            hpGrad.addColorStop(0, '#0284c7');
            hpGrad.addColorStop(1, '#38bdf8');
          }
          ctx.fillStyle = hpGrad;
          ctx.fillRect(barX, barY, barW * hpRatio, barH);

          // Stun Status Overhead Text
          if (entity.stunTimer > 0) {
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💫 STUNNED', 0, barY - 4);
          }

          ctx.restore(); // Restore entity translation
        }
      });

      // Render Particle System
      particles.addAmbientEmbers(MAP_WIDTH, MAP_HEIGHT);
      particles.updateAndDraw(ctx, dt);

      // --- RENDER DYNAMIC LIGHTING & FOG OF WAR VISION LAYER ---
      const activeLights: LightSource[] = [];

      // Map torches (ambient light points)
      MAP_TORCHES.forEach((t) => {
        activeLights.push(t);
      });

      // Friendly Entities (Player & Blue Bots) grant real-time vision to BLUE team
      entities.forEach((e) => {
        if (!e.isDead && e.team === 'BLUE') {
          activeLights.push({
            x: e.x,
            y: e.y,
            radius: e === player ? 400 : 300,
            color: e.data.glowColor || '#38bdf8',
            intensity: 1.0,
          });
        }
      });

      lighting.renderLightingLayer(
        ctx,
        MAP_WIDTH,
        MAP_HEIGHT,
        activeLights,
        MAP_WALLS
      );

      ctx.restore();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, selectedCharId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;
    const cam = cameraRef.current;
    mousePosRef.current = {
      x: screenX + cam.x,
      y: screenY + cam.y,
    };
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
      {/* Game Canvas Container */}
      <div
        onMouseMove={handleMouseMove}
        className="relative w-full max-w-[1400px] aspect-[14/8] shadow-2xl rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-900 cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
        />

        {/* HUD Overlay */}
        {gameState === 'PLAYING' && playerRef.current && (
          <HUD
            player={playerRef.current}
            entities={entitiesRef.current}
            flags={flagsRef.current}
            items={itemsRef.current}
            walls={MAP_WALLS}
            bushes={MAP_BUSHES}
            stats={stats}
            killFeed={killFeed}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            mapWidth={MAP_WIDTH}
            mapHeight={MAP_HEIGHT}
          />
        )}

        {/* Hero Selection Modal */}
        {gameState === 'MENU' && (
          <CharacterSelectModal
            selectedCharId={selectedCharId}
            onSelectChar={handleSelectChar}
            onStartGame={() => startMatch()}
            gameMode={gameMode}
            onSelectGameMode={setGameMode}
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            roomCodeInput={roomCodeInput}
            onRoomCodeInputChange={setRoomCodeInput}
            roomState={roomState}
            isRoomHost={roomState ? roomState.players.find((p) => p.id === mpClientRef.current?.playerId)?.isHost : false}
            isReady={isReady}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onToggleReady={handleToggleReady}
            errorMessage={errorMessage}
          />
        )}

        {/* Game Over Modal */}
        {gameState === 'GAMEOVER' && (
          <GameOverModal
            stats={stats}
            playerKills={playerKills}
            playerDeaths={playerDeaths}
            onPlayAgain={startMatch}
            onReturnToSelect={() => setGameState('MENU')}
          />
        )}
      </div>
    </div>
  );
};
