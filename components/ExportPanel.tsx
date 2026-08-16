import type { Signal } from "@preact/signals";
import { FieldLabel } from "./FieldLabel.tsx";

const EXPORT_SIZES = [200, 300, 512, 1024];

interface ExportPanelProps {
  exportSize: Signal<number>;
  feedback: Signal<string>;
  disabled: boolean;
  onPng: () => void;
  onWebp: () => void;
  onCopy: () => void;
}

export function ExportPanel(props: ExportPanelProps) {
  const control =
    "w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-sky-500";

  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4">
      <div>
        <FieldLabel>Export size</FieldLabel>
        <select
          value={props.exportSize.value}
          onChange={(e) =>
            props.exportSize.value = Number(e.currentTarget.value)}
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
          onClick={props.onPng}
          disabled={props.disabled}
          class="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download PNG
        </button>
        <button
          type="button"
          onClick={props.onWebp}
          disabled={props.disabled}
          class="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download WebP (smaller)
        </button>
        <button
          type="button"
          onClick={props.onCopy}
          disabled={props.disabled}
          class="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Copy to clipboard
        </button>
      </div>
      {props.feedback.value && (
        <p class="text-center text-xs text-sky-400">{props.feedback.value}</p>
      )}
    </section>
  );
}
