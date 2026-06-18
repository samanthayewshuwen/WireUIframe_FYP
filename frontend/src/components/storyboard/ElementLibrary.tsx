import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = "icons" | "characters" | "vr" | "templates";

interface LibraryElement {
  id: string;
  label: string;
  category: Category;
  svg: string;
  stampW: number;
  stampH: number;
  fillCanvas?: boolean; // templates fill the entire canvas
}

// ─── SVG Element Library ─────────────────────────────────────────────────────

const ELEMENTS: LibraryElement[] = [
  // ── Game Icons ──────────────────────────────────────────────────────────────
  {
    id: "sword", label: "Sword", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <line x1="8" y1="40" x2="36" y2="12" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="30" y1="18" x2="42" y2="18" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="36" y1="12" x2="36" y2="24" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="6" y1="38" x2="10" y2="42" stroke="#1c1917" stroke-width="2.5"/>
    </svg>`,
  },
  {
    id: "shield", label: "Shield", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 6 L40 12 L40 28 Q40 38 24 44 Q8 38 8 28 L8 12 Z" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="24" y1="6" x2="24" y2="44" stroke="#1c1917" stroke-width="1"/>
      <line x1="8" y1="20" x2="40" y2="20" stroke="#1c1917" stroke-width="1"/>
    </svg>`,
  },
  {
    id: "heart", label: "Health", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 38 Q10 28 10 18 Q10 10 18 10 Q22 10 24 14 Q26 10 30 10 Q38 10 38 18 Q38 28 24 38Z" stroke="#1c1917" stroke-width="1.5" fill="none"/>
    </svg>`,
  },
  {
    id: "coin", label: "Coin", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="16" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <circle cx="24" cy="24" r="10" stroke="#1c1917" stroke-width="1" fill="none"/>
      <text x="24" y="29" text-anchor="middle" font-size="12" font-family="serif" fill="#1c1917">$</text>
    </svg>`,
  },
  {
    id: "key", label: "Key", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="18" r="8" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <circle cx="16" cy="18" r="3" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <line x1="22" y1="22" x2="40" y2="38" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="33" y1="31" x2="33" y2="37" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="37" y1="35" x2="37" y2="41" stroke="#1c1917" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: "portal", label: "Portal", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="24" cy="24" rx="8" ry="16" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <ellipse cx="24" cy="24" rx="14" ry="20" stroke="#1c1917" stroke-width="1" fill="none" stroke-dasharray="3 2"/>
      <line x1="24" y1="4" x2="24" y2="8" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="40" x2="24" y2="44" stroke="#1c1917" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: "potion", label: "Potion", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 14 L18 22 Q8 28 8 36 Q8 42 24 42 Q40 42 40 36 Q40 28 30 22 L30 14 Z" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="18" y1="14" x2="30" y2="14" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="20" y1="8" x2="28" y2="10" stroke="#1c1917" stroke-width="2"/>
      <line x1="16" y1="32" x2="22" y2="36" stroke="#1c1917" stroke-width="1"/>
      <line x1="22" y1="30" x2="16" y2="36" stroke="#1c1917" stroke-width="1"/>
    </svg>`,
  },
  {
    id: "chest", label: "Chest", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="22" width="36" height="20" rx="2" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M6 22 Q6 14 24 14 Q42 14 42 22" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="6" y1="32" x2="42" y2="32" stroke="#1c1917" stroke-width="1"/>
      <rect x="20" y="29" width="8" height="6" rx="1" stroke="#1c1917" stroke-width="1.2" fill="none"/>
    </svg>`,
  },
  {
    id: "star", label: "Star", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <polygon points="24,6 28,18 40,18 31,26 34,38 24,31 14,38 17,26 8,18 20,18" stroke="#1c1917" stroke-width="1.5" fill="none"/>
    </svg>`,
  },
  {
    id: "bomb", label: "Bomb", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="28" r="14" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="22" y1="14" x2="28" y2="8" stroke="#1c1917" stroke-width="1.5"/>
      <path d="M28 8 Q32 4 36 8" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <circle cx="30" cy="22" r="3" stroke="#1c1917" stroke-width="1" fill="none"/>
    </svg>`,
  },
  {
    id: "gem", label: "Gem", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <polygon points="24,6 38,16 38,34 24,44 10,34 10,16" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <polygon points="24,6 38,16 24,24 10,16" stroke="#1c1917" stroke-width="1" fill="none"/>
      <line x1="24" y1="24" x2="24" y2="44" stroke="#1c1917" stroke-width="1"/>
    </svg>`,
  },
  {
    id: "arrow", label: "Arrow", category: "icons", stampW: 60, stampH: 60,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <line x1="8" y1="40" x2="40" y2="8" stroke="#1c1917" stroke-width="1.5"/>
      <polyline points="24,8 40,8 40,24" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="8" y1="42" x2="6" y2="36" stroke="#1c1917" stroke-width="1.2"/>
      <line x1="8" y1="42" x2="14" y2="44" stroke="#1c1917" stroke-width="1.2"/>
    </svg>`,
  },

  // ── Anime Characters ─────────────────────────────────────────────────────────
  {
    id: "char-idle", label: "Idle", category: "characters", stampW: 48, stampH: 64,
    svg: `<svg viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="10" r="7" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M17 8 Q18 4 24 4 Q30 4 31 8" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="24" y1="17" x2="24" y2="36" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="22" x2="14" y2="30" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="22" x2="34" y2="30" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="36" x2="16" y2="54" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="36" x2="32" y2="54" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="16" y1="54" x2="12" y2="56" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="32" y1="54" x2="36" y2="56" stroke="#1c1917" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: "char-attack", label: "Attack", category: "characters", stampW: 56, stampH: 64,
    svg: `<svg viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="26" cy="10" r="7" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="26" y1="17" x2="22" y2="36" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="22" x2="44" y2="14" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="44" y1="14" x2="52" y2="6" stroke="#1c1917" stroke-width="2"/>
      <line x1="24" y1="22" x2="12" y2="28" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="22" y1="36" x2="12" y2="52" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="22" y1="36" x2="34" y2="54" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="46" y1="8" x2="52" y2="4" stroke="#1c1917" stroke-width="1" stroke-dasharray="2 1"/>
      <line x1="50" y1="12" x2="54" y2="10" stroke="#1c1917" stroke-width="1" stroke-dasharray="2 1"/>
    </svg>`,
  },
  {
    id: "char-jump", label: "Jump", category: "characters", stampW: 48, stampH: 64,
    svg: `<svg viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="8" r="7" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="24" y1="15" x2="24" y2="30" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="20" x2="12" y2="14" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="20" x2="36" y2="14" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="30" x2="14" y2="38" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="14" y1="38" x2="18" y2="48" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="30" x2="34" y2="38" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="34" y1="38" x2="30" y2="48" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="18" y1="54" x2="18" y2="60" stroke="#1c1917" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="24" y1="56" x2="24" y2="62" stroke="#1c1917" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="30" y1="54" x2="30" y2="60" stroke="#1c1917" stroke-width="1" stroke-dasharray="2 2"/>
    </svg>`,
  },
  {
    id: "char-crouch", label: "Crouch", category: "characters", stampW: 52, stampH: 48,
    svg: `<svg viewBox="0 0 52 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="26" cy="22" r="7" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="26" y1="29" x2="26" y2="38" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="26" y1="32" x2="10" y2="28" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="26" y1="32" x2="42" y2="28" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="26" y1="38" x2="14" y2="46" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="14" y1="46" x2="8" y2="38" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="26" y1="38" x2="38" y2="46" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="38" y1="46" x2="44" y2="38" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="6" y1="46" x2="18" y2="46" stroke="#1c1917" stroke-width="2"/>
      <line x1="34" y1="46" x2="46" y2="46" stroke="#1c1917" stroke-width="2"/>
    </svg>`,
  },
  {
    id: "char-run", label: "Run", category: "characters", stampW: 56, stampH: 64,
    svg: `<svg viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="10" r="7" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="30" y1="17" x2="26" y2="34" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="28" y1="22" x2="42" y2="18" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="28" y1="22" x2="14" y2="30" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="26" y1="34" x2="14" y2="44" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="14" y1="44" x2="20" y2="56" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="26" y1="34" x2="40" y2="42" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="40" y1="42" x2="36" y2="54" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="4" y1="30" x2="14" y2="26" stroke="#1c1917" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="2" y1="36" x2="12" y2="34" stroke="#1c1917" stroke-width="1" stroke-dasharray="2 2"/>
    </svg>`,
  },
  {
    id: "char-cast", label: "Cast", category: "characters", stampW: 56, stampH: 64,
    svg: `<svg viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="10" r="7" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="24" y1="17" x2="24" y2="36" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="22" x2="10" y2="26" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="22" x2="44" y2="16" stroke="#1c1917" stroke-width="1.5"/>
      <circle cx="48" cy="14" r="4" stroke="#1c1917" stroke-width="1.2" fill="none" stroke-dasharray="2 1"/>
      <line x1="50" y1="10" x2="54" y2="6" stroke="#1c1917" stroke-width="1"/>
      <line x1="52" y1="14" x2="56" y2="14" stroke="#1c1917" stroke-width="1"/>
      <line x1="50" y1="18" x2="54" y2="22" stroke="#1c1917" stroke-width="1"/>
      <line x1="24" y1="36" x2="16" y2="54" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="24" y1="36" x2="32" y2="54" stroke="#1c1917" stroke-width="1.5"/>
    </svg>`,
  },

  // ── VR / AR Overlays ─────────────────────────────────────────────────────────
  {
    id: "vr-crosshair", label: "Crosshair", category: "vr", stampW: 80, stampH: 80,
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="12" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <circle cx="32" cy="32" r="2" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="32" y1="8" x2="32" y2="20" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="32" y1="44" x2="32" y2="56" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="8" y1="32" x2="20" y2="32" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="44" y1="32" x2="56" y2="32" stroke="#1c1917" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: "vr-hud", label: "HUD Frame", category: "vr", stampW: 100, stampH: 100,
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <polyline points="4,16 4,4 16,4" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <polyline points="48,4 60,4 60,16" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <polyline points="4,48 4,60 16,60" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <polyline points="60,48 60,60 48,60" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <rect x="20" y="20" width="24" height="24" stroke="#1c1917" stroke-width="0.8" fill="none" stroke-dasharray="3 2"/>
    </svg>`,
  },
  {
    id: "vr-waypoint", label: "Waypoint", category: "vr", stampW: 64, stampH: 64,
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="48" r="8" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="32" y1="40" x2="32" y2="12" stroke="#1c1917" stroke-width="1.5"/>
      <polyline points="22,22 32,10 42,22" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="28" y1="50" x2="36" y2="50" stroke="#1c1917" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: "vr-gaze", label: "Gaze Circle", category: "vr", stampW: 80, stampH: 80,
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="20" stroke="#1c1917" stroke-width="1.5" fill="none" stroke-dasharray="4 2"/>
      <circle cx="32" cy="32" r="10" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <circle cx="32" cy="32" r="3" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <circle cx="32" cy="32" r="1" fill="#1c1917"/>
    </svg>`,
  },
  {
    id: "vr-fov", label: "FOV Cone", category: "vr", stampW: 80, stampH: 80,
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="54" r="4" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="32" y1="50" x2="6" y2="12" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="32" y1="50" x2="58" y2="12" stroke="#1c1917" stroke-width="1.5"/>
      <path d="M10 18 Q32 8 54 18" stroke="#1c1917" stroke-width="1" fill="none" stroke-dasharray="3 2"/>
      <path d="M18 30 Q32 22 46 30" stroke="#1c1917" stroke-width="1" fill="none" stroke-dasharray="2 2"/>
    </svg>`,
  },
  {
    id: "vr-controller", label: "Controller", category: "vr", stampW: 80, stampH: 72,
    svg: `<svg viewBox="0 0 64 56" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 20 Q6 36 12 44 Q18 50 24 46 L28 38 Q32 36 36 38 L40 46 Q46 50 52 44 Q58 36 56 20 Q54 12 44 12 L20 12 Q10 12 8 20Z" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="18" y1="24" x2="18" y2="34" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="13" y1="29" x2="23" y2="29" stroke="#1c1917" stroke-width="1.5"/>
      <circle cx="44" cy="24" r="2.5" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <circle cx="50" cy="30" r="2.5" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <circle cx="38" cy="30" r="2.5" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <circle cx="44" cy="36" r="2.5" stroke="#1c1917" stroke-width="1.2" fill="none"/>
    </svg>`,
  },
  {
    id: "vr-anchor", label: "AR Anchor", category: "vr", stampW: 80, stampH: 80,
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="52" rx="20" ry="6" stroke="#1c1917" stroke-width="1.2" fill="none" stroke-dasharray="3 2"/>
      <line x1="32" y1="46" x2="32" y2="14" stroke="#1c1917" stroke-width="1.5"/>
      <polyline points="22,24 32,12 42,24" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="14" y1="52" x2="8" y2="52" stroke="#1c1917" stroke-width="1.2"/>
      <line x1="50" y1="52" x2="56" y2="52" stroke="#1c1917" stroke-width="1.2"/>
    </svg>`,
  },
  {
    id: "vr-compass", label: "Compass", category: "vr", stampW: 80, stampH: 80,
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="24" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <circle cx="32" cy="32" r="3" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <polygon points="32,10 28,32 32,28 36,32" stroke="#1c1917" stroke-width="1" fill="none"/>
      <polygon points="32,54 28,32 32,36 36,32" stroke="#1c1917" stroke-width="1" fill="none" stroke-dasharray="2 0"/>
      <text x="32" y="14" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#1c1917">N</text>
      <text x="32" y="56" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#1c1917">S</text>
      <text x="10" y="35" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#1c1917">W</text>
      <text x="54" y="35" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#1c1917">E</text>
    </svg>`,
  },

  // ── Scene Templates ───────────────────────────────────────────────────────────
  {
    id: "tmpl-dungeon", label: "Dungeon", category: "templates", stampW: 480, stampH: 256,
    fillCanvas: true,
    svg: `<svg viewBox="0 0 320 176" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="176" fill="#fafaf9"/>
      <line x1="0" y1="140" x2="320" y2="140" stroke="#1c1917" stroke-width="2"/>
      <line x1="40" y1="140" x2="40" y2="176" stroke="#78716c" stroke-width="0.8"/>
      <line x1="80" y1="140" x2="80" y2="176" stroke="#78716c" stroke-width="0.8"/>
      <line x1="120" y1="140" x2="120" y2="176" stroke="#78716c" stroke-width="0.8"/>
      <line x1="160" y1="140" x2="160" y2="176" stroke="#78716c" stroke-width="0.8"/>
      <line x1="200" y1="140" x2="200" y2="176" stroke="#78716c" stroke-width="0.8"/>
      <line x1="240" y1="140" x2="240" y2="176" stroke="#78716c" stroke-width="0.8"/>
      <line x1="280" y1="140" x2="280" y2="176" stroke="#78716c" stroke-width="0.8"/>
      <line x1="0" y1="158" x2="320" y2="158" stroke="#78716c" stroke-width="0.8"/>
      <line x1="0" y1="0" x2="0" y2="176" stroke="#1c1917" stroke-width="3"/>
      <line x1="60" y1="0" x2="60" y2="140" stroke="#1c1917" stroke-width="2"/>
      <line x1="320" y1="0" x2="320" y2="176" stroke="#1c1917" stroke-width="3"/>
      <line x1="260" y1="0" x2="260" y2="140" stroke="#1c1917" stroke-width="2"/>
      <line x1="0" y1="0" x2="60" y2="0" stroke="#1c1917" stroke-width="2"/>
      <line x1="260" y1="0" x2="320" y2="0" stroke="#1c1917" stroke-width="2"/>
      <path d="M60 0 Q160 -6 260 0" stroke="#1c1917" stroke-width="2" fill="none"/>
      <rect x="2" y="10" width="54" height="20" stroke="#78716c" stroke-width="0.8" fill="none"/>
      <rect x="2" y="32" width="54" height="20" stroke="#78716c" stroke-width="0.8" fill="none"/>
      <rect x="2" y="54" width="54" height="20" stroke="#78716c" stroke-width="0.8" fill="none"/>
      <rect x="264" y="10" width="54" height="20" stroke="#78716c" stroke-width="0.8" fill="none"/>
      <rect x="264" y="32" width="54" height="20" stroke="#78716c" stroke-width="0.8" fill="none"/>
      <line x1="30" y1="80" x2="30" y2="100" stroke="#1c1917" stroke-width="1.5"/>
      <rect x="24" y="76" width="12" height="8" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <path d="M26 76 Q30 66 34 76" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <line x1="290" y1="80" x2="290" y2="100" stroke="#1c1917" stroke-width="1.5"/>
      <rect x="284" y="76" width="12" height="8" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <path d="M286 76 Q290 66 294 76" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <rect x="125" y="80" width="70" height="60" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M125 80 Q160 70 195 80" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="145" y1="80" x2="145" y2="140" stroke="#78716c" stroke-width="1"/>
      <line x1="160" y1="80" x2="160" y2="140" stroke="#78716c" stroke-width="1"/>
      <line x1="175" y1="80" x2="175" y2="140" stroke="#78716c" stroke-width="1"/>
      <line x1="125" y1="110" x2="195" y2="110" stroke="#78716c" stroke-width="1"/>
    </svg>`,
  },
  {
    id: "tmpl-forest", label: "Forest", category: "templates", stampW: 480, stampH: 256,
    fillCanvas: true,
    svg: `<svg viewBox="0 0 320 176" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="176" fill="#fafaf9"/>
      <line x1="0" y1="100" x2="320" y2="100" stroke="#78716c" stroke-width="0.8"/>
      <line x1="0" y1="140" x2="320" y2="140" stroke="#1c1917" stroke-width="2"/>
      <path d="M0 140 Q40 136 80 140 Q120 144 160 140 Q200 136 240 140 Q280 144 320 140" stroke="#78716c" stroke-width="0.8" fill="none"/>
      <path d="M130 176 Q160 160 160 140" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M190 176 Q160 160 160 140" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="60" y1="100" x2="60" y2="130" stroke="#78716c" stroke-width="1"/>
      <path d="M40 115 Q60 90 80 115" stroke="#78716c" stroke-width="1" fill="none"/>
      <path d="M45 108 Q60 96 75 108" stroke="#78716c" stroke-width="1" fill="none"/>
      <line x1="250" y1="100" x2="250" y2="130" stroke="#78716c" stroke-width="1"/>
      <path d="M230 115 Q250 90 270 115" stroke="#78716c" stroke-width="1" fill="none"/>
      <line x1="30" y1="140" x2="30" y2="40" stroke="#1c1917" stroke-width="2"/>
      <path d="M0 90 Q30 50 60 90" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M4 75 Q30 40 56 75" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M10 60 Q30 30 50 60" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="290" y1="140" x2="290" y2="40" stroke="#1c1917" stroke-width="2"/>
      <path d="M260 90 Q290 50 320 90" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M264 75 Q290 40 316 75" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M270 60 Q290 30 310 60" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="110" y1="140" x2="110" y2="70" stroke="#1c1917" stroke-width="1.5"/>
      <path d="M86 110 Q110 72 134 110" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M92 96 Q110 62 128 96" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <line x1="210" y1="140" x2="210" y2="70" stroke="#1c1917" stroke-width="1.5"/>
      <path d="M186 110 Q210 72 234 110" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <path d="M192 96 Q210 62 228 96" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <path d="M60 140 Q70 128 80 140" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <path d="M230 140 Q240 128 250 140" stroke="#1c1917" stroke-width="1.2" fill="none"/>
    </svg>`,
  },
  {
    id: "tmpl-space", label: "Space Arena", category: "templates", stampW: 480, stampH: 256,
    fillCanvas: true,
    svg: `<svg viewBox="0 0 320 176" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="176" fill="#fafaf9"/>
      <circle cx="20" cy="15" r="1" fill="#1c1917"/>
      <circle cx="50" cy="8" r="1.2" fill="#1c1917"/>
      <circle cx="90" cy="20" r="1" fill="#1c1917"/>
      <circle cx="140" cy="5" r="1.5" fill="#1c1917"/>
      <circle cx="180" cy="18" r="1" fill="#1c1917"/>
      <circle cx="220" cy="10" r="1.2" fill="#1c1917"/>
      <circle cx="270" cy="22" r="1" fill="#1c1917"/>
      <circle cx="300" cy="8" r="1.5" fill="#1c1917"/>
      <circle cx="310" cy="40" r="1" fill="#1c1917"/>
      <circle cx="10" cy="60" r="1.2" fill="#1c1917"/>
      <circle cx="75" cy="45" r="1" fill="#1c1917"/>
      <circle cx="240" cy="35" r="1.2" fill="#1c1917"/>
      <circle cx="160" cy="50" r="1" fill="#1c1917"/>
      <circle cx="55" cy="70" r="1" fill="#1c1917"/>
      <circle cx="285" cy="55" r="1.2" fill="#1c1917"/>
      <circle cx="270" cy="50" r="30" stroke="#78716c" stroke-width="0.8" fill="none"/>
      <path d="M252 36 Q270 30 288 36" stroke="#78716c" stroke-width="0.8" fill="none"/>
      <path d="M60 140 L260 140 L280 150 L40 150 Z" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="60" y1="140" x2="40" y2="150" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="260" y1="140" x2="280" y2="150" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="60" y1="140" x2="260" y2="140" stroke="#1c1917" stroke-width="2.5"/>
      <line x1="100" y1="140" x2="90" y2="150" stroke="#78716c" stroke-width="0.8"/>
      <line x1="140" y1="140" x2="130" y2="150" stroke="#78716c" stroke-width="0.8"/>
      <line x1="180" y1="140" x2="170" y2="150" stroke="#78716c" stroke-width="0.8"/>
      <line x1="220" y1="140" x2="210" y2="150" stroke="#78716c" stroke-width="0.8"/>
      <rect x="0" y="110" width="50" height="10" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <rect x="270" y="110" width="50" height="10" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="60" y1="80" x2="60" y2="140" stroke="#1c1917" stroke-width="1.5" stroke-dasharray="4 2"/>
      <line x1="260" y1="80" x2="260" y2="140" stroke="#1c1917" stroke-width="1.5" stroke-dasharray="4 2"/>
      <line x1="60" y1="80" x2="260" y2="80" stroke="#1c1917" stroke-width="1" stroke-dasharray="6 3"/>
    </svg>`,
  },
  {
    id: "tmpl-city", label: "City Street", category: "templates", stampW: 480, stampH: 256,
    fillCanvas: true,
    svg: `<svg viewBox="0 0 320 176" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="176" fill="#fafaf9"/>
      <rect x="100" y="120" width="120" height="56" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <line x1="100" y1="120" x2="100" y2="176" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="220" y1="120" x2="220" y2="176" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="160" y1="124" x2="160" y2="134" stroke="#78716c" stroke-width="1"/>
      <line x1="160" y1="142" x2="160" y2="152" stroke="#78716c" stroke-width="1"/>
      <line x1="160" y1="160" x2="160" y2="170" stroke="#78716c" stroke-width="1"/>
      <line x1="0" y1="120" x2="100" y2="120" stroke="#1c1917" stroke-width="1.5"/>
      <line x1="220" y1="120" x2="320" y2="120" stroke="#1c1917" stroke-width="1.5"/>
      <rect x="0" y="20" width="60" height="100" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <rect x="8" y="30" width="16" height="12" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="36" y="30" width="16" height="12" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="8" y="52" width="16" height="12" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="36" y="52" width="16" height="12" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="8" y="74" width="16" height="12" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="36" y="74" width="16" height="12" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="20" y="95" width="20" height="25" stroke="#1c1917" stroke-width="1.2" fill="none"/>
      <rect x="64" y="0" width="50" height="120" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <rect x="72" y="10" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="100" y="10" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="72" y="30" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="100" y="30" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="72" y="50" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="100" y="50" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="72" y="70" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="100" y="70" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="206" y="10" width="58" height="110" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <rect x="214" y="20" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="240" y="20" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="214" y="40" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="240" y="40" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="214" y="60" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="240" y="60" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="214" y="80" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="240" y="80" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="268" y="30" width="52" height="90" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <rect x="276" y="40" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="298" y="40" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="276" y="60" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <rect x="298" y="60" width="14" height="10" stroke="#78716c" stroke-width="1" fill="none"/>
      <line x1="85" y1="80" x2="85" y2="120" stroke="#1c1917" stroke-width="1.5"/>
      <path d="M85 80 Q90 74 95 76" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <circle cx="96" cy="76" r="2" stroke="#1c1917" stroke-width="1" fill="none"/>
      <line x1="235" y1="80" x2="235" y2="120" stroke="#1c1917" stroke-width="1.5"/>
      <path d="M235 80 Q230 74 225 76" stroke="#1c1917" stroke-width="1.5" fill="none"/>
      <circle cx="224" cy="76" r="2" stroke="#1c1917" stroke-width="1" fill="none"/>
    </svg>`,
  },
];

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: "icons", label: "Game Icons", icon: "⚔" },
  { id: "characters", label: "Characters", icon: "🧍" },
  { id: "vr", label: "VR / AR", icon: "◈" },
  { id: "templates", label: "Templates", icon: "🎬" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ElementLibrary() {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("icons");

  const filtered = ELEMENTS.filter((el) => el.category === activeCategory);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, el: LibraryElement) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/x-sb-svg", el.svg);
    e.dataTransfer.setData("application/x-sb-w", String(el.stampW));
    e.dataTransfer.setData("application/x-sb-h", String(el.stampH));
    e.dataTransfer.setData("application/x-sb-fill", el.fillCanvas ? "1" : "0");
  };

  return (
    <div className={`flex-shrink-0 flex flex-col transition-all duration-200 ${open ? "w-48" : "w-8"}`}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? "Close element library" : "Open element library"}
        className="flex items-center justify-center w-8 h-8 rounded bg-stone-200 hover:bg-stone-300
          text-stone-600 text-sm font-mono transition-colors self-start mb-2 flex-shrink-0"
      >
        {open ? "◂" : "▸"}
      </button>

      {open && (
        <div className="flex flex-col gap-2 h-full">
          {/* Header */}
          <div className="px-1">
            <p className="text-[9px] font-mono text-stone-500 uppercase tracking-widest leading-tight">
              Element Library
            </p>
            <p className="text-[8px] text-stone-400 font-mono mt-0.5">
              Drag onto a sketch canvas
            </p>
          </div>

          {/* Category tabs */}
          <div className="flex flex-col gap-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono
                  text-left transition-colors ${
                  activeCategory === cat.id
                    ? "bg-stone-800 text-white"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="w-full h-px bg-stone-200" />

          {/* Element grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1.5 pb-4">
              {filtered.map((el) => (
                <div
                  key={el.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, el)}
                  title={`Drag "${el.label}" onto a sketch canvas`}
                  className="flex flex-col items-center gap-1 p-1.5 rounded border border-stone-200
                    bg-white hover:border-emerald-400 hover:bg-emerald-50 cursor-grab active:cursor-grabbing
                    transition-colors select-none"
                >
                  {/* SVG preview */}
                  <div
                    className="w-10 h-10 flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: el.svg }}
                    style={{ pointerEvents: "none" }}
                  />
                  <span className="text-[8px] font-mono text-stone-500 text-center leading-tight">
                    {el.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
