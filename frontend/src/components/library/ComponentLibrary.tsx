import { useCallback, useEffect, useState } from "react";
import { SavedComponent } from "../../types";
import { useAppStore } from "../../store/app-store";

const STORAGE_KEY = "wireuiframe_component_library";

function load(): SavedComponent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persist(items: SavedComponent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

interface Props {
  onClose: () => void;
  getCurrentCode?: () => string;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

export default function ComponentLibrary({ onClose, getCurrentCode, iframeRef }: Props) {
  const { isInteractiveMode, setInteractiveMode } = useAppStore();
  const [components, setComponents] = useState<SavedComponent[]>([]);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveTag, setSaveTag] = useState("SECTION");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);

  useEffect(() => {
    setComponents(load());
  }, []);

  useEffect(() => {
    const handleSave = (event: Event) => {
      const detail = (event as CustomEvent).detail as { html?: string; tagName?: string } | undefined;
      if (!detail?.html) {
        setComponents(load());
        return;
      }

      const name = window.prompt("Name this component block", detail.tagName || "Saved Block");
      if (!name?.trim()) return;

      const next = [
        {
          id: `comp_${Date.now()}`,
          name: name.trim(),
          html: detail.html,
          tagName: (detail.tagName || "DIV").toUpperCase(),
          createdAt: new Date().toISOString(),
        },
        ...load(),
      ];
      persist(next);
      setComponents(next);
    };
    window.addEventListener("designer:save-component", handleSave);
    return () => window.removeEventListener("designer:save-component", handleSave);
  }, []);

  const filtered = components.filter((component) => {
    const q = search.toLowerCase();
    return (
      !q ||
      component.name.toLowerCase().includes(q) ||
      component.tagName.toLowerCase().includes(q)
    );
  });

  function handleSaveCurrentPage() {
    if (!saveName.trim()) return;
    const html = getCurrentCode?.() ?? "";
    if (!html.trim()) return;

    const component: SavedComponent = {
      id: `comp_${Date.now()}`,
      name: saveName.trim(),
      html,
      tagName: saveTag.trim().toUpperCase() || "SECTION",
      createdAt: new Date().toISOString(),
    };
    const next = [component, ...components];
    setComponents(next);
    persist(next);
    setSaveName("");
    setSaveTag("SECTION");
    setIsSaving(false);
  }

  function handleDelete(id: string) {
    const next = components.filter((component) => component.id !== id);
    setComponents(next);
    persist(next);
  }

  async function handleCopy(html: string, id: string) {
    await navigator.clipboard.writeText(html);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  const handleInsert = useCallback(
    (component: SavedComponent) => {
      const iframe = iframeRef?.current;
      if (!iframe) return;
      if (!isInteractiveMode) setInteractiveMode(true);

      if (isInteractiveMode) {
        iframe.contentWindow?.postMessage(
          { type: "DESIGNER_INSERT_COMPONENT", html: component.html },
          "*"
        );
      } else {
        const doc = iframe.contentDocument;
        if (!doc?.body) return;
        const tmp = doc.createElement("div");
        tmp.innerHTML = component.html.trim();
        const el = tmp.firstElementChild;
        if (!el) return;
        el.classList.add("__designer-block");
        el.setAttribute("data-component-category", component.tagName || "Component");
        doc.body.appendChild(el);
        window.postMessage(
          {
            type: "DESIGNER_DOM_UPDATED",
            html: "<!DOCTYPE html>\n" + doc.documentElement.outerHTML,
          },
          "*"
        );
      }

      setInsertedId(component.id);
      window.setTimeout(() => setInsertedId(null), 1600);
    },
    [iframeRef, isInteractiveMode, setInteractiveMode]
  );

  return (
    <div className="flex h-full flex-col bg-stone-950 text-stone-300">
      <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Component Library</h2>
          <p className="text-[10px] font-mono text-stone-500">
            {components.length} saved blocks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSaving((value) => !value)}
            className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400 hover:bg-amber-500/20"
          >
            {isSaving ? "Cancel" : "Save Current"}
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-900 hover:text-stone-200"
            title="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {isInteractiveMode && (
        <div className="mx-3 mt-3 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-mono text-amber-300">
          Interactive Edit is on. Inserted blocks become selected and draggable immediately.
        </div>
      )}

      {!isInteractiveMode && (
        <div className="mx-3 mt-3 rounded border border-stone-700 bg-stone-900 px-3 py-2 text-[10px] font-mono text-stone-400">
          Turn on Interactive Edit to drag, resize, and style inserted blocks.
        </div>
      )}

      {isSaving && (
        <div className="space-y-2 border-b border-amber-500/20 bg-stone-900/60 px-4 py-3">
          <input
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSaveCurrentPage()}
            placeholder="Component name"
            autoFocus
            className="w-full rounded border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-100 placeholder-stone-600 focus:border-amber-500/50 focus:outline-none"
          />
          <input
            value={saveTag}
            onChange={(event) => setSaveTag(event.target.value)}
            placeholder="Category or tag"
            className="w-full rounded border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-100 placeholder-stone-600 focus:border-amber-500/50 focus:outline-none"
          />
          <button
            onClick={handleSaveCurrentPage}
            disabled={!saveName.trim()}
            className="w-full rounded bg-amber-500 py-1.5 text-xs font-semibold text-stone-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Current Canvas
          </button>
        </div>
      )}

      <div className="border-b border-stone-800 px-4 py-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search components..."
          className="w-full rounded border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs text-stone-300 placeholder-stone-600 focus:border-stone-600 focus:outline-none"
        />
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs font-medium text-stone-500">
              {components.length === 0 ? "No saved components yet" : "No matching components"}
            </p>
            <p className="mt-1 text-[10px] font-mono text-stone-600">
              Select a block in Interactive Edit, then use Save Block.
            </p>
          </div>
        ) : (
          filtered.map((component) => (
            <div
              key={component.id}
              draggable
              onDragStart={(event) => {
                if (!isInteractiveMode) setInteractiveMode(true);
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData("text/html", component.html);
                event.dataTransfer.setData("application/x-wireuiframe-component", component.html);
              }}
              className="rounded border border-stone-800 bg-stone-900/60 p-3 transition-colors hover:border-amber-500/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs font-semibold text-white">{component.name}</h3>
                  <span className="text-[9px] font-mono uppercase tracking-wide text-amber-500">
                    {component.tagName} block
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(component.html, component.id)}
                    title="Copy HTML"
                    className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-800 hover:text-amber-400"
                  >
                    {copiedId === component.id ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => handleDelete(component.id)}
                    title="Delete"
                    className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-800 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <pre className="mt-2 max-h-16 overflow-hidden rounded bg-stone-950 p-1.5 text-[9px] leading-relaxed text-stone-600 whitespace-pre-wrap">
                {component.html.slice(0, 260)}
                {component.html.length > 260 ? "..." : ""}
              </pre>

              <button
                onClick={() => handleInsert(component)}
                className={`mt-2 flex w-full items-center justify-center rounded border py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                  insertedId === component.id
                    ? "border-emerald-500 bg-emerald-600 text-white"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                {insertedId === component.id ? "Inserted" : "Insert into Canvas"}
              </button>
              <p className="mt-1.5 text-[9px] font-mono text-stone-600">
                {new Date(component.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
