/**
 * Sub-style selector shown inside the Full Project aesthetic card.
 * Lets the user choose whether the generated multi-page project
 * should be rendered as Wireframe (Low-Fi) or Product (High-Fi).
 *
 * The chosen sub-style is stored in a separate localStorage key so it
 * doesn't conflict with the main aestheticMode setting.
 */

export const FULL_PROJECT_SUB_STYLE_KEY = "fullProject_subStyle";
export type FullProjectSubStyle = "wireframe" | "high_fi";

interface Props {
  subStyle: FullProjectSubStyle;
  setSubStyle: (s: FullProjectSubStyle) => void;
  disabled?: boolean;
}

export default function FullProjectSubStyleSelector({ subStyle, setSubStyle, disabled }: Props) {
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] text-stone-500 font-mono uppercase tracking-wide">Visual style for generated pages:</p>
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            { value: "wireframe" as const, label: "Wireframe", desc: "Blueprint / Low-Fi", color: "border-zinc-400" },
            { value: "high_fi"   as const, label: "High-Fi",   desc: "Polished / Product",  color: "border-amber-500/80" },
          ]
        ).map((opt) => (
          <button
            key={opt.value}
            disabled={disabled}
            onClick={() => setSubStyle(opt.value)}
            className={`p-2 rounded border text-left transition-all disabled:opacity-40 text-[10px] font-mono ${
              subStyle === opt.value
                ? `bg-stone-900 ${opt.color} text-white shadow-sm`
                : "bg-stone-950 border-stone-800 text-stone-500 hover:bg-stone-900/40"
            }`}
          >
            <div className="font-semibold">{opt.label}</div>
            <div className="text-stone-500 text-[9px] mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
