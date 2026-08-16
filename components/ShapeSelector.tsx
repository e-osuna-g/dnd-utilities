import type { Signal } from "@preact/signals";
import type { TokenShape } from "../utils/token.ts";
import { FieldLabel } from "./FieldLabel.tsx";

const SHAPES: { id: TokenShape; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
  { id: "hex", label: "Hex" },
];

export function ShapeSelector({ shape }: { shape: Signal<TokenShape> }) {
  return (
    <div>
      <FieldLabel>Shape</FieldLabel>
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
  );
}
