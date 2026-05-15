// Utilities for handling image uploads. Phone photos arrive as multi-megabyte JPEGs;
// we resize them in-browser to a sensible max dimension and re-encode as JPEG to fit
// comfortably in localStorage (which is capped at ~5 MB per origin).

export interface ResizeOptions {
  maxDim?: number;   // longest edge in pixels (default 1024)
  quality?: number;  // 0..1, JPEG quality (default 0.85)
}

/**
 * Reads a File, downscales it to maxDim on the longest edge, and returns a JPEG data URL.
 * Falls back to the original data URL if anything fails — never blocks the user.
 */
export async function resizeImageFile(file: File, opts: ResizeOptions = {}): Promise<string> {
  const maxDim = opts.maxDim ?? 1024;
  const quality = opts.quality ?? 0.85;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

  // Skip resize for SVG/other vector — no point and canvas may not handle well.
  if (!/^data:image\/(jpeg|jpg|png|webp);/i.test(dataUrl)) return dataUrl;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        // Already small enough — but still re-encode to JPEG to drop alpha/PNG bloat
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0);
        try { resolve(canvas.toDataURL("image/jpeg", quality)); }
        catch { resolve(dataUrl); }
        return;
      }
      if (width > height) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL("image/jpeg", quality)); }
      catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function dataUrlSizeBytes(dataUrl: string): number {
  // base64-encoded payload: every 4 chars = 3 bytes
  const commaIdx = dataUrl.indexOf(",");
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.ceil(b64.length * 3 / 4);
}
