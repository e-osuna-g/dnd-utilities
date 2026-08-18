import type { Signal } from "@preact/signals";

interface BackdropControlProps {
  enabled: Signal<boolean>;
  color: Signal<string>;
}

export function BackdropControl(props: BackdropControlProps) {
  return (
    <div>
      <label class="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={props.enabled.value}
          onChange={(e) => props.enabled.value = e.currentTarget.checked}
          class="h-4 w-4 accent-sky-500"
        />
        <span class="text-sm text-zinc-200">Backdrop color</span>
      </label>
      {props.enabled.value && (
        <div class="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={props.color.value}
            onChange={(e) => props.color.value = e.currentTarget.value}
            class="h-8 w-10 cursor-pointer rounded border border-zinc-700 bg-transparent"
          />
          <span class="text-xs text-zinc-400">
            Fills the area behind the image when it's panned past its edge
          </span>
        </div>
      )}
    </div>
  );
}
