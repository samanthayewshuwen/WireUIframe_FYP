import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAppStore } from "../../store/app-store";
import { SavedComponent } from "../../types";

const STORAGE_KEY = "wireuiframe_component_library";

export default function SaveComponentModal() {
  const { addSavedComponent } = useAppStore();

  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [tagName, setTagName] = useState("DIV");
  const [name, setName] = useState("");

  useEffect(() => {
    const handler = (event: CustomEvent<{ html: string; tagName: string }>) => {
      const nextTagName = event.detail.tagName || "DIV";
      setHtml(event.detail.html || "");
      setTagName(nextTagName);
      setName(`Extracted ${nextTagName} Block`);
      setOpen(true);
    };

    window.addEventListener("designer:save-component", handler as EventListener);
    return () => window.removeEventListener("designer:save-component", handler as EventListener);
  }, []);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setName("");
  };

  const handleSave = () => {
    if (!name.trim() || !html.trim()) return;

    const component: SavedComponent = {
      id: `comp_${Date.now()}`,
      name: name.trim(),
      html,
      tagName: tagName.toUpperCase(),
      createdAt: new Date().toISOString(),
    };

    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as SavedComponent[];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([component, ...stored]));
    } catch (error) {
      toast.error("Component library storage is full. Delete some saved blocks and try again.");
      console.error("Failed to save component", error);
      return;
    }

    addSavedComponent({ id: component.id, name: component.name, html: component.html });
    toast.success("Component saved");
    close();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-stone-800 bg-stone-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Save to Component Library
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close save component dialog"
            onClick={close}
            className="cursor-pointer font-mono text-xs text-stone-400 hover:text-white"
          >
            x
          </button>
        </div>

        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-widest text-stone-400">Component Name *</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
            placeholder="e.g. Hero Section, Nav Card, Pricing Row"
            autoFocus
            className="w-full rounded-lg border border-stone-800 bg-stone-950 p-2.5 text-xs text-stone-100 placeholder-stone-600 transition-colors focus:border-amber-500/50 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="font-mono text-[10px] uppercase tracking-widest text-stone-400">Tag</label>
          <span className="rounded border border-stone-700 bg-stone-800 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-500">
            {tagName}
          </span>
        </div>

        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-widest text-stone-400">HTML Preview</label>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-stone-800 bg-stone-950 p-2.5">
            <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-stone-500">
              {html.length > 400 ? `${html.slice(0, 400)}...` : html}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            aria-label="Cancel save component"
            onClick={close}
            className="cursor-pointer rounded-lg border border-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            aria-label="Save component"
            onClick={handleSave}
            disabled={!name.trim() || !html.trim()}
            className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Component
          </button>
        </div>
      </div>
    </div>
  );
}
