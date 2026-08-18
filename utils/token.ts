export type TokenShape = "circle" | "square" | "hex";

export interface TokenConfig {
  shape: TokenShape;
  ringColor: string;
  /** Fraction of the outer shape that the image inset leaves visible as ring (0..1). */
  inset: number;
  hairlineEnabled: boolean;
  hairlineColor: string;
  /** Fill color shown behind the image when it is panned past its cover area. */
  backdropEnabled: boolean;
  backdropColor: string;
  /** Degrees of hex rotation, 0 = flat-top. Ignored for other shapes. */
  hexRotation: number;
  /** Horizontal image position as a fraction of the overflow, clamped to [-1, 1]. */
  offsetX: number;
  /** Vertical image position as a fraction of the overflow, clamped to [-1, 1]. */
  offsetY: number;
  /** Extra magnification past cover-fit, >= 1. */
  zoom: number;
  /** URL of the selected border PNG, or null for the custom ring. */
  borderUrl?: string | null;
  /** Loaded border image (set by the caller once the URL has finished loading). */
  border?: HTMLImageElement | null;
}

const borderCache = new Map<string, Promise<HTMLImageElement>>();

/** Loads a border PNG with CORS enabled, caching the result so renders don't refetch. */
export function loadBorderImage(url: string): Promise<HTMLImageElement> {
  let cached = borderCache.get(url);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        borderCache.delete(url);
        reject(new Error(`Could not load border image: ${url}`));
      };
      img.src = url;
    });
    borderCache.set(url, cached);
  }
  return cached;
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
 * `maxShift` is the maximum pixel shift per axis at full pan (the cover-fit
 * excess plus an extra `PAN_MARGIN` fraction of the displayed image).
 */
export interface TokenGeometry {
  boxW: number;
  boxH: number;
  drawW: number;
  drawH: number;
  excessX: number;
  excessY: number;
  maxShiftX: number;
  maxShiftY: number;
}

/** Extra pan distance past cover-fit alignment, as a fraction of the displayed image. */
export const PAN_MARGIN = 0.2;

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
  const excessX = drawW - boxW;
  const excessY = drawH - boxH;
  return {
    boxW,
    boxH,
    drawW,
    drawH,
    excessX,
    excessY,
    maxShiftX: excessX / 2 + PAN_MARGIN * drawW,
    maxShiftY: excessY / 2 + PAN_MARGIN * drawH,
  };
}

/**
 * Builds an alpha mask of the border's silhouette at the given resolution. The
 * mask keeps the opaque ring (with its own alpha for anti-aliased edges) plus the
 * enclosed transparent center, and cuts the transparent regions that touch the
 * canvas edge. Cached per border URL + size.
 */
const maskCache = new Map<string, HTMLCanvasElement>();

