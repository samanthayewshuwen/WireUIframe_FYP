import React, { useEffect, useRef, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { addHighlight, removeHighlight } from "./utils";
import { useAppStore } from "../../store/app-store";
import KeyboardShortcutBadge from "../core/KeyboardShortcutBadge";

interface EditPopupProps {
  event: MouseEvent | null;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  doUpdate: (updateInstruction: string, selectedElement?: HTMLElement) => void;
  scale: number;
}

const EditPopup: React.FC<EditPopupProps> = ({ event, iframeRef, doUpdate, scale }) => {
  const { inSelectAndEditMode } = useAppStore();
  const inSelectAndEditModeRef = useRef(inSelectAndEditMode);
  useEffect(() => {
    inSelectAndEditModeRef.current = inSelectAndEditMode;
  }, [inSelectAndEditMode]);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [selectedElement, setSelectedElement] = useState<HTMLElement | undefined>(undefined);
  const [updateText, setUpdateText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function onUpdate(text: string) {
    doUpdate(text, selectedElement ? removeHighlight(selectedElement) : selectedElement);
    setSelectedElement(undefined);
    setPopupVisible(false);
  }

  // Clear when mode turns off
  useEffect(() => {
    if (!inSelectAndEditMode) {
      if (selectedElement) removeHighlight(selectedElement);
      setSelectedElement(undefined);
      setPopupVisible(false);
    }
  }, [inSelectAndEditMode, selectedElement]);

  // Handle clicks forwarded from the iframe body listener (set in PreviewComponent)
  useEffect(() => {
    if (!inSelectAndEditModeRef.current || !event) return;

    event.preventDefault();
    const target = event.target as HTMLElement;
    if (!target || target === iframeRef.current?.contentDocument?.body) return;

    setSelectedElement((prev) => {
      if (prev) removeHighlight(prev);
      return addHighlight(target);
    });

    // Position relative to innerRef (the scaled wrapper).
    // event.clientX/Y are coords inside the iframe's viewport (unscaled).
    // Multiplying by scale converts to the visual position inside the wrapper.
    setPopupVisible(true);
    // Offset ~2 cm (76 px) away from the clicked element so the popup never
    // overlaps the selected component.
    const OFFSET = 76;
    const scaledX = event.clientX * scale;
    const scaledY = event.clientY * scale;
    const maxX = BASE_W * scale - 250;
    const maxY = BASE_H * scale - 150;
    // Prefer right + below; flip left if near the right edge.
    const popX = scaledX + OFFSET <= maxX ? scaledX + OFFSET : Math.max(0, scaledX - 250 - OFFSET);
    const popY = scaledY + OFFSET <= maxY ? scaledY + OFFSET : Math.max(0, scaledY - 150 - OFFSET);
    setPopupPosition({ x: popX, y: popY });
    setUpdateText("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [event, iframeRef, scale]);

  useEffect(() => {
    if (popupVisible) textareaRef.current?.focus();
  }, [popupVisible]);

  if (!popupVisible) return null;

  return (
    <div
      className="absolute bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600 rounded shadow-lg w-60 z-[9999]"
      style={{ top: popupPosition.y, left: popupPosition.x }}
    >
      <Textarea
        ref={textareaRef}
        value={updateText}
        onChange={(e) => setUpdateText(e.target.value)}
        placeholder="Tell the AI what to change about this element..."
        className="dark:bg-gray-700 dark:text-white"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onUpdate(updateText);
          }
        }}
      />
      <div className="flex justify-end mt-2">
        <Button className="dark:bg-gray-700 dark:text-white" onClick={() => onUpdate(updateText)}>
          Update <KeyboardShortcutBadge letter="enter" />
        </Button>
      </div>
    </div>
  );
};

// Match PreviewComponent's base dimensions for clamping
const BASE_W = 1440;
const BASE_H = 900;

export default EditPopup;