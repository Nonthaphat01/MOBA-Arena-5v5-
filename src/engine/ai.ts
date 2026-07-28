import { BushZone, CharacterData, DestructibleCrate, FlagZoneData, ItemData, SpeedPad, Wall } from '../types';
import { getBushAt, isInWater, isPointInBush, lineIntersectsRect, raycastWallIntersection, isEntityVisibleToTeam } from './physics';

export interface CharacterAIContext {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  impulseX: number;
  impulseY: number;
  walkCycle: number;
  swingTimer: number;
  swingDuration: number;
  swingStartAngle: number;
  hitFlashTimer: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  team: 'BLUE' | 'RED';
  data: CharacterData;
  bStr: number;
  bAgi: number;
  bInt: number;
  isDead: boolean;
  atkCooldown: number;
  skillCDs: number[];
  speedBuffTimer: number;
  stunTimer: number;
  radius: number;
  respawnTimer?: number;
  spawnX?: number;
  spawnY?: number;
}

/**
 * Calculates a clear waypoint around blocking walls using bounding box corners.
 */
function findPathWaypoint(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  walls: Wall[]
): { x: number; y: number } {
  // If direct ray is clear, proceed directly to target
  if (!raycastWallIntersection(startX, startY, targetX, targetY, walls)) {
    return { x: targetX, y: targetY };
  }

  // Find walls intersecting direct path
  const blocking = walls.filter((w) => lineIntersectsRect(startX, startY, targetX, targetY, w));
  if (blocking.length === 0) return { x: targetX, y: targetY };

  // Select closest wall
  let closestWall = blocking[0];
  let minD = 99999;
  blocking.forEach((w) => {
    const centerDist = Math.hypot(startX - (w.x + w.w / 2), startY - (w.y + w.h / 2));
    if (centerDist < minD) {
      minD = centerDist;
      closestWall = w;
    }
  });

  // Calculate 4 outer bypass waypoints (32px clearance outside wall)
  const margin = 32;
  const corners = [
    { x: closestWall.x - margin, y: closestWall.y - margin }, // Top-Left
    { x: closestWall.x + closestWall.w + margin, y: closestWall.y - margin }, // Top-Right
    { x: closestWall.x + closestWall.w + margin, y: closestWall.y + closestWall.h + margin }, // Bottom-Right
    { x: closestWall.x - margin, y: closestWall.y + closestWall.h + margin }, // Bottom-Left
  ];

  let bestCorner: { x: number; y: number } | null = null;
  let minTotalDist = 999999;

  corners.forEach((c) => {
    // Check if path to corner is clear
    if (!raycastWallIntersection(startX, startY, c.x, c.y, walls)) {
      const d1 = Math.hypot(c.x - startX, c.y - startY);
      const d2 = Math.hypot(targetX - c.x, targetY - c.y);
      const total = d1 + d2;
      if (total < minTotalDist) {
        minTotalDist = total;
        bestCorner = c;
      }
    }
  });

  return bestCorner || { x: targetX, y: targetY };
}

