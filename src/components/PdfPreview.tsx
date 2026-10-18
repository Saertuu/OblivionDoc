import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
} from "lucide-react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfPreview({
  blob,
  fileName,
}: {
  blob: Blob;
  fileName: string;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(420);
  const [rendered, setRendered] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(100, Math.floor(entries[0].contentRect.width - 32))),
    );
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    setPdf(undefined);
    setPageNumber(1);
    setError("");
    setRendered(false);
    (async () => {
      try {
        const data = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;
        const resources = new URL("./pdfjs/", document.baseURI).href;
        task = getDocument({
          data,
          useSystemFonts: true,
          cMapUrl: `${resources}cmaps/`,
          standardFontDataUrl: `${resources}standard_fonts/`,
          wasmUrl: `${resources}wasm/`,
          iccUrl: `${resources}iccs/`,
        });
        const loaded = await task.promise;
        if (!cancelled) setPdf(loaded);
      } catch (error) {
        if (!cancelled)
          setError(
            (error as Error).name === "PasswordException"
              ? "PDF защищён паролем. Скачайте его и откройте в программе для работы с PDF."
              : "Предпросмотр этого PDF недоступен. Файл можно скачать кнопкой выше.",
          );
      }
    })();
    return () => {
      cancelled = true;
      if (task) void task.destroy().catch(() => {});
    };
  }, [blob]);

  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    setRendered(false);
    setText("");
    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled || !canvas.current) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const density = Math.min(window.devicePixelRatio || 1, 2);
        const surface = canvas.current;
        surface.width = Math.floor(viewport.width * density);
        surface.height = Math.floor(viewport.height * density);
        task = page.render({
          canvas: surface,
          canvasContext: surface.getContext("2d", { alpha: false })!,
          viewport,
          transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0],
        });
        await task.promise;
        const content = await page.getTextContent();
        if (!cancelled) {
          setText(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
          );
          setRendered(true);
        }
      } catch (error) {
        if (
          !cancelled &&
          (error as Error).name !== "RenderingCancelledException"
        )
          setError(
            "Не удалось показать страницу PDF. Скачайте исходный файл кнопкой выше.",
          );
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width]);

  return (
    <div className="pdf-viewer" ref={container}>
      {pdf && (
        <div className="pdf-controls">
          <FileText size={14} />
          <span>PDF · {pdf.numPages} стр.</span>
          <div>
            <button
              className="icon-button"
              aria-label="Предыдущая страница PDF"
              disabled={pageNumber === 1}
              onClick={() => setPageNumber((number) => number - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span aria-live="polite">
              {pageNumber} / {pdf.numPages}
            </span>
            <button
              className="icon-button"
              aria-label="Следующая страница PDF"
              disabled={pageNumber === pdf.numPages}
              onClick={() => setPageNumber((number) => number + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="pdf-error" role="status">
          {error}
        </p>
      ) : (
        <>
          <div className="pdf-canvas-wrap">
            <canvas
              ref={canvas}
              role="img"
              aria-label={`${fileName} — страница ${pageNumber}`}
              data-rendered={rendered}
              style={{ display: rendered ? "block" : "none" }}
            />
            {!rendered && (
              <div className="preview-placeholder">
                <LoaderCircle size={22} className="spin" />
                Готовим страницу PDF…
              </div>
            )}
          </div>
          <p className="sr-only">{text}</p>
        </>
      )}
    </div>
  );
}
