import { useCallback, useEffect, useRef, useState } from "react";
import { SavedComponent } from "../../types";
import { useAppStore } from "../../store/app-store";

// ─── Types ─────────────────────────────────────────────────────────────────

interface LibraryItem {
  id: string;
  name: string;
  category: string;
  html: string;
  previewScale?: number;
  previewHeight?: number;
}

interface IconItem {
  id: string;
  name: string;
  svg: string;
}

interface Props {
  onClose: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  getCurrentCode?: () => string;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

// ─── Element library data ───────────────────────────────────────────────────

const ELEMENTS: LibraryItem[] = [
  // ── Text ──
  {
    id: "text-heading1", name: "Heading 1", category: "Text",
    html: `<h1 style="font-size:32px;font-weight:800;color:#111827;margin:0;line-height:1.2;font-family:system-ui,sans-serif">Main Heading</h1>`,
    previewHeight: 44,
  },
  {
    id: "text-heading2", name: "Heading 2", category: "Text",
    html: `<h2 style="font-size:24px;font-weight:700;color:#111827;margin:0;line-height:1.3;font-family:system-ui,sans-serif">Sub Heading</h2>`,
    previewHeight: 36,
  },
  {
    id: "text-heading3", name: "Heading 3", category: "Text",
    html: `<h3 style="font-size:18px;font-weight:600;color:#111827;margin:0;line-height:1.4;font-family:system-ui,sans-serif">Section Title</h3>`,
    previewHeight: 30,
  },
  {
    id: "text-paragraph", name: "Paragraph", category: "Text",
    html: `<p style="font-size:15px;color:#374151;margin:0;line-height:1.7;font-family:system-ui,sans-serif;max-width:360px">This is a paragraph of body text. Edit the content after inserting into your design.</p>`,
    previewHeight: 52,
  },
  {
    id: "text-label", name: "Label", category: "Text",
    html: `<label style="font-size:13px;font-weight:600;color:#374151;margin:0;font-family:system-ui,sans-serif;display:block">Form Label</label>`,
    previewHeight: 28,
  },
  {
    id: "text-caption", name: "Caption", category: "Text",
    html: `<p style="font-size:12px;color:#6B7280;margin:0;font-style:italic;line-height:1.5;font-family:system-ui,sans-serif">Caption or helper text</p>`,
    previewHeight: 28,
  },
  // ── Shapes ──
  {
    id: "shape-rect", name: "Rectangle", category: "Shape",
    html: `<div style="width:160px;height:100px;background:#6366F1;border-radius:8px"></div>`,
    previewHeight: 50,
  },
  {
    id: "shape-circle", name: "Circle", category: "Shape",
    html: `<div style="width:100px;height:100px;background:#10B981;border-radius:50%"></div>`,
    previewHeight: 56,
  },
  {
    id: "shape-triangle", name: "Triangle", category: "Shape",
    html: `<svg width="100" height="88" xmlns="http://www.w3.org/2000/svg" style="display:block"><polygon points="50,0 100,88 0,88" fill="#A78BFA"/></svg>`,
    previewHeight: 50,
  },
  {
    id: "shape-star", name: "Star", category: "Shape",
    html: `<svg width="80" height="80" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#F59E0B"/></svg>`,
    previewHeight: 50,
  },
  {
    id: "shape-diamond", name: "Diamond", category: "Shape",
    html: `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg" style="display:block"><polygon points="40,0 80,40 40,80 0,40" fill="#F43F5E"/></svg>`,
    previewHeight: 50,
  },
  {
    id: "shape-line", name: "Line", category: "Shape",
    html: `<svg width="160" height="4" xmlns="http://www.w3.org/2000/svg" style="display:block"><line x1="0" y1="2" x2="160" y2="2" stroke="#64748B" stroke-width="2"/></svg>`,
    previewHeight: 20,
  },
  {
    id: "shape-arrow", name: "Arrow", category: "Shape",
    html: `<svg width="160" height="24" xmlns="http://www.w3.org/2000/svg" style="display:block"><line x1="0" y1="12" x2="136" y2="12" stroke="#F59E0B" stroke-width="2.5"/><polygon points="136,4 160,12 136,20" fill="#F59E0B"/></svg>`,
    previewHeight: 30,
  },
  // ── Layout ──
  {
    id: "shape-frame", name: "Frame / Container", category: "Layout",
    html: `<div style="width:320px;height:200px;border:2px dashed #94A3B8;border-radius:12px;background:rgba(148,163,184,0.04);display:flex;align-items:center;justify-content:center"><span style="color:#94A3B8;font-size:13px;font-family:system-ui,sans-serif">Frame</span></div>`,
    previewHeight: 70,
  },
  {
    id: "shape-divider", name: "Divider", category: "Layout",
    html: `<hr style="border:none;border-top:1.5px solid #E5E7EB;margin:0;width:240px" />`,
    previewHeight: 20,
  },
  {
    id: "shape-spacer", name: "Spacer", category: "Layout",
    html: `<div style="width:240px;height:32px;border:1px dashed #CBD5E1;border-radius:4px;background:repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(148,163,184,0.1) 4px,rgba(148,163,184,0.1) 8px)"></div>`,
    previewHeight: 36,
  },
  // ── Buttons ──
  {
    id: "btn-primary", name: "Primary Button", category: "Button",
    html: `<button style="background:#6366F1;color:white;padding:10px 24px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif">Get Started</button>`,
    previewHeight: 52,
  },
  {
    id: "btn-secondary", name: "Secondary Button", category: "Button",
    html: `<button style="background:white;color:#6366F1;padding:10px 24px;border:2px solid #6366F1;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif">Learn More</button>`,
    previewHeight: 52,
  },
  {
    id: "btn-danger", name: "Danger Button", category: "Button",
    html: `<button style="background:#EF4444;color:white;padding:10px 24px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif">Delete</button>`,
    previewHeight: 52,
  },
  // ── Inputs ──
  {
    id: "input-text", name: "Text Input", category: "Input",
    html: `<input type="text" placeholder="Enter text…" style="border:1.5px solid #D1D5DB;border-radius:8px;padding:10px 14px;font-size:14px;outline:none;width:220px;background:white;color:#111827;font-family:system-ui,sans-serif;box-sizing:border-box" />`,
    previewHeight: 52,
  },
  {
    id: "input-search", name: "Search Input", category: "Input",
    html: `<div style="position:relative;display:inline-block"><svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:#9CA3AF" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg><input type="text" placeholder="Search…" style="border:1.5px solid #D1D5DB;border-radius:8px;padding:10px 14px 10px 36px;font-size:14px;outline:none;width:240px;background:white;color:#111827;font-family:system-ui,sans-serif;box-sizing:border-box" /></div>`,
    previewHeight: 52,
  },
  {
    id: "textarea", name: "Textarea", category: "Input",
    html: `<textarea placeholder="Write your message…" rows="3" style="border:1.5px solid #D1D5DB;border-radius:8px;padding:10px 14px;font-size:14px;outline:none;width:240px;background:white;color:#111827;font-family:system-ui,sans-serif;box-sizing:border-box;resize:vertical"></textarea>`,
    previewHeight: 80,
  },
  // ── Display ──
  {
    id: "badge", name: "Badge", category: "Display",
    html: `<span style="background:#EEF2FF;color:#6366F1;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;font-family:system-ui,sans-serif">New Feature</span>`,
    previewHeight: 40,
  },
  {
    id: "alert", name: "Alert Banner", category: "Display",
    html: `<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;font-family:system-ui,sans-serif;width:280px;box-sizing:border-box"><svg style="width:18px;height:18px;color:#3B82F6;flex-shrink:0;margin-top:1px" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg><div><p style="margin:0;font-size:13px;font-weight:600;color:#1D4ED8">Info</p><p style="margin:4px 0 0;font-size:12px;color:#1E40AF;line-height:1.4">This is an informational message.</p></div></div>`,
    previewHeight: 80,
  },
  {
    id: "avatar", name: "Avatar", category: "Display",
    html: `<div style="display:flex;align-items:center;gap:12px;font-family:system-ui,sans-serif"><div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:700;flex-shrink:0">JD</div><div><p style="margin:0;font-size:14px;font-weight:600;color:#111827">Jane Doe</p><p style="margin:2px 0 0;font-size:12px;color:#6B7280">Product Designer</p></div></div>`,
    previewHeight: 60,
  },
  {
    id: "progress", name: "Progress Bar", category: "Display",
    html: `<div style="font-family:system-ui,sans-serif;width:240px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;color:#374151;font-weight:500">Progress</span><span style="font-size:12px;color:#6366F1;font-weight:600">68%</span></div><div style="height:8px;background:#E5E7EB;border-radius:999px;overflow:hidden"><div style="width:68%;height:100%;background:linear-gradient(90deg,#6366F1,#8B5CF6);border-radius:999px"></div></div></div>`,
    previewHeight: 48,
  },
  {
    id: "toggle", name: "Toggle Switch", category: "Input",
    html: `<label style="display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-family:system-ui,sans-serif"><div style="width:44px;height:24px;background:#6366F1;border-radius:999px;position:relative;transition:background .2s"><div style="width:18px;height:18px;background:white;border-radius:50%;position:absolute;top:3px;left:23px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div></div><span style="font-size:14px;color:#374151;font-weight:500">Enabled</span></label>`,
    previewHeight: 44,
  },
  {
    id: "checkbox", name: "Checkbox", category: "Input",
    html: `<label style="display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-family:system-ui,sans-serif"><div style="width:18px;height:18px;background:#6366F1;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg style="width:11px;height:11px" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></div><span style="font-size:14px;color:#374151">Accept terms</span></label>`,
    previewHeight: 40,
  },
  // ── Cards ──
  {
    id: "card-basic", name: "Card", category: "Card",
    html: `<div style="background:white;border:1px solid #E5E7EB;border-radius:14px;padding:24px;width:260px;box-shadow:0 1px 4px rgba(0,0,0,.06);font-family:system-ui,sans-serif"><h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#111827">Card Title</h3><p style="margin:0 0 18px;font-size:13px;color:#6B7280;line-height:1.6">Supporting text that describes the card content in more detail.</p><button style="background:#6366F1;color:white;padding:8px 18px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Action</button></div>`,
    previewScale: 0.75, previewHeight: 160,
  },
  {
    id: "stat-card", name: "Stat Card", category: "Card",
    html: `<div style="background:white;border:1px solid #E5E7EB;border-radius:14px;padding:24px;width:200px;box-shadow:0 1px 4px rgba(0,0,0,.06);font-family:system-ui,sans-serif"><p style="margin:0 0 4px;font-size:12px;font-weight:500;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">Total Revenue</p><p style="margin:0 0 8px;font-size:28px;font-weight:800;color:#111827">$48,295</p><p style="margin:0;font-size:12px;color:#10B981;font-weight:600">↑ 12.5% from last month</p></div>`,
    previewScale: 0.8, previewHeight: 110,
  },
  // ── Layout ──
  {
    id: "two-cols", name: "Two Columns", category: "Layout",
    html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;width:320px;font-family:system-ui,sans-serif"><div style="background:#F3F4F6;border-radius:10px;padding:20px;min-height:80px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:13px">Column 1</div><div style="background:#F3F4F6;border-radius:10px;padding:20px;min-height:80px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:13px">Column 2</div></div>`,
    previewScale: 0.75, previewHeight: 90,
  },
  {
    id: "three-cols", name: "Three Columns", category: "Layout",
    html: `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;width:360px;font-family:system-ui,sans-serif"><div style="background:#F3F4F6;border-radius:10px;padding:16px;min-height:70px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px">Col 1</div><div style="background:#F3F4F6;border-radius:10px;padding:16px;min-height:70px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px">Col 2</div><div style="background:#F3F4F6;border-radius:10px;padding:16px;min-height:70px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px">Col 3</div></div>`,
    previewScale: 0.7, previewHeight: 80,
  },
  {
    id: "image-placeholder", name: "Image", category: "Media",
    html: `<div style="width:280px;height:160px;background:linear-gradient(135deg,#E5E7EB 0%,#D1D5DB 100%);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#9CA3AF"><svg style="width:32px;height:32px;margin-bottom:8px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span style="font-size:13px;font-weight:500">Image Placeholder</span></div>`,
    previewScale: 0.7, previewHeight: 120,
  },
  {
    id: "divider", name: "Divider", category: "Layout",
    html: `<div style="display:flex;align-items:center;gap:12px;width:280px;font-family:system-ui,sans-serif"><div style="flex:1;height:1px;background:#E5E7EB"></div><span style="font-size:12px;color:#9CA3AF;white-space:nowrap;font-weight:500">or</span><div style="flex:1;height:1px;background:#E5E7EB"></div></div>`,
    previewHeight: 36,
  },
  {
    id: "table", name: "Data Table", category: "Data",
    html: `<table style="width:340px;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px"><thead><tr style="background:#F9FAFB;border-bottom:1px solid #E5E7EB"><th style="padding:10px 14px;text-align:left;color:#374151;font-weight:600">Name</th><th style="padding:10px 14px;text-align:left;color:#374151;font-weight:600">Status</th><th style="padding:10px 14px;text-align:left;color:#374151;font-weight:600">Amount</th></tr></thead><tbody><tr style="border-bottom:1px solid #F3F4F6"><td style="padding:10px 14px;color:#111827">Alice Chen</td><td style="padding:10px 14px"><span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">Active</span></td><td style="padding:10px 14px;color:#111827;font-weight:600">$2,400</td></tr><tr style="border-bottom:1px solid #F3F4F6"><td style="padding:10px 14px;color:#111827">Bob Smith</td><td style="padding:10px 14px"><span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">Pending</span></td><td style="padding:10px 14px;color:#111827;font-weight:600">$1,800</td></tr><tr><td style="padding:10px 14px;color:#111827">Carol Lee</td><td style="padding:10px 14px"><span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">Active</span></td><td style="padding:10px 14px;color:#111827;font-weight:600">$3,150</td></tr></tbody></table>`,
    previewScale: 0.6, previewHeight: 120,
  },
];

const BLOCKS: LibraryItem[] = [
  {
    id: "block-navbar", name: "Navbar", category: "Navigation",
    html: `<nav style="background:white;border-bottom:1px solid #E5E7EB;padding:0 32px;display:flex;align-items:center;justify-content:space-between;height:64px;font-family:system-ui,sans-serif;width:100%;box-sizing:border-box"><div style="font-size:20px;font-weight:800;color:#111827">Brand</div><div style="display:flex;gap:32px"><a href="#" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500">Home</a><a href="#" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500">Features</a><a href="#" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500">Pricing</a></div><button style="background:#6366F1;color:white;padding:9px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Sign Up</button></nav>`,
    previewScale: 0.45, previewHeight: 52,
  },
  {
    id: "block-hero", name: "Hero Section", category: "Header",
    html: `<section style="background:linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%);padding:80px 40px;text-align:center;font-family:system-ui,sans-serif;color:white;box-sizing:border-box"><p style="margin:0 0 16px;font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;opacity:.8">Introducing v2.0</p><h1 style="margin:0 0 20px;font-size:52px;font-weight:800;line-height:1.1">Build faster than<br/>ever before</h1><p style="margin:0 0 36px;font-size:18px;opacity:.85;max-width:520px;margin-left:auto;margin-right:auto;line-height:1.6">The all-in-one platform that helps your team ship products at lightning speed.</p><div style="display:flex;gap:16px;justify-content:center"><button style="background:white;color:#6366F1;padding:14px 32px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">Get Started Free</button><button style="background:rgba(255,255,255,.15);color:white;padding:14px 32px;border:2px solid rgba(255,255,255,.4);border-radius:10px;font-size:15px;font-weight:600;cursor:pointer">Watch Demo</button></div></section>`,
    previewScale: 0.28, previewHeight: 120,
  },
  {
    id: "block-features", name: "Features Grid", category: "Content",
    html: `<section style="padding:60px 40px;background:#F9FAFB;font-family:system-ui,sans-serif;box-sizing:border-box"><div style="text-align:center;margin-bottom:48px"><h2 style="margin:0 0 12px;font-size:36px;font-weight:800;color:#111827">Everything you need</h2><p style="margin:0;font-size:16px;color:#6B7280;max-width:480px;margin-left:auto;margin-right:auto">A complete toolkit for building modern products your users will love.</p></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:900px;margin:0 auto"><div style="background:white;border-radius:14px;padding:28px;border:1px solid #E5E7EB"><div style="width:44px;height:44px;background:#EEF2FF;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg style="width:22px;height:22px;color:#6366F1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/></svg></div><h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111827">Fast Performance</h3><p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6">Blazing-fast load times with our optimized delivery network.</p></div><div style="background:white;border-radius:14px;padding:28px;border:1px solid #E5E7EB"><div style="width:44px;height:44px;background:#F0FDF4;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg style="width:22px;height:22px;color:#10B981" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg></div><h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111827">Secure by Default</h3><p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6">Enterprise-grade security built into every layer of the stack.</p></div><div style="background:white;border-radius:14px;padding:28px;border:1px solid #E5E7EB"><div style="width:44px;height:44px;background:#FFF7ED;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg style="width:22px;height:22px;color:#F97316" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg></div><h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111827">Developer First</h3><p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6">Clean APIs and SDKs that make integration effortless.</p></div></div></section>`,
    previewScale: 0.22, previewHeight: 130,
  },
  {
    id: "block-pricing", name: "Pricing Cards", category: "Content",
    html: `<section style="padding:60px 40px;background:white;font-family:system-ui,sans-serif;box-sizing:border-box"><div style="text-align:center;margin-bottom:48px"><h2 style="margin:0 0 12px;font-size:36px;font-weight:800;color:#111827">Simple pricing</h2><p style="margin:0;font-size:16px;color:#6B7280">No surprises. Cancel any time.</p></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:900px;margin:0 auto"><div style="border:1px solid #E5E7EB;border-radius:16px;padding:32px"><p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">Starter</p><p style="margin:0 0 4px;font-size:40px;font-weight:800;color:#111827">$9<span style="font-size:16px;font-weight:500;color:#6B7280">/mo</span></p><p style="margin:0 0 24px;font-size:13px;color:#6B7280">Perfect for solo projects</p><button style="width:100%;background:#F3F4F6;color:#374151;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:24px">Get Started</button><ul style="list-style:none;margin:0;padding:0;font-size:13px;color:#6B7280;display:flex;flex-direction:column;gap:10px"><li>✓ 5 projects</li><li>✓ 10 GB storage</li><li>✓ Email support</li></ul></div><div style="border:2px solid #6366F1;border-radius:16px;padding:32px;background:#F5F3FF;position:relative"><span style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#6366F1;color:white;padding:4px 16px;border-radius:999px;font-size:11px;font-weight:700">POPULAR</span><p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#6366F1;text-transform:uppercase;letter-spacing:.05em">Pro</p><p style="margin:0 0 4px;font-size:40px;font-weight:800;color:#111827">$29<span style="font-size:16px;font-weight:500;color:#6B7280">/mo</span></p><p style="margin:0 0 24px;font-size:13px;color:#6B7280">For growing teams</p><button style="width:100%;background:#6366F1;color:white;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:24px">Get Started</button><ul style="list-style:none;margin:0;padding:0;font-size:13px;color:#6B7280;display:flex;flex-direction:column;gap:10px"><li>✓ Unlimited projects</li><li>✓ 100 GB storage</li><li>✓ Priority support</li></ul></div><div style="border:1px solid #E5E7EB;border-radius:16px;padding:32px"><p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em">Enterprise</p><p style="margin:0 0 4px;font-size:40px;font-weight:800;color:#111827">$99<span style="font-size:16px;font-weight:500;color:#6B7280">/mo</span></p><p style="margin:0 0 24px;font-size:13px;color:#6B7280">For large organizations</p><button style="width:100%;background:#F3F4F6;color:#374151;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:24px">Contact Sales</button><ul style="list-style:none;margin:0;padding:0;font-size:13px;color:#6B7280;display:flex;flex-direction:column;gap:10px"><li>✓ Unlimited everything</li><li>✓ 1 TB storage</li><li>✓ Dedicated support</li></ul></div></div></section>`,
    previewScale: 0.18, previewHeight: 140,
  },
  {
    id: "block-testimonials", name: "Testimonials", category: "Content",
    html: `<section style="padding:60px 40px;background:#F9FAFB;font-family:system-ui,sans-serif;box-sizing:border-box"><div style="text-align:center;margin-bottom:48px"><h2 style="margin:0 0 12px;font-size:36px;font-weight:800;color:#111827">Loved by teams</h2><p style="margin:0;font-size:16px;color:#6B7280">See what our customers have to say</p></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:800px;margin:0 auto"><div style="background:white;border-radius:16px;padding:28px;border:1px solid #E5E7EB"><div style="color:#FBBF24;font-size:18px;margin-bottom:14px">★★★★★</div><p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;font-style:italic">"This tool completely transformed how our team works. We ship 3x faster now."</p><div style="display:flex;align-items:center;gap:10px"><div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700">SL</div><div><p style="margin:0;font-size:13px;font-weight:700;color:#111827">Sarah L.</p><p style="margin:0;font-size:11px;color:#9CA3AF">CTO at Acme Corp</p></div></div></div><div style="background:white;border-radius:16px;padding:28px;border:1px solid #E5E7EB"><div style="color:#FBBF24;font-size:18px;margin-bottom:14px">★★★★★</div><p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;font-style:italic">"The best investment we've made this year. Our productivity skyrocketed."</p><div style="display:flex;align-items:center;gap:10px"><div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#10B981,#059669);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700">MK</div><div><p style="margin:0;font-size:13px;font-weight:700;color:#111827">Mark K.</p><p style="margin:0;font-size:11px;color:#9CA3AF">CEO at Buildfast</p></div></div></div></div></section>`,
    previewScale: 0.25, previewHeight: 130,
  },
  {
    id: "block-cta", name: "CTA Section", category: "Content",
    html: `<section style="background:linear-gradient(135deg,#1F2937 0%,#111827 100%);padding:72px 40px;text-align:center;font-family:system-ui,sans-serif;box-sizing:border-box"><h2 style="margin:0 0 16px;font-size:40px;font-weight:800;color:white;line-height:1.2">Ready to get started?</h2><p style="margin:0 0 36px;font-size:17px;color:#9CA3AF;max-width:440px;margin-left:auto;margin-right:auto;line-height:1.6">Join thousands of teams already building with us. No credit card required.</p><div style="display:flex;gap:14px;justify-content:center"><button style="background:#6366F1;color:white;padding:14px 32px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">Start Free Trial</button><button style="background:transparent;color:white;padding:14px 32px;border:2px solid rgba(255,255,255,.2);border-radius:10px;font-size:15px;font-weight:600;cursor:pointer">Learn More</button></div></section>`,
    previewScale: 0.3, previewHeight: 110,
  },
  {
    id: "block-stats", name: "Stats Bar", category: "Content",
    html: `<section style="padding:48px 40px;background:white;font-family:system-ui,sans-serif;box-sizing:border-box"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:32px;max-width:900px;margin:0 auto;text-align:center"><div><p style="margin:0 0 4px;font-size:40px;font-weight:800;color:#111827">10K+</p><p style="margin:0;font-size:14px;color:#6B7280;font-weight:500">Happy Customers</p></div><div><p style="margin:0 0 4px;font-size:40px;font-weight:800;color:#6366F1">99.9%</p><p style="margin:0;font-size:14px;color:#6B7280;font-weight:500">Uptime SLA</p></div><div><p style="margin:0 0 4px;font-size:40px;font-weight:800;color:#111827">3.2M</p><p style="margin:0;font-size:14px;color:#6B7280;font-weight:500">API Requests/day</p></div><div><p style="margin:0 0 4px;font-size:40px;font-weight:800;color:#10B981">48h</p><p style="margin:0;font-size:14px;color:#6B7280;font-weight:500">Avg. Setup Time</p></div></div></section>`,
    previewScale: 0.28, previewHeight: 80,
  },
  {
    id: "block-faq", name: "FAQ Section", category: "Content",
    html: `<section style="padding:60px 40px;background:#F9FAFB;font-family:system-ui,sans-serif;box-sizing:border-box"><div style="max-width:640px;margin:0 auto"><h2 style="margin:0 0 40px;font-size:36px;font-weight:800;color:#111827;text-align:center">Frequently asked questions</h2><div style="display:flex;flex-direction:column;gap:4px"><div style="background:white;border-radius:10px;padding:20px 24px;border:1px solid #E5E7EB"><div style="display:flex;justify-content:space-between;align-items:center"><p style="margin:0;font-size:15px;font-weight:600;color:#111827">How does billing work?</p><span style="color:#6366F1;font-size:18px">+</span></div></div><div style="background:white;border-radius:10px;padding:20px 24px;border:1px solid #E5E7EB"><div style="display:flex;justify-content:space-between;align-items:center"><p style="margin:0;font-size:15px;font-weight:600;color:#111827">Can I cancel at any time?</p><span style="color:#6366F1;font-size:18px">+</span></div></div><div style="background:white;border-radius:10px;padding:20px 24px;border:1px solid #6366F1"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><p style="margin:0;font-size:15px;font-weight:600;color:#6366F1">Do you offer a free trial?</p><span style="color:#6366F1;font-size:18px">−</span></div><p style="margin:0;font-size:14px;color:#6B7280;line-height:1.6">Yes! We offer a 14-day free trial with full access to all features. No credit card required to get started.</p></div><div style="background:white;border-radius:10px;padding:20px 24px;border:1px solid #E5E7EB"><div style="display:flex;justify-content:space-between;align-items:center"><p style="margin:0;font-size:15px;font-weight:600;color:#111827">What kind of support do you provide?</p><span style="color:#6366F1;font-size:18px">+</span></div></div></div></div></section>`,
    previewScale: 0.22, previewHeight: 140,
  },
  {
    id: "block-footer", name: "Footer", category: "Footer",
    html: `<footer style="background:#111827;padding:60px 40px 32px;font-family:system-ui,sans-serif;box-sizing:border-box"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:48px"><div><div style="font-size:20px;font-weight:800;color:white;margin-bottom:16px">Brand</div><p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.7;max-width:220px">Building the future of digital products, one component at a time.</p></div><div><h4 style="margin:0 0 16px;font-size:13px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:.08em">Product</h4><div style="display:flex;flex-direction:column;gap:10px"><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">Features</a><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">Pricing</a><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">Changelog</a></div></div><div><h4 style="margin:0 0 16px;font-size:13px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:.08em">Company</h4><div style="display:flex;flex-direction:column;gap:10px"><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">About</a><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">Blog</a><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">Careers</a></div></div><div><h4 style="margin:0 0 16px;font-size:13px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:.08em">Legal</h4><div style="display:flex;flex-direction:column;gap:10px"><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">Privacy</a><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">Terms</a><a href="#" style="color:#9CA3AF;text-decoration:none;font-size:13px">Cookies</a></div></div></div><div style="border-top:1px solid #1F2937;padding-top:24px;display:flex;justify-content:space-between;align-items:center"><p style="margin:0;font-size:12px;color:#6B7280">© 2024 Brand Inc. All rights reserved.</p></div></footer>`,
    previewScale: 0.22, previewHeight: 120,
  },
  {
    id: "block-login", name: "Login Form", category: "Form",
    html: `<div style="display:flex;justify-content:center;padding:40px;background:#F9FAFB;font-family:system-ui,sans-serif;box-sizing:border-box"><div style="background:white;border-radius:16px;padding:36px;width:380px;border:1px solid #E5E7EB;box-shadow:0 4px 20px rgba(0,0,0,.06)"><h2 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#111827">Welcome back</h2><p style="margin:0 0 28px;font-size:14px;color:#6B7280">Sign in to your account to continue</p><div style="margin-bottom:16px"><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Email address</label><input type="email" placeholder="you@company.com" style="width:100%;border:1.5px solid #D1D5DB;border-radius:8px;padding:10px 14px;font-size:14px;color:#111827;box-sizing:border-box;outline:none" /></div><div style="margin-bottom:24px"><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Password</label><input type="password" placeholder="••••••••" style="width:100%;border:1.5px solid #D1D5DB;border-radius:8px;padding:10px 14px;font-size:14px;color:#111827;box-sizing:border-box;outline:none" /></div><button style="width:100%;background:#6366F1;color:white;padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:16px">Sign In</button><p style="text-align:center;margin:0;font-size:13px;color:#6B7280">Don't have an account? <a href="#" style="color:#6366F1;font-weight:600;text-decoration:none">Sign up</a></p></div></div>`,
    previewScale: 0.32, previewHeight: 160,
  },
  {
    id: "block-newsletter", name: "Newsletter Section", category: "Content",
    html: `<section style="padding:64px 40px;background:linear-gradient(135deg,#EEF2FF 0%,#F5F3FF 100%);text-align:center;font-family:system-ui,sans-serif;box-sizing:border-box"><h2 style="margin:0 0 12px;font-size:34px;font-weight:800;color:#111827">Stay in the loop</h2><p style="margin:0 0 32px;font-size:16px;color:#6B7280;max-width:440px;margin-left:auto;margin-right:auto">Get the latest updates, articles, and resources delivered to your inbox weekly.</p><div style="display:flex;gap:12px;justify-content:center;max-width:440px;margin:0 auto"><input type="email" placeholder="Enter your email" style="flex:1;border:1.5px solid #D1D5DB;border-radius:8px;padding:11px 14px;font-size:14px;outline:none;background:white;box-sizing:border-box" /><button style="background:#6366F1;color:white;padding:11px 24px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap">Subscribe</button></div><p style="margin:16px 0 0;font-size:12px;color:#9CA3AF">No spam, ever. Unsubscribe at any time.</p></section>`,
    previewScale: 0.28, previewHeight: 100,
  },
  {
    id: "block-team", name: "Team Section", category: "Content",
    html: `<section style="padding:60px 40px;background:white;font-family:system-ui,sans-serif;box-sizing:border-box"><div style="text-align:center;margin-bottom:48px"><h2 style="margin:0 0 12px;font-size:36px;font-weight:800;color:#111827">Meet the team</h2><p style="margin:0;font-size:16px;color:#6B7280">The people behind the product</p></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px;max-width:900px;margin:0 auto"><div style="text-align:center"><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:800;margin:0 auto 14px">AJ</div><h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111827">Alex Johnson</h3><p style="margin:0;font-size:12px;color:#6B7280">CEO &amp; Founder</p></div><div style="text-align:center"><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#10B981,#059669);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:800;margin:0 auto 14px">MC</div><h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111827">Maria Chen</h3><p style="margin:0;font-size:12px;color:#6B7280">Head of Design</p></div><div style="text-align:center"><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#F97316,#EF4444);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:800;margin:0 auto 14px">DK</div><h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111827">David Kim</h3><p style="margin:0;font-size:12px;color:#6B7280">Lead Engineer</p></div><div style="text-align:center"><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#FBBF24,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:800;margin:0 auto 14px">SN</div><h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111827">Sophie N.</h3><p style="margin:0;font-size:12px;color:#6B7280">Product Manager</p></div></div></section>`,
    previewScale: 0.22, previewHeight: 120,
  },
];

// ─── Icon data ──────────────────────────────────────────────────────────────

const ICONS: IconItem[] = [
  { id: "ic-home", name: "Home", svg: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { id: "ic-search", name: "Search", svg: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
  { id: "ic-user", name: "User", svg: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  { id: "ic-settings", name: "Settings", svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>' },
  { id: "ic-bell", name: "Bell", svg: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>' },
  { id: "ic-heart", name: "Heart", svg: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>' },
  { id: "ic-star", name: "Star", svg: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  { id: "ic-mail", name: "Mail", svg: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>' },
  { id: "ic-lock", name: "Lock", svg: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>' },
  { id: "ic-eye", name: "Eye", svg: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
  { id: "ic-eye-off", name: "Eye Off", svg: '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>' },
  { id: "ic-edit", name: "Edit", svg: '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>' },
  { id: "ic-trash", name: "Trash", svg: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>' },
  { id: "ic-download", name: "Download", svg: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
  { id: "ic-upload", name: "Upload", svg: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>' },
  { id: "ic-plus", name: "Plus", svg: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' },
  { id: "ic-minus", name: "Minus", svg: '<line x1="5" y1="12" x2="19" y2="12"/>' },
  { id: "ic-x", name: "Close (X)", svg: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' },
  { id: "ic-check", name: "Check", svg: '<polyline points="20 6 9 17 4 12"/>' },
  { id: "ic-chevron-down", name: "Chevron Down", svg: '<polyline points="6 9 12 15 18 9"/>' },
  { id: "ic-chevron-up", name: "Chevron Up", svg: '<polyline points="18 15 12 9 6 15"/>' },
  { id: "ic-chevron-right", name: "Chevron Right", svg: '<polyline points="9 18 15 12 9 6"/>' },
  { id: "ic-chevron-left", name: "Chevron Left", svg: '<polyline points="15 18 9 12 15 6"/>' },
  { id: "ic-arrow-right", name: "Arrow Right", svg: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>' },
  { id: "ic-arrow-left", name: "Arrow Left", svg: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>' },
  { id: "ic-menu", name: "Menu (Hamburger)", svg: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>' },
  { id: "ic-more-horizontal", name: "More Options", svg: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>' },
  { id: "ic-share", name: "Share", svg: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' },
  { id: "ic-copy", name: "Copy", svg: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>' },
  { id: "ic-link", name: "Link", svg: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>' },
  { id: "ic-external-link", name: "External Link", svg: '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>' },
  { id: "ic-image", name: "Image", svg: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
  { id: "ic-camera", name: "Camera", svg: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>' },
  { id: "ic-video", name: "Video", svg: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>' },
  { id: "ic-music", name: "Music", svg: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  { id: "ic-folder", name: "Folder", svg: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>' },
  { id: "ic-file", name: "File", svg: '<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>' },
  { id: "ic-calendar", name: "Calendar", svg: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  { id: "ic-clock", name: "Clock", svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
  { id: "ic-map-pin", name: "Map Pin", svg: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>' },
  { id: "ic-phone", name: "Phone", svg: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.24 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v2.92z"/>' },
  { id: "ic-globe", name: "Globe", svg: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>' },
  { id: "ic-cloud", name: "Cloud", svg: '<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>' },
  { id: "ic-sun", name: "Sun", svg: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' },
  { id: "ic-moon", name: "Moon", svg: '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>' },
  { id: "ic-code", name: "Code", svg: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
  { id: "ic-database", name: "Database", svg: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>' },
  { id: "ic-server", name: "Server", svg: '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>' },
  { id: "ic-shield", name: "Shield", svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  { id: "ic-info", name: "Info", svg: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' },
  { id: "ic-alert-triangle", name: "Warning", svg: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
  { id: "ic-check-circle", name: "Check Circle", svg: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
  { id: "ic-filter", name: "Filter", svg: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>' },
  { id: "ic-sort", name: "Sort", svg: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' },
  { id: "ic-grid", name: "Grid", svg: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
  { id: "ic-list", name: "List", svg: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' },
  { id: "ic-refresh", name: "Refresh", svg: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>' },
  { id: "ic-send", name: "Send", svg: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' },
  { id: "ic-bookmark", name: "Bookmark", svg: '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>' },
  { id: "ic-tag", name: "Tag", svg: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>' },
  { id: "ic-zap", name: "Zap / Lightning", svg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { id: "ic-trending-up", name: "Trending Up", svg: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
];

// ─── Saved components (localStorage) ───────────────────────────────────────

const STORAGE_KEY = "wireuiframe_component_library";

function loadSaved(): SavedComponent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistSaved(items: SavedComponent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ─── Main component ─────────────────────────────────────────────────────────

type Tab = "elements" | "blocks" | "icons" | "saved" | "templates" | "import";

// ─── Imported assets persistence ────────────────────────────────────────────
const IMPORT_STORAGE_KEY = "dsr-imported-assets";

interface ImportedAsset {
  id: string;
  name: string;
  type: "image" | "svg" | "html";
  dataUrl?: string;   // for image / svg
  html?: string;      // for html snippets
  mimeType?: string;
  createdAt: string;
}

function loadImported(): ImportedAsset[] {
  try { return JSON.parse(localStorage.getItem(IMPORT_STORAGE_KEY) || "[]"); } catch { return []; }
}
function persistImported(items: ImportedAsset[]) {
  try { localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(items)); } catch {}
}

export default function ElementLibrary({ onClose, onExpand, isExpanded, getCurrentCode, iframeRef }: Props) {
  const { isInteractiveMode, setInteractiveMode } = useAppStore();
  const [tab, setTab] = useState<Tab>("elements");
  const [search, setSearch] = useState("");
  const [savedComponents, setSavedComponents] = useState<SavedComponent[]>([]);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [saveName, setSaveName] = useState("");
  const dragHtmlRef = useRef<string>("");
  // Imported assets
  const [importedAssets, setImportedAssets] = useState<ImportedAsset[]>([]);
  const [importHtmlSnippet, setImportHtmlSnippet] = useState("");
  const [importHtmlName, setImportHtmlName] = useState("");
  const [importTab, setImportTab] = useState<"media" | "html">("media");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted data on mount
  useEffect(() => {
    setSavedComponents(loadSaved());
    setImportedAssets(loadImported());
  }, []);

  // Listen for save-component events dispatched by the interactive editor toolbar
  useEffect(() => {
    const handleSave = (event: Event) => {
      const detail = (event as CustomEvent).detail as { html?: string; tagName?: string } | undefined;
      if (!detail?.html) { setSavedComponents(loadSaved()); return; }
      const name = window.prompt("Name this component block", detail.tagName || "Saved Block");
      if (!name?.trim()) return;
      const next = [
        { id: `comp_${Date.now()}`, name: name.trim(), html: detail.html, tagName: (detail.tagName || "DIV").toUpperCase(), createdAt: new Date().toISOString() },
        ...loadSaved(),
      ];
      persistSaved(next);
      setSavedComponents(next);
    };
    window.addEventListener("designer:save-component", handleSave);
    return () => window.removeEventListener("designer:save-component", handleSave);
  }, []);

  // ── Insertion helpers ──

  const insertIntoIframe = useCallback(
    (html: string) => {
      const iframe = iframeRef?.current;
      if (!iframe) return;
      if (!isInteractiveMode) setInteractiveMode(true);
      iframe.contentWindow?.postMessage({ type: "DESIGNER_INSERT_COMPONENT", html }, "*");
    },
    [iframeRef, isInteractiveMode, setInteractiveMode]
  );

  const flashInserted = (id: string) => {
    setInsertedId(id);
    window.setTimeout(() => setInsertedId(null), 1200);
  };

  const handleDragStart = (e: React.DragEvent, html: string) => {
    dragHtmlRef.current = html;
    // Store in parent window so the iframe editor can read it on drop
    (window as any).__dsrDragHtml = html;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", "dsr-element");
    if (!isInteractiveMode) setInteractiveMode(true);
  };

  const handleDragEnd = () => {
    // Clear after a brief delay (drop handler reads it first)
    window.setTimeout(() => { (window as any).__dsrDragHtml = null; }, 200);
  };

  // ── Filter helpers ──

  const q = search.toLowerCase();

  const filteredElements = ELEMENTS.filter(
    (it) => !q || it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q)
  );
  const filteredBlocks = BLOCKS.filter(
    (it) => !q || it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q)
  );
  const filteredIcons = ICONS.filter((it) => !q || it.name.toLowerCase().includes(q));
  const filteredSaved = savedComponents.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.tagName.toLowerCase().includes(q)
  );

  function deleteSaved(id: string) {
    const next = savedComponents.filter((c) => c.id !== id);
    setSavedComponents(next);
    persistSaved(next);
  }

  // ── Import handlers ──────────────────────────────────────────────────────

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg");
        const asset: ImportedAsset = {
          id: `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          type: isSvg ? "svg" : "image",
          dataUrl,
          mimeType: file.type || "image/png",
          createdAt: new Date().toISOString(),
        };
        setImportedAssets(prev => {
          const next = [asset, ...prev];
          persistImported(next);
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
    // reset so same file can be re-imported
    e.target.value = "";
  }

  function addImportedHtmlSnippet() {
    const html = importHtmlSnippet.trim();
    const name = importHtmlName.trim() || "Custom Component";
    if (!html) return;
    const asset: ImportedAsset = {
      id: `imp_${Date.now()}`,
      name,
      type: "html",
      html,
      createdAt: new Date().toISOString(),
    };
    setImportedAssets(prev => {
      const next = [asset, ...prev];
      persistImported(next);
      return next;
    });
    setImportHtmlSnippet("");
    setImportHtmlName("");
  }

  function deleteImported(id: string) {
    setImportedAssets(prev => {
      const next = prev.filter(a => a.id !== id);
      persistImported(next);
      return next;
    });
  }

  function insertImported(asset: ImportedAsset) {
    let html = "";
    if (asset.type === "image") {
      html = `<img src="${asset.dataUrl}" alt="${asset.name}" style="max-width:100%;height:auto;display:block" />`;
    } else if (asset.type === "svg") {
      // Embed SVG as an img tag using data URL
      html = `<img src="${asset.dataUrl}" alt="${asset.name}" style="width:48px;height:48px;display:inline-block" />`;
    } else if (asset.type === "html") {
      html = asset.html || "";
    }
    if (html) { insertIntoIframe(html); flashInserted(asset.id); }
  }

  function saveCurrentPage() {
    if (!saveName.trim()) return;
    const html = getCurrentCode?.() ?? "";
    if (!html.trim()) return;
    const comp: SavedComponent = { id: `comp_${Date.now()}`, name: saveName.trim(), html, tagName: "SECTION", createdAt: new Date().toISOString() };
    const next = [comp, ...savedComponents];
    setSavedComponents(next);
    persistSaved(next);
    setSaveName("");
    setIsSavingNew(false);
    setTab("saved");
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  const TAB_ITEMS: { id: Tab; label: string }[] = [
    { id: "elements", label: "Elements" },
    { id: "blocks", label: "Blocks" },
    { id: "icons", label: "Icons" },
    { id: "templates", label: "Templates" },
    { id: "saved", label: `Saved${savedComponents.length ? ` (${savedComponents.length})` : ""}` },
    { id: "import", label: `Import${importedAssets.length ? ` (${importedAssets.length})` : ""}` },
  ];

  return (
    <div className="flex h-full flex-col bg-stone-950 text-stone-300 select-none" style={{ userSelect: "none" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white">Element Library</h2>
          <p className="text-[10px] font-mono text-stone-500">Drag or click to insert into canvas</p>
        </div>
        <div className="flex items-center gap-1">
          {onExpand && !isExpanded && (
            <button onClick={onExpand} className="rounded p-1 text-stone-500 hover:bg-stone-800 hover:text-white" title="Expand to full page">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="rounded p-1 text-stone-500 hover:bg-stone-800 hover:text-white" title="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mode hint */}
      {!isInteractiveMode && (
        <div className="mx-3 mt-2.5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-mono text-amber-300 shrink-0">
          Turn on <strong>Interactive Edit</strong> to drag &amp; style elements.
        </div>
      )}

      {/* Tabs — scrollable row for 6 tabs */}
      <div className="flex border-b border-stone-800 shrink-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TAB_ITEMS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-2.5 py-2 text-[10px] font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? "border-b-2 border-amber-500 text-amber-400"
                : "text-stone-500 hover:text-stone-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1.5 shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === "icons" ? "Search icons…" : "Search library…"}
          className="w-full rounded border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-scroll">

        {/* ── ELEMENTS tab ── */}
        {tab === "elements" && (
          <div className="px-3 pb-4">
            {filteredElements.length === 0 ? (
              <p className="py-8 text-center text-xs text-stone-500">No elements found.</p>
            ) : (
              <>
                {/* Group by category */}
                {Array.from(new Set(filteredElements.map((el) => el.category))).map((cat) => (
                  <div key={cat} className="mb-4">
                    <p className="mb-1.5 mt-3 text-[9px] font-bold uppercase tracking-widest text-stone-500">{cat}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredElements.filter((el) => el.category === cat).map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, item.html)}
                          onDragEnd={handleDragEnd}
                          className="group relative cursor-grab rounded-lg border border-stone-800 bg-stone-900/40 p-2 transition-all hover:border-amber-500/40 hover:bg-stone-800 hover:shadow-sm active:cursor-grabbing"
                        >
                          {/* Preview */}
                          <div
                            className="mb-1.5 overflow-hidden rounded bg-white"
                            style={{ height: `${item.previewHeight || 60}px`, pointerEvents: "none" }}
                          >
                            <div
                              style={{
                                transform: `scale(${item.previewScale || 1})`,
                                transformOrigin: "top left",
                                width: item.previewScale ? `${100 / item.previewScale}%` : "100%",
                                pointerEvents: "none",
                              }}
                              dangerouslySetInnerHTML={{ __html: item.html }}
                            />
                          </div>
                          <p className="text-[10px] font-semibold text-stone-400 truncate">{item.name}</p>

                          {/* Insert button on hover */}
                          <button
                            onClick={() => { insertIntoIframe(item.html); flashInserted(item.id); }}
                            className="absolute inset-0 flex items-end justify-center pb-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-stone-900/90 to-transparent"
                          >
                            <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${insertedId === item.id ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>
                              {insertedId === item.id ? "✓ Inserted" : "+ Insert"}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── BLOCKS tab ── */}
        {tab === "blocks" && (
          <div className="px-3 pb-4 space-y-2.5">
            {filteredBlocks.length === 0 ? (
              <p className="py-8 text-center text-xs text-stone-500">No blocks found.</p>
            ) : (
              filteredBlocks.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.html)}
                  onDragEnd={handleDragEnd}
                  className="group relative cursor-grab rounded-lg border border-stone-800 bg-stone-900/40 p-2 transition-all hover:border-amber-500/40 hover:bg-stone-800 hover:shadow-sm active:cursor-grabbing"
                >
                  <div
                    className="mb-1.5 overflow-hidden rounded bg-white"
                    style={{ height: `${item.previewHeight || 80}px`, pointerEvents: "none" }}
                  >
                    <div
                      style={{
                        transform: `scale(${item.previewScale || 1})`,
                        transformOrigin: "top left",
                        width: item.previewScale ? `${100 / item.previewScale}%` : "100%",
                        pointerEvents: "none",
                      }}
                      dangerouslySetInnerHTML={{ __html: item.html }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-stone-300">{item.name}</p>
                      <p className="text-[9px] text-stone-500">{item.category}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => { insertIntoIframe(item.html); flashInserted(item.id); }}
                    className="absolute inset-0 flex items-end justify-center pb-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-stone-900/90 to-transparent"
                  >
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${insertedId === item.id ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>
                      {insertedId === item.id ? "✓ Inserted" : "+ Insert Block"}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ICONS tab ── */}
        {tab === "icons" && (
          <div className="px-3 pb-4">
            {filteredIcons.length === 0 ? (
              <p className="py-8 text-center text-xs text-stone-500">No icons found.</p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {filteredIcons.map((icon) => {
                  const svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.svg}</svg>`;
                  return (
                    <button
                      key={icon.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, svgHtml)}
                      onDragEnd={handleDragEnd}
                      onClick={() => { insertIntoIframe(svgHtml); flashInserted(icon.id); }}
                      title={icon.name}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg p-2 transition-all cursor-grab active:cursor-grabbing ${
                        insertedId === icon.id
                          ? "bg-emerald-900/30 border border-emerald-600/50"
                          : "bg-stone-900/40 border border-stone-800 hover:border-amber-500/40 hover:bg-stone-800"
                      }`}
                    >
                      <svg
                        width={20} height={20}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                        className="text-stone-300"
                        dangerouslySetInnerHTML={{ __html: icon.svg }}
                      />
                      <span className="text-[8px] text-stone-500 text-center leading-tight truncate w-full">{icon.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TEMPLATES tab ── */}
        {tab === "templates" && (
          <div className="px-3 pb-4 space-y-3 pt-2">
            <p className="text-[10px] font-mono text-stone-500">Full-page templates — click to load into canvas</p>
            {[
              {
                id: "tpl-saas-landing", name: "SaaS Landing Page", category: "Landing",
                preview: "Hero + Features + Pricing + CTA",
                html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white font-sans"><nav class="flex items-center justify-between px-8 py-4 border-b border-gray-100"><span class="text-xl font-black text-gray-900">Brand</span><div class="flex items-center gap-8"><a href="#" class="text-sm text-gray-500 hover:text-gray-800">Features</a><a href="#" class="text-sm text-gray-500 hover:text-gray-800">Pricing</a><a href="#" class="text-sm text-gray-500 hover:text-gray-800">Blog</a></div><button class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-500">Get Started</button></nav><section class="text-center py-24 px-8 bg-gradient-to-b from-indigo-50 to-white"><p class="text-sm font-semibold text-indigo-600 mb-3 uppercase tracking-widest">Now in Public Beta</p><h1 class="text-5xl font-black text-gray-900 mb-6 max-w-2xl mx-auto leading-tight">Build faster than ever before</h1><p class="text-lg text-gray-500 max-w-xl mx-auto mb-10">The all-in-one platform for modern teams. Design, develop, and ship at lightning speed.</p><div class="flex justify-center gap-4"><button class="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-500">Start Free Trial</button><button class="border border-gray-200 text-gray-700 px-8 py-3 rounded-xl font-semibold hover:border-gray-300">Watch Demo</button></div></section><section class="py-20 px-8 max-w-5xl mx-auto"><h2 class="text-3xl font-black text-center text-gray-900 mb-3">Everything you need</h2><p class="text-center text-gray-500 mb-12">Built for teams of all sizes</p><div class="grid grid-cols-3 gap-6"><div class="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition"><div class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">⚡</div><h3 class="font-bold text-gray-900 mb-2">Fast Performance</h3><p class="text-sm text-gray-500">Blazing fast with our global CDN and optimized infrastructure.</p></div><div class="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition"><div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">🔒</div><h3 class="font-bold text-gray-900 mb-2">Secure by Default</h3><p class="text-sm text-gray-500">Enterprise-grade security built into every layer.</p></div><div class="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition"><div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-4">🛠</div><h3 class="font-bold text-gray-900 mb-2">Developer First</h3><p class="text-sm text-gray-500">Clean APIs and SDKs that make integration effortless.</p></div></div></section><section class="py-20 bg-gray-50 px-8"><h2 class="text-3xl font-black text-center text-gray-900 mb-12">Simple pricing</h2><div class="grid grid-cols-3 gap-6 max-w-4xl mx-auto"><div class="bg-white rounded-2xl p-8 border border-gray-200"><p class="text-sm font-bold text-gray-400 uppercase mb-4">Starter</p><p class="text-4xl font-black text-gray-900 mb-1">$9<span class="text-base font-normal text-gray-400">/mo</span></p><p class="text-sm text-gray-400 mb-6">For solo projects</p><button class="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold mb-6 hover:bg-gray-200">Get Started</button><ul class="space-y-2 text-sm text-gray-500"><li>✓ 5 projects</li><li>✓ 10 GB storage</li><li>✓ Email support</li></ul></div><div class="bg-indigo-600 rounded-2xl p-8 border border-indigo-600 relative"><span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-gray-900 text-xs font-black px-3 py-1 rounded-full">POPULAR</span><p class="text-sm font-bold text-indigo-200 uppercase mb-4">Pro</p><p class="text-4xl font-black text-white mb-1">$29<span class="text-base font-normal text-indigo-300">/mo</span></p><p class="text-sm text-indigo-300 mb-6">For growing teams</p><button class="w-full bg-white text-indigo-600 py-2.5 rounded-lg font-semibold mb-6 hover:bg-indigo-50">Get Started</button><ul class="space-y-2 text-sm text-indigo-200"><li>✓ Unlimited projects</li><li>✓ 100 GB storage</li><li>✓ Priority support</li></ul></div><div class="bg-white rounded-2xl p-8 border border-gray-200"><p class="text-sm font-bold text-gray-400 uppercase mb-4">Enterprise</p><p class="text-4xl font-black text-gray-900 mb-1">$99<span class="text-base font-normal text-gray-400">/mo</span></p><p class="text-sm text-gray-400 mb-6">For large orgs</p><button class="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold mb-6 hover:bg-gray-200">Contact Sales</button><ul class="space-y-2 text-sm text-gray-500"><li>✓ Unlimited everything</li><li>✓ 1 TB storage</li><li>✓ Dedicated support</li></ul></div></div></section><footer class="bg-gray-900 text-gray-400 py-12 px-8 text-center"><p class="text-sm">© 2024 Brand Inc. All rights reserved.</p></footer></body></html>`,
              },
              {
                id: "tpl-dashboard", name: "Admin Dashboard", category: "Dashboard",
                preview: "Sidebar + Stats + Charts + Table",
                html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 font-sans flex h-screen overflow-hidden"><aside class="w-60 bg-gray-900 text-white flex flex-col shrink-0"><div class="px-6 py-5 border-b border-gray-700"><span class="text-lg font-black">AdminPanel</span></div><nav class="flex-1 px-3 py-4 space-y-1"><a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium">📊 Dashboard</a><a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 text-sm font-medium">👥 Users</a><a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 text-sm font-medium">📦 Products</a><a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 text-sm font-medium">💳 Payments</a><a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 text-sm font-medium">📈 Analytics</a><a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 text-sm font-medium">⚙️ Settings</a></nav></aside><div class="flex-1 flex flex-col overflow-hidden"><header class="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between"><h1 class="text-xl font-bold text-gray-900">Dashboard</h1><div class="flex items-center gap-3"><span class="text-sm text-gray-500">Jun 2024</span><div class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">JD</div></div></header><main class="flex-1 overflow-auto p-8"><div class="grid grid-cols-4 gap-6 mb-8"><div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"><p class="text-xs font-semibold text-gray-400 uppercase mb-1">Total Revenue</p><p class="text-3xl font-black text-gray-900">$48.2K</p><p class="text-sm text-green-500 font-medium mt-1">↑ 12.5% this month</p></div><div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"><p class="text-xs font-semibold text-gray-400 uppercase mb-1">Active Users</p><p class="text-3xl font-black text-gray-900">3,842</p><p class="text-sm text-green-500 font-medium mt-1">↑ 8.2% this month</p></div><div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"><p class="text-xs font-semibold text-gray-400 uppercase mb-1">New Orders</p><p class="text-3xl font-black text-gray-900">284</p><p class="text-sm text-red-400 font-medium mt-1">↓ 3.1% this month</p></div><div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"><p class="text-xs font-semibold text-gray-400 uppercase mb-1">Conversion</p><p class="text-3xl font-black text-gray-900">5.4%</p><p class="text-sm text-green-500 font-medium mt-1">↑ 1.8% this month</p></div></div><div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"><div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between"><h2 class="font-bold text-gray-900">Recent Orders</h2><button class="text-sm text-indigo-600 font-medium">View all</button></div><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="text-left px-6 py-3 text-gray-400 font-semibold text-xs uppercase">Customer</th><th class="text-left px-6 py-3 text-gray-400 font-semibold text-xs uppercase">Product</th><th class="text-left px-6 py-3 text-gray-400 font-semibold text-xs uppercase">Status</th><th class="text-left px-6 py-3 text-gray-400 font-semibold text-xs uppercase">Amount</th></tr></thead><tbody class="divide-y divide-gray-50"><tr class="hover:bg-gray-50"><td class="px-6 py-4 font-medium text-gray-900">Alice Johnson</td><td class="px-6 py-4 text-gray-500">Pro Plan</td><td class="px-6 py-4"><span class="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">Active</span></td><td class="px-6 py-4 font-semibold text-gray-900">$29.00</td></tr><tr class="hover:bg-gray-50"><td class="px-6 py-4 font-medium text-gray-900">Bob Smith</td><td class="px-6 py-4 text-gray-500">Starter Plan</td><td class="px-6 py-4"><span class="bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">Pending</span></td><td class="px-6 py-4 font-semibold text-gray-900">$9.00</td></tr><tr class="hover:bg-gray-50"><td class="px-6 py-4 font-medium text-gray-900">Carol Lee</td><td class="px-6 py-4 text-gray-500">Enterprise Plan</td><td class="px-6 py-4"><span class="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">Active</span></td><td class="px-6 py-4 font-semibold text-gray-900">$99.00</td></tr><tr class="hover:bg-gray-50"><td class="px-6 py-4 font-medium text-gray-900">David Kim</td><td class="px-6 py-4 text-gray-500">Pro Plan</td><td class="px-6 py-4"><span class="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">Cancelled</span></td><td class="px-6 py-4 font-semibold text-gray-900">$29.00</td></tr></tbody></table></div></main></div></body></html>`,
              },
              {
                id: "tpl-mobile-app", name: "Mobile App UI", category: "Mobile",
                preview: "App-style layout with bottom nav",
                html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=375,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 font-sans flex justify-center items-center min-h-screen"><div class="w-96 h-[780px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col relative border-4 border-gray-900"><div class="bg-gray-900 text-white px-6 py-3 flex items-center justify-between"><span class="text-xs font-semibold">9:41</span><div class="flex gap-1 text-xs">▲ ◉ ▮</div></div><div class="bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100"><div><p class="text-xs text-gray-400">Good morning 👋</p><h1 class="text-lg font-black text-gray-900">Alex Johnson</h1></div><div class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">AJ</div></div><div class="flex-1 overflow-auto px-5 py-4"><div class="bg-indigo-600 rounded-2xl p-5 mb-4 text-white"><p class="text-xs text-indigo-300 mb-1">Total Balance</p><p class="text-3xl font-black mb-3">$12,840.00</p><div class="flex gap-3"><button class="flex-1 bg-white/20 py-2 rounded-xl text-sm font-semibold">Send</button><button class="flex-1 bg-white/20 py-2 rounded-xl text-sm font-semibold">Receive</button></div></div><h2 class="font-bold text-gray-800 mb-3">Quick Actions</h2><div class="grid grid-cols-4 gap-3 mb-5"><div class="flex flex-col items-center gap-2"><div class="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-xl">💳</div><span class="text-xs text-gray-500">Pay</span></div><div class="flex flex-col items-center gap-2"><div class="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-xl">📈</div><span class="text-xs text-gray-500">Invest</span></div><div class="flex flex-col items-center gap-2"><div class="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-xl">🏦</div><span class="text-xs text-gray-500">Savings</span></div><div class="flex flex-col items-center gap-2"><div class="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-xl">🔄</div><span class="text-xs text-gray-500">Transfer</span></div></div><h2 class="font-bold text-gray-800 mb-3">Recent Transactions</h2><div class="space-y-3"><div class="flex items-center gap-3 bg-gray-50 rounded-xl p-3"><div class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">🛒</div><div class="flex-1"><p class="text-sm font-semibold text-gray-800">Amazon</p><p class="text-xs text-gray-400">Dec 5, 2024</p></div><p class="text-sm font-bold text-red-500">-$49.99</p></div><div class="flex items-center gap-3 bg-gray-50 rounded-xl p-3"><div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">💰</div><div class="flex-1"><p class="text-sm font-semibold text-gray-800">Salary</p><p class="text-xs text-gray-400">Dec 1, 2024</p></div><p class="text-sm font-bold text-green-500">+$3,200</p></div><div class="flex items-center gap-3 bg-gray-50 rounded-xl p-3"><div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">☕</div><div class="flex-1"><p class="text-sm font-semibold text-gray-800">Starbucks</p><p class="text-xs text-gray-400">Nov 30, 2024</p></div><p class="text-sm font-bold text-red-500">-$6.50</p></div></div></div><div class="bg-white border-t border-gray-100 px-6 py-3 flex justify-around"><button class="flex flex-col items-center gap-1 text-indigo-600"><span class="text-xl">🏠</span><span class="text-[10px] font-semibold">Home</span></button><button class="flex flex-col items-center gap-1 text-gray-400"><span class="text-xl">📊</span><span class="text-[10px]">Stats</span></button><button class="flex flex-col items-center gap-1 text-gray-400"><span class="text-xl">💳</span><span class="text-[10px]">Cards</span></button><button class="flex flex-col items-center gap-1 text-gray-400"><span class="text-xl">⚙️</span><span class="text-[10px]">Settings</span></button></div></div></body></html>`,
              },
              {
                id: "tpl-portfolio", name: "Portfolio Page", category: "Portfolio",
                preview: "Hero + Projects + Contact",
                html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-950 text-white font-sans"><nav class="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800 px-8 py-4 flex items-center justify-between"><span class="font-black text-xl">Alex<span class="text-indigo-500">.</span></span><div class="flex gap-8"><a href="#" class="text-sm text-gray-400 hover:text-white">Work</a><a href="#" class="text-sm text-gray-400 hover:text-white">About</a><a href="#" class="text-sm text-gray-400 hover:text-white">Contact</a></div></nav><section class="pt-32 pb-24 px-8 max-w-4xl mx-auto"><div class="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">● Available for work</div><h1 class="text-6xl font-black mb-6 leading-tight">Product Designer<br/><span class="text-gray-500">& Developer</span></h1><p class="text-lg text-gray-400 max-w-xl mb-10">I craft beautiful digital experiences that live at the intersection of design and technology. 5 years of experience building products people love.</p><div class="flex gap-4"><button class="bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100">View My Work</button><button class="border border-gray-700 text-white px-6 py-3 rounded-xl font-semibold hover:border-gray-500">Download CV</button></div></section><section class="py-20 px-8 max-w-4xl mx-auto"><h2 class="text-2xl font-black mb-2">Selected Work</h2><p class="text-gray-500 mb-10">Projects I am proud of</p><div class="grid grid-cols-2 gap-6"><div class="group rounded-2xl overflow-hidden border border-gray-800 hover:border-gray-600 transition cursor-pointer"><div class="h-48 bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center text-4xl">🎯</div><div class="p-5"><span class="text-xs font-semibold text-indigo-400 uppercase tracking-widest">SaaS · 2024</span><h3 class="text-lg font-bold mt-1 mb-2">Project Alpha</h3><p class="text-sm text-gray-400">A design system and web app for enterprise teams.</p></div></div><div class="group rounded-2xl overflow-hidden border border-gray-800 hover:border-gray-600 transition cursor-pointer"><div class="h-48 bg-gradient-to-br from-green-900 to-teal-900 flex items-center justify-center text-4xl">📱</div><div class="p-5"><span class="text-xs font-semibold text-green-400 uppercase tracking-widest">Mobile · 2023</span><h3 class="text-lg font-bold mt-1 mb-2">FinFlow App</h3><p class="text-sm text-gray-400">Personal finance app with 50K active users.</p></div></div></div></section><section class="py-20 px-8 max-w-xl mx-auto text-center"><h2 class="text-2xl font-black mb-3">Let's work together</h2><p class="text-gray-400 mb-8">Have a project in mind? I'd love to hear about it.</p><a href="mailto:hello@alex.com" class="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-500">Send me an email</a></section><footer class="text-center py-8 border-t border-gray-800 text-gray-600 text-sm">© 2024 Alex. All rights reserved.</footer></body></html>`,
              },
              {
                id: "tpl-ecommerce", name: "E-Commerce Store", category: "Commerce",
                preview: "Product grid + cart + filters",
                html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white font-sans"><header class="border-b border-gray-100 px-8 py-4"><div class="flex items-center justify-between max-w-7xl mx-auto"><span class="text-xl font-black text-gray-900">ShopLane</span><nav class="flex gap-8"><a href="#" class="text-sm text-gray-500">Women</a><a href="#" class="text-sm text-gray-500">Men</a><a href="#" class="text-sm text-gray-500">Kids</a><a href="#" class="text-sm text-gray-500">Sale</a></nav><div class="flex items-center gap-4"><button class="text-gray-500 hover:text-gray-900">🔍</button><button class="relative text-gray-500 hover:text-gray-900">🛒<span class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">3</span></button></div></div></header><div class="max-w-7xl mx-auto px-8 py-6 flex gap-8"><aside class="w-56 shrink-0"><h2 class="font-bold text-gray-900 mb-4">Filters</h2><div class="space-y-5"><div><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">Category</h3><div class="space-y-2 text-sm text-gray-600"><label class="flex items-center gap-2"><input type="checkbox" checked class="accent-indigo-600"> All Items</label><label class="flex items-center gap-2"><input type="checkbox" class="accent-indigo-600"> T-Shirts</label><label class="flex items-center gap-2"><input type="checkbox" class="accent-indigo-600"> Jackets</label><label class="flex items-center gap-2"><input type="checkbox" class="accent-indigo-600"> Shoes</label></div></div><div><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">Price Range</h3><input type="range" min="0" max="500" value="200" class="w-full accent-indigo-600"><div class="flex justify-between text-xs text-gray-400"><span>$0</span><span>$500</span></div></div><div><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">Color</h3><div class="flex gap-2"><button class="w-7 h-7 rounded-full bg-gray-900 border-2 border-gray-900"></button><button class="w-7 h-7 rounded-full bg-white border-2 border-gray-200"></button><button class="w-7 h-7 rounded-full bg-red-400 border-2 border-transparent"></button><button class="w-7 h-7 rounded-full bg-blue-500 border-2 border-transparent"></button></div></div></aside><main class="flex-1"><div class="flex items-center justify-between mb-6"><p class="text-sm text-gray-500">Showing 24 of 142 products</p><select class="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">Best Selling</select></div><div class="grid grid-cols-3 gap-6">${Array.from({length:6}, (_,i) => `<div class="group cursor-pointer"><div class="aspect-square bg-gray-100 rounded-2xl mb-3 overflow-hidden relative"><div class="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-4xl">${["👟","👕","🧥","👗","👜","🧢"][i]}</div><button class="absolute bottom-3 left-0 right-0 mx-4 bg-gray-900 text-white py-2 text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition">Add to Cart</button></div><h3 class="font-semibold text-gray-900 text-sm">Product ${i+1}</h3><p class="text-sm text-gray-400">Classic Collection</p><p class="font-bold text-gray-900 mt-1">$${[59,29,89,49,79,19][i]}.00</p></div>`).join("")}</div></main></div></body></html>`,
              },
              {
                id: "tpl-blog", name: "Blog / Article", category: "Content",
                preview: "Article with sidebar layout",
                html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white font-sans"><header class="border-b border-gray-100 px-8 py-4"><div class="max-w-6xl mx-auto flex items-center justify-between"><span class="text-xl font-black text-gray-900">The Blog</span><div class="flex gap-6 text-sm text-gray-500"><a href="#">Technology</a><a href="#">Design</a><a href="#">Business</a><a href="#">Culture</a></div><button class="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold">Subscribe</button></div></header><div class="max-w-6xl mx-auto px-8 py-12 flex gap-12"><main class="flex-1"><div class="mb-6"><span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">Technology</span></div><h1 class="text-4xl font-black text-gray-900 mb-4 leading-tight">The Future of AI in Product Design: What Every Designer Needs to Know</h1><div class="flex items-center gap-4 mb-8 pb-8 border-b border-gray-100"><div class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">SK</div><div><p class="font-semibold text-gray-900 text-sm">Sarah Kim</p><p class="text-xs text-gray-400">Dec 5, 2024 · 8 min read</p></div></div><div class="aspect-video bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl mb-10 flex items-center justify-center text-6xl">🤖</div><div class="prose max-w-none"><p class="text-lg text-gray-600 mb-6 leading-relaxed">Artificial intelligence is no longer a distant concept—it's transforming the way we think about product design right now. From automated user research to generative design tools, AI is reshaping every stage of the design process.</p><h2 class="text-2xl font-black text-gray-900 mb-4 mt-10">1. Understanding the Shift</h2><p class="text-gray-600 mb-6 leading-relaxed">The design industry has always evolved alongside technology. Just as the introduction of desktop publishing transformed print design, and the rise of the web created an entirely new discipline, AI represents another fundamental shift. The difference this time is the speed of change.</p><h2 class="text-2xl font-black text-gray-900 mb-4 mt-10">2. Practical Applications Today</h2><p class="text-gray-600 mb-6 leading-relaxed">Designers are already using AI tools to accelerate their workflows. Tools like Midjourney for concept exploration, GitHub Copilot for front-end code generation, and emerging AI-powered design systems are becoming part of everyday practice.</p></div></main><aside class="w-72 shrink-0"><div class="sticky top-8 space-y-8"><div class="bg-gray-50 rounded-2xl p-6"><h3 class="font-bold text-gray-900 mb-4">About the Author</h3><div class="flex items-center gap-3 mb-3"><div class="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">SK</div><div><p class="font-bold text-gray-900">Sarah Kim</p><p class="text-xs text-gray-400">Senior Product Designer</p></div></div><p class="text-sm text-gray-500">5 years in product design, passionate about the intersection of AI and UX.</p></div><div><h3 class="font-bold text-gray-900 mb-4">Related Posts</h3><div class="space-y-4"><div class="flex gap-3 cursor-pointer group"><div class="w-16 h-16 bg-gray-100 rounded-xl shrink-0 flex items-center justify-center">📱</div><div><p class="text-sm font-semibold text-gray-800 group-hover:text-indigo-600">Mobile-First Design in 2024</p><p class="text-xs text-gray-400 mt-1">Dec 1, 2024</p></div></div><div class="flex gap-3 cursor-pointer group"><div class="w-16 h-16 bg-gray-100 rounded-xl shrink-0 flex items-center justify-center">🎨</div><div><p class="text-sm font-semibold text-gray-800 group-hover:text-indigo-600">Design Systems at Scale</p><p class="text-xs text-gray-400 mt-1">Nov 28, 2024</p></div></div></div></div></div></aside></div></body></html>`,
              },
            ].map((tpl) => (
              <div key={tpl.id} className="rounded-lg border border-stone-800 bg-stone-900/40 p-3 hover:border-amber-500/40 hover:bg-stone-800 transition-all">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-200">{tpl.name}</p>
                    <p className="text-[9px] font-mono text-stone-500">{tpl.category} · {tpl.preview}</p>
                  </div>
                  <button
                    onClick={() => { insertIntoIframe(tpl.html); flashInserted(tpl.id); }}
                    className={`shrink-0 rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      insertedId === tpl.id
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-600 text-white hover:bg-amber-500"
                    }`}
                  >
                    {insertedId === tpl.id ? "✓ Loaded" : "Use Template"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SAVED tab ── */}
        {tab === "saved" && (
          <div className="px-3 pb-4">
            {/* Save current canvas button */}
            <div className="mt-2 mb-3">
              {isSavingNew ? (
                <div className="rounded border border-stone-700 bg-stone-900/60 p-3 space-y-2">
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveCurrentPage()}
                    placeholder="Component name"
                    autoFocus
                    className="w-full rounded border border-stone-700 bg-stone-800 px-2.5 py-1.5 text-xs text-white placeholder-stone-600 focus:border-amber-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveCurrentPage} disabled={!saveName.trim()} className="flex-1 rounded bg-amber-600 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-amber-500">
                      Save Canvas
                    </button>
                    <button onClick={() => setIsSavingNew(false)} className="px-3 rounded bg-stone-700 text-xs text-stone-300 hover:bg-stone-600">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setIsSavingNew(true)} className="w-full rounded border border-stone-700 bg-stone-900/40 py-1.5 text-[11px] font-semibold text-stone-300 hover:bg-stone-800 hover:text-white transition">
                  + Save Current Canvas
                </button>
              )}
            </div>

            {filteredSaved.length === 0 ? (
              <p className="py-8 text-center text-xs text-stone-500">
                {savedComponents.length === 0
                  ? "No saved components yet. Select a block in Interactive Edit, then Save Block."
                  : "No matching components."}
              </p>
            ) : (
              <div className="space-y-2.5">
                {filteredSaved.map((comp) => (
                  <div
                    key={comp.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, comp.html)}
                    onDragEnd={handleDragEnd}
                    className="rounded border border-stone-800 bg-stone-900/40 p-3 hover:border-amber-500/40 cursor-grab active:cursor-grabbing transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-xs font-semibold text-white">{comp.name}</h3>
                        <span className="text-[9px] font-mono uppercase tracking-wide text-amber-500">{comp.tagName}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={async () => { await navigator.clipboard.writeText(comp.html); setCopiedId(comp.id); window.setTimeout(() => setCopiedId(null), 1400); }}
                          className="rounded px-1.5 py-0.5 text-[9px] text-stone-400 hover:bg-stone-700 hover:text-white transition"
                        >
                          {copiedId === comp.id ? "Copied" : "Copy"}
                        </button>
                        <button onClick={() => deleteSaved(comp.id)} className="rounded px-1.5 py-0.5 text-[9px] text-stone-400 hover:bg-red-900/30 hover:text-red-400 transition">
                          Delete
                        </button>
                      </div>
                    </div>
                    <pre className="mt-1 max-h-12 overflow-hidden rounded bg-stone-800 p-1.5 text-[9px] leading-relaxed text-stone-400 whitespace-pre-wrap">
                      {comp.html.slice(0, 200)}{comp.html.length > 200 ? "…" : ""}
                    </pre>
                    <button
                      onClick={() => { insertIntoIframe(comp.html); flashInserted(comp.id); }}
                      className={`mt-2 w-full rounded border py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                        insertedId === comp.id
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-stone-700 bg-stone-800 text-stone-300 hover:bg-stone-700"
                      }`}
                    >
                      {insertedId === comp.id ? "✓ Inserted" : "Insert into Canvas"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── IMPORT tab ── */}
        {tab === "import" && (
          <div className="px-3 pb-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 mt-2 mb-3 rounded-lg overflow-hidden border border-stone-800 bg-stone-900">
              <button
                onClick={() => setImportTab("media")}
                className={`flex-1 py-1.5 text-[10px] font-bold transition-colors ${importTab === "media" ? "bg-amber-600 text-white" : "text-stone-400 hover:text-white"}`}
              >🖼 Images / SVG / Icons</button>
              <button
                onClick={() => setImportTab("html")}
                className={`flex-1 py-1.5 text-[10px] font-bold transition-colors ${importTab === "html" ? "bg-amber-600 text-white" : "text-stone-400 hover:text-white"}`}
              >{"</>"} HTML Snippet</button>
            </div>

            {importTab === "media" && (
              <>
                {/* Drop zone / file input */}
                <div
                  className="relative mb-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-700 bg-stone-900/60 py-6 cursor-pointer hover:border-amber-500/60 hover:bg-stone-800/60 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files);
                    if (!files.length) return;
                    const syntheticEvent = { target: { files, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFileImport(syntheticEvent);
                  }}
                >
                  <div className="text-3xl">📁</div>
                  <p className="text-xs font-semibold text-stone-300">Click or drag files here</p>
                  <p className="text-[10px] text-stone-500">PNG · JPG · GIF · WebP · SVG</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.svg"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                </div>

                {/* Imported asset grid */}
                {importedAssets.filter(a => a.type === "image" || a.type === "svg").length === 0 ? (
                  <p className="py-4 text-center text-[10px] text-stone-500">No images imported yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {importedAssets.filter(a => a.type === "image" || a.type === "svg").map(asset => (
                      <div
                        key={asset.id}
                        draggable
                        onDragStart={e => {
                          const html = asset.type === "svg"
                            ? `<img src="${asset.dataUrl}" alt="${asset.name}" style="width:48px;height:48px;display:inline-block" />`
                            : `<img src="${asset.dataUrl}" alt="${asset.name}" style="max-width:100%;height:auto;display:block" />`;
                          handleDragStart(e, html);
                        }}
                        onDragEnd={handleDragEnd}
                        className="group relative cursor-grab rounded-lg border border-stone-800 bg-stone-900/40 p-1.5 transition-all hover:border-amber-500/40 hover:bg-stone-800 active:cursor-grabbing"
                      >
                        <div className="mb-1 flex h-16 items-center justify-center overflow-hidden rounded bg-stone-800/60">
                          <img src={asset.dataUrl} alt={asset.name} className="max-h-full max-w-full object-contain" />
                        </div>
                        <p className="truncate text-[9px] text-stone-400 font-medium">{asset.name}</p>
                        <p className="text-[8px] text-stone-600 uppercase">{asset.type}</p>
                        {/* Hover actions */}
                        <div className="absolute inset-0 flex flex-col items-center justify-end gap-1 pb-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-stone-900/90 to-transparent">
                          <button
                            onClick={() => insertImported(asset)}
                            className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${insertedId === asset.id ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}
                          >{insertedId === asset.id ? "✓ Inserted" : "+ Insert"}</button>
                          <button
                            onClick={() => deleteImported(asset.id)}
                            className="text-[9px] text-red-400 hover:text-red-300 font-semibold"
                          >Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {importTab === "html" && (
              <div className="space-y-2">
                <p className="text-[10px] text-stone-400">Paste any HTML component, icon SVG, or template snippet. It will be saved and draggable into your designs.</p>
                <input
                  value={importHtmlName}
                  onChange={e => setImportHtmlName(e.target.value)}
                  placeholder="Component name (optional)"
                  className="w-full rounded border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:border-amber-500 focus:outline-none"
                />
                <textarea
                  value={importHtmlSnippet}
                  onChange={e => setImportHtmlSnippet(e.target.value)}
                  placeholder={`<div class="card">...</div>`}
                  rows={6}
                  className="w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 font-mono text-[11px] text-stone-200 placeholder-stone-600 focus:border-amber-500 focus:outline-none resize-y"
                />
                <button
                  onClick={addImportedHtmlSnippet}
                  disabled={!importHtmlSnippet.trim()}
                  className="w-full rounded-lg border border-amber-600 bg-amber-600/10 py-2 text-xs font-bold text-amber-400 hover:bg-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >+ Save Component</button>

                {/* Saved HTML snippets */}
                {importedAssets.filter(a => a.type === "html").length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-stone-500">Saved Snippets</p>
                    {importedAssets.filter(a => a.type === "html").map(asset => (
                      <div key={asset.id} className="rounded-lg border border-stone-800 bg-stone-900/60 p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-semibold text-stone-200">{asset.name}</p>
                          <button onClick={() => deleteImported(asset.id)} className="text-[9px] text-red-400 hover:text-red-300">Delete</button>
                        </div>
                        <pre className="max-h-10 overflow-hidden text-[9px] text-stone-500 whitespace-pre-wrap">
                          {(asset.html || "").slice(0, 120)}{(asset.html || "").length > 120 ? "…" : ""}
                        </pre>
                        <button
                          onClick={() => insertImported(asset)}
                          className={`mt-2 w-full rounded border py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                            insertedId === asset.id
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-stone-700 bg-stone-800 text-stone-300 hover:bg-stone-700"
                          }`}
                        >{insertedId === asset.id ? "✓ Inserted" : "Insert into Canvas"}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
