import { LightSource, Wall } from '../types';

export class LightingEngine {
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = width;
    this.lightCanvas.height = height;
    this.lightCtx = this.lightCanvas.getContext('2d')!;
  }

  public resize(width: number, height: number) {
    this.lightCanvas.width = width;
    this.lightCanvas.height = height;
  }

  public renderLightingLayer(
    mainCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    lights: LightSource[],
    walls: Wall[]
  ) {
    const lctx = this.lightCtx;
    lctx.clearRect(0, 0, width, height);

    // Ambient Darkness Overlay (Rich Pitch Dark Fog of War)
    lctx.fillStyle = 'rgba(3, 7, 18, 0.94)';
    lctx.fillRect(0, 0, width, height);

    // Cut out vision holes using destination-out
    lctx.save();
    lctx.globalCompositeOperation = 'destination-out';

    // 1. Render all friendly vision light cutouts
    lights.forEach((light) => {
      const grad = lctx.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        light.radius
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.55, `rgba(255, 255, 255, ${Math.min(1.0, light.intensity)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      lctx.fill();
    });

    lctx.restore();

    // 2. Render soft colored glow layer on top of light cutouts
    lctx.save();
    lctx.globalCompositeOperation = 'lighter';
    lights.forEach((light) => {
      const grad = lctx.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        light.radius * 0.8
      );
      grad.addColorStop(0, light.color);
      grad.addColorStop(1, 'transparent');

      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.arc(light.x, light.y, light.radius * 0.8, 0, Math.PI * 2);
      lctx.fill();
    });
    lctx.restore();

    // 3. Render Wall Shadows (Directional shadow projection from global light angle)
    lctx.save();
    lctx.fillStyle = 'rgba(5, 8, 16, 0.45)';
    const shadowDirX = 0.5; // Slight angle from top-left sun/moon
    const shadowDirY = 0.8;

    walls.forEach((wall) => {
      lctx.beginPath();
      lctx.moveTo(wall.x, wall.y + wall.h);
      lctx.lineTo(wall.x + wall.w, wall.y + wall.h);
      lctx.lineTo(wall.x + wall.w + shadowDirX * 25, wall.y + wall.h + shadowDirY * 25);
      lctx.lineTo(wall.x + shadowDirX * 25, wall.y + wall.h + shadowDirY * 25);
      lctx.closePath();
      lctx.fill();
    });
    lctx.restore();

    // 4. Apply lighting composite canvas onto main game canvas
    mainCtx.save();
    mainCtx.drawImage(this.lightCanvas, 0, 0);

    // 5. Screen Vignette for cinematic focus
    const vigGrad = mainCtx.createRadialGradient(
      width / 2,
      height / 2,
      Math.max(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75
    );
    vigGrad.addColorStop(0, 'transparent');
    vigGrad.addColorStop(1, 'rgba(3, 7, 18, 0.55)');

    mainCtx.fillStyle = vigGrad;
    mainCtx.fillRect(0, 0, width, height);

    mainCtx.restore();
  }
}