export class SmartAIEngine {
  public static computeBotInput(
    self: CharacterAIContext,
    allEntities: CharacterAIContext[],
    flags: FlagZoneData[],
    items: ItemData[],
    bushes: BushZone[],
    walls: Wall[],
    crates?: DestructibleCrate[],
    speedPads?: SpeedPad[]
  ): {
    targetVx: number;
    targetVy: number;
    targetAngle: number;
    wantAttack: boolean;
    wantSkill: number | null; // 0, 1, 2 or null
  } {
    if (self.isDead || self.stunTimer > 0) {
      return { targetVx: 0, targetVy: 0, targetAngle: self.angle, wantAttack: false, wantSkill: null };
    }

    const role = self.data.id; // 0: Warrior, 1: Tank, 2: Assassin, 3: Lancer, 4: Mage
    const hpPct = self.hp / self.maxHp;

    // Flee thresholds per class
    const fleeThresholds = [0.22, 0.12, 0.32, 0.20, 0.28];
    const fleeHP = fleeThresholds[role] || 0.2;
    const atkRange = self.data.atkRange;

    // 1. Perception & Team State Analysis
    let closestEnemy: CharacterAIContext | null = null;
    let minEnemyDist = 9999;
    let weakEnemy: CharacterAIContext | null = null;
    let minEnemyHP = 9999;
    let squishyEnemy: CharacterAIContext | null = null;
    let minSquishyDist = 9999;

    let closestAllyInNeed: CharacterAIContext | null = null;
    let minAllyHP = 9999;
    let alliesNearbyCount = 0;
    let enemiesNearbyCount = 0;

    allEntities.forEach((e) => {
      if (e.isDead || e === self) return;

      const dist = Math.hypot(e.x - self.x, e.y - self.y);

      if (e.team !== self.team) {
        // Line of sight, stealth bush & Fog of War check
        const visibleToBotTeam = isEntityVisibleToTeam(self.team, e, allEntities, bushes, walls);
        if (!visibleToBotTeam) return; // Cannot see enemy hidden in Fog of War!

        if (dist < 500) enemiesNearbyCount++;

        if (dist < minEnemyDist) {
          minEnemyDist = dist;
          closestEnemy = e;
        }

        if (dist < 600 && e.hp < minEnemyHP) {
          minEnemyHP = e.hp;
          weakEnemy = e;
        }

        // Squishy targets (Mage = 4, Lancer = 3, Assassin = 2)
        if ((e.data.id === 4 || e.data.id === 3 || e.data.id === 2) && dist < minSquishyDist) {
          minSquishyDist = dist;
          squishyEnemy = e;
        }
      } else {
        // Teammates
        if (dist < 500) alliesNearbyCount++;
        if (e.hp < e.maxHp * 0.75 && e.hp < minAllyHP && dist < 500) {
          minAllyHP = e.hp;
          closestAllyInNeed = e;
        }
      }
    });

    // 2. Identify Flag, Crate & Item Objectives
    let targetFlag: FlagZoneData | null = null;
    let minFlagDist = 9999;
    flags.forEach((f) => {
      if (f.owner !== self.team) {
        const d = Math.hypot(f.x - self.x, f.y - self.y);
        if (d < minFlagDist) {
          minFlagDist = d;
          targetFlag = f;
        }
      }
    });

    // If all flags are captured by team, patrol center or closest flag
    if (!targetFlag && flags.length > 0) {
      targetFlag = flags.find((f) => f.id === 'f_mid') || flags[0];
    }

    let closestItem: ItemData | null = null;
    let minItemDist = 9999;
    items.forEach((it) => {
      const d = Math.hypot(it.x - self.x, it.y - self.y);
      if (d < 400 && d < minItemDist) {
        minItemDist = d;
        closestItem = it;
      }
    });

    // Check destructible crates nearby
    let targetCrate: DestructibleCrate | null = null;
    let minCrateDist = 9999;
    if (crates) {
      crates.forEach((c) => {
        if (c.hp > 0) {
          const d = Math.hypot(c.x - self.x, c.y - self.y);
          if (d < 220 && d < minCrateDist) {
            minCrateDist = d;
            targetCrate = c;
          }
        }
      });
    }

    // 3. Determine High-Level AI Behavior State
    type AIState = 'FLEE' | 'ITEM' | 'CRATE' | 'BUSH_AMBUSH' | 'PEEL' | 'ENGAGE' | 'FLAG' | 'REGROUP';
    let state: AIState = 'FLAG';

    const isOutnumbered = enemiesNearbyCount > alliesNearbyCount + 1;

    if (hpPct < fleeHP || (isOutnumbered && hpPct < 0.45)) {
      state = 'FLEE';
    } else if (alliesNearbyCount === 0 && enemiesNearbyCount >= 2 && hpPct < 0.6) {
      state = 'REGROUP';
    } else if (closestItem && (closestItem.type === 'HP' ? hpPct < 0.82 : true)) {
      state = 'ITEM';
    } else if (role === 1 && closestAllyInNeed && minEnemyDist < 350) {
      // Tank Peeling: guard wounded ally
      state = 'PEEL';
    } else if (targetCrate && minEnemyDist > 300 && (hpPct < 0.9 || items.length === 0)) {
      // Break crate for power-ups when no immediate enemy threat
      state = 'CRATE';
    } else if (role === 2 && !isPointInBush(self.x, self.y, bushes) && closestEnemy && minEnemyDist > 200 && minEnemyDist < 600) {
      // Assassin Ambush: lurk in nearby bush
      const currentBush = getBushAt(self.x, self.y, bushes);
      if (!currentBush && bushes.length > 0) {
        state = 'BUSH_AMBUSH';
      } else {
        state = 'ENGAGE';
      }
    } else if (closestEnemy && minEnemyDist < 520) {
      state = 'ENGAGE';
    } else if (targetFlag) {
      state = 'FLAG';
    }

    let rawTargetX = self.x;
    let rawTargetY = self.y;
    let wantAttack = false;
    let wantSkill: number | null = null;
    let aimAngle = self.angle;

    // 4. State Execution Logic
    if (state === 'FLEE' || state === 'REGROUP') {
      const baseX = self.spawnX ?? (self.team === 'BLUE' ? 120 : 1280);
      const baseY = self.spawnY ?? 400;
      rawTargetX = baseX;
      rawTargetY = baseY;

      if (closestEnemy) {
        aimAngle = Math.atan2(self.y - closestEnemy.y, self.x - closestEnemy.x);
      }

      // Use dash/mobility skill to escape if available
      if (self.skillCDs[1] <= 0 && self.mp >= self.data.skills[1].mp && self.data.skills[1].type === 'dash') {
        wantSkill = 1;
      }
    } else if (state === 'ITEM' && closestItem) {
      rawTargetX = (closestItem as ItemData).x;
      rawTargetY = (closestItem as ItemData).y;
      aimAngle = Math.atan2(rawTargetY - self.y, rawTargetX - self.x);
    } else if (state === 'CRATE' && targetCrate) {
      rawTargetX = targetCrate.x;
      rawTargetY = targetCrate.y;
      aimAngle = Math.atan2(rawTargetY - self.y, rawTargetX - self.x);
      if (minCrateDist <= atkRange + targetCrate.radius + 15 && self.atkCooldown <= 0) {
        wantAttack = true;
      }
    } else if (state === 'BUSH_AMBUSH') {
      let bestBush: BushZone | null = null;
      let bestD = 9999;
      bushes.forEach((b) => {
        const d = Math.hypot(b.x + b.w / 2 - self.x, b.y + b.h / 2 - self.y);
        if (d < bestD) {
          bestD = d;
          bestBush = b;
        }
      });
      if (bestBush) {
        rawTargetX = (bestBush as BushZone).x + (bestBush as BushZone).w / 2;
        rawTargetY = (bestBush as BushZone).y + (bestBush as BushZone).h / 2;
      }
      aimAngle = Math.atan2(rawTargetY - self.y, rawTargetX - self.x);
    } else if (state === 'PEEL' && closestAllyInNeed && closestEnemy) {
      // Bodyblock position between enemy and wounded ally
      rawTargetX = (closestAllyInNeed.x + closestEnemy.x) / 2;
      rawTargetY = (closestAllyInNeed.y + closestEnemy.y) / 2;
      aimAngle = Math.atan2(closestEnemy.y - self.y, closestEnemy.x - self.x);

      if (minEnemyDist < 85 && self.skillCDs[0] <= 0 && self.mp >= self.data.skills[0].mp) {
        wantSkill = 0; // Shield Bash to peel
      }
    } else if (state === 'FLAG' && targetFlag) {
      rawTargetX = targetFlag.x;
      rawTargetY = targetFlag.y;
      aimAngle = Math.atan2(rawTargetY - self.y, rawTargetX - self.x);
    } else if (state === 'ENGAGE' && closestEnemy) {
      // Pick focus target: Assassin targets squishy, executioners pick weak targets
      const mainTarget: CharacterAIContext =
        role === 2 && squishyEnemy
          ? squishyEnemy
          : weakEnemy && minEnemyHP < 150
          ? weakEnemy
          : closestEnemy;

      const d = Math.hypot(mainTarget.x - self.x, mainTarget.y - self.y);

      // Predictive Aiming (Lead shot)
      const leadTime = Math.min(0.35, d / 450);
      const predictedX = mainTarget.x + mainTarget.vx * (mainTarget.data.spd * 0.01 * 60) * leadTime;
      const predictedY = mainTarget.y + mainTarget.vy * (mainTarget.data.spd * 0.01 * 60) * leadTime;
      aimAngle = Math.atan2(predictedY - self.y, predictedX - self.x);

      // Kiting & Spacing Positioning
      if (role === 4) {
        // Mage: Maintain distance ~160px
        if (d < 120) {
          // Back up
          rawTargetX = self.x - (mainTarget.x - self.x);
          rawTargetY = self.y - (mainTarget.y - self.y);
        } else if (d > 220) {
          rawTargetX = predictedX;
          rawTargetY = predictedY;
        } else {
          // Strafe around target
          const sideAngle = aimAngle + Math.PI / 2;
          rawTargetX = self.x + Math.cos(sideAngle) * 60;
          rawTargetY = self.y + Math.sin(sideAngle) * 60;
        }
      } else if (role === 3) {
        // Lancer: Sweet spot ~110px
        if (d < 80) {
          rawTargetX = self.x - (mainTarget.x - self.x);
          rawTargetY = self.y - (mainTarget.y - self.y);
        } else if (d > 140) {
          rawTargetX = predictedX;
          rawTargetY = predictedY;
        } else {
          rawTargetX = self.x;
          rawTargetY = self.y;
        }
      } else {
        // Melee Rush (Warrior, Tank, Assassin)
        rawTargetX = predictedX;
        rawTargetY = predictedY;
      }

      // Basic Attack Execution
      if (d <= atkRange + mainTarget.radius + 15 && self.atkCooldown <= 0) {
        wantAttack = true;
      }

      // Tactical Skill Matrix
      if (role === 0) {
        // Warrior
        if (d < 85 && self.skillCDs[0] <= 0 && self.mp >= self.data.skills[0].mp) {
          wantSkill = 0; // Heavy Slash
        } else if (d > 110 && d < 220 && self.skillCDs[1] <= 0 && self.mp >= self.data.skills[1].mp) {
          wantSkill = 1; // Dash Close
        } else if (d < 160 && enemiesNearbyCount >= 2 && self.skillCDs[2] <= 0 && self.mp >= self.data.skills[2].mp) {
          wantSkill = 2; // Ultimate Slam
        }
      } else if (role === 1) {
        // Tank
        if (d < 80 && self.skillCDs[0] <= 0 && self.mp >= self.data.skills[0].mp) {
          wantSkill = 0; // Shield Bash Stun
        } else if (d < 150 && self.skillCDs[2] <= 0 && self.mp >= self.data.skills[2].mp) {
          wantSkill = 2; // Fortress Roar
        }
      } else if (role === 2) {
        // Assassin
        if (d > 80 && d < 240 && self.skillCDs[1] <= 0 && self.mp >= self.data.skills[1].mp) {
          wantSkill = 1; // Shadow Step Gap Close
        } else if (d < 75 && self.skillCDs[0] <= 0 && self.mp >= self.data.skills[0].mp) {
          wantSkill = 0; // Dual Strike
        } else if (d < 140 && (mainTarget.hp < mainTarget.maxHp * 0.5 || hpPct < 0.4) && self.skillCDs[2] <= 0 && self.mp >= self.data.skills[2].mp) {
          wantSkill = 2; // Execution Burst
        }
      } else if (role === 3) {
        // Lancer
        if (d <= 140 && self.skillCDs[0] <= 0 && self.mp >= self.data.skills[0].mp) {
          wantSkill = 0; // Piercing Thrust
        } else if (d < 90 && self.skillCDs[1] <= 0 && self.mp >= self.data.skills[1].mp) {
          wantSkill = 1; // Backstep Dash
        } else if (d < 180 && self.skillCDs[2] <= 0 && self.mp >= self.data.skills[2].mp) {
          wantSkill = 2; // Dragon Lance Charge
        }
      } else if (role === 4) {
        // Mage
        if (closestAllyInNeed && self.skillCDs[1] <= 0 && self.mp >= self.data.skills[1].mp) {
          wantSkill = 1; // Sacred Aura Heal
        } else if (d <= 180 && self.skillCDs[0] <= 0 && self.mp >= self.data.skills[0].mp) {
          wantSkill = 0; // Arcane Bolt
        } else if (d < 220 && enemiesNearbyCount >= 2 && self.skillCDs[2] <= 0 && self.mp >= self.data.skills[2].mp) {
          wantSkill = 2; // Judgement Tempest
        }
      }
    }

    // Check Speed Pad Routing when traveling long distances
    if (speedPads && Math.hypot(rawTargetX - self.x, rawTargetY - self.y) > 280) {
      speedPads.forEach((pad) => {
        const padCenterX = pad.x + pad.w / 2;
        const padCenterY = pad.y + pad.h / 2;
        const distToPad = Math.hypot(padCenterX - self.x, padCenterY - self.y);
        if (distToPad < 180 && distToPad > 30) {
          // Check if speed pad aligns with travel direction
          const dirToTargetX = (rawTargetX - self.x) / Math.hypot(rawTargetX - self.x, rawTargetY - self.y);
          const dirToTargetY = (rawTargetY - self.y) / Math.hypot(rawTargetX - self.x, rawTargetY - self.y);
          const dot = pad.dirX * dirToTargetX + pad.dirY * dirToTargetY;
          if (dot > 0.2) {
            rawTargetX = padCenterX;
            rawTargetY = padCenterY;
          }
        }
      });
    }

    // 5. Smart Pathfinding (Wall Corner Bypass Waypoints)
    const waypoint = findPathWaypoint(self.x, self.y, rawTargetX, rawTargetY, walls);
    let navTargetX = waypoint.x;
    let navTargetY = waypoint.y;

    // 6. Smooth Tangential Wall Sliding & Steering
    let desiredDx = navTargetX - self.x;
    let desiredDy = navTargetY - self.y;
    const distToNav = Math.hypot(desiredDx, desiredDy);

    if (distToNav > 1) {
      desiredDx /= distToNav;
      desiredDy /= distToNav;
    } else {
      desiredDx = 0;
      desiredDy = 0;
    }

    // Tangential wall face repulsion to glide smoothly near wall edges
    let avoidDx = 0;
    let avoidDy = 0;

    walls.forEach((w) => {
      const closestX = Math.max(w.x, Math.min(self.x, w.x + w.w));
      const closestY = Math.max(w.y, Math.min(self.y, w.y + w.h));
      const dx = self.x - closestX;
      const dy = self.y - closestY;
      const dist = Math.hypot(dx, dy);

      if (dist < 42 && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;

        // Tangent vectors along wall face
        const t1x = -ny;
        const t1y = nx;
        const t2x = ny;
        const t2y = -nx;

        const dot1 = desiredDx * t1x + desiredDy * t1y;
        const dot2 = desiredDx * t2x + desiredDy * t2y;

        const chosenTx = dot1 >= dot2 ? t1x : t2x;
        const chosenTy = dot1 >= dot2 ? t1y : t2y;

        const factor = (42 - dist) / 42;
        avoidDx += (nx * 0.7 + chosenTx * 0.9) * factor;
        avoidDy += (ny * 0.7 + chosenTy * 0.9) * factor;
      }
    });

    let finalVx = desiredDx + avoidDx;
    let finalVy = desiredDy + avoidDy;

    const finalMag = Math.hypot(finalVx, finalVy);
    if (finalMag > 0.1) {
      finalVx /= finalMag;
      finalVy /= finalMag;
    } else {
      finalVx = 0;
      finalVy = 0;
    }

    // Determine target facing angle
    const targetAngle =
      state === 'ENGAGE' || wantAttack || wantSkill !== null
        ? aimAngle
        : finalMag > 0.1
        ? Math.atan2(finalVy, finalVx)
        : self.angle;

    return {
      targetVx: finalVx,
      targetVy: finalVy,
      targetAngle,
      wantAttack,
      wantSkill,
    };
  }
}


