import { useState, useEffect } from "react";

export interface FullProjectPage {
  id: string;
  name: string;
}

interface Props {
  pages: FullProjectPage[];
}

// Maps common page name keywords to emoji icons
const PAGE_ICON_MAP: [string, string][] = [
  ["home",         "🏠"],
  ["dashboard",    "📊"],
  ["login",        "🔐"],
  ["sign in",      "🔐"],
  ["register",     "📝"],
  ["sign up",      "📝"],
  ["search",       "🔍"],
  ["results",      "📋"],
  ["listing",      "📋"],
  ["detail",       "ℹ️"],
  ["flight",       "✈️"],
  ["seat",         "💺"],
  ["booking",      "📅"],
  ["payment",      "💳"],
  ["checkout",     "💳"],
  ["confirm",      "✅"],
  ["success",      "✅"],
  ["my booking",   "🎫"],
  ["order",        "📦"],
  ["cart",         "🛒"],
  ["profile",      "👤"],
  ["account",      "👤"],
  ["setting",      "⚙️"],
  ["passenger",    "👥"],
  ["notification", "🔔"],
  ["report",       "📈"],
  ["admin",        "🛡️"],
  ["help",         "❓"],
  ["about",        "📖"],
];

function getIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, icon] of PAGE_ICON_MAP) {
    if (lower.includes(keyword)) return icon;
  }
  return "📄";
}

export default function FullProjectPageNav({ pages }: Props) {
  const [activePage, setActivePage] = useState<string>(pages[0]?.id ?? "");

  // Sync active page when the iframe hash changes from clicks inside the page
  useEffect(() => {
    const syncFromIframeMessage = (e: MessageEvent) => {
      if (e.data?.type === "FP_HASH_CHANGED" && e.data.pageId) {
        setActivePage(e.data.pageId);
      }
    };
    window.addEventListener("message", syncFromIframeMessage);
    return () => window.removeEventListener("message", syncFromIframeMessage);
  }, []);

  const navigate = (pageId: string) => {
    setActivePage(pageId);
    window.dispatchEvent(
      new CustomEvent("fullproject:navigate", { detail: { pageId } })
    );
  };

  if (pages.length === 0) return null;

  return (
    <div className="mt-2 mb-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <svg className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 16h4" />
        </svg>
        <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400">
          Full Project — {pages.length} Pages
        </span>
        <span className="ml-auto text-[8px] text-stone-600 font-mono">Click to preview</span>
      </div>

      {/* Page buttons */}
      <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
        {pages.map((page, index) => {
          const isActive = activePage === page.id;
          return (
            <button
              key={page.id}
              onClick={() => navigate(page.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all flex items-center gap-2 group ${
                isActive
                  ? "bg-violet-900/40 border-violet-500/60 text-violet-100 shadow-sm"
                  : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/60 hover:border-stone-700 hover:text-stone-200"
              }`}
            >
              {/* Index badge */}
              <span
                className={`shrink-0 w-4 h-4 rounded text-[8px] font-mono flex items-center justify-center font-bold ${
                  isActive
                    ? "bg-violet-500/30 text-violet-300"
                    : "bg-stone-800 text-stone-500 group-hover:bg-stone-700"
                }`}
              >
                {index + 1}
              </span>

              {/* Icon */}
              <span className="text-sm leading-none shrink-0">{getIcon(page.name)}</span>

              {/* Page name */}
              <span className="text-xs font-sans font-medium truncate flex-1">{page.name}</span>

              {/* Active indicator */}
              {isActive && (
                <span className="shrink-0 text-[8px] font-mono text-violet-400 bg-violet-900/60 px-1.5 py-0.5 rounded border border-violet-700/40">
                  VIEWING
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Info bar */}
      <div className="mt-2 px-2 py-1.5 rounded-lg bg-stone-900/40 border border-stone-800">
        <p className="text-[9px] text-stone-500 font-mono leading-relaxed">
          Navigation links inside the preview also work — click any nav link in the generated UI to switch pages.
        </p>
      </div>
    </div>
  );
}
