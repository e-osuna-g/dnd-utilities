interface RangeControlProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  formatted: string;
  onChange: (value: number) => void;
}

export function RangeControl(props: RangeControlProps) {
  return (
    <div>
      <div class="flex items-baseline justify-between">
        <span class="block text-xs uppercase tracking-wider text-zinc-400 font-medium">
          {props.label}
        </span>
        <span class="text-sm tabular-nums text-zinc-300">
          {props.formatted}
        </span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.currentTarget.value))}
        class="mt-2 w-full accent-sky-500"
      />
    </div>
  );
}
