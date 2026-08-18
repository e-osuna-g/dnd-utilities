import { useRef } from "preact/hooks";
import { type Signal, useSignal, useSignalEffect } from "@preact/signals";
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

const STORAGE_KEY = "dnd-token-custom-colors";
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function loadSavedColors(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((v): v is string => typeof v === "string" && HEX_RE.test(v))
      .map((v) => v.toLowerCase());
  } catch {
    return [];
  }
}

function parseColorsFile(raw: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter((v): v is string => typeof v === "string" && HEX_RE.test(v))
    .map((v) => v.toLowerCase());
}

export function RingColorPicker({ ringColor }: { ringColor: Signal<string> }) {
  const savedColors = useSignal<string[]>(loadSavedColors());
  const importMsg = useSignal("");
  const fileRef = useRef<HTMLInputElement>(null);

  useSignalEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedColors.value));
    } catch {
      // storage unavailable (private mode, quota) — ignore
    }
  });

  const saveCurrent = () => {
    const c = ringColor.value.toLowerCase();
    if (!savedColors.value.includes(c)) {
      savedColors.value = [...savedColors.value, c];
    }
  };

  const removeColor = (index: number) => {
    savedColors.value = savedColors.value.filter((_, i) => i !== index);
  };

  const downloadJson = () => {
    const blob = new Blob(
      [JSON.stringify(savedColors.value, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dnd-token-custom-colors.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImport = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const incoming = parseColorsFile(String(reader.result ?? ""));
      if (incoming.length === 0) {
        importMsg.value = "No valid colors found in that file.";
        return;
      }
      const merged = [...savedColors.value];
      for (const c of incoming) {
        if (!merged.includes(c)) merged.push(c);
      }
      savedColors.value = merged;
      importMsg.value = `Imported ${incoming.length} color${
        incoming.length === 1 ? "" : "s"
      }.`;
      setTimeout(() => importMsg.value = "", 2500);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const actionBtn =
    "rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800";

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

      <div class="mt-4 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveCurrent}
            class="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-500"
          >
            Save current color
          </button>
          <button type="button" onClick={downloadJson} class={actionBtn}>
            Download JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            class={actionBtn}
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            class="hidden"
          />
        </div>

        {savedColors.value.length > 0 && (
          <div class="flex flex-wrap gap-2">
            {savedColors.value.map((c, i) => (
              <div key={`${c}-${i}`} class="group relative">
                <button
                  type="button"
                  title={c}
                  aria-label={`Saved color ${c}`}
                  onClick={() =>
                    ringColor.value = c}
                  class={`h-7 w-7 rounded-full border transition hover:scale-110 ${
                    ringColor.value === c
                      ? "border-white ring-2 ring-sky-400"
                      : "border-zinc-600"
                  }`}
                  style={{ backgroundColor: c }}
                />
                <button
                  type="button"
                  aria-label={`Remove saved color ${c}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeColor(i);
                  }}
                  class="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full border border-zinc-700 bg-zinc-800 text-[9px] leading-none text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-600 hover:text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {importMsg.value && (
          <p class="text-xs text-amber-400">{importMsg.value}</p>
        )}
      </div>
    </div>
  );
}
