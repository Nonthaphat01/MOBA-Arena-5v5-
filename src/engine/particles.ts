import { Particle } from '../types';

export class ParticleSystem {
  public particles: Particle[] = [];
  public screenShakeTime: number = 0;
  public screenShakeIntensity: number = 0;

  public triggerScreenShake(intensity: number, duration: number) {
    if (intensity > this.screenShakeIntensity) {
      this.screenShakeIntensity = intensity;
      this.screenShakeTime = duration;
    }
  }

  public addSparkSplatter(x: number, y: number, color: string, count: number = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        id: Math.random().toString(),
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  public addBloodSplatter(x: number, y: number, hitAngle: number, count: number = 10) {
    for (let i = 0; i < count; i++) {
      const spreadAngle = hitAngle + (Math.random() - 0.5) * 1.2;
      const speed = 3 + Math.random() * 7;
      this.particles.push({
        id: Math.random().toString(),
        type: 'blood',
        x,
        y,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color: '#ef4444',
        size: 3 + Math.random() * 3,
      });
    }
  }

  public addWallDebris(x: number, y: number) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        id: Math.random().toString(),
        type: 'debris',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        color: Math.random() > 0.5 ? '#94a3b8' : '#64748b',
        size: 3 + Math.random() * 4,
      });
    }

    // Ground Crack Decal
    this.particles.push({
      id: Math.random().toString(),
      type: 'crack',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 2.5,
      maxLife: 2.5,
      color: '#334155',
      size: 25 + Math.random() * 10,
    });
  }

  public addLeafRustle(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        id: Math.random().toString(),
        type: 'leaf',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1, // Floats slightly upward
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        color: Math.random() > 0.5 ? '#22c55e' : '#16a34a',
        size: 3 + Math.random() * 3,
      });
    }
  }

  public addWaterRipple(x: number, y: number) {
    this.particles.push({
      id: Math.random().toString(),
      type: 'ripple',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.6,
      maxLife: 0.6,
      color: '#38bdf8',
      size: 8,
    });
  }

  public addSlash(x: number, y: number, angle: number, color: string, range: number) {
    this.particles.push({
      id: Math.random().toString(),
      type: 'slash',
      x: x + Math.cos(angle) * (range * 0.5),
      y: y + Math.sin(angle) * (range * 0.5),
      vx: 0,
      vy: 0,
      angle,
      range,
      life: 0.18,
      maxLife: 0.18,
      color,
      size: range,
    });
  }

  public addShockwave(x: number, y: number, color: string, maxRadius: number) {
    this.particles.push({
      id: Math.random().toString(),
      type: 'shockwave',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.35,
      maxLife: 0.35,
      color,
      size: maxRadius,
    });
  }

  public addDamageText(x: number, y: number, text: string, color: string = '#ffffff', isCritical: boolean = false) {
    this.particles.push({
      id: Math.random().toString(),
      type: 'text',
      x: x + (Math.random() - 0.5) * 15,
      y: y - 15,
      text,
      vx: (Math.random() - 0.5) * 1.5,
      vy: isCritical ? -3.0 : -2.0,
      life: isCritical ? 1.0 : 0.8,
      maxLife: isCritical ? 1.0 : 0.8,
      color,
      size: isCritical ? 22 : 16,
    });
  }

  public addAmbientEmbers(width: number, height: number) {
    if (Math.random() < 0.3) {
      this.particles.push({
        id: Math.random().toString(),
        type: 'ember',
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.5 - Math.random() * 0.8,
        life: 2.0 + Math.random() * 2.0,
        maxLife: 4.0,
        color: Math.random() > 0.5 ? 'rgba(251, 191, 36, 0.6)' : 'rgba(56, 189, 248, 0.6)',
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  public updateAndDraw(ctx: CanvasRenderingContext2D, dt: number) {
    // Screen shake decay
    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= dt;
      if (this.screenShakeTime <= 0) {
        this.screenShakeIntensity = 0;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      const alpha = Math.max(0, p.life / p.maxLife);

      if (p.type === 'text') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.96; // slow down bounce
        ctx.font = `800 ${p.size}px "Segoe UI", sans-serif`;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(p.text || '', p.x, p.y);
      } else if (p.type === 'slash') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(0, 0, (p.range || 40) * 0.75, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 8 * alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.stroke();
      } else if (p.type === 'shockwave') {
        const radius = (1 - p.life / p.maxLife) * p.size;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * alpha;
        ctx.globalAlpha = alpha;
        ctx.stroke();
      } else if (p.type === 'crack') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.4;
        ctx.fill();
      } else if (p.type === 'ripple') {
        const radius = (1 - p.life / p.maxLife) * p.size * 2 + 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * alpha;
        ctx.globalAlpha = alpha;
        ctx.stroke();
      } else if (p.type === 'ember') {
        p.x += p.vx;
        p.y += p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fill();
      } else {
        // Sparks, blood, debris, leaves
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
