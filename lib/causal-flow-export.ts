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

export type PdfPageOrientation = "portrait" | "landscape";

/** A4 頁面，依版面縮放置中圖片（維持比例）。 */
export function downloadPdfFromPngDataUrl(
  dataUrl: string,
  filename: string,
  options: { orientation: PdfPageOrientation },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const wPx = img.naturalWidth;
        const hPx = img.naturalHeight;
        const { orientation } = options;
        const pdf = new jsPDF({
          orientation,
          unit: "mm",
          format: "a4",
        });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const marginMm = 10;
        const innerW = pageW - 2 * marginMm;
        const innerH = pageH - 2 * marginMm;
        const imgRatio = wPx / hPx;
        const boxRatio = innerW / innerH;
        let drawW: number;
        let drawH: number;
        if (imgRatio > boxRatio) {
          drawW = innerW;
          drawH = innerW / imgRatio;
        } else {
          drawH = innerH;
          drawW = innerH * imgRatio;
        }
        const x = marginMm + (innerW - drawW) / 2;
        const y = marginMm + (innerH - drawH) / 2;
        pdf.addImage(dataUrl, "PNG", x, y, drawW, drawH, undefined, "FAST");
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
