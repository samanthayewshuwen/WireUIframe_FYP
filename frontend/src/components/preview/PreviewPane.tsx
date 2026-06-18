import { useEffect, useMemo, useRef, useState } from "react";
import { FaBook, FaCode, FaDesktop, FaDownload, FaFilePdf, FaFileImage, FaMobile, FaUndo } from "react-icons/fa";
import { AppState, Settings } from "../../types";
import { useAppStore } from "../../store/app-store";
import { useProjectStore } from "../../store/project-store";
import { useFullProjectStore } from "../../store/full-project-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import CodeTab from "./CodeTab";
import PreviewComponent from "./PreviewComponent";
import { downloadCode } from "./download";
import { extractHtml } from "./extractHtml";

interface Props {
  doUpdate: (instruction: string) => void;
  reset: () => void;
  settings: Settings;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

// 闁冲厜鍋撻柍鍏夊亾闁冲厜鍋?PNG / PDF capture helpers 闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾

async function captureIframeAsPng(
  iframe: HTMLIFrameElement,
  width: number,
  height: number
): Promise<Blob> {
  // 闁冲厜鍋撻柍鍏夊亾 Reset CSS scale before capture 闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋?  // The iframe is CSS-scaled down (e.g. scale(0.45)) to fit the panel.
  // html2canvas captures the DOM at its *rendered* size, which would produce
  // a tiny image. We temporarily set scale(1) so the iframe renders at full
  // native resolution, capture, then restore the original transform.
  const prevTransform = iframe.style.transform;
  const prevWidth     = iframe.style.width;
  const prevHeight    = iframe.style.height;

  iframe.style.transform = "scale(1)";
  iframe.style.transformOrigin = "top left";
  iframe.style.width  = `${width}px`;
  iframe.style.height = `${height}px`;

  // Force a layout flush so the browser applies the new dimensions
  void iframe.offsetWidth;

  return new Promise((resolve, reject) => {
    const restore = () => {
      iframe.style.transform = prevTransform;
      iframe.style.width     = prevWidth;
      iframe.style.height    = prevHeight;
    };

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) { restore(); return reject(new Error("No iframe document")); }

      const capture = async () => {
        try {
          const h2c = (iframe.contentWindow as any).html2canvas;
          const canvas = await h2c(iframeDoc.documentElement, {
            // Capture the full document (not just body) at native resolution
            width,
            height,
            windowWidth: width,
            windowHeight: height,
            scrollX: 0,
            scrollY: 0,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            scale: 1,
          });
          restore();
          canvas.toBlob((blob: Blob | null) => {
            if (blob) resolve(blob);
            else reject(new Error("canvas.toBlob returned null"));
          }, "image/png");
        } catch (err) {
          restore();
          reject(err);
        }
      };

      if ((iframe.contentWindow as any).html2canvas) {
        void capture();
        return;
      }

      const existing = iframeDoc.getElementById("__html2canvas") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => void capture(), { once: true });
        existing.addEventListener("error", () => { restore(); reject(new Error("html2canvas failed to load")); }, { once: true });
        return;
      }

      const script = iframeDoc.createElement("script");
      script.id = "__html2canvas";
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.onload = () => void capture();
      script.onerror = () => { restore(); reject(new Error("html2canvas failed to load")); };
      iframeDoc.head.appendChild(script);
    } catch (err) {
      restore();
      reject(err);
    }
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getIframeDocumentSize(iframe: HTMLIFrameElement) {
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return { width: 1440, height: 900 };

  const body = doc.body;
  const html = doc.documentElement;

  return {
    width: Math.max(
      html.scrollWidth,
      body?.scrollWidth ?? 0,
      html.clientWidth,
      body?.clientWidth ?? 0,
      1440
    ),
    height: Math.max(
      html.scrollHeight,
      body?.scrollHeight ?? 0,
      html.clientHeight,
      body?.clientHeight ?? 0,
      900
    ),
  };
}

async function exportAsPng(
  iframe: HTMLIFrameElement,
  width: number,
  height: number,
  label: string
) {
  const blob = await captureIframeAsPng(iframe, width, height);
  triggerDownload(blob, `${label}.png`);
}