function maskForBorder(
  border: HTMLImageElement,
  size: number,
): HTMLCanvasElement {
  const key = `${border.src}@${size}`;
  const cached = maskCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(
    size / border.naturalWidth,
    size / border.naturalHeight,
  );
  const bw = border.naturalWidth * scale;
  const bh = border.naturalHeight * scale;
  ctx.drawImage(border, (size - bw) / 2, (size - bh) / 2, bw, bh);

  const img = ctx.getImageData(0, 0, size, size);
  const px = img.data;
  const n = size * size;
  const THRESH = 200;
  const opaque = new Uint8Array(n);
  const cut = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    opaque[i] = px[i * 4 + 3] > THRESH ? 1 : 0;
  }

  const stack: number[] = [];
  const seed = (i: number) => {
    if (!opaque[i] && !cut[i]) {
      cut[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < size; x++) {
    seed(x);
    seed((size - 1) * size + x);
  }
  for (let y = 0; y < size; y++) {
    seed(y * size);
    seed(y * size + size - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % size;
    const y = (i / size) | 0;
    if (x > 0) seed(i - 1);
    if (x < size - 1) seed(i + 1);
    if (y > 0) seed(i - size);
    if (y < size - 1) seed(i + size);
  }

  for (let i = 0; i < n; i++) {
    const a = opaque[i] ? px[i * 4 + 3] : (cut[i] ? 0 : 255);
    px[i * 4] = 255;
    px[i * 4 + 1] = 255;
    px[i * 4 + 2] = 255;
    px[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  maskCache.set(key, canvas);
  return canvas;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Recolors a border to the given tint color while preserving its brightness/
 * shading. Resulting RGB is the tint scaled by the border's luminance, so light
 * parts approach the tint color and dark parts fall toward black. The border's
 * alpha (silhouette + anti-aliased edges) is kept. Cached per url+color+size.
 */
const tintedCache = new Map<string, HTMLCanvasElement>();
const TINTED_CACHE_MAX = 40;

function tintedBorder(
  border: HTMLImageElement,
  color: string,
  size: number,
): HTMLCanvasElement {
  const key = `${border.src}@${color}@${size}`;
  const cached = tintedCache.get(key);
  if (cached) return cached;

  const tint = hexToRgb(color);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(
    size / border.naturalWidth,
    size / border.naturalHeight,
  );
  const bw = border.naturalWidth * scale;
  const bh = border.naturalHeight * scale;
  ctx.drawImage(border, (size - bw) / 2, (size - bh) / 2, bw, bh);

  const img = ctx.getImageData(0, 0, size, size);
  const px = img.data;
  const n = size * size;
  const THRESH = 20;
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3];
    if (a <= THRESH) {
      px[i * 4 + 3] = 0;
      continue;
    }
    const l = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] +
      0.114 * px[i * 4 + 2]) / 255;
    px[i * 4] = tint.r * l;
    px[i * 4 + 1] = tint.g * l;
    px[i * 4 + 2] = tint.b * l;
  }
  ctx.putImageData(img, 0, 0);

  tintedCache.set(key, canvas);
  if (tintedCache.size > TINTED_CACHE_MAX) {
    const oldest = tintedCache.keys().next().value;
    if (oldest !== undefined) tintedCache.delete(oldest);
  }
  return canvas;
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
  const border = config.border;
  const innerHalf = border ? outerHalf : outerHalf * (1 - config.inset);

  if (!border) {
    ctx.save();
    ctx.beginPath();
    traceShape(ctx, config.shape, cx, cy, outerHalf, config.hexRotation);
    if (innerHalf > 0) {
      traceShape(ctx, config.shape, cx, cy, innerHalf, config.hexRotation);
      ctx.fillStyle = config.ringColor;
      ctx.fill("evenodd");
    } else {
      ctx.fillStyle = config.ringColor;
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  if (!border) {
    ctx.beginPath();
    traceShape(ctx, config.shape, cx, cy, innerHalf, config.hexRotation);
    ctx.clip();
  }
  if (config.backdropEnabled) {
    ctx.fillStyle = config.backdropColor;
    ctx.fillRect(0, 0, size, size);
  }
  const g = getImageGeometry(image, {
    ...config,
    inset: border ? 0 : config.inset,
  }, size);
  if (g && g.drawW > 0 && g.drawH > 0) {
    const ox = Math.max(-1, Math.min(1, config.offsetX ?? 0));
    const oy = Math.max(-1, Math.min(1, config.offsetY ?? 0));
    const drawX = cx - g.drawW / 2 + (ox * g.maxShiftX);
    const drawY = cy - g.drawH / 2 + (oy * g.maxShiftY);
    ctx.drawImage(image, drawX, drawY, g.drawW, g.drawH);
  }
  ctx.restore();

  if (!border && config.hairlineEnabled && innerHalf > 0) {
    ctx.save();
    ctx.beginPath();
    traceShape(ctx, config.shape, cx, cy, innerHalf, config.hexRotation);
    ctx.lineWidth = Math.max(2, size * 0.006);
    ctx.strokeStyle = config.hairlineColor;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  if (border && border.naturalWidth > 0 && border.naturalHeight > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(maskForBorder(border, size), 0, 0);
    ctx.restore();
    ctx.drawImage(tintedBorder(border, config.ringColor, size), 0, 0);
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
