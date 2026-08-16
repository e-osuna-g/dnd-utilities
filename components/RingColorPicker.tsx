import type { Signal } from "@preact/signals";
import { FieldLabel } from "./FieldLabel.tsx";

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

export function RingColorPicker({ ringColor }: { ringColor: Signal<string> }) {
  return (
    <div>
      <FieldLabel>Ring color</FieldLabel>
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
  );
}