async function exportAsPdf(
  iframe: HTMLIFrameElement,
  width: number,
  height: number,
  label: string
) {
  const pngBlob = await captureIframeAsPng(iframe, width, height);

  const imgDataUrl = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = () => rej(new Error("FileReader failed"));
    reader.readAsDataURL(pngBlob);
  });

  // Load jsPDF on demand - no bundle cost
  if (!(window as any).jspdf) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = () => res();
      s.onerror = () => rej(new Error("jsPDF failed to load"));
      document.head.appendChild(s);
    });
  }

  const { jsPDF } = (window as any).jspdf;
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const imageWidthMm = pageWidthMm;
  const imageHeightMm = Math.max(pageHeightMm, (height / width) * imageWidthMm);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = 0;
  pdf.addImage(imgDataUrl, "PNG", 0, y, imageWidthMm, imageHeightMm);

  let remainingHeight = imageHeightMm - pageHeightMm;
  while (remainingHeight > 0) {
    pdf.addPage();
    y -= pageHeightMm;
    pdf.addImage(imgDataUrl, "PNG", 0, y, imageWidthMm, imageHeightMm);
    remainingHeight -= pageHeightMm;
  }

  pdf.save(`${label}.pdf`);
}

// 闁冲厜鍋撻柍鍏夊亾闁冲厜鍋?Dev specs builder 闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾

function buildDevSpecs(html: string): string {
  if (!html.trim()) return "";

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const headings = doc.querySelectorAll("h1,h2,h3,h4,h5,h6");
    const buttons  = doc.querySelectorAll("button,[role='button'],input[type='button'],input[type='submit']");
    const inputs   = doc.querySelectorAll("input,textarea,select");
    const images   = doc.querySelectorAll("img");
    const links    = doc.querySelectorAll("a");
    const lists    = doc.querySelectorAll("ul,ol");
    const tables   = doc.querySelectorAll("table");
    const forms    = doc.querySelectorAll("form");
    const sections = doc.querySelectorAll("section,article,main,aside,header,footer,nav");

    const colourMatches = html.match(/(?:bg|text|border|ring)-([a-z]+-\d{2,3})/g) || [];
    const uniqueColours = [...new Set(colourMatches)].slice(0, 10);

    const cssFrameworks = [
      html.includes("tailwind")    && "Tailwind CSS",
      html.includes("bootstrap")   && "Bootstrap",
      html.includes("alpine")      && "Alpine.js",
      html.includes("lucide")      && "Lucide Icons",
      (html.includes("font-awesome") || html.includes("fontawesome")) && "Font Awesome",
      (html.includes("chart.js")   || html.includes("Chart.js"))     && "Chart.js",
      (html.includes("d3.js")      || html.includes("d3.min"))       && "D3.js",
    ].filter(Boolean).join(", ") || "Vanilla CSS";

    const lines = [
      "## UI Architecture Overview",
      "",
      "### Component Inventory",
      `- **Semantic sections**: ${sections.length > 0 ? `${sections.length} (header, footer, nav, main, aside)` : "None detected"}`,
      `- **Headings**: ${headings.length} (${Array.from(headings).map((h) => h.tagName).join(", ") || "none"})`,
      `- **Buttons**: ${buttons.length}`,
      `- **Form inputs**: ${inputs.length}${forms.length > 0 ? ` across ${forms.length} form(s)` : ""}`,
      `- **Links**: ${links.length}`,
      `- **Images**: ${images.length}`,
      `- **Lists**: ${lists.length}`,
      `- **Tables**: ${tables.length}`,
      "",
      "### Layout System",
      `- **Grid layout**: ${html.includes("grid") || html.includes("grid-cols") ? "CSS Grid detected" : "Not used"}`,
      `- **Flex layout**: ${html.includes("flex") || html.includes("flexbox") ? "Flexbox detected" : "Not used"}`,
      `- **Dark mode**: ${html.includes("dark:") || html.includes("dark-mode") ? "Dark mode classes present" : "Light mode only"}`,
      `- **Modal / overlay**: ${html.includes("modal") || html.includes("dialog") ? "Modal present" : "None detected"}`,
      "",
      "### Tech Stack",
      `- **CSS framework**: ${cssFrameworks}`,
      `- **Interactivity**: ${html.includes("addEventListener") || html.includes("onclick") ? "Custom JS event listeners" : "No custom JS"}`,
      `- **Data persistence**: ${html.includes("localStorage") ? "localStorage" : "None"}`,
      `- **API calls**: ${html.includes("fetch(") || html.includes("axios") ? "fetch / axios detected" : "No API calls"}`,
      ...(uniqueColours.length > 0
        ? ["", "### Detected Colour Tokens", uniqueColours.map((c) => `\`${c}\``).join(" / ")]
        : []),
      "",
      "### Accessibility",
      `- **ARIA labels**: ${html.includes("aria-label") || html.includes("aria-labelledby") ? "Present" : "Not detected"}`,
      `- **ARIA roles**: ${html.includes("role=") ? "Present" : "Not detected"}`,
      `- **Image alt text**: ${images.length === 0 ? "N/A" : Array.from(images).some((img) => img.hasAttribute("alt")) ? "At least one img has alt" : "Alt attributes missing"}`,
      "",
      "### Responsiveness",
      `- **Mobile (sm)**: ${html.includes("sm:") ? "Yes" : "No"}`,
      `- **Tablet (md)**: ${html.includes("md:") || html.includes("@media") ? "Yes" : "No"}`,
      `- **Desktop (lg+)**: ${html.includes("lg:") ? "Yes" : "No"}`,
    ];

    return lines.join("\n");
  } catch {
    return "Unable to analyse code structure.";
  }
}

