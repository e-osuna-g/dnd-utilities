import { useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import {
  loadBorderImage,
  renderToken,
  renderTokenCanvas,
  type TokenConfig,
  type TokenShape,
} from "../utils/token.ts";
import { UploadZone } from "../components/UploadZone.tsx";
import { ShapeSelector } from "../components/ShapeSelector.tsx";
import { RingColorPicker } from "../components/RingColorPicker.tsx";
import { HairlineControl } from "../components/HairlineControl.tsx";
import { RangeControl } from "../components/RangeControl.tsx";
import { TokenBorderSelector } from "../components/TokenBorderSelector.tsx";
import { PREVIEW_SIZE, PreviewPanel } from "../components/PreviewPanel.tsx";
import { ExportPanel } from "../components/ExportPanel.tsx";

export default function TokenMaker() {
  const image = useSignal<HTMLImageElement | null>(null);
  const sourceName = useSignal("");
  const objectUrl = useSignal<string | null>(null);

  const shape = useSignal<TokenShape>("circle");
  const ringColor = useSignal("#ef4444");
  const inset = useSignal(0.12);
  const hairlineEnabled = useSignal(false);
  const hairlineColor = useSignal("#f8fafc");
  const hexRotation = useSignal(0);
  const offsetX = useSignal(0);
  const offsetY = useSignal(0);
  const zoom = useSignal(1);

  const borderUrl = useSignal<string | null>(null);
  const borderImage = useSignal<HTMLImageElement | null>(null);

  const exportSize = useSignal(512);
  const feedback = useSignal("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useSignalEffect(() => {
    const url = borderUrl.value;
    if (!url) {
      borderImage.value = null;
      return;
    }
    loadBorderImage(url).then((img) => {
      if (borderUrl.value === url) borderImage.value = img;
    }).catch(() => {
      if (borderUrl.value === url) {
        borderImage.value = null;
        borderUrl.value = null;
        feedback.value = "Couldn't load that border.";
        setTimeout(() => feedback.value = "", 2500);
      }
    });
  });

  const getConfig = (): TokenConfig => {
    const hasBorder = !!borderUrl.value;
    return {
      shape: shape.value,
      ringColor: ringColor.value,
      inset: hasBorder ? 0 : inset.value,
      hairlineEnabled: hairlineEnabled.value,
      hairlineColor: hairlineColor.value,
      hexRotation: hexRotation.value,
      offsetY: offsetY.value,
      offsetX: offsetX.value,
      zoom: zoom.value,
      borderUrl: borderUrl.value,
      border: borderImage.value,
    };
  };

  useSignalEffect(() => {
    const canvas = canvasRef.current;
    const img = image.value;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !img || !ctx) return;
    renderToken(ctx, img, getConfig(), PREVIEW_SIZE);
  });

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      feedback.value = "Please drop an image file.";
      setTimeout(() => feedback.value = "", 2500);
      return;
    }
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    const url = URL.createObjectURL(file);
    objectUrl.value = url;
    const img = new Image();
    img.onload = () => {
      image.value = img;
      sourceName.value = file.name;
      offsetX.value = 0;
      offsetY.value = 0;
      zoom.value = 1;
    };
    img.onerror = () => {
      feedback.value = "Could not load that image.";
      setTimeout(() => feedback.value = "", 2500);
    };
    img.src = url;
  };

  const resetImage = () => {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
    image.value = null;
    sourceName.value = "";
  };

  const ensureExportable = (): HTMLCanvasElement | null => {
    const img = image.value;
    if (!img) return null;
    return renderTokenCanvas(img, getConfig(), exportSize.value);
  };

  const downloadBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `token-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = (
    canvas: HTMLCanvasElement,
    mime: string,
    ext: string,
    quality?: number,
  ) => {
    canvas.toBlob(
      (blob) => {
        if (blob) downloadBlob(blob, ext);
      },
      mime,
      quality,
    );
  };

  const canvasToBlob = (
    canvas: HTMLCanvasElement,
    mime: string,
    quality?: number,
  ): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error("toBlob failed")),
        mime,
        quality,
      );
    });

  /** True if the token's corners are transparent (skipped for square, which is opaque by design). */
  const blobHasTransparency = (
    blob: Blob,
    size: number,
    shape: TokenShape,
  ): Promise<boolean> => {
    if (shape === "square") return Promise.resolve(true);
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const corners: [number, number][] = [
          [2, 2],
          [2, size - 3],
          [size - 3, 2],
          [size - 3, size - 3],
        ];
        let transparent = true;
        for (const [x, y] of corners) {
          if (ctx.getImageData(x, y, 1, 1).data[3] > 8) {
            transparent = false;
            break;
          }
        }
        URL.revokeObjectURL(url);
        resolve(transparent);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      img.src = url;
    });
  };

  const downloadPng = () => {
    const canvas = ensureExportable();
    if (canvas) download(canvas, "image/png", "png");
  };

  const downloadWebp = async () => {
    const canvas = ensureExportable();
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas, "image/webp", 0.92);
      if (blob.type !== "image/webp") {
        downloadBlob(blob, "png");
        feedback.value =
          "This browser can't encode WebP, so it was saved as PNG.";
      } else if (
        await blobHasTransparency(blob, exportSize.value, shape.value)
      ) {
        downloadBlob(blob, "webp");
      } else {
        const lossless = await canvasToBlob(canvas, "image/webp", 1);
        if (
          lossless.type === "image/webp" &&
          await blobHasTransparency(lossless, exportSize.value, shape.value)
        ) {
          downloadBlob(lossless, "webp");
          feedback.value = "Encoded lossless to keep the transparency.";
        } else {
          const png = await canvasToBlob(canvas, "image/png");
          downloadBlob(png, "png");
          feedback.value =
            "Your browser flattened WebP transparency, so it was saved as PNG.";
        }
      }
    } catch {
      feedback.value = "Could not generate the image — try again.";
    }
    setTimeout(() => feedback.value = "", 3000);
  };

  const copyToClipboard = async () => {
    const canvas = ensureExportable();
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas, "image/png");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      feedback.value = "Copied to clipboard!";
    } catch {
      feedback.value = "Clipboard copy not supported here — try downloading.";
    }
    setTimeout(() => feedback.value = "", 2500);
  };

  const panel = "rounded-xl border border-zinc-800 bg-zinc-900/70 p-5";

  return (
    <div class="grid gap-6 md:grid-cols-5">
      <div class="space-y-6 md:col-span-3">
        <UploadZone
          image={image}
          sourceName={sourceName}
          objectUrl={objectUrl}
          inputRef={inputRef}
          onFile={loadFile}
          onReset={resetImage}
        />

        <section class={`${panel} space-y-6`}>
          <TokenBorderSelector selected={borderUrl} />

          {!borderUrl.value && (
            <>
              <ShapeSelector shape={shape} />

              {shape.value === "hex" && (
                <RangeControl
                  label="Hex rotation"
                  min={0}
                  max={60}
                  step={1}
                  value={hexRotation.value}
                  formatted={`${hexRotation.value}°`}
                  onChange={(v) => hexRotation.value = v}
                />
              )}

              <RingColorPicker ringColor={ringColor} />

              <RangeControl
                label="Ring thickness"
                min={0}
                max={25}
                step={0.5}
                value={inset.value * 100}
                formatted={`${Math.round(inset.value * 100)}%`}
                onChange={(v) => inset.value = v / 100}
              />

              <HairlineControl
                enabled={hairlineEnabled}
                color={hairlineColor}
              />
            </>
          )}
        </section>
      </div>

      <div class="space-y-6 md:col-span-2">
        <PreviewPanel
          canvasRef={canvasRef}
          image={image}
          offsetX={offsetX}
          offsetY={offsetY}
          zoom={zoom}
          getConfig={getConfig}
        />

        <ExportPanel
          exportSize={exportSize}
          feedback={feedback}
          disabled={!image.value}
          onPng={downloadPng}
          onWebp={downloadWebp}
          onCopy={copyToClipboard}
        />
      </div>
    </div>
  );
}
