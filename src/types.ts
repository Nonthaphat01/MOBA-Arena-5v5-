export type Team = 'BLUE' | 'RED';
export type CharacterRole = 'Warrior' | 'Tank' | 'Assassin' | 'Ranged' | 'Mage';

export interface Skill {
  key: string;
  name: string;
  mp: number;
  cd: number;
  description: string;
  iconName: string;
  type: 'attack' | 'dash' | 'aoe' | 'heal' | 'buff' | 'projectile';
}

export interface CharacterData {
  id: number;
  name: string;
  roleTitle: string;
  role: CharacterRole;
  color: string;
  glowColor: string;
  atkRange: number;
  str: number;
  agi: number;
  int: number;
  spd: number;
  arm: number;
  healthReg: number;
  magicRes: number;
  atkSpeed: number;
  avatarIcon: string;
  description: string;
  skills: Skill[];
}

export interface Wall {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'stone' | 'ruin' | 'pillar';
}

export interface BushZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  bladeOffset: number;
}

export interface WaterZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlagZoneData {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  owner: Team | 'NEUTRAL';
  progress: number; // -100 (RED) to 100 (BLUE)
  pulseAngle: number;
}

export interface ItemData {
  id: string;
  x: number;
  y: number;
  type: 'HP' | 'SPEED' | 'STAT' | 'BUFF_FIRE';
  radius: number;
  hover: number;
  despawnTimer: number;
}

export interface DestructibleCrate {
  id: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
}

export interface SpeedPad {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dirX: number;
  dirY: number;
}

export type ParticleType =
  | 'spark'
  | 'slash'
  | 'text'
  | 'blood'
  | 'debris'
  | 'leaf'
  | 'ripple'
  | 'crack'
  | 'ember'
  | 'shockwave'
  | 'aura'
  | 'projectile';

export interface Particle {
  id: string;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  text?: string;
  angle?: number;
  range?: number;
  targetX?: number;
  targetY?: number;
}

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
}

export interface KillFeedEntry {
  id: string;
  killerName: string;
  killerTeam: Team;
  victimName: string;
  victimTeam: Team;
  timestamp: number;
  text: string;
}

export interface GameStats {
  blueScore: number;
  redScore: number;
  matchTimer: number;
  blueKills: number;
  redKills: number;
}

export type GameMode = 'PRACTICE_5V5' | 'MULTIPLAYER_1V1';

export interface RoomPlayer {
  id: string;
  name: string;
  team: Team;
  characterId: number;
  isReady: boolean;
  isLockedIn?: boolean;
  isHost?: boolean;
}

export type PlayerInfo = RoomPlayer;

export interface RoomState {
  code: string;
  status: 'LOBBY' | 'SELECTING' | 'PLAYING';
  players: RoomPlayer[];
}

