import { useSignal } from "@preact/signals";
import type { RefObject } from "preact";
import type { Signal } from "@preact/signals";

interface UploadZoneProps {
  image: Signal<HTMLImageElement | null>;
  sourceName: Signal<string>;
  objectUrl: Signal<string | null>;
  inputRef: RefObject<HTMLInputElement>;
  onFile: (file: File) => void;
  onReset: () => void;
}

export function UploadZone(props: UploadZoneProps) {
  const dragging = useSignal(false);

  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div
        class={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
          dragging.value
            ? "border-sky-400 bg-sky-500/10"
            : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          dragging.value = true;
        }}
        onDragLeave={() => dragging.value = false}
        onDrop={(e) => {
          e.preventDefault();
          dragging.value = false;
          const file = e.dataTransfer?.files?.[0];
          if (file) props.onFile(file);
        }}
        onClick={() => props.inputRef.current?.click()}
      >
        <input
          ref={props.inputRef}
          type="file"
          accept="image/*"
          class="hidden"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) props.onFile(file);
          }}
        />
        {props.image.value
          ? (
            <div class="flex items-center gap-4">
              <img
                src={props.objectUrl.value ?? ""}
                alt="Source art preview"
                class="h-16 w-16 rounded object-cover"
              />
              <div class="text-left">
                <p class="text-sm font-medium text-zinc-100">
                  {props.sourceName.value}
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
      {props.image.value && (
        <div class="mt-3 flex justify-end">
          <button
            type="button"
            onClick={props.onReset}
            class="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Remove image
          </button>
        </div>
      )}
    </section>
  );
}
