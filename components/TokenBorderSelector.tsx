import { useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import type { Signal } from "@preact/signals";
import { FieldLabel } from "./FieldLabel.tsx";

interface TokenBorder {
  name: string;
  url: string;
}

interface TokenBorderSelectorProps {
  selected: Signal<string | null>;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function TokenBorderSelector({ selected }: TokenBorderSelectorProps) {
  const borders = useSignal<TokenBorder[]>([]);
  const state = useSignal<"loading" | "ready" | "error">("loading");
  const open = useSignal(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useSignalEffect(() => {
    let cancelled = false;
    fetch("/token-borders.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TokenBorder[]) => {
        if (cancelled) return;
        borders.value = data;
        state.value = "ready";
      })
      .catch(() => {
        if (cancelled) return;
        state.value = "error";
      });
    return () => cancelled = true;
  });

  const openModal = () => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    open.value = true;
  };

  const closeModal = () => {
    open.value = false;
    previouslyFocused.current?.focus();
  };

  useSignalEffect(() => {
    if (!open.value) return;

    const panel = panelRef.current;
    panel?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeModal();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = prevOverflow;
    };
  });

  const selectedBorder = borders.value.find((b) => b.url === selected.value) ??
    null;

  const select = (url: string | null) => {
    selected.value = url;
    closeModal();
  };

  return (
    <div>
      <FieldLabel>Token border</FieldLabel>
      {state.value === "loading" && (
        <p class="mt-2 text-xs text-zinc-400">Loading borders…</p>
      )}
      {state.value === "error" && (
        <p class="mt-2 text-xs text-red-400">
          Couldn't load token-borders.json
        </p>
      )}
      {state.value === "ready" && (
        <div class="mt-2">
          <div class="flex items-center gap-2">
            <button
              ref={triggerRef}
              type="button"
              onClick={openModal}
              aria-haspopup="dialog"
              aria-expanded={open.value}
              class="flex flex-1 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
            >
              {selectedBorder
                ? (
                  <>
                    <img
                      src={selectedBorder.url}
                      alt=""
                      class="h-7 w-7 rounded object-cover"
                    />
                    <span class="truncate">{selectedBorder.name}</span>
                  </>
                )
                : <span class="text-zinc-400">None — Custom ring</span>}
            </button>
            {selectedBorder && (
              <button
                type="button"
                onClick={() => selected.value = null}
                title="Clear border"
                aria-label="Clear border"
                class="rounded-md border border-zinc-700 px-2.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                ×
              </button>
            )}
          </div>

          {open.value && (
            <div
              class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Choose a border"
            >
              <div
                class="fixed inset-0 bg-black/60"
                onClick={closeModal}
                aria-hidden="true"
              />
              <div
                ref={panelRef}
                tabIndex={-1}
                class="relative mt-16 w-full max-w-[560px] rounded-xl border border-zinc-800 bg-zinc-900 p-5 outline-none"
              >
                <div class="mb-4 flex items-center justify-between">
                  <h2 class="text-sm font-semibold text-zinc-100">
                    Choose a border
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close"
                    class="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    Close
                  </button>
                </div>
                <div class="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => select(null)}
                    class={`flex aspect-square items-center justify-center rounded-md border-2 text-xs transition ${
                      selected.value === null
                        ? "border-sky-500 ring-2 ring-sky-400"
                        : "border-zinc-700 hover:border-zinc-500"
                    }`}
                  >
                    None
                  </button>
                  {borders.value.map((b) => (
                    <button
                      type="button"
                      key={b.url}
                      title={b.name}
                      aria-label={`Border ${b.name}`}
                      onClick={() => select(b.url)}
                      class={`aspect-square overflow-hidden rounded-md border-2 transition ${
                        selected.value === b.url
                          ? "border-sky-500 ring-2 ring-sky-400"
                          : "border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      <img
                        src={b.url}
                        alt={b.name}
                        loading="lazy"
                        class="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
