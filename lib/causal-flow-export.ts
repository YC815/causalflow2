import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

const DEFAULT_BG = "#e8dfd2";

export function safeExportBasename(title: string): string {
  const t = title.trim();
  if (!t) return "causalflow";
  const s = t.replace(/[/\\:*?"<>|\s]+/g, "_").slice(0, 80);
  return s || "causalflow";
}

export async function captureViewportToPngDataUrl(
  viewportEl: HTMLElement,
  options?: { pixelRatio?: number; backgroundColor?: string },
): Promise<string> {
  return toPng(viewportEl, {
    pixelRatio: options?.pixelRatio ?? 2,
    backgroundColor: options?.backgroundColor ?? DEFAULT_BG,
    cacheBust: true,
  });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function downloadPngFromDataUrl(dataUrl: string, filename: string) {
  downloadDataUrl(dataUrl, filename);
}

export function downloadPdfFromPngDataUrl(
  dataUrl: string,
  filename: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const wPx = img.naturalWidth;
        const hPx = img.naturalHeight;
        const pdf = new jsPDF({
          orientation: wPx >= hPx ? "landscape" : "portrait",
          unit: "px",
          format: [wPx, hPx],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, wPx, hPx, undefined, "FAST");
        pdf.save(filename);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("無法載入點陣圖以產生 PDF"));
    img.src = dataUrl;
  });
}
