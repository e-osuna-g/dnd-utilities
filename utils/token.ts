export type TokenShape = "circle" | "square" | "hex";

export interface TokenConfig {
  shape: TokenShape;
  ringColor: string;
  /** Fraction of the outer shape that the image inset leaves visible as ring (0..1). */
  inset: number;
  hairlineEnabled: boolean;
  hairlineColor: string;
  /** Degrees of hex rotation, 0 = flat-top. Ignored for other shapes. */
  hexRotation: number;
  /** Horizontal image position as a fraction of the overflow, clamped to [-1, 1]. */
  offsetX: number;
  /** Vertical image position as a fraction of the overflow, clamped to [-1, 1]. */
  offsetY: number;
  /** Extra magnification past cover-fit, >= 1. */
  zoom: number;
}

interface Point {
  x: number;
  y: number;
}

function hexVertices(
  cx: number,
  cy: number,
  half: number,
  rotation: number,
): Point[] {
  const start = (rotation * Math.PI) / 180;
  const points: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = start + (i * Math.PI) / 3;
    points.push({
      x: cx + half * Math.cos(angle),
      y: cy + half * Math.sin(angle),
    });
  }
  return points;
}

/** Appends the path of the given shape (centered, "half" = see shapeBounds) to ctx. */
function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: TokenShape,
  cx: number,
  cy: number,
  half: number,
  rotation: number,
) {
  switch (shape) {
    case "circle":
      ctx.arc(cx, cy, half, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(cx - half, cy - half, half * 2, half * 2);
      break;
    case "hex": {
      const pts = hexVertices(cx, cy, half, rotation);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      break;
    }
  }
}

function shapeBounds(
  shape: TokenShape,
  cx: number,
  cy: number,
  half: number,
  rotation: number,
) {
  switch (shape) {
    case "circle":
    case "square":
      return {
        minX: cx - half,
        minY: cy - half,
        maxX: cx + half,
        maxY: cy + half,
      };
    case "hex": {
      const pts = hexVertices(cx, cy, half, rotation);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      return { minX, minY, maxX, maxY };
    }
  }
}

/**
 * Geometry of the cover-fitted image for a given token config/resolution.
 * `excess` is how much larger the image is than the clip box on each axis;
 * offset units map to pixels via `offset * excess / 2`.
 */
export interface TokenGeometry {
  boxW: number;
  boxH: number;
  drawW: number;
  drawH: number;
  excessX: number;
  excessY: number;
}

export function getImageGeometry(
  image: HTMLImageElement,
  config: TokenConfig,
  size: number,
): TokenGeometry | null {
  const imgW = image.naturalWidth > 0 ? image.naturalWidth : image.width;
  const imgH = image.naturalHeight > 0 ? image.naturalHeight : image.height;
  if (imgW <= 0 || imgH <= 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const innerHalf = (size / 2) * (1 - config.inset);
  const b = shapeBounds(config.shape, cx, cy, innerHalf, config.hexRotation);
  const boxW = b.maxX - b.minX;
  const boxH = b.maxY - b.minY;
  const scale = Math.max(boxW / imgW, boxH / imgH) * (config.zoom ?? 1);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  return {
    boxW,
    boxH,
    drawW,
    drawH,
    excessX: drawW - boxW,
    excessY: drawH - boxH,
  };
}

/**
 * Renders a single token into the given context. The canvas is cleared first, so
 * every call produces a fresh token. Corners outside the contour stay transparent.
 */
export function renderToken(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  config: TokenConfig,
  size: number,
) {
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const outerHalf = size / 2;
  const innerHalf = outerHalf * (1 - config.inset);

  ctx.save();
  ctx.beginPath();
  traceShape(ctx, config.shape, cx, cy, outerHalf, config.hexRotation);
  ctx.fillStyle = config.ringColor;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  traceShape(ctx, config.shape, cx, cy, innerHalf, config.hexRotation);
  ctx.clip();
  const g = getImageGeometry(image, config, size);
  if (g && g.drawW > 0 && g.drawH > 0) {
    const ox = Math.max(-1, Math.min(1, config.offsetX ?? 0));
    const oy = Math.max(-1, Math.min(1, config.offsetY ?? 0));
    const drawX = cx - g.drawW / 2 + (ox * g.excessX) / 2;
    const drawY = cy - g.drawH / 2 + (oy * g.excessY) / 2;
    ctx.drawImage(image, drawX, drawY, g.drawW, g.drawH);
  }
  ctx.restore();

  if (config.hairlineEnabled && innerHalf > 0) {
    ctx.save();
    ctx.beginPath();
    traceShape(ctx, config.shape, cx, cy, innerHalf, config.hexRotation);
    ctx.lineWidth = Math.max(2, size * 0.006);
    ctx.strokeStyle = config.hairlineColor;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }
}

/** Renders a standalone token onto a fresh canvas of the requested resolution. */
export function renderTokenCanvas(
  image: HTMLImageElement,
  config: TokenConfig,
  size: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  renderToken(ctx, image, config, size);
  return canvas;
}
