import { useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import {
  getImageGeometry,
  renderToken,
  renderTokenCanvas,
  type TokenConfig,
  type TokenShape,
} from "../utils/token.ts";

const PREVIEW_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const SHAPES: { id: TokenShape; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
  { id: "hex", label: "Hex" },
];

const PRESETS: { name: string; value: string }[] = [
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "White", value: "#f8fafc" },
  { name: "Black", value: "#101010" },
];

const EXPORT_SIZES = [200, 300, 512, 1024];

export default function TokenMaker() {
  const image = useSignal<HTMLImageElement | null>(null);
  const sourceName = useSignal("");
  const objectUrl = useSignal<string | null>(null);

  const shape = useSignal<TokenShape>("circle");
  const ringColor = useSignal("#ef4444");
  const inset = useSignal(0.12);
  const hairlineEnabled = useSignal(false);
  const hairlineColor = useSignal("#f8fafc");
  const hexRotation = useSignal(0);
  const offsetX = useSignal(0);
  const offsetY = useSignal(0);
  const zoom = useSignal(1);

  const exportSize = useSignal(512);
  const feedback = useSignal("");
  const dragging = useSignal(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const getConfig = (): TokenConfig => ({
    shape: shape.value,
    ringColor: ringColor.value,
    inset: inset.value,
    hairlineEnabled: hairlineEnabled.value,
    hairlineColor: hairlineColor.value,
    hexRotation: hexRotation.value,
    offsetY: offsetY.value,
    offsetX: offsetX.value,
    zoom: zoom.value,
  });

  useSignalEffect(() => {
    const canvas = canvasRef.current;
    const img = image.value;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !img || !ctx) return;
    renderToken(ctx, img, getConfig(), PREVIEW_SIZE);
  });

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      feedback.value = "Please drop an image file.";
      setTimeout(() => feedback.value = "", 2500);
      return;
    }
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    const url = URL.createObjectURL(file);
    objectUrl.value = url;
    const img = new Image();
    img.onload = () => {
      image.value = img;
      sourceName.value = file.name;
      offsetX.value = 0;
      offsetY.value = 0;
      zoom.value = 1;
    };
    img.onerror = () => {
      feedback.value = "Could not load that image.";
      setTimeout(() => feedback.value = "", 2500);
    };
    img.src = url;
  };

  const resetImage = () => {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
    image.value = null;
    sourceName.value = "";
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragging.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  };

  const resetView = () => {
    offsetX.value = 0;
    offsetY.value = 0;
    zoom.value = 1;
  };

  const toCanvasPoint = (e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const panBy = (dx: number, dy: number) => {
    const img = image.value;
    if (!img) return;
    const g = getImageGeometry(img, getConfig(), PREVIEW_SIZE);
    if (!g) return;
    if (g.excessX > 0) {
      offsetX.value = clamp(offsetX.value + (2 * dx) / g.excessX, -1, 1);
    }
    if (g.excessY > 0) {
      offsetY.value = clamp(offsetY.value + (2 * dy) / g.excessY, -1, 1);
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !image.value) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toCanvasPoint(e));
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!image.value || !pointers.current.has(e.pointerId)) return;
    const pt = toCanvasPoint(e);
    const prev = pointers.current.get(e.pointerId)!;

    if (pointers.current.size >= 2) {
      const [idA, idB] = [...pointers.current.keys()];
      const prevA = pointers.current.get(idA)!;
      const prevB = pointers.current.get(idB)!;
      const curA = idA === e.pointerId ? pt : prevA;
      const curB = idB === e.pointerId ? pt : prevB;
      const prevSpan = Math.hypot(prevB.x - prevA.x, prevB.y - prevA.y);
      const curSpan = Math.hypot(curB.x - curA.x, curB.y - curA.y);
      if (prevSpan > 0 && curSpan > 0) {
        zoom.value = clamp(
          zoom.value * (curSpan / prevSpan),
          MIN_ZOOM,
          MAX_ZOOM,
        );
      }
      panBy(
        (curA.x + curB.x) / 2 - (prevA.x + prevB.x) / 2,
        (curA.y + curB.y) / 2 - (prevA.y + prevB.y) / 2,
      );
    } else {
      panBy(pt.x - prev.x, pt.y - prev.y);
    }

    pointers.current.set(e.pointerId, pt);
  };

  const handlePointerEnd = (e: PointerEvent) => {
    if (pointers.current.delete(e.pointerId)) {
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be gone
      }
    }
  };

  useSignalEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!image.value) return;
      e.preventDefault();
      zoom.value = clamp(
        zoom.value * Math.pow(1.0015, -e.deltaY),
        MIN_ZOOM,
        MAX_ZOOM,
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  });

  const ensureExportable = (): HTMLCanvasElement | null => {
    const img = image.value;
    if (!img) return null;
    return renderTokenCanvas(img, getConfig(), exportSize.value);
  };

  const downloadBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `token-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = (
    canvas: HTMLCanvasElement,
    mime: string,
    ext: string,
    quality?: number,
  ) => {
    canvas.toBlob(
      (blob) => {
        if (blob) downloadBlob(blob, ext);
      },
      mime,
      quality,
    );
  };

  const canvasToBlob = (
    canvas: HTMLCanvasElement,
    mime: string,
    quality?: number,
  ): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error("toBlob failed")),
        mime,
        quality,
      );
    });

  /** True if the token's corners are transparent (skipped for square, which is opaque by design). */
  const blobHasTransparency = (
    blob: Blob,
    size: number,
    shape: TokenShape,
  ): Promise<boolean> => {
    if (shape === "square") return Promise.resolve(true);
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const corners: [number, number][] = [
          [2, 2],
          [2, size - 3],
          [size - 3, 2],
          [size - 3, size - 3],
        ];
        let transparent = true;
        for (const [x, y] of corners) {
          if (ctx.getImageData(x, y, 1, 1).data[3] > 8) {
            transparent = false;
            break;
          }
        }
        URL.revokeObjectURL(url);
        resolve(transparent);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      img.src = url;
    });
  };

  const downloadPng = () => {
    const canvas = ensureExportable();
    if (canvas) download(canvas, "image/png", "png");
  };

  const downloadWebp = async () => {
    const canvas = ensureExportable();
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas, "image/webp", 0.92);
      if (blob.type !== "image/webp") {
        downloadBlob(blob, "png");
        feedback.value =
          "This browser can't encode WebP, so it was saved as PNG.";
      } else if (
        await blobHasTransparency(blob, exportSize.value, shape.value)
      ) {
        downloadBlob(blob, "webp");
      } else {
        const lossless = await canvasToBlob(canvas, "image/webp", 1);
        if (
          lossless.type === "image/webp" &&
          await blobHasTransparency(lossless, exportSize.value, shape.value)
        ) {
          downloadBlob(lossless, "webp");
          feedback.value = "Encoded lossless to keep the transparency.";
        } else {
          const png = await canvasToBlob(canvas, "image/png");
          downloadBlob(png, "png");
          feedback.value =
            "Your browser flattened WebP transparency, so it was saved as PNG.";
        }
      }
    } catch {
      feedback.value = "Could not generate the image — try again.";
    }
    setTimeout(() => feedback.value = "", 3000);
  };

  const copyToClipboard = async () => {
    const canvas = ensureExportable();
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error("toBlob failed")),
          "image/png",
        );
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      feedback.value = "Copied to clipboard!";
    } catch {
      feedback.value = "Clipboard copy not supported here — try downloading.";
    }
    setTimeout(() => feedback.value = "", 2500);
  };

  const field =
    "block text-xs uppercase tracking-wider text-zinc-400 font-medium";
  const control =
    "w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-sky-500";
  const panel = "rounded-xl border border-zinc-800 bg-zinc-900/70 p-5";

  return (
    <div class="grid gap-6 md:grid-cols-5">
      <div class="space-y-6 md:col-span-3">
        <section class={panel}>
          <div
            class={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
              dragging
                ? "border-sky-400 bg-sky-500/10"
                : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              dragging.value = true;
            }}
            onDragLeave={() => dragging.value = false}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              class="hidden"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) loadFile(file);
              }}
            />
            {image.value
              ? (
                <div class="flex items-center gap-4">
                  <img
                    src={objectUrl.value ?? ""}
                    alt="Source art preview"
                    class="h-16 w-16 rounded object-cover"
                  />
                  <div class="text-left">
                    <p class="text-sm font-medium text-zinc-100">
                      {sourceName.value}
                    </p>
                    <p class="text-xs text-zinc-400">
                      Drop another image or click to replace
                    </p>
                  </div>
                </div>
              )
              : (
                <div>
                  <p class="text-sm font-medium text-zinc-100">
                    Drop your character art here
                  </p>
                  <p class="mt-1 text-xs text-zinc-400">
                    or click to browse — PNG, JPG or WebP
                  </p>
                </div>
              )}
          </div>
          {image.value && (
            <div class="mt-3 flex justify-end">
              <button
                type="button"
                onClick={resetImage}
                class="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Remove image
              </button>
            </div>
          )}
        </section>

        <section class={`${panel} space-y-6`}>
          <div>
            <span class={field}>Shape</span>
            <div class="mt-2 grid grid-cols-3 gap-2">
              {SHAPES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => shape.value = s.id}
                  class={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    shape.value === s.id
                      ? "border-sky-500 bg-sky-600 text-white"
                      : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {shape.value === "hex" && (
            <div>
              <div class="flex items-baseline justify-between">
                <span class={field}>Hex rotation</span>
                <span class="text-sm tabular-nums text-zinc-300">
                  {hexRotation.value}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                value={hexRotation.value}
                onChange={(e) =>
                  hexRotation.value = Number(e.currentTarget.value)}
                class="mt-2 w-full accent-sky-500"
              />
            </div>
          )}

          <div>
            <div class="flex items-baseline justify-between">
              <span class={field}>Ring color</span>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={ringColor.value}
                onChange={(e) => ringColor.value = e.currentTarget.value}
                class="h-9 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent"
              />
              <div class="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.name}
                    title={p.name}
                    aria-label={`Ring color ${p.name}`}
                    onClick={() => ringColor.value = p.value}
                    class={`h-7 w-7 rounded-full border transition hover:scale-110 ${
                      ringColor.value === p.value
                        ? "border-white ring-2 ring-sky-400"
                        : "border-zinc-600"
                    }`}
                    style={{ backgroundColor: p.value }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <div class="flex items-baseline justify-between">
              <span class={field}>Ring thickness</span>
              <span class="text-sm tabular-nums text-zinc-300">
                {Math.round(inset.value * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="0.5"
              value={inset.value * 100}
              onChange={(e) =>
                inset.value = Number(e.currentTarget.value) / 100}
              class="mt-2 w-full accent-sky-500"
            />
          </div>

          <div>
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={hairlineEnabled.value}
                onChange={(e) =>
                  hairlineEnabled.value = e.currentTarget.checked}
                class="h-4 w-4 accent-sky-500"
              />
              <span class="text-sm text-zinc-200">Inner hairline ring</span>
            </label>
            {hairlineEnabled.value && (
              <div class="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={hairlineColor.value}
                  onChange={(e) => hairlineColor.value = e.currentTarget.value}
                  class="h-8 w-10 cursor-pointer rounded border border-zinc-700 bg-transparent"
                />
                <span class="text-xs text-zinc-400">
                  A thin line on the inner edge of the image
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      <div class="space-y-6 md:col-span-2">
        <section class={`${panel} flex flex-col items-center`}>
          <span class={field}>Preview</span>
          {image.value && (
            <div class="mt-2 flex w-full items-center justify-between">
              <span class="text-xs text-zinc-400">
                Drag to move · scroll / pinch to zoom
              </span>
              <div class="flex items-center gap-2">
                <span class="text-xs tabular-nums text-zinc-300">
                  {Math.round(zoom.value * 100)}%
                </span>
                <button
                  type="button"
                  onClick={resetView}
                  class="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Reset view
                </button>
              </div>
            </div>
          )}
          <div class="checker mt-3 w-full max-w-[320px] rounded-lg p-2">
            <div class="relative aspect-square w-full">
              <canvas
                ref={canvasRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                class={`h-full w-full touch-none rounded ${
                  image.value ? "cursor-move" : "hidden"
                }`}
              />
              {!image.value && (
                <div class="flex h-full w-full items-center justify-center rounded text-sm text-zinc-400">
                  Upload an image to see your token
                </div>
              )}
            </div>
          </div>
        </section>

        <section class={`${panel} space-y-4`}>
          <div>
            <span class={field}>Export size</span>
            <select
              value={exportSize.value}
              onChange={(e) => exportSize.value = Number(e.currentTarget.value)}
              class={`${control} mt-2`}
            >
              {EXPORT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} × {s} px
                </option>
              ))}
            </select>
          </div>

          <div class="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={downloadPng}
              disabled={!image.value}
              class="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={downloadWebp}
              disabled={!image.value}
              class="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download WebP (smaller)
            </button>
            <p class="text-center text-xs text-zinc-500">
              Transparency is preserved automatically.
            </p>
            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!image.value}
              class="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Copy to clipboard
            </button>
          </div>

          {feedback.value && (
            <p class="text-center text-xs text-sky-400">{feedback.value}</p>
          )}
        </section>
      </div>
    </div>
  );
}
