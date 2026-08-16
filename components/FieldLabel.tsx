import type { ComponentChildren } from "preact";

export function FieldLabel({ children }: { children: ComponentChildren }) {
  return (
    <span class="block text-xs uppercase tracking-wider text-zinc-400 font-medium">
      {children}
    </span>
  );
}
