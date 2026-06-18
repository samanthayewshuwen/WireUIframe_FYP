import { GiClick } from "react-icons/gi";
import { useAppStore } from "../../store/app-store";

function SelectAndEditModeToggleButton() {
  const { inSelectAndEditMode, toggleInSelectAndEditMode } = useAppStore();

  return (
    <button
      onClick={toggleInSelectAndEditMode}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
        inSelectAndEditMode
          ? "border-red-500 bg-red-600 text-white hover:bg-red-500"
          : "border-stone-600 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white"
      }`}
    >
      <GiClick className="text-lg" />
      <span>
        {inSelectAndEditMode ? "Exit selection mode" : "Select and update"}
      </span>
    </button>
  );
}

export default SelectAndEditModeToggleButton;
