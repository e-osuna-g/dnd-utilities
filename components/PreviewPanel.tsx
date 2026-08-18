import { useRef } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import type { RefObject } from "preact";
import type { Signal } from "@preact/signals";
import { getImageGeometry, type TokenConfig } from "../utils/token.ts";
import { FieldLabel } from "./FieldLabel.tsx";

export const PREVIEW_SIZE = 512;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

interface PreviewPanelProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  image: Signal<HTMLImageElement | null>;
  offsetX: Signal<number>;
  offsetY: Signal<number>;
  zoom: Signal<number>;
  getConfig: () => TokenConfig;
}

export function PreviewPanel(props: PreviewPanelProps) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const resetView = () => {
    props.offsetX.value = 0;
    props.offsetY.value = 0;
    props.zoom.value = 1;
  };

  const toCanvasPoint = (e: PointerEvent) => {
    const canvas = props.canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const panBy = (dx: number, dy: number) => {
    const img = props.image.value;
    if (!img) return;
    const g = getImageGeometry(img, props.getConfig(), PREVIEW_SIZE);
    if (!g) return;
    if (g.maxShiftX > 0) {
      props.offsetX.value = clamp(
        props.offsetX.value + dx / g.maxShiftX,
        -1,
        1,
      );
    }
    if (g.maxShiftY > 0) {
      props.offsetY.value = clamp(
        props.offsetY.value + dy / g.maxShiftY,
        -1,
        1,
      );
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    const canvas = props.canvasRef.current;
    if (!canvas || !props.image.value) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toCanvasPoint(e));
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!props.image.value || !pointers.current.has(e.pointerId)) return;
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
        props.zoom.value = clamp(
          props.zoom.value * (curSpan / prevSpan),
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
        props.canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be gone
      }
    }
  };

  useSignalEffect(() => {
    const canvas = props.canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!props.image.value) return;
      e.preventDefault();
      props.zoom.value = clamp(
        props.zoom.value * Math.pow(1.0015, -e.deltaY),
        MIN_ZOOM,
        MAX_ZOOM,
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  });

  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 flex flex-col items-center">
      <FieldLabel>Preview</FieldLabel>
      {props.image.value && (
        <div class="mt-2 flex w-full items-center justify-between">
          <span class="text-xs text-zinc-400">
            Drag to move · scroll / pinch to zoom
          </span>
          <div class="flex items-center gap-2">
            <span class="text-xs tabular-nums text-zinc-300">
              {Math.round(props.zoom.value * 100)}%
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
            ref={props.canvasRef}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            class={`h-full w-full touch-none rounded ${
              props.image.value ? "cursor-move" : "hidden"
            }`}
          />
          {!props.image.value && (
            <div class="flex h-full w-full items-center justify-center rounded text-sm text-zinc-400">
              Upload an image to see your token
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