// 闁冲厜鍋撻柍鍏夊亾闁冲厜鍋?Component 闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾闁冲厜鍋撻柍鍏夊亾

function PreviewPane({ doUpdate, reset: _reset, settings, iframeRef: externalIframeRef }: Props) {
  const { appState, isInteractiveMode, setInteractiveMode } = useAppStore();
  const internalIframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeRef = (externalIframeRef ?? internalIframeRef) as React.RefObject<HTMLIFrameElement>;
  const { head, commits, setHead } = useProjectStore();

  // ── Full Project mode — show the active screen's HTML instead of commit code ──
  const {
    isActive: isFPActive,
    screens: fpScreens,
    activeScreenId,
    planStatus,
    resetScreenToOriginal,
    resetScreenMobileToOriginal,
  } = useFullProjectStore();
  const activeScreen = isFPActive
    ? fpScreens.find((s) => s.id === activeScreenId) ?? null
    : null;
  const isFPPlanning = isFPActive && planStatus === "planning";

  // Track which device tab is active so Reset targets the right HTML field.
  const [activeTab, setActiveTab] = useState<"desktop" | "mobile">("desktop");
  // Incrementing keys force PreviewComponent remount on Reset, guaranteeing the
  // originalHtml is written fresh to the iframe with no timing/throttle ambiguity.
  const [desktopResetKey, setDesktopResetKey] = useState(0);
  const [mobileResetKey,  setMobileResetKey]  = useState(0);

  const [exportState, setExportState] = useState<"png" | "pdf" | null>(null);

  // Derive the code to preview — desktop and mobile use separate HTML in FP mode.
  const currentCommit = head !== null && commits[head] ? commits[head] : null;
  const commitCode = currentCommit
    ? currentCommit.variants[currentCommit.selectedVariantIndex]?.code ?? ""
    : "";
  const desktopCode   = isFPActive ? (activeScreen?.html ?? "") : commitCode;
  const mobileRawCode = isFPActive
    ? (activeScreen?.mobileHtml || activeScreen?.html || "")
    : commitCode;
  const currentCode   = desktopCode;
  const previewCode     = isFPActive
    ? (extractHtml(desktopCode) || desktopCode)
    : extractHtml(currentCode);
  const mobilePreviewCode = isFPActive
    ? (extractHtml(mobileRawCode) || mobileRawCode)
    : extractHtml(mobileRawCode);
  const hasGeneratedCode = currentCode.trim().length > 0;
  const hasPreviewCode   = previewCode.trim().length > 0;
  const devSpecs = useMemo(() => buildDevSpecs(previewCode), [previewCode]);
  // panelH = viewport minus NavigationRail top offset, toolbar row, tab margins, and padding
  const panelH   = "calc(100vh - 156px)";

  // Measure the actual bottom of the toolbar row so InspectPanel/PropertiesPanel
  // start exactly below it — no magic number needed.
  const toolbarRowRef = useRef<HTMLDivElement | null>(null);
  const [toolbarBottom, setToolbarBottom] = useState(156);
  useEffect(() => {
    const measure = () => {
      if (toolbarRowRef.current) {
        setToolbarBottom(Math.round(toolbarRowRef.current.getBoundingClientRect().bottom) + 4);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Label changes based on aesthetic mode so exported files are named sensibly
  const exportLabel =
    settings.aestheticMode === "wireframe" ? "wireframe" : "ui-export";

  const handleDownloadPng = async () => {
    const iframe = iframeRef.current;
    if (!iframe || !hasPreviewCode) return;
    setExportState("png");
    try {
      const { width, height } = getIframeDocumentSize(iframe);
      await exportAsPng(iframe, width, height, exportLabel);
    } catch {
      alert("PNG export failed - make sure the preview has finished loading.");
    } finally {
      setExportState(null);
    }
  };

  const handleDownloadPdf = async () => {
    const iframe = iframeRef.current;
    if (!iframe || !hasPreviewCode) return;
    setExportState("pdf");
    try {
      const { width, height } = getIframeDocumentSize(iframe);
      await exportAsPdf(iframe, width, height, exportLabel);
    } catch {
      alert("PDF export failed - make sure the preview has finished loading.");
    } finally {
      setExportState(null);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center px-6 pt-4 pb-0 overflow-hidden">
      <Tabs defaultValue="desktop" onValueChange={(v) => setActiveTab(v as "desktop" | "mobile")} className="w-full max-w-[1600px] flex flex-col h-full">
        {/* Toolbar row — Panel toggle on left, action buttons in middle, tabs pinned to right */}
        <div ref={toolbarRowRef} className="mb-3 flex items-center gap-2">
          {/* Show Panel button removed — now a floating tab on the sidebar edge in App.tsx */}
          <div className="flex shrink-0 items-center gap-2">
            {appState === AppState.CODE_READY && (
              <>
                <Button
                  onClick={() => {
                    if (isFPActive && activeScreenId) {
                      // 1. Clear any in-flight DESIGNER_DOM_UPDATED debounce so edited HTML
                      //    can't overwrite the just-reset originalHtml after a 100ms delay.
                      window.dispatchEvent(new CustomEvent("designer:clear-dom-sync-timer"));
                      // Tell Write HTML else-branch to skip live-DOM capture so it uses
                      // the freshly-reset latestCodeRef (originalHtml) instead of stale DOM.
                      window.dispatchEvent(new CustomEvent("designer:skip-live-capture"));
                      // 2. Grab originalHtml BEFORE resetting store for direct iframe write.
                      const activeScreenData = fpScreens.find(s => s.id === activeScreenId);
                      const resetTargetHtml = activeTab === "mobile"
                        ? (activeScreenData?.originalMobileHtml || activeScreenData?.mobileHtml || "")
                        : (activeScreenData?.originalHtml || activeScreenData?.html || "");
                      // 3. Reset the store FIRST so latestCodeRef picks up originalHtml
                      //    before the Write HTML effect runs (avoids timing race).
                      if (activeTab === "mobile") {
                        resetScreenMobileToOriginal(activeScreenId);
                      } else {
                        resetScreenToOriginal(activeScreenId);
                      }
                      // 4. Direct iframe write for immediate visual reset (desktop only — mobile
                      //    iframe uses its own internal ref that isn't accessible here).
                      if (activeTab !== "mobile" && iframeRef?.current && resetTargetHtml.trim()) {
                        const doc = iframeRef.current.contentDocument;
                        if (doc) { doc.open(); doc.write(resetTargetHtml); doc.close(); }
                      }
                      // 5. Exit interactive mode (triggers Write HTML effect).
                      if (isInteractiveMode) setInteractiveMode(false);
                      window.dispatchEvent(new CustomEvent("designer:force-reinject"));
                      // 6. Increment the reset key to force PreviewComponent remount —
                      //    guarantees a clean write of originalHtml regardless of throttle.
                      if (activeTab === "mobile") {
                        setMobileResetKey(k => k + 1);
                      } else {
                        setDesktopResetKey(k => k + 1);
                      }
                    } else {
                      // Single-page mode: walk to root commit (original AI-generated version)
                      window.dispatchEvent(new CustomEvent("designer:skip-live-capture"));
                      if (isInteractiveMode) setInteractiveMode(false);
                      let rootHash = head;
                      while (rootHash !== null && commits[rootHash]?.parentHash !== null) {
                        rootHash = commits[rootHash]?.parentHash ?? null;
                      }
                      if (rootHash !== null && rootHash !== head) setHead(rootHash);
                    }
                  }}
                  className="flex shrink-0 items-center gap-x-2"
                  title={isFPActive ? "Reset this screen to its original AI-generated version" : "Restore original AI-generated version"}
                >
                  <FaUndo /> Reset
                </Button>
                {isInteractiveMode && (
                  <Button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("designer:undo"));
                    }}
                    variant="secondary"
                    className="flex items-center gap-x-2"
                    title="Undo last edit (Ctrl+Z)"
                  >
                    ↩ Undo
                  </Button>
                )}

                {/* 闁冲厜鍋撻柍鍏夊亾 Download Code (existing) 闁冲厜鍋撻柍鍏夊亾 */}
                <Button
                  onClick={() => downloadCode(previewCode)}
                  variant="secondary"
                  disabled={!hasPreviewCode}
                  className="flex items-center gap-x-2"
                >
                  <FaDownload /> Download Code
                </Button>

                {/* 闁冲厜鍋撻柍鍏夊亾 Download PNG (new) 闁冲厜鍋撻柍鍏夊亾 */}
                <Button
                  onClick={handleDownloadPng}
                  variant="secondary"
                  disabled={!hasPreviewCode || exportState !== null}
                  className="flex items-center gap-x-2"
                  title="Download current preview as a PNG image"
                >
                  <FaFileImage />
                  {exportState === "png" ? "Exporting..." : "Download PNG"}
                </Button>

                {/* 闁冲厜鍋撻柍鍏夊亾 Download PDF (new) 闁冲厜鍋撻柍鍏夊亾 */}
                <Button
                  onClick={handleDownloadPdf}
                  variant="secondary"
                  disabled={!hasPreviewCode || exportState !== null}
                  className="flex items-center gap-x-2"
                  title="Download current preview as a PDF document"
                >
                  <FaFilePdf />
                  {exportState === "pdf" ? "Exporting..." : "Download PDF"}
                </Button>
              </>
            )}
          </div>

          <div className="ml-auto shrink-0">
            <TabsList>
              <TabsTrigger value="desktop" className="flex gap-x-2">
                <FaDesktop /> Desktop
              </TabsTrigger>
              <TabsTrigger value="mobile" className="flex gap-x-2">
                <FaMobile /> Mobile
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-x-2">
                <FaCode />
                <span className="flex flex-col items-start leading-none">
                  <span>Code</span>
                  <span className="text-[8px] opacity-50 font-normal">Desktop</span>
                </span>
              </TabsTrigger>
              <TabsTrigger value="specs" className="flex gap-x-2">
                <FaBook /> Dev Specs
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Desktop tab */}
        <TabsContent value="desktop">
          <div
            className="rounded-xl border border-stone-800 bg-stone-950 p-4"
            style={{ height: panelH }}
          >
            {isFPPlanning ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <p className="font-mono text-xs text-violet-300">Planning project screens…</p>
                <p className="text-[10px] text-stone-500">This takes a few seconds</p>
              </div>
            ) : hasGeneratedCode && !hasPreviewCode ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center text-sm text-amber-200">
                Generated code exists, but no renderable HTML was found. Check the Code tab or
                choose HTML + Tailwind output.
              </div>
            ) : (
              <PreviewComponent
                key={isFPActive ? (activeScreenId ?? "fp-init") + "-d" + desktopResetKey : "sp"}
                code={previewCode}
                device="desktop"
                doUpdate={doUpdate}
                iframeRef={iframeRef}
                aestheticMode={settings.aestheticMode}
                panelTop={toolbarBottom}
              />
            )}
          </div>
        </TabsContent>

        {/* Mobile tab */}
        <TabsContent value="mobile">
          <div
            className="flex justify-center rounded-xl border border-stone-800 bg-stone-950 p-4"
            style={{ height: panelH }}
          >
            {isFPPlanning ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <p className="font-mono text-xs text-violet-300">Planning project screens…</p>
              </div>
            ) : hasGeneratedCode && !hasPreviewCode ? (
              <div className="flex h-full w-full items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center text-sm text-amber-200">
                Generated code exists, but no renderable HTML was found. Check the Code tab or
                choose HTML + Tailwind output.
              </div>
            ) : (
              <PreviewComponent
                key={isFPActive ? (activeScreenId ?? "fp-init") + "-m" + mobileResetKey : "sp-mobile"}
                code={mobilePreviewCode}
                device="mobile"
                doUpdate={doUpdate}
                aestheticMode={settings.aestheticMode}
                panelTop={toolbarBottom}
              />
            )}
          </div>
        </TabsContent>

        {/* 闁冲厜鍋撻柍鍏夊亾 Code tab 闁冲厜鍋撻柍鍏夊亾 */}
        <TabsContent value="code">
          <CodeTab code={previewCode} setCode={() => {}} settings={settings} />
        </TabsContent>

        {/* Dev Specs tab */}
        <TabsContent value="specs">
          <div
            className="mx-4 overflow-auto rounded-xl border border-stone-800 bg-stone-950"
            style={{ height: panelH }}
          >
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-800 bg-stone-950 px-5 py-3">
              <FaBook className="text-sm text-amber-500" />
              <h2 className="text-sm font-bold tracking-tight text-white">Dev Specs</h2>
              <span className="ml-auto font-mono text-[10px] text-stone-500">
                Auto-generated / {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="p-6">
              {devSpecs ? (
                <div className="space-y-0.5">
                  {devSpecs.split("\n").map((line, index) => {
                    if (line.startsWith("## ")) {
                      return (
                        <h2
                          key={index}
                          className="mt-6 mb-2 flex items-center gap-2 text-sm font-bold text-white"
                        >
                          <span className="inline-block h-4 w-1 shrink-0 rounded-full bg-amber-500" />
                          {line.replace("## ", "")}
                        </h2>
                      );
                    }
                    if (line.startsWith("### ")) {
                      return (
                        <h3
                          key={index}
                          className="mt-4 mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-amber-400"
                        >
                          {line.replace("### ", "")}
                        </h3>
                      );
                    }
                    if (line.startsWith("- ")) {
                      const parts = line
                        .replace("- ", "")
                        .split(/(\*\*[^*]+\*\*)/)
                        .filter(Boolean);
                      return (
                        <div
                          key={index}
                          className="flex items-start gap-2 py-0.5 text-xs text-stone-300"
                        >
                          <span className="mt-0.5 shrink-0 text-stone-500">-</span>
                          <span>
                            {parts.map((part, pi) =>
                              part.startsWith("**") && part.endsWith("**") ? (
                                <span key={pi} className="font-semibold text-white">
                                  {part.slice(2, -2)}
                                </span>
                              ) : (
                                <span key={pi}>{part}</span>
                              )
                            )}
                          </span>
                        </div>
                      );
                    }
                    if (line.trim() === "") return <div key={index} className="h-2" />;
                    if (line.includes("`")) {
                      const tokens = line.split(/(`[^`]+`)/g);
                      return (
                        <div key={index} className="mt-1.5 flex flex-wrap gap-1.5">
                          {tokens.map((token, ti) =>
                            token.startsWith("`") && token.endsWith("`") ? (
                              <code
                                key={ti}
                                className="rounded border border-stone-700 bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] text-amber-400"
                              >
                                {token.slice(1, -1)}
                              </code>
                            ) : (
                              <span key={ti} className="self-center text-xs text-stone-400">
                                {token}
                              </span>
                            )
                          )}
                        </div>
                      );
                    }
                    return (
                      <p key={index} className="text-xs text-stone-400">
                        {line}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <FaBook className="mb-3 text-3xl text-stone-600" />
                  <p className="font-mono text-xs text-stone-500">
                    Generate a UI to see its specification analysis here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PreviewPane;
