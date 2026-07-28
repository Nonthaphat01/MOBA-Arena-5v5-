import { BushZone, DestructibleCrate, SpeedPad, Wall, WaterZone } from '../types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function circleToBoxCollision(
  cx: number,
  cy: number,
  radius: number,
  box: Box
): { hit: boolean; normalX: number; normalY: number; overlap: number } {
  const closestX = Math.max(box.x, Math.min(cx, box.x + box.w));
  const closestY = Math.max(box.y, Math.min(cy, box.y + box.h));

  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq < radius * radius) {
    let dist = Math.sqrt(distSq);
    if (dist === 0) {
      // Inside box center
      return { hit: true, normalX: 1, normalY: 0, overlap: radius };
    }
    const overlap = radius - dist;
    return {
      hit: true,
      normalX: dx / dist,
      normalY: dy / dist,
      overlap,
    };
  }

  return { hit: false, normalX: 0, normalY: 0, overlap: 0 };
}

export function isPointInBush(x: number, y: number, bushes: BushZone[]): boolean {
  for (const bush of bushes) {
    if (x >= bush.x && x <= bush.x + bush.w && y >= bush.y && y <= bush.y + bush.h) {
      return true;
    }
  }
  return false;
}

export function getBushAt(x: number, y: number, bushes: BushZone[]): BushZone | null {
  for (const bush of bushes) {
    if (x >= bush.x && x <= bush.x + bush.w && y >= bush.y && y <= bush.y + bush.h) {
      return bush;
    }
  }
  return null;
}

export function isInWater(x: number, y: number, waters: WaterZone[]): boolean {
  for (const w of waters) {
    if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) {
      return true;
    }
  }
  return false;
}

export function checkSpeedPad(x: number, y: number, pads: SpeedPad[]): { boost: boolean; dirX: number; dirY: number } {
  for (const pad of pads) {
    if (x >= pad.x && x <= pad.x + pad.w && y >= pad.y && y <= pad.y + pad.h) {
      return { boost: true, dirX: pad.dirX, dirY: pad.dirY };
    }
  }
  return { boost: false, dirX: 0, dirY: 0 };
}

export function raycastWallIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  walls: Wall[]
): boolean {
  for (const wall of walls) {
    // Check line segment vs 4 wall segments
    if (lineIntersectsRect(x1, y1, x2, y2, wall)) {
      return true;
    }
  }
  return false;
}

export function lineIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: { x: number; y: number; w: number; h: number }
): boolean {
  if (x1 >= rect.x && x1 <= rect.x + rect.w && y1 >= rect.y && y1 <= rect.y + rect.h) return true;
  if (x2 >= rect.x && x2 <= rect.x + rect.w && y2 >= rect.y && y2 <= rect.y + rect.h) return true;

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  if (maxX < rect.x || minX > rect.x + rect.w || maxY < rect.y || minY > rect.y + rect.h) {
    return false;
  }

  // Check segment against 4 rect edges
  if (lineIntersectsLine(x1, y1, x2, y2, rect.x, rect.y, rect.x + rect.w, rect.y)) return true;
  if (lineIntersectsLine(x1, y1, x2, y2, rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h)) return true;
  if (lineIntersectsLine(x1, y1, x2, y2, rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h)) return true;
  if (lineIntersectsLine(x1, y1, x2, y2, rect.x, rect.y + rect.h, rect.x, rect.y)) return true;

  return false;
}

function lineIntersectsLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

export function isEntityVisibleTo(
  observer: { x: number; y: number; team: string },
  target: { x: number; y: number; team: string; isDead: boolean },
  bushes: BushZone[],
  walls: Wall[],
  maxVisionRadius: number = 350
): boolean {
  if (target.isDead) return false;
  if (observer.team === target.team) return true; // Teammates always visible

  // Vision range check in fog of war
  const dist = Math.hypot(observer.x - target.x, observer.y - target.y);
  if (dist > maxVisionRadius) {
    return false;
  }

  // Wall line-of-sight check
  if (raycastWallIntersection(observer.x, observer.y, target.x, target.y, walls)) {
    return false;
  }

  // Bush visibility logic
  const targetInBush = isPointInBush(target.x, target.y, bushes);
  const observerInBush = isPointInBush(observer.x, observer.y, bushes);

  if (targetInBush) {
    if (!observerInBush) {
      // Target is hiding in bush while observer is outside
      return dist < 70; // Reveal if extremely close inside the bush area
    } else {
      // Both in bush: check if in same bush
      const bushObs = getBushAt(observer.x, observer.y, bushes);
      const bushTgt = getBushAt(target.x, target.y, bushes);
      if (bushObs && bushTgt && bushObs.id === bushTgt.id) {
        return true;
      }
      return false;
    }
  }

  return true;
}

export function isEntityVisibleToTeam(
  team: 'BLUE' | 'RED',
  target: { x: number; y: number; team: string; isDead: boolean },
  allEntities: { x: number; y: number; team: string; isDead: boolean }[],
  bushes: BushZone[],
  walls: Wall[]
): boolean {
  if (target.isDead) return false;
  if (target.team === team) return true;

  // Check if ANY active teammate sees the target
  for (const entity of allEntities) {
    if (!entity.isDead && entity.team === team) {
      if (isEntityVisibleTo(entity, target, bushes, walls, 350)) {
        return true;
      }
    }
  }

  return false;
}
