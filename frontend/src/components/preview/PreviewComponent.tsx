import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";
import toast from "react-hot-toast";

import useThrottle from "../../hooks/useThrottle";
import EditPopup from "../select-and-edit/EditPopup";
import { useAppStore } from "../../store/app-store";
import { useProjectStore } from "../../store/project-store";
import { useFullProjectStore } from "../../store/full-project-store";
import { AestheticMode } from "../../types";
import { createCommit } from "../commits/utils";

interface Props {
  code: string;
  device: "desktop" | "mobile";
  doUpdate: (instruction: string) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  aestheticMode?: AestheticMode;
  /** Bottom position of the toolbar row (px from viewport top). Panels start here. */
  panelTop?: number;
}

const BASE_W = { desktop: 1440, mobile: 390 };
const BASE_H = { desktop: 900, mobile: 844 };

// 閳光偓閳光偓閳光偓 HTML helpers 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓

function stripMarkdownFence(code: string): string {
  return code.trim()
    .replace(/^```(?:html|text)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildPreviewFallback(code: string): string {
  const snippet = escapeHtml(code.slice(0, 1200));
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><script src="https://cdn.tailwindcss.com"></script></head>
<body class="min-h-screen bg-white text-slate-900"><main class="mx-auto max-w-3xl p-8 font-sans">
<div class="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900">
<h1 class="text-lg font-semibold">Preview could not render this output as HTML</h1>
<p class="mt-2 text-sm">Check the Code tab or switch the output framework to HTML + Tailwind.</p></div>
<pre class="mt-4 max-h-[560px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">${snippet}</pre>
</main></body></html>`;
}

function ensureFullHtml(code: string): string {
  const cleaned = stripMarkdownFence(code);
  if (!cleaned) return '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body></body></html>';
  if (/<html[\s>]/i.test(cleaned)) return cleaned.startsWith("<!DOCTYPE") ? cleaned : `<!DOCTYPE html>\n${cleaned}`;
  if (/<body[\s>]/i.test(cleaned) || /<head[\s>]/i.test(cleaned)) {
    return `<!DOCTYPE html>\n<html>\n${cleaned.replace(/<!doctype html>/i, "")}\n</html>`;
  }
  if (/<[a-z][\s\S]*>/i.test(cleaned)) {
    return `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8"/>\n<meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n<script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body>\n${cleaned}\n</body>\n</html>`;
  }
  return buildPreviewFallback(cleaned);
}

// 閳光偓閳光偓閳光偓 Sentinel 閳?a data attribute on <html>, stripped before saving 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
const RUNTIME_SENTINEL = "data-designer-runtime-injected";

function injectEditorRuntime(rawHtml: string): string {
  const normalizedHtml = ensureFullHtml(rawHtml);
  if (new RegExp(`<html[^>]+${RUNTIME_SENTINEL}`, "i").test(normalizedHtml)) return normalizedHtml;

  const css = `
<style id="__dsr-style">
  body { position:relative; min-height:100vh; }
  body *:not([id^="__dsr"]):not([id^="__dt"]):not([id^="__pp"]) { pointer-events:auto !important; }
  /* Always keep toolbar buttons clickable regardless of page-level pointer-events rules */
  #__dsr-toolbar button, #__dsr-toolbar [type=button] { pointer-events:auto !important; cursor:pointer !important; flex:0 0 auto !important; white-space:nowrap !important; }
  #__dsr-tb-r1, #__dsr-tb-r2 { display:flex !important; flex-wrap:wrap !important; align-items:center !important; gap:6px !important; }
  .dsr-hovered  { outline:2px dashed #f59e0b !important; outline-offset:-2px !important; cursor:pointer !important; }
  .dsr-selected { outline:2.5px solid #3b82f6 !important; outline-offset:-2px !important; }
  .dsr-drag-top { border-top:4px solid #f59e0b !important; }
  .dsr-drag-bot { border-bottom:4px solid #f59e0b !important; }
  .dsr-dragging { opacity:0.4 !important; }
  [data-dsr-group]  { outline: 1px dashed rgba(56,189,248,0.35) !important; outline-offset: 3px !important; }
  [data-dsr-locked] { cursor: not-allowed !important; opacity: 0.8 !important; }
</style>`;

  const toolbar = `
<div id="__dsr-toolbar" style="position:fixed;display:none;flex-direction:column;gap:9px;max-width:calc(100vw - 20px);width:auto;padding:12px 16px;background:#0c0a09;color:#fff;border:1.5px solid #292524;border-radius:13px;box-shadow:0 18px 48px rgba(0,0,0,.92);z-index:2147483647;font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;user-select:none;pointer-events:auto;box-sizing:border-box">
  <div id="__dsr-tb-r1" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">
    <span id="__dt-tag" style="background:#292524;color:#f59e0b;font-weight:800;font-family:monospace;text-transform:uppercase;padding:6px 11px;border-radius:6px;border:1px solid #555;font-size:12px">ELEM</span>
    <button id="__dt-parent" type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#292524;color:#f59e0b">⬆ Parent</button>
    <button id="__dt-edit"   type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#1c1917;color:#fff">✎ Text</button>
    <button id="__dt-layout" type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#1c1917;color:#a78bfa">⚙ Props</button>
    <button id="__dt-save"       type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #065f46;font-size:13px;font-weight:700;cursor:pointer;background:#064e3b;color:#6ee7b7">⊕ Save</button>
    <button id="__dt-savelayout" type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #065f46;font-size:13px;font-weight:700;cursor:pointer;background:#065f46;color:#a7f3d0">⊞ Layout</button>
    <span style="color:#3f3f46;margin:0 3px;font-size:18px;line-height:1;align-self:center">│</span>
    <button id="__dt-bfront" type="button" title="Bring to Front" style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#1c1917;color:#38bdf8">⬆ Front</button>
    <button id="__dt-fwd"    type="button" title="Bring Forward"  style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#1c1917;color:#7dd3fc">↑ Fwd</button>
    <button id="__dt-bwd"    type="button" title="Send Backward"  style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#1c1917;color:#7dd3fc">↓ Bwd</button>
    <button id="__dt-bback"  type="button" title="Send to Back"   style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#1c1917;color:#38bdf8">⬇ Back</button>
    <button id="__dt-lock"   type="button" title="Lock element"   style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#1c1917;color:#d6d3d1">🔓 Lock</button>
  </div>
  <div id="__dsr-tb-r2" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">
    <button id="__dt-selectmode" type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#292524;color:#f59e0b">☐ Select</button>
    <button id="__dt-group"      type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#292524;color:#71717a;opacity:0.5;pointer-events:none">Group</button>
    <button id="__dt-del"        type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #7f1d1d;font-size:13px;font-weight:700;cursor:pointer;background:#450a0a;color:#fca5a5">🗑 Delete</button>
    <button id="__dt-close"      type="button" style="padding:7px 13px;border-radius:7px;border:1px solid #44403c;font-size:13px;font-weight:700;cursor:pointer;background:#292524;color:#a8a29e">✕ Close</button>
  </div>
</div>
<div id="__dsr-edit-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(0,0,0,.65);z-index:2147483647;display:none;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,sans-serif;box-sizing:border-box">
  <div style="background:#1c1917;border:1px solid #292524;border-radius:12px;padding:18px;width:min(340px,90%);box-shadow:0 20px 28px rgba(0,0,0,.6);color:white">
    <h4 style="margin:0 0 10px;font-size:11px;font-weight:bold;font-family:monospace;color:#f59e0b;text-transform:uppercase">Edit Element Text</h4>
    <textarea id="__dsr-edit-input" style="width:100%;height:90px;background:#0c0a09;border:1px solid #444;border-radius:8px;padding:10px;color:white;font-size:12px;resize:none;outline:none;margin-bottom:12px;font-family:sans-serif;box-sizing:border-box"></textarea>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button type="button" onclick="document.getElementById('__dsr-edit-modal').style.display='none'" style="padding:5px 12px;background:#292524;border:1px solid #444;border-radius:6px;color:#a8a29e;font-size:11px;cursor:pointer;font-weight:bold">Cancel</button>
      <button id="__dsr-edit-apply" type="button" style="padding:5px 14px;background:#f59e0b;border:none;border-radius:6px;color:#0c0a09;font-weight:bold;font-size:11px;cursor:pointer">Save</button>
    </div>
  </div>
</div>
<div id="__dsr-delete-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483647;display:none;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,sans-serif">
  <div style="background:#1c1917;border:1px solid #292524;border-radius:12px;padding:18px;width:310px;box-shadow:0 20px 28px rgba(0,0,0,.6);color:white;text-align:center">
    <h4 style="margin:0 0 10px;font-size:11px;font-weight:bold;font-family:monospace;color:#ef4444;text-transform:uppercase">Delete Element?</h4>
    <p style="margin:0 0 16px;font-size:12px;color:#d6d3d1;line-height:1.5">Permanently remove this element from the layout?</p>
    <div style="display:flex;justify-content:center;gap:8px">
      <button type="button" onclick="document.getElementById('__dsr-delete-modal').style.display='none'" style="padding:5px 12px;background:#292524;border:1px solid #444;border-radius:6px;color:#a8a29e;font-size:11px;cursor:pointer;font-weight:bold">Cancel</button>
      <button id="__dt-confirm-del" type="button" style="padding:5px 14px;background:#ef4444;border:none;border-radius:6px;color:white;font-weight:bold;font-size:11px;cursor:pointer">Remove</button>
    </div>
  </div>
</div>
`;

  // 閳光偓閳光偓 Interactive editor runtime 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  // Guard uses DOM presence instead of a window variable. doc.open() clears the
  // DOM on every write, so getElementById always returns null after a fresh write 閳?  // guaranteeing the script re-initialises even after Transform or second open.
  const script = `
<script id="__dsr-script">
(function() {
  // Guard: attribute on <html> is wiped by doc.open() on every fresh write,
  // so this always re-initialises 閳?unlike window variables which persist.
  if (document.documentElement.getAttribute('data-dsr-running')) return;
  document.documentElement.setAttribute('data-dsr-running', '1');
  var selectedEl = null;
  var hoveredEl = null;
  var freeDrag = null;
  var justDragged = false;
  var selectedEls = [];   // multi-select accumulator for grouping
  var resizeState = null;
  var resizeGhost = null;   // placeholder that holds slot when a non-absolute el is resized
  var isDragging = false;   // true while a freeDrag is active; guards canvasify re-runs
  var resizeOverlay = null;
  var mutationTimer = null;
  var rubberBand = null;
  var rubberBandEl = null;
  var undoStack = [];
  var MAX_UNDO = 30;
  var propsPanelOpen = false;
  var selectMode = false;
  var textEditTarget = null; // element whose text is being edited via the parent-window modal

  // 閳光偓閳光偓 Designer UI guard 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function isDesignerUi(el) {
    return el && el.closest && (
      el.closest('#__dsr-toolbar') ||
      el.closest('#__dsr-edit-modal') ||
      el.closest('#__dsr-delete-modal') ||
      el.closest('#__dsr-resize-overlay') ||
      el.closest('#__dsr-rubber')
    );
  }

  // 閳光偓閳光偓 Element filter 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function isDraggable(el) {
    if (!el || !el.tagName) return false;
    if (isDesignerUi(el)) return false;
    if (el === document.body || el === document.documentElement) return false;
    // Canvas-placed elements (position:absolute) are always draggable regardless of tag.
    // This covers inserted icons (spans) and any other element explicitly placed on canvas.
    if (el.style && el.style.position === 'absolute') return true;
    var tag = el.tagName.toLowerCase();
    var skip = ['script','style','meta','link','title','head',
                'svg','path','g','polygon','rect','circle','line',
                'span','b','i','strong','em','small','br','hr'];
    return skip.indexOf(tag) === -1;
  }

  // 閳光偓閳光偓 Clean artifacts before saving 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function cleanDesignerArtifacts(root) {
    ['#__dsr-toolbar','#__dsr-edit-modal',
     '#__dsr-delete-modal','#__dsr-style','#__dsr-script',
     '#__dsr-resize-overlay','#__dsr-rubber'].forEach(function(sel) {
      var n = root.querySelector(sel);
      if (n) n.remove();
    });
    // Remove all ghost placeholders (drag + resize, class-based, multiple may exist)
    root.querySelectorAll('.__dsr-drag-ghost,.__dsr-resize-ghost').forEach(function(n) { n.remove(); });
    var htmlEl = (root.tagName && root.tagName.toLowerCase() === 'html') ? root : (root.querySelector ? root.querySelector('html') : null);
    if (htmlEl) { htmlEl.removeAttribute('data-designer-runtime-injected'); htmlEl.removeAttribute('data-dsr-running'); }
    root.querySelectorAll('.dsr-hovered,.dsr-selected,.dsr-drag-top,.dsr-drag-bot,.dsr-dragging')
      .forEach(function(n) { n.className = n.className.replace(/dsr-\\S+/g, '').trim(); });
    root.querySelectorAll('[draggable]').forEach(function(n) {
      n.removeAttribute('draggable');
      if (n.dataset) delete n.dataset.dsrDrag;
    });
    // Remove canvasify tracking attributes added by canvasifyBody / drag-end.
    root.querySelectorAll('[data-cv-body]').forEach(function(n) { if (n.dataset) delete n.dataset.cvBody; });
    root.querySelectorAll('[data-cv-user-moved]').forEach(function(n) { if (n.dataset) delete n.dataset.cvUserMoved; });
  }

  function postUpdate() {
    var clone = document.documentElement.cloneNode(true);
    cleanDesignerArtifacts(clone);
    window.parent.postMessage(
      { type: 'DESIGNER_DOM_UPDATED', html: '<!DOCTYPE html>\\n' + clone.outerHTML }, '*'
    );
  }

  function snapshotForUndo() {
    var snap = [];
    Array.prototype.forEach.call(document.body.children, function(child) {
      if (isDesignerUi(child) || (child.className && (child.className.indexOf('__dsr-drag-ghost') !== -1 || child.className.indexOf('__dsr-resize-ghost') !== -1))) return;
      snap.push(child.outerHTML);
    });
    undoStack.push(snap);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function applyUndo() {
    if (!undoStack.length) return;
    var snap = undoStack.pop();
    var toRemove = [];
    Array.prototype.forEach.call(document.body.children, function(child) {
      if (!isDesignerUi(child)) toRemove.push(child);
    });
    toRemove.forEach(function(el) { el.remove(); });
    var tmp = document.createElement('div');
    tmp.innerHTML = snap.join('\\n');
    var tb = document.getElementById('__dsr-toolbar');
    while (tmp.firstChild) {
      var node = tmp.firstChild;
      tmp.removeChild(node);
      if (tb) document.body.insertBefore(node, tb);
      else document.body.appendChild(node);
    }
    selectedEl = null; selectedEls = [];
    resizeState = null;
    if (resizeGhost && resizeGhost.parentNode) { resizeGhost.parentNode.removeChild(resizeGhost); resizeGhost = null; }
    removeResizeOverlay();
    if (tb) tb.style.display = 'none';
    propsPanelOpen = false;
    window.parent.postMessage({ type: 'DESIGNER_PROPS_CLOSE' }, '*');
    postUpdate();
  }

  // 閳光偓閳光偓 Resize overlay (8 handles: corners + mid-edges) 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function removeResizeOverlay() {
    if (resizeOverlay) { resizeOverlay.remove(); resizeOverlay = null; }
  }

  function updateResizeOverlay() {
    if (!resizeOverlay || !selectedEl) return;
    var r = selectedEl.getBoundingClientRect();
    var sX = window.scrollX || document.documentElement.scrollLeft || 0;
    var sY = window.scrollY || document.documentElement.scrollTop  || 0;
    resizeOverlay.style.left   = (r.left + sX) + 'px';
    resizeOverlay.style.top    = (r.top  + sY) + 'px';
    resizeOverlay.style.width  = r.width  + 'px';
    resizeOverlay.style.height = r.height + 'px';
  }

  function createResizeOverlay(el) {
    removeResizeOverlay();
    var r = el.getBoundingClientRect();
    var sX = window.scrollX || document.documentElement.scrollLeft || 0;
    var sY = window.scrollY || document.documentElement.scrollTop  || 0;
    resizeOverlay = document.createElement('div');
    resizeOverlay.id = '__dsr-resize-overlay';
    resizeOverlay.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483644;box-sizing:border-box;outline:2px solid #38bdf8;outline-offset:-1px';
    resizeOverlay.style.left   = (r.left + sX) + 'px';
    resizeOverlay.style.top    = (r.top  + sY) + 'px';
    resizeOverlay.style.width  = r.width  + 'px';
    resizeOverlay.style.height = r.height + 'px';
    [
      {id:'nw', s:'left:-5px;top:-5px;cursor:nw-resize'},
      {id:'n',  s:'left:calc(50% - 5px);top:-5px;cursor:n-resize'},
      {id:'ne', s:'right:-5px;top:-5px;cursor:ne-resize'},
      {id:'e',  s:'right:-5px;top:calc(50% - 5px);cursor:e-resize'},
      {id:'se', s:'right:-5px;bottom:-5px;cursor:se-resize'},
      {id:'s',  s:'left:calc(50% - 5px);bottom:-5px;cursor:s-resize'},
      {id:'sw', s:'left:-5px;bottom:-5px;cursor:sw-resize'},
      {id:'w',  s:'left:-5px;top:calc(50% - 5px);cursor:w-resize'}
    ].forEach(function(d) {
      var h = document.createElement('div');
      h.dataset.rh = d.id;
      h.style.cssText = 'position:absolute;width:10px;height:10px;background:#38bdf8;border:2px solid white;border-radius:2px;pointer-events:auto;box-sizing:border-box;' + d.s;
      resizeOverlay.appendChild(h);
    });
    document.body.appendChild(resizeOverlay);
  }

  // 閳光偓閳光偓 Toolbar placement 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function getMobileToolbarPayload(visible) {
    return {
      type: 'DESIGNER_MOBILE_TOOLBAR',
      visible: !!visible,
      tag: selectedEl ? selectedEl.tagName : '',
      selectMode: selectMode,
      canGroup: selectedEls.length > 1,
      canUngroup: !!(selectedEl && selectedEl.dataset && selectedEl.dataset.dsrGroup),
      groupCount: selectedEls.length,
      isLocked: !!(selectedEl && selectedEl.dataset && selectedEl.dataset.dsrLocked),
    };
  }

  function placeToolbar() {
    if (!selectedEl) return;
    var toolbar = document.getElementById('__dsr-toolbar');
    if (!toolbar) return;
    var rect = selectedEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    // Always relay toolbar state to the React parent so it renders the toolbar
    // OUTSIDE the iframe — the in-iframe toolbar is never displayed so it never
    // obscures the preview canvas.
    toolbar.style.display = 'none';
    window.parent.postMessage(getMobileToolbarPayload(true), '*');
    var tagEl = document.getElementById('__dt-tag');
    if (tagEl) tagEl.innerText = selectedEl.tagName;
    updateResizeOverlay();
  }

  function updateGroupBtn() {
    var btn = document.getElementById('__dt-group');
    if (!btn) return;
    if (selectedEls.length > 1) {
      btn.style.display = 'inline-block';
      btn.style.background = '#1d4ed8';
      btn.style.color = '#bfdbfe';
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.textContent = 'Group (' + selectedEls.length + ')';
    } else if (selectedEl && selectedEl.dataset && selectedEl.dataset.dsrGroup) {
      btn.style.display = 'inline-block';
      btn.style.background = '#1d4ed8';
      btn.style.color = '#bfdbfe';
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.textContent = 'Ungroup';
    } else {
      // Always visible but dimmed/disabled when not applicable
      btn.style.display = 'inline-block';
      btn.style.background = '#292524';
      btn.style.color = '#71717a';
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      btn.textContent = 'Group';
    }
    updateSelectBar();
  }

  function updateLockBtn() {
    var btn = document.getElementById('__dt-lock');
    if (!btn) return;
    var locked = selectedEl && selectedEl.dataset && selectedEl.dataset.dsrLocked;
    if (locked) {
      btn.textContent = '🔒 Locked';
      btn.style.background = '#7c2d12';
      btn.style.color = '#fca5a5';
    } else {
      btn.textContent = '🔓 Lock';
      btn.style.background = '#1c1917';
      btn.style.color = '#d6d3d1';
    }
  }

  function selectElement(el) {
    if (!el) return;
    // Clear any multi-select highlight
    selectedEls.forEach(function(e) { e.classList.remove('dsr-selected'); });
    selectedEls = [];
    if (selectedEl) selectedEl.classList.remove('dsr-selected');
    selectedEl = el;
    selectedEl.classList.add('dsr-selected');
    placeToolbar();
    createResizeOverlay(el);
    updateGroupBtn();
    updateLockBtn();
    // Always open/refresh the props panel on element selection (Visily-like behaviour)
    openPropsPanel();
  }

  // ★★ Toolbar & layer button handler — registered at WINDOW capture level so it
  // fires before any FP-page document-level handlers that might call
  // stopImmediatePropagation() and block our onclick events on pages 2+.
  function getSiblingZIndexes() {
    var result = [];
    if (!selectedEl || !selectedEl.parentNode) return result;
    Array.prototype.forEach.call(selectedEl.parentNode.children, function(el) {
      if (el === selectedEl || isDesignerUi(el)) return;
      var z = parseInt(getComputedStyle(el).zIndex, 10);
      if (!isNaN(z)) result.push(z);
    });
    return result;
  }

  function updateSelectBar() {
    var btn = document.getElementById('__dt-selectmode');
    if (btn) {
      btn.style.background = selectMode ? '#f59e0b' : '#292524';
      btn.style.color = selectMode ? '#0c0a09' : '#f59e0b';
      btn.textContent = selectMode ? '☑ Select' : '☐ Select';
    }
  }

  function handleBtnClick(id) {
    switch (id) {
      case '__dt-parent': {
        var p = selectedEl && selectedEl.parentElement;
        if (p && p !== document.body && p !== document.documentElement) selectElement(p);
        break;
      }
      case '__dt-edit': {
        if (!selectedEl) break;
        // Send edit request to parent window — the modal renders OUTSIDE the iframe
        // so it is always visible regardless of mobile scale/clipping.
        textEditTarget = selectedEl;
        window.parent.postMessage({
          type: 'DESIGNER_TEXT_EDIT_REQUEST',
          text: (selectedEl.innerText || selectedEl.textContent || '').trim()
        }, '*');
        break;
      }
      case '__dsr-edit-apply': {
        // Legacy path (kept for safety — won't normally fire since modal is now outside iframe).
        var inp2 = document.getElementById('__dsr-edit-input');
        if (selectedEl && inp2) { snapshotForUndo(); selectedEl.innerText = inp2.value; postUpdate(); }
        var editModal2 = document.getElementById('__dsr-edit-modal');
        if (editModal2) editModal2.style.display = 'none';
        break;
      }
      case '__dt-layout': {
        if (!selectedEl) break;
        openPropsPanel();
        break;
      }
      case '__dt-save': {
        if (!selectedEl) break;
        window.parent.postMessage({ type: 'DESIGNER_SAVE_COMPONENT', html: selectedEl.outerHTML, tagName: selectedEl.tagName }, '*');
        break;
      }
      case '__dt-savelayout': {
        window.parent.postMessage({ type: 'DESIGNER_SAVE_LAYOUT' }, '*');
        break;
      }
      case '__dt-group': {
        if (!selectedEl) break;
        // Guard: do nothing if there is nothing to group or ungroup.
        if (selectedEls.length <= 1 && !(selectedEl.dataset && selectedEl.dataset.dsrGroup)) break;
        snapshotForUndo();
        if (selectedEls.length > 1) {
          var bodyRect = document.body.getBoundingClientRect();
          var minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
          selectedEls.forEach(function(el) {
            var r = el.getBoundingClientRect();
            minL = Math.min(minL, r.left - bodyRect.left);
            minT = Math.min(minT, r.top  - bodyRect.top);
            maxR = Math.max(maxR, r.right  - bodyRect.left);
            maxB = Math.max(maxB, r.bottom - bodyRect.top);
          });
          var wrapW = maxR - minL, wrapH = maxB - minT;
          var wrapper = document.createElement('div');
          wrapper.dataset.dsrGroup = '1';
          wrapper.style.cssText = 'display:block;position:absolute;left:' + minL + 'px;top:' + minT + 'px;width:' + wrapW + 'px;height:' + wrapH + 'px;overflow:visible;margin:0;box-sizing:border-box';
          document.body.insertBefore(wrapper, selectedEls[0]);
          selectedEls.forEach(function(el) {
            el.classList.remove('dsr-selected');
            var r = el.getBoundingClientRect();
            el.style.position = 'absolute';
            el.style.left = (r.left - bodyRect.left - minL) + 'px';
            el.style.top  = (r.top  - bodyRect.top  - minT) + 'px';
            el.style.width = r.width + 'px';
            el.style.margin = '0';
            el.style.boxSizing = 'border-box';
            wrapper.appendChild(el);
          });
          selectedEls = [];
          selectElement(wrapper);
          postUpdate();
        } else if (selectedEl && selectedEl.dataset && selectedEl.dataset.dsrGroup) {
          var par = selectedEl.parentNode;
          Array.prototype.slice.call(selectedEl.children).forEach(function(child) {
            par.insertBefore(child, selectedEl);
          });
          selectedEl.remove(); selectedEl = null;
          removeResizeOverlay();
          var tb0 = document.getElementById('__dsr-toolbar');
          if (tb0) tb0.style.display = 'none';
          window.parent.postMessage({ type: 'DESIGNER_MOBILE_TOOLBAR', visible: false }, '*');
          postUpdate();
        }
        break;
      }
      case '__dt-del': {
        if (!selectedEl) break;
        var delModal = document.getElementById('__dsr-delete-modal');
        if (delModal) delModal.style.display = 'flex';
        break;
      }
      case '__dt-confirm-del': {
        if (selectedEl) {
          snapshotForUndo();
          selectedEl.remove(); selectedEl = null;
          removeResizeOverlay();
          var tb1 = document.getElementById('__dsr-toolbar');
          if (tb1) tb1.style.display = 'none';
          window.parent.postMessage({ type: 'DESIGNER_MOBILE_TOOLBAR', visible: false }, '*');
          updateGroupBtn();
          postUpdate();
        }
        var delModal2 = document.getElementById('__dsr-delete-modal');
        if (delModal2) delModal2.style.display = 'none';
        break;
      }
      case '__dt-close': {
        if (selectedEl) selectedEl.classList.remove('dsr-selected');
        selectedEls.forEach(function(el) { el.classList.remove('dsr-selected'); });
        selectedEl = null; selectedEls = [];
        removeResizeOverlay();
        var tb2 = document.getElementById('__dsr-toolbar');
        if (tb2) tb2.style.display = 'none';
        updateGroupBtn();
        // Always hide the React-side external toolbar when closing
        window.parent.postMessage({ type: 'DESIGNER_MOBILE_TOOLBAR', visible: false }, '*');
        break;
      }
      case '__dt-bfront': {
        if (!selectedEl) break;
        snapshotForUndo();
        // z-index only works on positioned elements; ensure at least relative.
        if (getComputedStyle(selectedEl).position === 'static') selectedEl.style.position = 'relative';
        var zs1 = getSiblingZIndexes();
        // Normalise siblings that lack an explicit z-index so the ordering is reliable.
        if (!zs1.length) {
          Array.prototype.forEach.call(selectedEl.parentNode ? selectedEl.parentNode.children : [], function(sib) {
            if (sib === selectedEl || isDesignerUi(sib)) return;
            var sc = getComputedStyle(sib);
            if (sc.position === 'static') sib.style.position = 'relative';
            if (sc.zIndex === 'auto' || isNaN(parseInt(sc.zIndex, 10))) sib.style.zIndex = '0';
          });
          zs1 = getSiblingZIndexes();
        }
        selectedEl.style.zIndex = String((zs1.length ? Math.max.apply(null, zs1) : 0) + 1);
        postUpdate();
        break;
      }
      case '__dt-fwd': {
        if (!selectedEl) break;
        snapshotForUndo();
        if (getComputedStyle(selectedEl).position === 'static') selectedEl.style.position = 'relative';
        var cur1 = parseInt(getComputedStyle(selectedEl).zIndex, 10);
        selectedEl.style.zIndex = String((isNaN(cur1) ? 0 : cur1) + 1);
        postUpdate();
        break;
      }
      case '__dt-bwd': {
        if (!selectedEl) break;
        snapshotForUndo();
        if (getComputedStyle(selectedEl).position === 'static') selectedEl.style.position = 'relative';
        var cur2 = parseInt(getComputedStyle(selectedEl).zIndex, 10);
        selectedEl.style.zIndex = String((isNaN(cur2) ? 0 : cur2) - 1);
        postUpdate();
        break;
      }
      case '__dt-bback': {
        if (!selectedEl) break;
        snapshotForUndo();
        if (getComputedStyle(selectedEl).position === 'static') selectedEl.style.position = 'relative';
        var zs2 = getSiblingZIndexes();
        if (!zs2.length) {
          Array.prototype.forEach.call(selectedEl.parentNode ? selectedEl.parentNode.children : [], function(sib) {
            if (sib === selectedEl || isDesignerUi(sib)) return;
            var sc = getComputedStyle(sib);
            if (sc.position === 'static') sib.style.position = 'relative';
            if (sc.zIndex === 'auto' || isNaN(parseInt(sc.zIndex, 10))) sib.style.zIndex = '0';
          });
          zs2 = getSiblingZIndexes();
        }
        selectedEl.style.zIndex = String((zs2.length ? Math.min.apply(null, zs2) : 0) - 1);
        postUpdate();
        break;
      }
      case '__dt-lock': {
        if (!selectedEl) break;
        snapshotForUndo();
        if (selectedEl.dataset.dsrLocked) {
          delete selectedEl.dataset.dsrLocked;
        } else {
          selectedEl.dataset.dsrLocked = '1';
        }
        updateLockBtn();
        // Refresh React toolbar so the button toggles between Lock/Unlock immediately.
        window.parent.postMessage(getMobileToolbarPayload(true), '*');
        postUpdate();
        break;
      }
      case '__dt-selectmode': {
        selectMode = !selectMode;
        if (selectMode) {
          // Entering select mode — immediately add the currently focused element so the
          // user sees instant feedback rather than having to click a second time.
          if (selectedEl && selectedEls.indexOf(selectedEl) === -1) {
            selectedEl.classList.add('dsr-selected');
            selectedEls.push(selectedEl);
          }
        } else {
          // Leaving select mode — clear the multi-selection
          selectedEls.forEach(function(e) { e.classList.remove('dsr-selected'); });
          selectedEls = [];
        }
        updateSelectBar();
        updateGroupBtn();
        // Refresh React toolbar so Select button toggles and Group button updates immediately.
        window.parent.postMessage(getMobileToolbarPayload(true), '*');
        break;
      }
    }
  }

  // Undo keyboard shortcut
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      applyUndo();
    }
  }, true);

  // 閳光偓閳光偓 Properties Panel 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function rgbToHex(rgb) {
    var m = (rgb || '').match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return '#000000';
    return '#' + [m[1],m[2],m[3]].map(function(x) {
      return parseInt(x,10).toString(16).padStart(2,'0');
    }).join('');
  }
  function hexToRgba(hex, opacity) {
    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+opacity+')';
  }
  function parseAlpha(rgb) {
    var m = (rgb || '').match(/rgba?\\(\\d+,\\s*\\d+,\\s*\\d+,?\\s*([0-9.]+)?/);
    return (m && m[1] !== undefined) ? parseFloat(m[1]) : 1;
  }

  function openPropsPanel() {
    if (!selectedEl) return;
    var el = selectedEl;
    // Temporarily remove selection highlight so getComputedStyle reads true background-color.
    // IMPORTANT: getComputedStyle() returns a LIVE CSSStyleDeclaration in most browsers —
    // if we re-add the class before reading values, the object reflects the class styles.
    // Solution: snapshot every needed value into plain strings before re-adding the class.
    el.classList.remove('dsr-selected');
    var cs = getComputedStyle(el);
    var snap = {
      bg:       cs.backgroundColor,
      bdColor:  cs.borderTopColor,
      bdWidth:  cs.borderTopWidth,
      bdStyle:  cs.borderTopStyle,
      rTL: cs.borderTopLeftRadius,
      rTR: cs.borderTopRightRadius,
      rBR: cs.borderBottomRightRadius,
      rBL: cs.borderBottomLeftRadius,
      shadow:   cs.boxShadow,
      filter:   cs.filter,
      bdf:      cs.backdropFilter || cs.webkitBackdropFilter || '',
    };
    el.classList.add('dsr-selected');
    // Position & Size (use BCR so scaled elements show visual size)
    var r = el.getBoundingClientRect();
    var par = el.parentElement || document.body;
    var parR = par.getBoundingClientRect();
    var x = (el.style.position === 'absolute') ? parseFloat(el.style.left || '0') : Math.round(r.left - parR.left);
    var y = (el.style.position === 'absolute') ? parseFloat(el.style.top  || '0') : Math.round(r.top  - parR.top);
    // Parse shadow from snapshot
    var sh = snap.shadow || '';
    var shOn = !!(sh && sh !== 'none');
    var shX = 0, shY = 4, shBl = 8, shSp = 0, shCol = '#000000', shAlpha = 0.3;
    if (shOn) {
      var sm = sh.match(/(-?[0-9.]+)px\\s+(-?[0-9.]+)px\\s+([0-9.]+)px\\s+(-?[0-9.]+)px/);
      if (sm) { shX = parseFloat(sm[1]); shY = parseFloat(sm[2]); shBl = parseFloat(sm[3]); shSp = parseFloat(sm[4]); }
      var shCm = sh.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (shCm) shCol = rgbToHex('rgb('+shCm[1]+','+shCm[2]+','+shCm[3]+')');
      shAlpha = parseAlpha(sh);
    }
    // Parse blur from snapshot
    var blurM = snap.filter.match(/blur\\(([0-9.]+)px\\)/);
    var blurPx = blurM ? parseFloat(blurM[1]) : 0;
    var bdM = snap.bdf.match(/blur\\(([0-9.]+)px\\)/);
    var bdPx = bdM ? parseFloat(bdM[1]) : 0;
    // Font size — read from element inline style first, fall back to computed
    var fsPx = parseFloat(el.style.fontSize) || parseFloat(cs.fontSize) || 14;
    // Send all data to React parent panel
    propsPanelOpen = true;
    window.parent.postMessage({
      type: 'DESIGNER_OPEN_PROPS',
      data: {
        tagName: el.tagName,
        x: Math.round(x), y: Math.round(y),
        w: Math.round(r.width), h: Math.round(r.height),
        opacity: (parseFloat(el.style.opacity !== '' ? el.style.opacity : '1') || 1),
        fillColor: rgbToHex(snap.bg),
        fillOpacity: parseAlpha(snap.bg),
        borderColor: rgbToHex(snap.bdColor || ''),
        borderWidth: Math.round(parseFloat(snap.bdWidth) || 0),
        borderStyle: snap.bdStyle || 'none',
        cornerTL: Math.round(parseFloat(snap.rTL) || 0),
        cornerTR: Math.round(parseFloat(snap.rTR) || 0),
        cornerBR: Math.round(parseFloat(snap.rBR) || 0),
        cornerBL: Math.round(parseFloat(snap.rBL) || 0),
        shadowOn: shOn,
        shadowX: shX, shadowY: shY, shadowBlur: shBl, shadowSpread: shSp,
        shadowColor: shCol, shadowOpacity: shAlpha,
        blurPx: blurPx,
        backdropBlurPx: bdPx,
        fontSize: Math.round(fsPx),
        isAbsolute: el.style.position === 'absolute'
      }
    }, '*');
  }

  function applyPropsFromData(d) {
    if (!selectedEl) return;
    snapshotForUndo();
    var el = selectedEl;
    // Clear any CSS transform first so W/H apply at raw pixel values
    if (el.style.transform) {
      var bcr = el.getBoundingClientRect();
      el.style.transform = '';
      delete el.dataset.resizeOriginalW;
      delete el.dataset.resizeOriginalH;
      el.style.width  = bcr.width  + 'px';
      el.style.height = bcr.height + 'px';
    }
    if (!isNaN(d.w) && d.w > 0) { el.style.width  = d.w + 'px'; el.style.minWidth  = '0'; }
    if (!isNaN(d.h) && d.h > 0) { el.style.height = d.h + 'px'; el.style.minHeight = '0'; }
    // Only move if already absolute — avoids coordinate-space mismatch
    if (el.style.position === 'absolute') {
      if (!isNaN(d.x)) el.style.left = d.x + 'px';
      if (!isNaN(d.y)) el.style.top  = d.y + 'px';
    }
    el.style.opacity = String(d.opacity != null ? d.opacity : 1);
    if (d.clearFill) {
      el.style.backgroundColor = '';
    } else {
      el.style.backgroundColor = hexToRgba(d.fillColor || '#ffffff', d.fillOpacity != null ? d.fillOpacity : 1);
    }
    if (!d.borderStyle || d.borderStyle === 'none') {
      el.style.border = 'none';
    } else {
      el.style.border = (d.borderWidth || 1) + 'px ' + d.borderStyle + ' ' + (d.borderColor || '#000000');
    }
    el.style.borderRadius = (d.cornerTL||0)+'px '+(d.cornerTR||0)+'px '+(d.cornerBR||0)+'px '+(d.cornerBL||0)+'px';
    if (d.shadowOn) {
      el.style.boxShadow = (d.shadowX||0)+'px '+(d.shadowY||4)+'px '+(d.shadowBlur||8)+'px '+(d.shadowSpread||0)+'px '+hexToRgba(d.shadowColor||'#000000', d.shadowOpacity != null ? d.shadowOpacity : 0.3);
    } else {
      el.style.boxShadow = 'none';
    }
    el.style.filter = d.blurPx > 0 ? 'blur('+d.blurPx+'px)' : '';
    if (d.backdropBlurPx > 0) {
      el.style.backdropFilter = 'blur('+d.backdropBlurPx+'px)';
      el.style.webkitBackdropFilter = 'blur('+d.backdropBlurPx+'px)';
    } else {
      el.style.backdropFilter = '';
      el.style.webkitBackdropFilter = '';
    }
    if (d.fontSize > 0) el.style.fontSize = d.fontSize + 'px';
    placeToolbar();
    updateResizeOverlay();
    openPropsPanel(); // refresh panel with actual applied values
    postUpdate();
  }

  // Props panel dup action — triggered via postMessage from React
  function handlePropsDup() {
    if (!selectedEl) return;
    var clone = selectedEl.cloneNode(true);
    clone.style.left = (parseFloat(selectedEl.style.left || '0') + 20) + 'px';
    clone.style.top  = (parseFloat(selectedEl.style.top  || '0') + 20) + 'px';
    clone.style.position = 'absolute';
    (selectedEl.parentNode || document.body).appendChild(clone);
    selectElement(clone);
    openPropsPanel();
    postUpdate();
  }

  // 閳光偓閳光偓 Hover / click 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  document.addEventListener('mouseover', function(e) {
    if (isDesignerUi(e.target) || e.target === document.body || e.target === document.documentElement) return;
    if (hoveredEl && hoveredEl !== e.target) hoveredEl.classList.remove('dsr-hovered');
    hoveredEl = e.target;
    hoveredEl.classList.add('dsr-hovered');
  }, true);
  document.addEventListener('mouseout', function(e) {
    if (hoveredEl && (!e.relatedTarget || !hoveredEl.contains(e.relatedTarget))) {
      hoveredEl.classList.remove('dsr-hovered'); hoveredEl = null;
    }
  }, true);
  // ★★ Click handler at WINDOW capture level — fires before any document-level
  // handlers that FP-page scripts might register with stopImmediatePropagation.
  // This guarantees toolbar buttons always work even on FP pages 2+.
  window.addEventListener('click', function(e) {
    // Toolbar / designer-UI buttons: handle here with highest priority and stop
    // propagation so the FP page cannot interfere.
    if (isDesignerUi(e.target)) {
      var btn = null;
      if (e.target && e.target.id &&
          (e.target.id.indexOf('__dt-') === 0 || e.target.id === '__dsr-edit-apply')) {
        btn = e.target;
      } else if (e.target && e.target.closest) {
        btn = e.target.closest('[id^="__dt-"],[id="__dsr-edit-apply"]');
      }
      if (btn) {
        e.stopImmediatePropagation();
        e.preventDefault();
        handleBtnClick(btn.id);
      }
      return; // don't process other designer-UI clicks (modals, overlays, etc.)
    }
    // Content element clicks: intercept before FP page scripts and select.
    if (justDragged) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.target === document.body || e.target === document.documentElement) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.shiftKey || selectMode) {
      // Shift-click or Select mode: toggle element in multi-selection for grouping.
      // Prefer the DEEPEST block element actually clicked — only skip past pure
      // inline/formatting tags (span, b, i, etc.) and designer-UI chrome.
      // Using the old isDraggable walk-up would overshoot past child components
      // and land on the parent container instead.
      var t = e.target;
      var _skipInlineSel = {span:1,b:1,i:1,strong:1,em:1,small:1,br:1,hr:1,u:1,s:1,abbr:1,code:1,wbr:1};
      while (t && t !== document.body &&
             (isDesignerUi(t) || !t.tagName || _skipInlineSel[t.tagName.toLowerCase()])) {
        t = t.parentElement;
      }
      if (!t || t === document.body || isDesignerUi(t)) { updateGroupBtn(); return; }
      var idx = selectedEls.indexOf(t);
      if (idx === -1) { t.classList.add('dsr-selected'); selectedEls.push(t); }
      else { t.classList.remove('dsr-selected'); selectedEls.splice(idx, 1); }
      // Keep toolbar anchored to the last multi-selected element
      if (selectedEls.length > 0) {
        selectedEl = selectedEls[selectedEls.length - 1];
        placeToolbar();
      }
      updateGroupBtn();
    } else {
      // Walk up to the nearest draggable ancestor before selecting.
      var tgt = e.target;
      while (tgt && tgt !== document.body && !isDraggable(tgt)) tgt = tgt.parentElement;
      if (tgt && isDraggable(tgt)) selectElement(tgt);
    }
  }, true);

  // 閳光偓閳光偓 Free drag + resize via document-level mouse events 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function setupDragOnElement(el) { /* no-op */ }
  function setupAllDrag() { /* no-op */ }

  window.addEventListener('mousedown', function(e) {
    // 閳光偓閳光偓 Resize handle? 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
    var rh = (e.target && e.target.dataset && e.target.dataset.rh) ? e.target
           : (e.target && e.target.closest ? e.target.closest('[data-rh]') : null);
    if (rh && selectedEl) {
      // Don't resize locked elements
      if (selectedEl.dataset && selectedEl.dataset.dsrLocked) { e.preventDefault(); return; }
      snapshotForUndo();
      var r = selectedEl.getBoundingClientRect();
      // If this element was previously scaled via CSS transform (from a prior resize),
      // temporarily clear the transform and set logical size = visual BCR size.
      // This ensures drag calculations (startW, dx→newW) work in visual pixels,
      // so the resize handles track the mouse correctly during the drag.
      if (selectedEl.dataset.resizeOriginalW && selectedEl.style.transform) {
        selectedEl.style.transform = '';
        selectedEl.style.width  = r.width  + 'px';
        selectedEl.style.height = r.height + 'px';
        // Reset stored originals so this resize chain starts fresh from the
        // current visual size (the previous transform has been cleared above).
        delete selectedEl.dataset.resizeOriginalW;
        delete selectedEl.dataset.resizeOriginalH;
      }
      // Ensure element is absolute before resizing
      var initL, initT;
      if (selectedEl.style.position === 'absolute') {
        initL = parseFloat(selectedEl.style.left || '0');
        initT = parseFloat(selectedEl.style.top  || '0');
      } else {
        var par = selectedEl.parentElement || document.body;
        var parRect = par.getBoundingClientRect();
        var parSty  = getComputedStyle(par);
        var rBL = parseFloat(parSty.borderLeftWidth) || 0;
        var rBT = parseFloat(parSty.borderTopWidth)  || 0;
        initL = r.left - parRect.left - rBL + (par.scrollLeft || 0);
        initT = r.top  - parRect.top  - rBT + (par.scrollTop  || 0);
        // Snapshot all in-flow siblings BEFORE any writes (reads-before-writes).
        var sibSnaps = [];
        if (par !== document.body) {
          Array.prototype.slice.call(par.children).forEach(function(sib) {
            if (sib === selectedEl || isDesignerUi(sib)) return;
            var sibCS2 = getComputedStyle(sib);
            if (sibCS2.position === 'absolute' || sibCS2.position === 'fixed') return;
            sibSnaps.push({ el: sib, rect: sib.getBoundingClientRect() });
          });
        }
        if (par !== document.body && parSty.position === 'static') par.style.position = 'relative';
        selectedEl.style.position = 'absolute';
        selectedEl.style.zIndex   = '9999';
        selectedEl.style.margin   = '0';
        selectedEl.style.width    = r.width + 'px';
        selectedEl.style.left     = initL + 'px';
        selectedEl.style.top      = initT + 'px';
        // Freeze siblings at their captured positions so the parent doesn't
        // reflow when the element leaves the normal flow. No ghost needed.
        if (par !== document.body && parRect.height > 0) par.style.minHeight = parRect.height + 'px';
        sibSnaps.forEach(function(snap) {
          snap.el.style.position  = 'absolute';
          snap.el.style.left      = (snap.rect.left - parRect.left - rBL) + 'px';
          snap.el.style.top       = (snap.rect.top  - parRect.top  - rBT) + 'px';
          snap.el.style.width     = snap.rect.width + 'px';
          snap.el.style.margin    = '0';
          snap.el.style.boxSizing = 'border-box';
        });
      }
      resizeState = {
        el: selectedEl, dir: rh.dataset.rh,
        startX: e.clientX, startY: e.clientY,
        startW: r.width, startH: r.height,
        startLeft: initL, startTop: initT,
        groupChildren: null
      };
      e.preventDefault(); e.stopPropagation(); return;
    }

    // 閳光偓閳光偓 Free drag 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
    if (isDesignerUi(e.target)) return;
    // Rubber-band selection: click on empty body → draw selection rect
    if (e.target === document.body || e.target === document.documentElement) {
      if (selectedEl) selectedEl.classList.remove('dsr-selected');
      selectedEls.forEach(function(el) { el.classList.remove('dsr-selected'); });
      selectedEl = null; selectedEls = [];
      removeResizeOverlay();
      var tb2 = document.getElementById('__dsr-toolbar'); if (tb2) tb2.style.display = 'none';
      window.parent.postMessage({ type: 'DESIGNER_MOBILE_TOOLBAR', visible: false }, '*');
      var sX2 = window.scrollX || 0, sY2 = window.scrollY || 0;
      rubberBand = { startX: e.clientX + sX2, startY: e.clientY + sY2 };
      rubberBandEl = document.createElement('div');
      rubberBandEl.id = '__dsr-rubber';
      rubberBandEl.style.cssText = 'position:absolute;border:1.5px dashed #3b82f6;background:rgba(59,130,246,0.07);pointer-events:none;z-index:2147483645;box-sizing:border-box;border-radius:2px';
      rubberBandEl.style.left = rubberBand.startX + 'px';
      rubberBandEl.style.top  = rubberBand.startY + 'px';
      rubberBandEl.style.width = '0'; rubberBandEl.style.height = '0';
      document.body.appendChild(rubberBandEl);
      e.preventDefault(); return;
    }
    var el = e.target;
    while (el && el !== document.body && !isDraggable(el)) el = el.parentElement;
    if (!el || !isDraggable(el)) return;
    // Don't drag locked elements
    if (el.dataset && el.dataset.dsrLocked) return;
    // In select mode: start a PENDING rubber-band instead of dragging.
    // We don't create the visible rect yet — we wait until the mouse moves >4 px
    // so that a plain click can still fall through to the click handler and
    // toggle-select the individual element the user tapped.
    if (selectMode) {
      rubberBand = { startX: e.clientX + (window.scrollX || 0), startY: e.clientY + (window.scrollY || 0) };
      // Intentionally NO e.preventDefault() — the click event must still fire
      // for zero-movement taps (click-to-select individual elements).
      return;
    }

    var r = el.getBoundingClientRect();
    var par = el.parentElement || document.body;
    var parRect = par.getBoundingClientRect();
    var parSty  = getComputedStyle(par);
    var bL = parseFloat(parSty.borderLeftWidth) || 0;
    var bT = parseFloat(parSty.borderTopWidth)  || 0;
    // Position relative to parent's content area — the correct origin once we
    // make the parent a positioning context and set position:absolute.
    var curLeft = (el.style.position === 'absolute')
      ? parseFloat(el.style.left || '0')
      : r.left - parRect.left - bL + (par.scrollLeft || 0);
    var curTop = (el.style.position === 'absolute')
      ? parseFloat(el.style.top  || '0')
      : r.top  - parRect.top  - bT + (par.scrollTop  || 0);
    freeDrag = {
      el: el, par: par,
      startX: e.clientX, startY: e.clientY,
      initLeft: curLeft, initTop: curTop,
      initBCRLeft: r.left, initBCRTop: r.top,
      width: r.width, height: r.height,
      moved: false, clone: null, ghost: null, lastDx: 0, lastDy: 0
    };
    isDragging = true;
  }, true);

  window.addEventListener('mousemove', function(e) {
    // 閳光偓閳光偓 Rubber band 閳光偓
    // Materialise a pending select-mode rubber-band once the drag threshold is crossed.
    if (rubberBand && !rubberBandEl) {
      var _sXp = window.scrollX || 0, _sYp = window.scrollY || 0;
      var _cxp = e.clientX + _sXp, _cyp = e.clientY + _sYp;
      if (Math.abs(_cxp - rubberBand.startX) + Math.abs(_cyp - rubberBand.startY) > 4) {
        // Clear current selection and create the visible rubber-band rect.
        selectedEls.forEach(function(el) { el.classList.remove('dsr-selected'); });
        if (selectedEl) selectedEl.classList.remove('dsr-selected');
        selectedEl = null; selectedEls = [];
        removeResizeOverlay();
        var _tbR = document.getElementById('__dsr-toolbar'); if (_tbR) _tbR.style.display = 'none';
        rubberBandEl = document.createElement('div');
        rubberBandEl.id = '__dsr-rubber';
        rubberBandEl.style.cssText = 'position:absolute;border:1.5px dashed #3b82f6;background:rgba(59,130,246,0.07);pointer-events:none;z-index:2147483645;box-sizing:border-box;border-radius:2px';
        rubberBandEl.style.left = rubberBand.startX + 'px';
        rubberBandEl.style.top  = rubberBand.startY + 'px';
        rubberBandEl.style.width = '0'; rubberBandEl.style.height = '0';
        document.body.appendChild(rubberBandEl);
      }
    }
    if (rubberBand && rubberBandEl) {
      var sX3 = window.scrollX || 0, sY3 = window.scrollY || 0;
      var cx = e.clientX + sX3, cy = e.clientY + sY3;
      var l = Math.min(rubberBand.startX, cx), t = Math.min(rubberBand.startY, cy);
      rubberBandEl.style.left   = l + 'px';
      rubberBandEl.style.top    = t + 'px';
      rubberBandEl.style.width  = Math.abs(cx - rubberBand.startX) + 'px';
      rubberBandEl.style.height = Math.abs(cy - rubberBand.startY) + 'px';
      e.preventDefault(); return;
    }
    // 閳光偓閳光偓 Resize 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
    if (resizeState) {
      var dx = e.clientX - resizeState.startX;
      var dy = e.clientY - resizeState.startY;
      var dir = resizeState.dir;
      var newW = resizeState.startW, newH = resizeState.startH;
      var newL = resizeState.startLeft, newT = resizeState.startTop;
      if (dir.indexOf('e') !== -1) newW = Math.max(40, resizeState.startW + dx);
      if (dir.indexOf('s') !== -1) newH = Math.max(24, resizeState.startH + dy);
      if (dir.indexOf('w') !== -1) { newW = Math.max(40, resizeState.startW - dx); newL = resizeState.startLeft + resizeState.startW - newW; }
      if (dir.indexOf('n') !== -1) { newH = Math.max(24, resizeState.startH - dy); newT = resizeState.startTop  + resizeState.startH - newH; }
      var rel = resizeState.el;
      // Directly resize the CSS box during drag. Siblings are already frozen to
      // absolute in mousedown so there is no reflow. overflow:hidden clips children
      // during the live drag; at mouseup a transform:scale is applied instead so
      // all children scale proportionally as a visual unit (no baking needed).
      rel.style.width     = newW + 'px';
      rel.style.height    = newH + 'px';
      rel.style.minHeight = '0';
      rel.style.minWidth  = '0';
      rel.style.overflow  = 'hidden';
      rel.style.left     = newL + 'px';
      rel.style.top      = newT + 'px';
      updateResizeOverlay();
      e.preventDefault(); e.stopPropagation(); return;
    }

    // 閳光偓閳光偓 Drag 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
    if (!freeDrag) return;
    var dx = e.clientX - freeDrag.startX;
    var dy = e.clientY - freeDrag.startY;
    if (!freeDrag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      freeDrag.moved = true;
      snapshotForUndo();
      window.parent.postMessage({ type: 'DESIGNER_DRAG_START' }, '*');
      // Clean up any ghost spacers left over from previous drags/resizes to avoid
      // accumulating invisible placeholders in the DOM.
      Array.prototype.forEach.call(
        document.querySelectorAll('.__dsr-drag-ghost,.__dsr-resize-ghost'),
        function(g) { if (g.parentNode) g.parentNode.removeChild(g); }
      );
      // Clear CSS transform from a previous resize.
      // IMPORTANT: capture BCR BEFORE clearing the transform so we preserve the
      // visual (scaled) size. Clearing the transform first would revert the element
      // back to its original dimensions (stored in style.width/height = origW/origH),
      // making freeDrag.width/height the unscaled size and causing the element to
      // snap back to its original size when the drag ends.
      if (freeDrag.el.style.transform) {
        var bcrClear = freeDrag.el.getBoundingClientRect(); // read BEFORE clearing
        // Lock the visual dimensions so clearing the transform doesn't collapse the element.
        freeDrag.el.style.width  = bcrClear.width  + 'px';
        freeDrag.el.style.height = bcrClear.height + 'px';
        freeDrag.el.style.transform = '';
        delete freeDrag.el.dataset.resizeOriginalW;
        delete freeDrag.el.dataset.resizeOriginalH;
        var bcrPos = freeDrag.el.getBoundingClientRect(); // re-read for position after clear
        freeDrag.initBCRLeft = bcrPos.left;
        freeDrag.initBCRTop  = bcrPos.top;
        freeDrag.width  = bcrClear.width;
        freeDrag.height = bcrClear.height;
        // Recalculate parent-relative initLeft/initTop using the post-clear BCR.
        var clearPar = freeDrag.el.parentElement || document.body;
        var clearParRect = clearPar.getBoundingClientRect();
        var clearParSty  = getComputedStyle(clearPar);
        freeDrag.initLeft = bcrPos.left - clearParRect.left - (parseFloat(clearParSty.borderLeftWidth) || 0) + (clearPar.scrollLeft || 0);
        freeDrag.initTop  = bcrPos.top  - clearParRect.top  - (parseFloat(clearParSty.borderTopWidth)  || 0) + (clearPar.scrollTop  || 0);
      }
      // ── In-place drag (no lift-to-body) ──────────────────────────────────
      // The element stays in its original parent at all times. We just switch it
      // to position:absolute and move it by updating left/top. This prevents the
      // parent/child hierarchy from being broken and keeps sibling layout intact.
      //
      // For already-absolute elements (e.g. canvasifyBody top-level components):
      //   no ghost needed — they were never in flow; just bump z-index.
      // For in-flow elements (flex/grid/block children):
      //   First freeze all in-flow siblings to absolute so removing the ghost later
      //   doesn't cause them to reflow (which would make them "fill" the dragged
      //   element's old slot). Then insert a ghost to hold the dragged element's
      //   own slot during the drag, and convert the element to absolute.
      var fdPar = freeDrag.el.parentElement || document.body;

      // ══ ALL READS FIRST — strict reads-before-writes discipline ══════════
      // Every getBoundingClientRect / getComputedStyle call must complete
      // before ANY style mutation so that layout is consistent throughout.

      // ── STEP 1a: Capture direct sibling BCRs ─────────────────────────────
      var fdParRect   = fdPar.getBoundingClientRect();
      var fdParStyAll = getComputedStyle(fdPar);
      var fdParBL     = parseFloat(fdParStyAll.borderLeftWidth) || 0;
      var fdParBT     = parseFloat(fdParStyAll.borderTopWidth)  || 0;
      var sibSnaps    = [];
      var fdElCS      = getComputedStyle(freeDrag.el);
      var fdElInFlow  = fdElCS.position !== 'absolute' && fdElCS.position !== 'fixed';
      Array.prototype.forEach.call(fdPar.children, function(sib) {
        if (sib === freeDrag.el || isDesignerUi(sib)) return;
        if (sib.classList && (sib.classList.contains('__dsr-drag-ghost') || sib.classList.contains('__dsr-resize-ghost'))) return;
        var sibCS = getComputedStyle(sib);
        if (sibCS.position === 'absolute' || sibCS.position === 'fixed') return;
        var sibR = sib.getBoundingClientRect();
        if (sibR.width < 1 && sibR.height < 1) return;
        sibSnaps.push({ el: sib, r: sibR });
      });

      // Snapshot ghost CSS while the element is still in flow.
      var ghostDisplay, ghostMargin, ghostFlex, ghostFlexShrink, ghostGridCol, ghostGridRow;
      if (fdElInFlow) {
        var ghostCS  = getComputedStyle(freeDrag.el);
        ghostDisplay    = ghostCS.display === 'inline' ? 'inline-block' : ghostCS.display;
        ghostMargin     = ghostCS.margin;
        ghostFlex       = ghostCS.flex;
        ghostFlexShrink = ghostCS.flexShrink;
        ghostGridCol    = ghostCS.gridColumn;
        ghostGridRow    = ghostCS.gridRow;
      }

      // ══ ALL WRITES BELOW — no more BCR reads after this point ════════════

      // ── STEP 2: Insert ghost + make element absolute ──────────────────────
      // Ghost goes in first so the parent retains its natural height/geometry
      // during sibling freezing (Step 3). Without the ghost, making siblings
      // absolute collapses the parent, corrupting left/top calculations.
      if (fdElInFlow) {
        if (fdParStyAll.position === 'static') fdPar.style.position = 'relative';
        if (fdParStyAll.overflow === 'hidden') fdPar.style.overflow  = 'visible';
        var ghost = document.createElement('div');
        ghost.className = '__dsr-drag-ghost';
        ghost.style.cssText =
          'display:' + ghostDisplay + ';' +
          'width:' + freeDrag.width + 'px;' +
          'height:' + freeDrag.height + 'px;' +
          'visibility:hidden;pointer-events:none;' +
          'margin:' + ghostMargin + ';' +
          'padding:0;box-sizing:border-box;' +
          'flex:' + ghostFlex + ';' +
          'flex-shrink:' + ghostFlexShrink + ';' +
          'grid-column:' + ghostGridCol + ';' +
          'grid-row:' + ghostGridRow + ';';
        if (freeDrag.el.parentNode) freeDrag.el.parentNode.insertBefore(ghost, freeDrag.el);
        freeDrag.ghost = ghost;
        freeDrag.el.style.position = 'absolute';
        freeDrag.el.style.left     = freeDrag.initLeft + 'px';
        freeDrag.el.style.top      = freeDrag.initTop  + 'px';
        freeDrag.el.style.width    = freeDrag.width + 'px';
        freeDrag.el.style.margin   = '0';
      } else {
        // Already absolute — no ghost needed; element stays in its current parent.
        freeDrag.ghost = null;
      }

      // ── STEP 3: Freeze direct siblings ────────────────────────────────────
      if (sibSnaps.length) {
        if (fdParStyAll.position === 'static') fdPar.style.position = 'relative';
        sibSnaps.forEach(function(snap) {
          snap.el.style.position  = 'absolute';
          snap.el.style.left      = (snap.r.left - fdParRect.left - fdParBL + (fdPar.scrollLeft || 0)) + 'px';
          snap.el.style.top       = (snap.r.top  - fdParRect.top  - fdParBT + (fdPar.scrollTop  || 0)) + 'px';
          snap.el.style.width     = snap.r.width  + 'px';
          snap.el.style.margin    = '0';
          snap.el.style.boxSizing = 'border-box';
        });
      }
      // Preserve fdPar's height. After its children become absolute, fdPar
      // would collapse — causing its own siblings to reflow into the gap.
      if (!fdPar.style.minHeight || parseFloat(fdPar.style.minHeight) < fdParRect.height) {
        fdPar.style.minHeight = fdParRect.height + 'px';
      }

      freeDrag.el.style.zIndex        = '2147483646';
      freeDrag.el.style.opacity       = '0.82';
      freeDrag.el.style.pointerEvents = 'none';
      freeDrag.clone = null;
      removeResizeOverlay();
    }
    if (freeDrag.moved) {
      freeDrag.lastDx = dx;
      freeDrag.lastDy = dy;
      // In-place drag: initLeft/initTop are parent-relative coords captured at
      // drag-start; dx/dy are viewport deltas. Because the parent itself does
      // not move during the drag, parent-relative delta equals viewport delta.
      freeDrag.el.style.left = (freeDrag.initLeft + dx) + 'px';
      freeDrag.el.style.top  = (freeDrag.initTop  + dy) + 'px';
      // Keep the toolbar pinned ~2 cm above/below the element as it moves.
      placeToolbar();
      e.preventDefault(); e.stopPropagation();
    }
  }, true);

  window.addEventListener('mouseup', function() {
    isDragging = false;
    // 閳光偓閳光偓 Rubber band end: select intersecting elements 閳光偓
    // If the rubber-band was pending but never materialised (user just clicked,
    // didn't drag), discard it so the click event can handle selection normally.
    if (rubberBand && !rubberBandEl) { rubberBand = null; }
    if (rubberBand && rubberBandEl) {
      var rbR = rubberBandEl.getBoundingClientRect();
      rubberBandEl.remove(); rubberBandEl = null;
      var hadSize = rbR.width > 5 || rbR.height > 5;
      if (hadSize) {
        var found = [];
        // Search recursively up to 2 levels so rubber-band can select nested
        // components (not just direct body children).
        function collectIntersecting(parent, depth) {
          Array.prototype.forEach.call(parent.children, function(child) {
            if (isDesignerUi(child) || child.id === '__dsr-rubber') return;
            if (child.classList && (child.classList.contains('__dsr-drag-ghost') || child.classList.contains('__dsr-resize-ghost'))) return;
            var cr = child.getBoundingClientRect();
            var intersects = cr.left < rbR.right && cr.right > rbR.left && cr.top < rbR.bottom && cr.bottom > rbR.top;
            if (!intersects) return;
            if (isDraggable(child)) {
              // If the rubber-band is fully inside this element the user is targeting
              // its children, not the container itself — recurse one level deeper.
              var rbInside = rbR.left >= cr.left && rbR.right  <= cr.right &&
                             rbR.top  >= cr.top  && rbR.bottom <= cr.bottom;
              if (rbInside && depth < 2) {
                collectIntersecting(child, depth + 1);
              } else {
                found.push(child);
              }
            } else if (depth < 2) {
              collectIntersecting(child, depth + 1);
            }
          });
        }
        collectIntersecting(document.body, 0);
        if (found.length === 1) {
          selectElement(found[0]);
        } else if (found.length > 1) {
          selectedEls.forEach(function(el) { el.classList.remove('dsr-selected'); });
          selectedEls = found;
          selectedEls.forEach(function(el) { el.classList.add('dsr-selected'); });
          selectedEl = selectedEls[selectedEls.length - 1];
          placeToolbar(); updateGroupBtn(); updateLockBtn();
        }
      }
      rubberBand = null; return;
    }
    // 閳光偓閳光偓 Resize end 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
    if (resizeState) {
      var rsEl = resizeState.el;
      // style.width/height hold the final dragged size (set directly during mousemove).
      var finalW = parseFloat(rsEl.style.width)  || resizeState.startW;
      var finalH = parseFloat(rsEl.style.height) || resizeState.startH;

      // Store the very-first original dimensions once; subsequent resizes compound
      // correctly because origW/origH never change (dataset persists across resizes).
      if (!rsEl.dataset.resizeOriginalW) {
        rsEl.dataset.resizeOriginalW = String(resizeState.startW);
        rsEl.dataset.resizeOriginalH = String(resizeState.startH);
      }
      var origW = parseFloat(rsEl.dataset.resizeOriginalW);
      var origH = parseFloat(rsEl.dataset.resizeOriginalH);

      // Reset CSS box to stored original dimensions, then apply a CSS transform that
      // makes the entire element (and ALL its descendants) render at finalW×finalH.
      // transform:scale scales the entire subtree as a visual unit — every child at
      // every depth stays within the parent boundary. No baking needed.
      rsEl.style.width           = origW + 'px';
      rsEl.style.height          = origH + 'px';
      rsEl.style.minWidth        = '0';
      rsEl.style.minHeight       = '0';
      rsEl.style.transform       = 'scale(' + (finalW / origW) + ',' + (finalH / origH) + ')';
      rsEl.style.transformOrigin = 'top left';
      // Keep overflow:hidden. With transform:scale, the clip is applied in LOCAL space
      // (before the transform), so overflow:hidden at origW×origH in CSS → clips at
      // finalW×finalH in visual space — exactly the visual boundary. Without hidden,
      // children that overflow the CSS box would bleed past the visual boundary.
      rsEl.style.overflow        = 'hidden';

      resizeState = null;
      // Defensive: remove any leftover resize ghost (none expected with new approach).
      if (resizeGhost && resizeGhost.parentNode) {
        resizeGhost.parentNode.removeChild(resizeGhost);
      }
      resizeGhost = null;

      updateResizeOverlay();
      postUpdate();
      return;
    }
    // 閳光偓閳光偓 Drag end 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
    if (!freeDrag) return;
    var wasMoved  = freeDrag.moved;
    var draggedEl = freeDrag.el;
    var fdW       = freeDrag.width;
    var fdH       = freeDrag.height;
    var fdGhost   = freeDrag.ghost;
    freeDrag = null;
    // Remove the ghost placeholder. The element is already in its original
    // parent (never lifted to body), so no re-attachment is necessary.
    // Siblings regain their natural layout once the ghost is gone — the
    // dragged element (now position:absolute within the parent) does not
    // participate in flow, so it doesn't push siblings around.
    if (fdGhost && fdGhost.parentNode) {
      fdGhost.parentNode.removeChild(fdGhost);
    }
    // Restore interactive properties.
    draggedEl.style.pointerEvents = '';
    draggedEl.style.opacity       = '';
    if (wasMoved) {
      justDragged = true;
      setTimeout(function() { justDragged = false; }, 50);
      window.parent.postMessage({ type: 'DESIGNER_DRAG_END' }, '*');
      draggedEl.style.width  = fdW + 'px';
      draggedEl.style.height = fdH + 'px';
      draggedEl.style.zIndex = '9999';
      draggedEl.style.margin = '0';
      // Prevent recanvasifyBody from resetting this element's user-chosen position
      // if the 500ms second-pass fires after the user has already dragged it.
      draggedEl.dataset.cvUserMoved = '1';
      postUpdate();
    }
  }, true);

  // 閳光偓閳光偓 External component insertion 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'DESIGNER_REQUEST_SAVE') { postUpdate(); return; }
    if (e.data.type === 'DESIGNER_UNDO') { applyUndo(); return; }
    // React-side mobile toolbar button relays
    if (e.data.type === 'DESIGNER_TOOLBAR_BTN') { handleBtnClick(e.data.id); return; }
    if (e.data.type === 'DESIGNER_TEXT_EDIT_APPLY') {
      if (textEditTarget) { snapshotForUndo(); textEditTarget.innerText = e.data.text; postUpdate(); textEditTarget = null; }
      return;
    }
    if (e.data.type === 'DESIGNER_PROPS_CLOSE') { propsPanelOpen = false; return; }
    if (e.data.type === 'DESIGNER_APPLY_PROPS') { applyPropsFromData(e.data.data || {}); return; }
    if (e.data.type === 'DESIGNER_PROPS_DUP') { handlePropsDup(); return; }
    if (e.data.type === 'DESIGNER_INSERT_COMPONENT') {
      var tmp = document.createElement('div');
      tmp.innerHTML = (e.data.html || '').trim();
      var newEl = tmp.firstElementChild;
      if (!newEl) return;
      if (selectedEl && selectedEl.parentNode) {
        selectedEl.parentNode.insertBefore(newEl, selectedEl.nextElementSibling);
      } else {
        document.body.appendChild(newEl);
      }
      if (window.lucide) window.lucide.createIcons();
      selectElement(newEl);
      postUpdate();
    }
  });

  // 閳光偓閳光偓 Drag-drop from Element Library panel 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  // The library panel sets window.__dsrDragHtml before dragging; since the iframe
  // is same-origin we can read window.parent.__dsrDragHtml in the drop handler.
  // This avoids cross-frame dataTransfer compatibility issues entirely.
  document.addEventListener('dragover', function(e) {
    if (window.parent && window.parent.__dsrDragHtml) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }
  }, true);

  document.addEventListener('drop', function(e) {
    var html = window.parent && window.parent.__dsrDragHtml;
    if (!html) return;
    window.parent.__dsrDragHtml = null;
    e.preventDefault();
    e.stopPropagation();

    var tmp = document.createElement('div');
    tmp.innerHTML = String(html).trim();
    var newEl = tmp.firstElementChild;
    if (!newEl) return;

    // Ensure the body is a positioning context so absolute coords are relative to it
    if (document.body.style.position !== 'relative') {
      document.body.style.position = 'relative';
    }
    newEl.style.position = 'absolute';
    var bodyR = document.body.getBoundingClientRect();
    newEl.style.left   = (e.clientX - bodyR.left + (window.scrollX || 0)) + 'px';
    newEl.style.top    = (e.clientY - bodyR.top  + (window.scrollY || 0)) + 'px';
    newEl.style.zIndex = '100';

    document.body.appendChild(newEl);
    if (window.lucide) window.lucide.createIcons();
    selectElement(newEl);
    postUpdate();
  }, true);

  // 閳光偓閳光偓 MutationObserver 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  var observer = new MutationObserver(function() {});
  observer.observe(document.body, { childList: true, subtree: false });

  window.addEventListener('beforeunload', function() {
    observer.disconnect();
    window.clearTimeout(mutationTimer);
    window.__dsr_initialized = false;
  });

  setupAllDrag();

  // 閳光偓閳光偓 Canvas-ify body children for Visily-like free positioning 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  // Converts all direct body children to absolute so dragging one element
  // never causes others to reflow/move — each occupies its own fixed space.
  //
  // CRITICAL: ALL BCRs are captured in a first pass BEFORE any DOM mutation.
  // Reading BCR inside a mutating loop is wrong — once element N becomes
  // position:absolute it leaves the flow, so element N+1's natural position
  // shifts upward and its BCR is read at the wrong (shifted) coordinate.
  function canvasifyBody() {
    if (isDragging) return;
    var bodyH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var bodyRect = document.body.getBoundingClientRect();

    // ── Pass 1: snapshot every in-flow child's rect BEFORE any mutation ──
    var snapshots = [];
    Array.prototype.slice.call(document.body.children).forEach(function(child) {
      if (isDesignerUi(child)) return;
      // Skip drag/resize ghosts — intentional in-flow placeholders.
      if (child.classList && (child.classList.contains('__dsr-drag-ghost') || child.classList.contains('__dsr-resize-ghost'))) return;
      var cs = getComputedStyle(child);
      if (cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'none') return;
      var r = child.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) return;
      snapshots.push({ el: child, r: r });
    });

    // ── Pass 2: apply mutations using the pre-captured rects ─────────────
    snapshots.forEach(function(snap) {
      snap.el.style.position  = 'absolute';
      snap.el.style.left      = (snap.r.left - bodyRect.left) + 'px';
      snap.el.style.top       = (snap.r.top  - bodyRect.top)  + 'px';
      snap.el.style.width     = snap.r.width  + 'px';
      snap.el.style.margin    = '0';
      snap.el.style.boxSizing = 'border-box';
      // Mark so recanvasifyBody can identify and re-pin these elements
      // after Tailwind CDN finishes applying its styles asynchronously.
      snap.el.dataset.cvBody  = '1';
    });

    // Always set as an inline style so it survives cleanReactSideArtifacts
    // (which removes #__dsr-style that otherwise provides position:relative via CSS).
    document.body.style.position = 'relative';
    var curMin = parseFloat(document.body.style.minHeight) || 0;
    if (bodyH > curMin) document.body.style.minHeight = bodyH + 'px';
  }

  // Second-pass re-canvasify: temporarily restores natural flow for elements
  // marked with data-cv-body (but not yet user-moved) so we can re-read their
  // Tailwind-styled positions after the CDN has finished applying styles, then
  // re-pins them to absolute at the corrected coordinates.
  // This replaces the old "setTimeout(canvasifyBody, 500)" which was broken
  // because canvasifyBody skips already-absolute elements.
  function recanvasifyBody() {
    if (isDragging) { setTimeout(recanvasifyBody, 300); return; }
    // Only re-pin elements that haven't been moved by the user yet.
    var candidates = Array.prototype.slice.call(document.body.children).filter(function(el) {
      return el.dataset && el.dataset.cvBody === '1' && !el.dataset.cvUserMoved;
    });
    if (!candidates.length) return;

    // Un-absolutize all candidates at once (batch write, then batch read)
    // so the browser can compute natural-flow positions in a single layout pass.
    candidates.forEach(function(el) {
      el.style.position  = '';
      el.style.left      = '';
      el.style.top       = '';
      el.style.width     = '';
      el.style.margin    = '';
    });

    // Snapshot in a single read pass with everything back in natural flow.
    var bodyRect = document.body.getBoundingClientRect();
    var snaps = candidates.map(function(el) {
      return { el: el, r: el.getBoundingClientRect() };
    });

    // Re-pin using the corrected (post-Tailwind) positions.
    snaps.forEach(function(snap) {
      snap.el.style.position  = 'absolute';
      snap.el.style.left      = (snap.r.left - bodyRect.left) + 'px';
      snap.el.style.top       = (snap.r.top  - bodyRect.top)  + 'px';
      snap.el.style.width     = snap.r.width  + 'px';
      snap.el.style.margin    = '0';
      snap.el.style.boxSizing = 'border-box';
    });

    var bodyH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var curMin = parseFloat(document.body.style.minHeight) || 0;
    if (bodyH > curMin) document.body.style.minHeight = bodyH + 'px';
  }

  // Delay until all CSS/scripts (Tailwind CDN, etc.) have loaded and rendered,
  // otherwise we'd capture pre-Tailwind positions and break the layout.
  function runCanvasify() {
    canvasifyBody();
    // Second pass after 500 ms to re-snapshot positions now that Tailwind CDN
    // has finished applying styles asynchronously (MutationObserver-based).
    // Uses recanvasifyBody (not canvasifyBody) so it can temporarily un-absolute
    // already-pinned elements and re-read their corrected Tailwind positions.
    setTimeout(recanvasifyBody, 500);
  }
  if (document.readyState === 'complete') {
    runCanvasify();
  } else {
    window.addEventListener('load', function() { runCanvasify(); }, { once: true });
  }
  // Wrap showPage (Full Project mode) so canvasifyBody re-runs after page switch,
  // ensuring newly-visible page elements get absolute positioning for drag/toolbar.
  if (typeof window.showPage === 'function') {
    var _origShowPage = window.showPage;
    window.showPage = function() {
      _origShowPage.apply(this, arguments);
      setTimeout(canvasifyBody, 50);
    };
  }
})();
</script>`;

  // Properly inject the sentinel into <html> whether it has existing attributes or not.
  // The old /<html(\s|>)/i pattern was broken for <html>: it captured ">" as group 1
  // and produced <html> data-designer-runtime-injected="1" (text AFTER the closed tag).
  let out = normalizedHtml.replace(/<html([^>]*)>/i, (_, attrs) =>
    `<html ${RUNTIME_SENTINEL}="1"${attrs ? ' ' + attrs.trim() : ''}>`
  );

  // Inject CSS — fall back to prepending if </head> is missing
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${css}\n</head>`);
  } else {
    out = css + '\n' + out;
  }

  // Inject toolbar + script — fall back to </html> then end-of-string if </body> is missing
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${toolbar}\n${script}\n</body>`);
  } else if (/<\/html>/i.test(out)) {
    out = out.replace(/<\/html>/i, `${toolbar}\n${script}\n</html>`);
  } else {
    out += `\n${toolbar}\n${script}`;
  }

  return out;
}

// ─── Mobile toolbar state (relayed from iframe via postMessage for mobile view) ─
interface MobileTbState {
  tag: string;
  selectMode: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  groupCount: number;
  isLocked: boolean;
}

// ─── Properties panel data type ──────────────────────────────────────────────
interface PropsPanelData {
  tagName: string;
  x: number; y: number; w: number; h: number;
  opacity: number;
  fillColor: string; fillOpacity: number;
  borderColor: string; borderWidth: number; borderStyle: string;
  cornerTL: number; cornerTR: number; cornerBR: number; cornerBL: number;
  shadowOn: boolean;
  shadowX: number; shadowY: number; shadowBlur: number; shadowSpread: number;
  shadowColor: string; shadowOpacity: number;
  blurPx: number; backdropBlurPx: number;
  fontSize: number;
  isAbsolute: boolean;
  clearFill?: boolean;
}

// ─── Read-only Inspect Panel ─────────────────────────────────────────────────
function InspectPanel({ data, onClose, panelTop }: { data: PropsPanelData; onClose: () => void; panelTop?: number }) {
  const panelStyle: React.CSSProperties = {
    position: 'fixed', right: 0, top: panelTop ?? 160, bottom: 0, width: 300,
    background: '#18181b', borderLeft: '1px solid #27272a',
    zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#fff',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
  };

  const dataRow = (label: string, value: string) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #27272a' }}>
      <span style={{ fontSize: 12, color: '#71717a', fontFamily: 'monospace' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );

  const section = (title: string) => (
    <div key={title} style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' as const, letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>{title}</div>
  );

  const colorRow = (color: string, label: string) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #27272a' }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, background: color, border: '1px solid #3f3f46', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: '#71717a', fontFamily: 'monospace', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#e4e4e7', fontFamily: 'monospace' }}>{color}</span>
    </div>
  );

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#09090b', position: 'sticky', top: 0, zIndex: 1 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>🔍 Inspect Element</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#a1a1aa', marginTop: 3 }}>&lt;{data.tagName.toLowerCase()}&gt;</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>×</button>
      </div>

      <div style={{ padding: '12px 16px', flex: 1 }}>
        {section('Layout')}
        {dataRow('X', `${Math.round(data.x)}px`)}
        {dataRow('Y', `${Math.round(data.y)}px`)}
        {dataRow('Width', `${Math.round(data.w)}px`)}
        {dataRow('Height', `${Math.round(data.h)}px`)}
        {dataRow('Opacity', `${Math.round(data.opacity * 100)}%`)}
        {dataRow('Position', data.isAbsolute ? 'absolute' : 'in-flow')}

        {section('Colors')}
        {colorRow(data.fillColor, 'Background')}
        {data.borderStyle !== 'none' && colorRow(data.borderColor, 'Border')}
        {data.shadowOn && colorRow(data.shadowColor, 'Shadow')}

        {section('Border')}
        {dataRow('Style', data.borderStyle)}
        {data.borderStyle !== 'none' && dataRow('Width', `${data.borderWidth}px`)}
        {dataRow('Radius', `${data.cornerTL} / ${data.cornerTR} / ${data.cornerBR} / ${data.cornerBL}px`)}

        {section('Typography')}
        {dataRow('Font Size', `${data.fontSize ?? 14}px`)}

        {data.shadowOn && (
          <>
            {section('Shadow')}
            {dataRow('Offset X / Y', `${data.shadowX}px / ${data.shadowY}px`)}
            {dataRow('Blur / Spread', `${data.shadowBlur}px / ${data.shadowSpread}px`)}
          </>
        )}

        {(data.blurPx > 0 || data.backdropBlurPx > 0) && (
          <>
            {section('Filters')}
            {data.blurPx > 0 && dataRow('Element Blur', `${data.blurPx}px`)}
            {data.backdropBlurPx > 0 && dataRow('Backdrop Blur', `${data.backdropBlurPx}px`)}
          </>
        )}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid #27272a', background: '#09090b', position: 'sticky', bottom: 0 }}>
        <p style={{ fontSize: 11, color: '#52525b', textAlign: 'center', fontFamily: 'monospace', margin: 0 }}>
          Click another element to inspect it
        </p>
      </div>
    </div>
  );
}

// ─── Inline Properties Panel React component ─────────────────────────────────
function PropertiesPanel({
  data, iframeRef, onClose, panelTop,
}: { data: PropsPanelData; iframeRef: React.RefObject<HTMLIFrameElement | null>; onClose: () => void; panelTop?: number }) {
  const [d, setD] = React.useState<PropsPanelData>(data);
  React.useEffect(() => { setD(data); }, [data]);

  const post = (type: string, payload?: object) =>
    iframeRef.current?.contentWindow?.postMessage({ type, ...payload }, '*');

  const apply = () => post('DESIGNER_APPLY_PROPS', { data: d });
  const dup   = () => post('DESIGNER_PROPS_DUP');
  const close = () => { post('DESIGNER_PROPS_CLOSE'); onClose(); };

  const field = (label: string, node: React.ReactNode) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 3 }}>{label}</div>
      {node}
    </div>
  );
  const inp = (val: number | string, onChange: (v: string) => void, type = 'number') => (
    <input type={type} value={val}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 5, color: '#fff', padding: '4px 7px', fontSize: 12, boxSizing: 'border-box' as const }}
    />
  );
  const row2 = (a: React.ReactNode, b: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 6 }}>
      <div style={{ flex: 1 }}>{a}</div>
      <div style={{ flex: 1 }}>{b}</div>
    </div>
  );
  const pct = (label: string, val: number, onChange: (v: number) => void) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a1a1aa' }}>
        <span>{label}</span><span>{Math.round(val * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={val}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#6366f1' }}
      />
    </div>
  );

  const panelStyle: React.CSSProperties = {
    position: 'fixed', right: 0, top: panelTop ?? 160, bottom: 0, width: 285,
    background: '#18181b', borderLeft: '1px solid #27272a',
    zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui,sans-serif', fontSize: 13, color: '#fff',
    boxShadow: '-4px 0 16px rgba(0,0,0,0.4)',
  };

  const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double'];

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#09090b', position: 'sticky', top: 0, zIndex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          &lt;{d.tagName.toLowerCase()}&gt; Properties
        </span>
        <button onClick={close} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: '12px 14px', flex: 1 }}>
        {/* Position & Size */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Position & Size</div>
        {row2(
          <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>X</div>{inp(d.x, v => setD(p => ({ ...p, x: parseFloat(v) || 0 })))}</>,
          <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Y</div>{inp(d.y, v => setD(p => ({ ...p, y: parseFloat(v) || 0 })))}</>,
        )}
        <div style={{ marginBottom: 8 }} />
        {row2(
          <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>W</div>{inp(d.w, v => setD(p => ({ ...p, w: parseFloat(v) || 0 })))}</>,
          <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>H</div>{inp(d.h, v => setD(p => ({ ...p, h: parseFloat(v) || 0 })))}</>,
        )}
        <div style={{ marginBottom: 14 }} />
        {/* Appearance */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Appearance</div>
        {pct('Opacity', d.opacity, v => setD(p => ({ ...p, opacity: v })))}
        {/* Fill */}
        {field('Fill Color',
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="color" value={d.fillColor} onChange={e => setD(p => ({ ...p, fillColor: e.target.value }))}
              style={{ width: 36, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 1 }} />
            {inp(d.fillColor, v => setD(p => ({ ...p, fillColor: v })), 'text')}
            <button onClick={() => setD(p => ({ ...p, fillOpacity: 0, clearFill: true }))}
              style={{ flexShrink: 0, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4, color: '#a1a1aa', cursor: 'pointer', fontSize: 11, padding: '4px 6px' }}>✕</button>
          </div>
        )}
        {pct('Fill Opacity', d.fillOpacity, v => setD(p => ({ ...p, fillOpacity: v })))}
        <div style={{ marginBottom: 14 }} />
        {/* Border */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Border</div>
        {field('Style',
          <div style={{ display: 'flex', gap: 4 }}>
            {BORDER_STYLES.map(s => (
              <button key={s} onClick={() => setD(p => ({ ...p, borderStyle: s }))}
                style={{ flex: 1, padding: '4px 2px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: d.borderStyle === s ? '#6366f1' : '#27272a', color: d.borderStyle === s ? '#fff' : '#a1a1aa' }}>
                {s === 'none' ? '✕' : s.slice(0,4)}
              </button>
            ))}
          </div>
        )}
        {d.borderStyle !== 'none' && (
          <>
            {field('Border Color',
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="color" value={d.borderColor} onChange={e => setD(p => ({ ...p, borderColor: e.target.value }))}
                  style={{ width: 36, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 1 }} />
                {inp(d.borderColor, v => setD(p => ({ ...p, borderColor: v })), 'text')}
              </div>
            )}
            {field('Width (px)', inp(d.borderWidth, v => setD(p => ({ ...p, borderWidth: parseFloat(v) || 0 }))))}
          </>
        )}
        <div style={{ marginBottom: 14 }} />
        {/* Corner Radius */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Corner Radius (px)</div>
        {row2(
          <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>↖ TL</div>{inp(d.cornerTL, v => setD(p => ({ ...p, cornerTL: parseFloat(v) || 0 })))}</>,
          <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>↗ TR</div>{inp(d.cornerTR, v => setD(p => ({ ...p, cornerTR: parseFloat(v) || 0 })))}</>,
        )}
        <div style={{ marginBottom: 6 }} />
        {row2(
          <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>↙ BL</div>{inp(d.cornerBL, v => setD(p => ({ ...p, cornerBL: parseFloat(v) || 0 })))}</>,
          <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>↘ BR</div>{inp(d.cornerBR, v => setD(p => ({ ...p, cornerBR: parseFloat(v) || 0 })))}</>,
        )}
        <div style={{ marginBottom: 14 }} />
        {/* Shadow */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={d.shadowOn} onChange={e => setD(p => ({ ...p, shadowOn: e.target.checked }))} style={{ accentColor: '#6366f1' }} />
            Drop Shadow
          </label>
        </div>
        {d.shadowOn && (
          <>
            {row2(
              <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>X</div>{inp(d.shadowX, v => setD(p => ({ ...p, shadowX: parseFloat(v) || 0 })))}</>,
              <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Y</div>{inp(d.shadowY, v => setD(p => ({ ...p, shadowY: parseFloat(v) || 0 })))}</>,
            )}
            <div style={{ marginBottom: 6 }} />
            {row2(
              <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Blur</div>{inp(d.shadowBlur, v => setD(p => ({ ...p, shadowBlur: parseFloat(v) || 0 })))}</>,
              <><div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Spread</div>{inp(d.shadowSpread, v => setD(p => ({ ...p, shadowSpread: parseFloat(v) || 0 })))}</>,
            )}
            <div style={{ marginBottom: 6 }} />
            {field('Shadow Color',
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="color" value={d.shadowColor} onChange={e => setD(p => ({ ...p, shadowColor: e.target.value }))}
                  style={{ width: 36, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 1 }} />
                {inp(d.shadowColor, v => setD(p => ({ ...p, shadowColor: v })), 'text')}
              </div>
            )}
            {pct('Shadow Opacity', d.shadowOpacity, v => setD(p => ({ ...p, shadowOpacity: v })))}
          </>
        )}
        <div style={{ marginBottom: 14 }} />
        {/* Filters */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Filters</div>
        {field('Element Blur (px)', inp(d.blurPx, v => setD(p => ({ ...p, blurPx: parseFloat(v) || 0 }))))}
        {field('Backdrop Blur (px)', inp(d.backdropBlurPx, v => setD(p => ({ ...p, backdropBlurPx: parseFloat(v) || 0 }))))}
        <div style={{ marginBottom: 14 }} />
        {/* Typography */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Typography</div>
        <div style={{ fontSize: 10, color: '#71717a', marginBottom: 6, lineHeight: 1.4 }}>
          Shrinking/enlarging the component scales all child text proportionally via CSS transform.
          Use Font Size to independently adjust text size for the selected element.
        </div>
        {field('Font Size (px)', inp(d.fontSize ?? 14, v => setD(p => ({ ...p, fontSize: parseFloat(v) || 14 }))))}
      </div>
      {/* Footer actions */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #27272a', display: 'flex', gap: 8, background: '#09090b', position: 'sticky', bottom: 0 }}>
        <button onClick={dup} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #3f3f46', background: '#27272a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Duplicate</button>
        <button onClick={apply} style={{ flex: 2, padding: '7px 0', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Apply</button>
      </div>
    </div>
  );
}

// ─── Lightweight inspect-only runtime ─────────────────────────────────────────
// Injected when isInspectMode is true (but isInteractiveMode is false).
// Highlights hovered elements and sends DESIGNER_OPEN_PROPS on click.
// No drag, no resize, no toolbar.
function injectInspectRuntime(rawHtml: string): string {
  const normalizedHtml = ensureFullHtml(rawHtml);

  const inspectScript = `
<script id="__inspect-script">
(function(){
  if(document.documentElement.getAttribute('data-inspect-running'))return;
  document.documentElement.setAttribute('data-inspect-running','1');
  var hov=null;
  var skip={html:1,head:1,body:1,script:1,style:1,meta:1,link:1,svg:1,path:1,g:1,defs:1};
  var sty=document.createElement('style');
  sty.id='__inspect-style';
  sty.textContent='.dsr-ins-hov{outline:2px dashed #f59e0b!important;outline-offset:-2px!important;cursor:crosshair!important}.dsr-ins-sel{outline:2.5px solid #38bdf8!important;outline-offset:-2px!important}';
  (document.head||document.documentElement).appendChild(sty);
  function getEl(t){
    while(t&&t!==document.body&&t!==document.documentElement){
      if(t.tagName&&!skip[t.tagName.toLowerCase()])return t;
      t=t.parentElement;
    }
    return null;
  }
  function toHex(c){
    if(!c||c==='transparent'||c==='rgba(0, 0, 0, 0)')return '#000000';
    var m=c.match(/rgba?\\s*\\((\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)/);
    if(!m)return '#000000';
    return '#'+('0'+parseInt(m[1]).toString(16)).slice(-2)+('0'+parseInt(m[2]).toString(16)).slice(-2)+('0'+parseInt(m[3]).toString(16)).slice(-2);
  }
  document.addEventListener('mouseover',function(e){
    var el=getEl(e.target);
    if(hov){hov.classList.remove('dsr-ins-hov');}
    if(el){el.classList.add('dsr-ins-hov');hov=el;}
  },true);
  document.addEventListener('mouseout',function(e){
    if(hov&&(!e.relatedTarget||!hov.contains(e.relatedTarget))){
      hov.classList.remove('dsr-ins-hov');hov=null;
    }
  },true);
  document.addEventListener('click',function(e){
    var el=getEl(e.target);
    if(!el)return;
    e.preventDefault();e.stopImmediatePropagation();
    document.querySelectorAll('.dsr-ins-sel').forEach(function(n){n.classList.remove('dsr-ins-sel');});
    el.classList.add('dsr-ins-sel');
    var r=el.getBoundingClientRect();
    var cs=window.getComputedStyle(el);
    var bw=Math.round(parseFloat(cs.borderTopWidth)||0);
    var shOn=cs.boxShadow&&cs.boxShadow!=='none';
    window.parent.postMessage({
      type:'DESIGNER_OPEN_PROPS',
      data:{
        tagName:el.tagName,
        x:Math.round(r.left),y:Math.round(r.top),
        w:Math.round(r.width),h:Math.round(r.height),
        opacity:parseFloat(cs.opacity)||1,
        fillColor:toHex(cs.backgroundColor),
        fillOpacity:1,
        borderColor:toHex(cs.borderColor),
        borderWidth:bw,
        borderStyle:cs.borderStyle||'none',
        cornerTL:Math.round(parseFloat(cs.borderTopLeftRadius)||0),
        cornerTR:Math.round(parseFloat(cs.borderTopRightRadius)||0),
        cornerBR:Math.round(parseFloat(cs.borderBottomRightRadius)||0),
        cornerBL:Math.round(parseFloat(cs.borderBottomLeftRadius)||0),
        shadowOn:!!shOn,
        shadowX:0,shadowY:0,shadowBlur:0,shadowSpread:0,
        shadowColor:'#000000',shadowOpacity:0,
        blurPx:0,backdropBlurPx:0,
        fontSize:Math.round(parseFloat(cs.fontSize)||14),
        isAbsolute:cs.position==='absolute'
      }
    },'*');
  },true);
  // Close inspect panel when clicking body/html
  document.addEventListener('mousedown',function(e){
    if(e.target===document.body||e.target===document.documentElement){
      document.querySelectorAll('.dsr-ins-sel').forEach(function(n){n.classList.remove('dsr-ins-sel');});
      window.parent.postMessage({type:'DESIGNER_PROPS_CLOSE'},'*');
    }
  },true);
})();
<\/script>`;

  if (normalizedHtml.includes("</body>")) {
    return normalizedHtml.replace(/<\/body>/i, inspectScript + "\n</body>");
  } else if (normalizedHtml.includes("</html>")) {
    return normalizedHtml.replace(/<\/html>/i, inspectScript + "\n</html>");
  }
  return normalizedHtml + inspectScript;
}

// ─── React-side artifact cleaner ──────────────────────────────────────────────
// Mirrors the iframe's cleanDesignerArtifacts, but runs in the parent window
// so we can clean a cloned DOM node without any postMessage roundtrip.
// Module-level flag so the Reset button's "skip-live-capture" signal survives a component
// remount (caused by the key increment that follows the reset).  A per-instance ref would
// be reset to false on the new mount before the Write HTML effect can read it.
let _skipLiveCaptureGlobal = false;

function cleanReactSideArtifacts(root: Element) {
  ['#__dsr-toolbar','#__dsr-edit-modal',
   '#__dsr-delete-modal','#__dsr-style','#__dsr-script','#__dsr-resize-overlay','#__dsr-rubber']
    .forEach(sel => root.querySelector(sel)?.remove());
  root.querySelectorAll('.__dsr-drag-ghost,.__dsr-resize-ghost').forEach(n => n.remove());
  const htmlEl: HTMLElement | null = root.tagName.toLowerCase() === 'html'
    ? (root as HTMLElement)
    : (root.querySelector('html') as HTMLElement | null);
  if (htmlEl) {
    htmlEl.removeAttribute('data-designer-runtime-injected');
    htmlEl.removeAttribute('data-dsr-running');
  }
  root.querySelectorAll('[class]').forEach(n => {
    const el = n as HTMLElement;
    if (typeof el.className === 'string') {
      el.className = el.className.replace(/\bdsr-\S+/g, '').trim();
    }
  });
  root.querySelectorAll('[draggable]').forEach(n => {
    n.removeAttribute('draggable');
    delete (n as HTMLElement).dataset?.dsrDrag;
  });
  // Remove canvasify tracking attributes (set by canvasifyBody and drag-end handler).
  root.querySelectorAll('[data-cv-body]').forEach(n => delete (n as HTMLElement).dataset?.cvBody);
  root.querySelectorAll('[data-cv-user-moved]').forEach(n => delete (n as HTMLElement).dataset?.cvUserMoved);
}

// ─── Save interactive edits as a new commit ──────────────────────────────────
// Always creates a NEW commit so history grows and the isCommitted guard is
// never triggered — new commits always start with isCommitted=false.
// Uses getState() to read the freshest store, avoiding stale closures.


function saveAsNewInteractiveCommit(savedHtml: string): void {
  const { head: currentHead, commits, addCommit, setHead, setCommitCode, isImportedFromCode } = useProjectStore.getState();
  if (currentHead === null) return;
  // Dedup: skip if the code hasn't changed from the current head commit.
  const currentCommit = commits[currentHead];
  if (currentCommit) {
    const currentCode = currentCommit.variants[currentCommit.selectedVariantIndex]?.code ?? "";
    if (currentCode === savedHtml) return;
  }

  // Blank canvas (importFromCode): update the existing uncommitted commit in-place so
  // history stays as "Version 1" rather than growing to "Version 2".
  if (isImportedFromCode && currentCommit && !currentCommit.isCommitted) {
    setCommitCode(currentHead, currentCommit.selectedVariantIndex, savedHtml);
    window.dispatchEvent(new CustomEvent("designer:save-project"));
    return;
  }

  const newCommit = createCommit({
    type: "ai_edit" as const,
    parentHash: currentHead,
    variants: [{ code: savedHtml, status: "complete" as const }],
    inputs: { text: "Interactive edit", images: [] },
  });
  addCommit(newCommit);
  setHead(newCommit.hash);
  // Signal App.tsx to persist to Supabase
  window.dispatchEvent(new CustomEvent("designer:save-project"));
}

// 閳光偓閳光偓閳光偓 React component 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓

function PreviewComponent({
  code, device, doUpdate,
  iframeRef: externalIframeRef,
  aestheticMode,
  panelTop,
}: Props) {
  const internalIframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeRef = (externalIframeRef || internalIframeRef) as React.RefObject<HTMLIFrameElement>;
  const outerRef  = useRef<HTMLDivElement | null>(null);
  const innerRef  = useRef<HTMLDivElement | null>(null);

  const { inSelectAndEditMode, isInteractiveMode, isInspectMode, setInspectMode, setPropsPanelOpen, setHadInteractiveEdits } = useAppStore();

  const throttledCode = useThrottle(code, 200);
  // Always track latest unthrottled code so turning off interactive mode writes
  // the most recent commit state, not a stale 200ms-old snapshot.
  const latestCodeRef = useRef(code);
  latestCodeRef.current = code;
  const [clickEvent, setClickEvent] = useState<MouseEvent | null>(null);
  const [scale, setScale]           = useState(1);
  const [propsData, setPropsData]   = useState<PropsPanelData | null>(null);
  // Text edit modal — rendered OUTSIDE the iframe so it's always visible (even in scaled mobile view)
  const [textEditOpen, setTextEditOpen]   = useState(false);
  const [textEditValue, setTextEditValue] = useState("");
  // Mobile toolbar — rendered ABOVE the mobile preview frame so it doesn't overlap content
  const [mobileTb, setMobileTb] = useState<MobileTbState | null>(null);
  // Tracks whether any actual edit was made in the current interactive session.
  // Set to true on DESIGNER_DOM_UPDATED; reset to false when entering interactive mode.
  // Used to skip the auto-save on exit when no changes were made.
  const hadEditsRef = useRef(false);
  // When "Don't Save" is chosen, this ref is set so the exit path can revert
  // the FP store to its pre-edit state instead of keeping the live-DOM edits.
  const discardEditsRef             = useRef(false);
  // When the Reset button is clicked, this flag tells the Write HTML else-branch
  // to skip live-DOM capture and use latestCodeRef.current (the reset HTML) directly.
  const skipLiveCaptureRef          = useRef(false);
  // Snapshot of each FP screen's HTML taken when entering interactive mode,
  // keyed by screen id — used to restore on discard.
  const preEditFpHtmlRef            = useRef<Record<string, string>>({});
  const isDraggingRef               = useRef(false);
  // Debounce timer for DESIGNER_DOM_UPDATED → FP store sync (avoids thrashing on rapid drags)
  const fpDomSyncTimerRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks WHICH screen the editor runtime was last injected for.
  // undefined  = editor not currently active (never injected, or toggled off)
  // null       = editor injected in single-page mode (no FP active screen)
  // string     = activeScreenId at the time of last injection (FP mode)
  //
  // The guard in the Write HTML effect compares this against the CURRENT
  // activeScreenId.  On a screen switch the IDs differ, so we always
  // re-inject.  On a mid-session code change (same screen, editor running)
  // the IDs match AND the toolbar is in the DOM, so we skip re-injection to
  // protect unsaved drag/resize positions.
  // This ref resets on every component remount (key change) so fresh mounts
  // always inject — regardless of React StrictMode double-invocation or
  // cross-store update batching edge cases.
  const editorScreenIdRef = useRef<string | null | undefined>(undefined);

  // Scale
  useEffect(() => {
    const compute = () => {
      const outer = outerRef.current, iframe = iframeRef.current, inner = innerRef.current;
      if (!outer || !iframe || !inner) return;
      // Read from the parent of outerRef — not outerRef itself — to avoid a
      // circular dependency where the iframe's unscaled 1440px layout footprint
      // (inside innerRef) inflates outer.clientWidth before we can correct it.
      const availableWidth = outer.parentElement?.clientWidth || outer.clientWidth;
      if (availableWidth === 0) return;
      // Clamp by available vertical space so the iframe never overflows the page.
      // Measure the real parent container height instead of guessing from window.innerHeight.
      // outer's own height is content-driven (circular), so read from outer's parent —
      // whatever container the caller is actually constraining.
      const parent = outer.parentElement;
      const parentHeight = parent?.clientHeight || 0;
      const availableHeight = parentHeight > 0
        ? parentHeight
        : Math.max(200, window.innerHeight - 140); // fallback when parent is unconstrained
      const nextScale = Math.min(1, availableWidth / BASE_W[device], availableHeight / BASE_H[device]);
      setScale(nextScale);
      iframe.style.transform = `scale(${nextScale})`;
      iframe.style.transformOrigin = "top left";
      const scaledW = BASE_W[device] * nextScale;
      const scaledH = BASE_H[device] * nextScale;
      inner.style.height = `${scaledH}px`;
      inner.style.width  = `${scaledW}px`;
      // Center the inner within the outer when there is leftover horizontal space
      // (e.g. when height-clamping makes the scale smaller than width-clamping would).
      const leftover = Math.max(0, availableWidth - scaledW);
      inner.style.marginLeft = `${Math.floor(leftover / 2)}px`;
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (outerRef.current) ro.observe(outerRef.current);
    if (outerRef.current?.parentElement) ro.observe(outerRef.current.parentElement);
    window.addEventListener("resize", compute);
    return () => { ro.disconnect(); window.removeEventListener("resize", compute); };
  }, [device, iframeRef]);

  // Write HTML
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Read current FP active screen — null when FP is not active (single-page mode).
    const fpActiveScreenId = useFullProjectStore.getState().activeScreenId ?? null;

    let sourceCode: string;
    if (isInteractiveMode) {
      // Skip re-injection ONLY when:
      //   (a) we already injected for THIS EXACT screen (editorScreenIdRef matches), AND
      //   (b) the toolbar DOM node is still present (editor is truly running).
      //
      // This correctly handles every scenario:
      //   • Fresh component mount (key change on screen switch): editorScreenIdRef = undefined → inject ✓
      //   • Mode toggle false→true: editorScreenIdRef = undefined (reset in else branch) → inject ✓
      //   • Screen switch without remount (edge case): IDs differ → inject ✓
      //   • Mid-session code change (DESIGNER_DOM_UPDATED): same screen + toolbar present → skip ✓
      //   • React StrictMode double-invocation: 1st run injects; 2nd run sees same ID + toolbar → skip ✓
      const editorAlreadyRunning =
        editorScreenIdRef.current !== undefined &&
        editorScreenIdRef.current === fpActiveScreenId &&
        !!iframe.contentDocument?.querySelector('#__dsr-toolbar');
      if (editorAlreadyRunning) {
        return;
      }
      isDraggingRef.current = false;
      hadEditsRef.current = false;
      discardEditsRef.current = false;
      setHadInteractiveEdits(false);  // reset edit-tracker for new session
      editorScreenIdRef.current = fpActiveScreenId;
      // Snapshot FP screen HTML now so "Don't Save" can restore them.
      // Each PreviewComponent (desktop/mobile) snapshots its own HTML field.
      {
        const fpSnap = useFullProjectStore.getState();
        const snap: Record<string, string> = {};
        fpSnap.screens.forEach((s) => {
          snap[s.id] = device === "mobile" ? (s.mobileHtml || s.html) : s.html;
        });
        preEditFpHtmlRef.current = snap;
      }
      // Strip BOTH runtime attributes so the injected script always initialises
      // cleanly, even if the stored HTML somehow still carries these attributes:
      //   • data-designer-runtime-injected — the sentinel that causes injectEditorRuntime
      //     to return early (already stripped before, kept for safety)
      //   • data-dsr-running — the attribute that causes the editor JS to return early
      //     before setting up event listeners (THIS is why hovering/clicking can silently
      //     fail on loaded/regenerated screens: the script sees it, thinks it's already
      //     running, and bails out — leaving the toolbar in the DOM but no handlers)
      sourceCode = throttledCode
        .replace(/ data-designer-runtime-injected="[^"]*"/g, '')
        .replace(/ data-dsr-running="[^"]*"/g, '');
    } else {
      isDraggingRef.current = false;
      editorScreenIdRef.current = undefined;  // reset: editor is no longer active
      // If the user chose "Don't Save", revert all FP screens to their pre-edit
      // snapshots and use the original code for the iframe, discarding all edits.
      if (discardEditsRef.current) {
        discardEditsRef.current = false;
        const fpState = useFullProjectStore.getState();
        const snap = preEditFpHtmlRef.current;
        // Restore every FP screen to its pre-edit HTML (device-specific field).
        fpState.screens.forEach((s) => {
          if (snap[s.id] !== undefined) {
            if (device === "mobile") {
              fpState.setScreenMobileHtml(s.id, snap[s.id]);
            } else {
              fpState.setScreenHtml(s.id, snap[s.id]);
            }
          }
        });
        // latestCodeRef still holds the edited code (Zustand update hasn't
        // flushed through a new render yet). Use the snapshot for THIS screen
        // directly so the iframe immediately shows the pre-edit content.
        const activeSnap = fpActiveScreenId ? snap[fpActiveScreenId] : undefined;
        sourceCode = activeSnap ?? latestCodeRef.current;
      } else {
        // Exit path: capture the live iframe DOM so the displayed content always
        // reflects the user's actual edits, regardless of React render ordering.
        // The Sidebar exit button already dispatched designer:request-save synchronously
        // before toggling the mode — the commit was created then. Here we only need
        // the right HTML for the iframe write, so no save call is made.
        const liveEl = iframe.contentDocument?.documentElement;
        const hasEditor = !!liveEl?.querySelector('#__dsr-toolbar');
        // Check both the per-instance ref (set during this mount) and the module-level
        // global (set before key-triggered remount so the signal survives it).
        const shouldSkipCapture = skipLiveCaptureRef.current || _skipLiveCaptureGlobal;
        if (liveEl && hasEditor && !shouldSkipCapture) {
          // Editor still running — capture live DOM so the iframe shows whatever
          // the user actually has, including unsaved drag/resize positions.
          const clone = liveEl.cloneNode(true) as Element;
          cleanReactSideArtifacts(clone);
          sourceCode = '<!DOCTYPE html>\n' + clone.outerHTML;
        } else {
          // skipLiveCapture is set by the Reset button — consume both flags so
          // subsequent (non-reset) exits still capture the live DOM normally.
          skipLiveCaptureRef.current = false;
          _skipLiveCaptureGlobal = false;
          // Editor is gone (already cleaned up, or version-switch while not in
          // interactive mode). latestCodeRef.current is updated synchronously in
          // every render, so it always holds the correct code for the current
          // head commit — use it regardless of whether we were previously in
          // interactive mode.  DO NOT fall back to lastSavedInteractiveHtml here:
          // it is a module-level cache that may hold a stale value from a
          // previous project or an earlier interactive session.
          sourceCode = latestCodeRef.current;
        }
      }
    }

    let html = isInteractiveMode
      ? injectEditorRuntime(sourceCode)
      : isInspectMode
        ? injectInspectRuntime(sourceCode)
        : ensureFullHtml(sourceCode);

    // ── Full-Project safety: if AI forgot style="display:block" on first page,
    // inject a script that auto-shows the first [data-page-name] section on load.
    if (!isInteractiveMode && !isInspectMode && html.includes("data-page-name")) {
      const fpSafetyScript = `<script>
(function(){
  function fpShow(){
    var pages=document.querySelectorAll('[data-page-name]');
    if(!pages.length)return;
    var anyVisible=false;
    for(var i=0;i<pages.length;i++){
      if(pages[i].style.display!=='none'&&pages[i].style.display!==''){anyVisible=true;break;}
    }
    if(!anyVisible){
      pages[0].style.display='block';
      if(typeof window.showPage==='function')window.showPage(pages[0].id);
    }
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fpShow);}
  else{fpShow();}
})();
<\/script>`;
      if (html.includes("</body>")) {
        html = html.replace(/<\/body>/i, fpSafetyScript + "\n</body>");
      } else {
        html += fpSafetyScript;
      }
    }

    // Mobile: prevent horizontal scroll from content wider than the 390 px viewport.
    // Desktop: prevent the page from expanding the iframe width beyond 1440 px.
    // These rules only affect the preview iframe — they do not alter saved code.
    const previewOverrideCss =
      device === "mobile"
        ? `<style id="__preview-overflow-fix">
html,body{overflow-x:hidden!important;max-width:100%!important;box-sizing:border-box!important;margin:0!important;padding:0!important}
*{max-width:100%!important;box-sizing:border-box!important}
img,video,iframe,canvas,svg{max-width:100%!important;height:auto}
body>*,main,section,header,footer,nav,article,aside,div{max-width:100%!important}
table{width:100%!important;table-layout:fixed!important}
pre,code{white-space:pre-wrap!important;word-break:break-word!important}
</style>`
        : '<style id="__preview-overflow-fix">html{overflow-x:hidden!important}</style>';
    if (html.includes('</head>')) {
      html = html.replace(/<\/head>/i, `${previewOverrideCss}</head>`);
    } else if (html.includes('</html>')) {
      html = html.replace(/<\/html>/i, `${previewOverrideCss}</html>`);
    } else {
      html += previewOverrideCss;
    }

    doc.open(); doc.write(html); doc.close();
    const body = iframe.contentWindow?.document?.body;
    const handleBodyClick = (event: Event) => setClickEvent(event as MouseEvent);
    body?.addEventListener("click", handleBodyClick, true);
    return () => body?.removeEventListener("click", handleBodyClick, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [throttledCode, isInteractiveMode, isInspectMode, iframeRef]);

  // Clear props panel when leaving both interactive and inspect modes
  useEffect(() => {
    if (!isInteractiveMode && !isInspectMode) { setPropsData(null); setPropsPanelOpen(false); }
  }, [isInteractiveMode, isInspectMode, setPropsPanelOpen]);

  // Listen for "Don't Save" signal from Sidebar so the exit path reverts FP edits.
  useEffect(() => {
    const handler = () => { discardEditsRef.current = true; };
    window.addEventListener("designer:discard-edits", handler);
    return () => window.removeEventListener("designer:discard-edits", handler);
  }, []);

  // Relay undo from the React toolbar button to whichever iframe is active.
  // Using a window event lets both the desktop and mobile PreviewComponent instances
  // listen — whichever one has the editor injected will apply the undo.
  useEffect(() => {
    const handler = () => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'DESIGNER_UNDO' }, '*');
    };
    window.addEventListener("designer:undo", handler);
    return () => window.removeEventListener("designer:undo", handler);
  }, [iframeRef]);

  // When the Reset button is about to run, it dispatches this event so the Write
  // HTML else-branch skips live-DOM capture and uses the just-reset HTML instead.
  // We also set the module-level flag so the signal survives the key-triggered
  // remount that immediately follows the reset.
  useEffect(() => {
    const handler = () => {
      skipLiveCaptureRef.current = true;
      _skipLiveCaptureGlobal = true;
    };
    window.addEventListener("designer:skip-live-capture", handler);
    return () => window.removeEventListener("designer:skip-live-capture", handler);
  }, []);

  // Bug fix (reset button): clear any pending DESIGNER_DOM_UPDATED debounce timer
  // so an in-flight edited-HTML write doesn't overwrite the just-reset originalHtml.
  useEffect(() => {
    const handler = () => {
      if (fpDomSyncTimerRef.current) {
        clearTimeout(fpDomSyncTimerRef.current);
        fpDomSyncTimerRef.current = null;
      }
    };
    window.addEventListener("designer:clear-dom-sync-timer", handler);
    return () => window.removeEventListener("designer:clear-dom-sync-timer", handler);
  }, []);

  // Bug fix (reset button): clears editorScreenIdRef so the Write HTML effect
  // re-injects rather than hitting the editorAlreadyRunning guard.
  useEffect(() => {
    const handler = () => { editorScreenIdRef.current = undefined; };
    window.addEventListener("designer:force-reinject", handler);
    return () => window.removeEventListener("designer:force-reinject", handler);
  }, []);

  // Sync propsPanelOpen store flag whenever propsData changes
  useEffect(() => {
    setPropsPanelOpen(!!propsData);
  }, [propsData, setPropsPanelOpen]);

  // Messages 閳?track drag state, sync FP store on visual edits, handle Save Layout.
  useEffect(() => {
    const handle = (event: MessageEvent) => {
      // Only handle messages from THIS component's iframe so that desktop and
      // mobile PreviewComponents don't process each other's DESIGNER_* messages
      // and accidentally overwrite each other's saved HTML.
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "DESIGNER_OPEN_PROPS") { setPropsData(event.data.data as PropsPanelData); return; }
      if (event.data?.type === "DESIGNER_PROPS_CLOSE") { setPropsData(null); return; }
      if (event.data?.type === "DESIGNER_DRAG_START") { isDraggingRef.current = true; return; }
      if (event.data?.type === "DESIGNER_DRAG_END")   { isDraggingRef.current = false; return; }
      if (event.data?.type === "DESIGNER_TEXT_EDIT_REQUEST") {
        setTextEditValue(event.data.text ?? "");
        setTextEditOpen(true);
        return;
      }
      if (event.data?.type === "DESIGNER_MOBILE_TOOLBAR") {
        if (event.data.visible) {
          setMobileTb({ tag: event.data.tag, selectMode: event.data.selectMode, canGroup: event.data.canGroup, canUngroup: event.data.canUngroup, groupCount: event.data.groupCount, isLocked: event.data.isLocked });
        } else {
          setMobileTb(null);
        }
        return;
      }

      // Keep FP store in sync with every visual-editor change.
      // We debounce at 100ms to avoid thrashing on rapid drags.
      // Only update when the screen is "complete" — never overwrite an in-progress AI stream.
      if (event.data?.type === "DESIGNER_DOM_UPDATED") {
        hadEditsRef.current = true;
        setHadInteractiveEdits(true);
        const fpState = useFullProjectStore.getState();
        if (fpState.isActive && fpState.activeScreenId && event.data.html) {
          const screenId  = fpState.activeScreenId;
          const screen    = fpState.screens.find(s => s.id === screenId);
          // Bug fix (problem 5): save edits to the device-specific HTML field so
          // desktop and mobile views remain independent.
          const isMobile  = device === "mobile";
          if (screen?.status === "complete") {
            const html = event.data.html as string;
            if (fpDomSyncTimerRef.current) clearTimeout(fpDomSyncTimerRef.current);
            fpDomSyncTimerRef.current = setTimeout(() => {
              // Re-read state inside the timeout — screen or activeScreenId might have changed
              const state = useFullProjectStore.getState();
              const s     = state.screens.find(sc => sc.id === screenId);
              if (state.isActive && state.activeScreenId === screenId && s?.status === "complete") {
                if (isMobile) {
                  state.setScreenMobileHtml(screenId, html);
                } else {
                  state.setScreenHtml(screenId, html);
                }
              }
            }, 100);
          }
        }
        return;
      }

      if (event.data?.type === "DESIGNER_SAVE_LAYOUT") {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const liveEl = iframe.contentDocument?.documentElement;
        if (!liveEl) return;
        const clone = liveEl.cloneNode(true) as Element;
        cleanReactSideArtifacts(clone);
        const savedHtml = '<!DOCTYPE html>\n' + clone.outerHTML;
        const fpState = useFullProjectStore.getState();
        if (fpState.isActive && fpState.activeScreenId) {
          // Full-project mode: only save when screen is fully generated (not streaming)
          const screen = fpState.screens.find(s => s.id === fpState.activeScreenId);
          if (screen?.status === "complete") {
            // Save to device-specific field (bug fix problem 5)
            if (device === "mobile") {
              fpState.setScreenMobileHtml(fpState.activeScreenId, savedHtml);
            } else {
              fpState.setScreenHtml(fpState.activeScreenId, savedHtml);
            }
            window.dispatchEvent(new CustomEvent('fp:layout-changed'));
            toast.success("Layout saved");
          }
        } else {
          // Single-page mode: create a versioned commit as before
          saveAsNewInteractiveCommit(savedHtml);
          hadEditsRef.current = false;
          setHadInteractiveEdits(false);
        }
      }
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeRef, setHadInteractiveEdits]);

  // Save-layout relay: sidebar button 閳?capture live DOM 閳?store / commit 閳?Supabase
  //
  // FP mode: the store is already kept in sync by DESIGNER_DOM_UPDATED above,
  // so we just trigger a Supabase persist — we do NOT re-capture the iframe DOM
  // here.  Re-capturing is dangerous because this event fires synchronously
  // before React commits the isInteractiveMode=false state update, meaning
  // isInteractiveMode is still true in this closure but the iframe may already
  // be transitioning, leading to stale / partial HTML overwriting the store.
  //
  // Single-page mode: behaviour is unchanged — capture + create a commit.
  useEffect(() => {
    const handler = () => {
      const fpState = useFullProjectStore.getState();
      if (fpState.isActive && fpState.activeScreenId) {
        // Store is already up-to-date via DESIGNER_DOM_UPDATED; just persist.
        const screen = fpState.screens.find(s => s.id === fpState.activeScreenId);
        if (screen?.status === "complete") {
          window.dispatchEvent(new CustomEvent('fp:layout-changed'));
        }
        return;
      }
      // Single-page mode — capture iframe DOM and create a versioned commit.
      // Skip if no actual edits were made in this session (prevents phantom versions).
      if (!hadEditsRef.current) return;
      const iframe = iframeRef.current;
      if (!iframe || !isInteractiveMode) return;
      const liveEl = iframe.contentDocument?.documentElement;
      if (!liveEl) return;
      const clone = liveEl.cloneNode(true) as Element;
      cleanReactSideArtifacts(clone);
      const savedHtml = '<!DOCTYPE html>\n' + clone.outerHTML;
      saveAsNewInteractiveCommit(savedHtml);
    };
    window.addEventListener("designer:request-save", handler);
    return () => window.removeEventListener("designer:request-save", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInteractiveMode, iframeRef]);

  // Save-component relay
  useEffect(() => {
    const handle = (event: MessageEvent) => {
      if (event.data?.type !== "DESIGNER_SAVE_COMPONENT") return;
      window.dispatchEvent(new CustomEvent("designer:save-component", {
        detail: { html: event.data.html, tagName: event.data.tagName },
      }));
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  // ── Full-Project page navigation ────────────────────────────────────────
  // Listens for fullproject:navigate custom events dispatched by FullProjectPageNav
  // and navigates the iframe to the requested page via hash + showPage() call.
  useEffect(() => {
    const handleNav = (e: Event) => {
      const pageId = (e as CustomEvent<{ pageId: string }>).detail?.pageId;
      if (!pageId) return;
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      // Call the showPage() function injected by our FULL_PROJECT prompt, or
      // fall back to a direct hash assignment so built-in hash routing still works.
      try {
        const win = iframe.contentWindow as Window & { showPage?: (id: string) => void };
        if (typeof win.showPage === "function") {
          win.showPage(pageId);
        } else {
          win.location.hash = pageId;
        }
      } catch {
        // cross-origin guard — should not happen since iframe uses srcdoc / blob
      }
    };
    window.addEventListener("fullproject:navigate", handleNav);
    return () => window.removeEventListener("fullproject:navigate", handleNav);
  }, [iframeRef]);

  return (
    <div ref={outerRef} className="relative w-full min-w-0 overflow-hidden">
      {/* External toolbar — rendered OUTSIDE the scaled iframe for both desktop and mobile
          so it never obscures the preview canvas. Buttons relay to the iframe via postMessage. */}
      {isInteractiveMode && mobileTb && (
        <div className="mb-2 flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-stone-700 bg-stone-900 p-2">
          {/* Tag badge */}
          <span className="shrink-0 truncate rounded bg-stone-800 px-2 py-1 text-center font-mono text-[10px] font-bold text-amber-500">{mobileTb.tag}</span>
          {/* All toolbar buttons — same set as the old in-iframe desktop toolbar */}
          {([
            ['__dt-parent',    '⬆ Parent',                                                    '#292524','#f59e0b'],
            ['__dt-edit',      '✎ Text',                                                      '#1c1917','#fff'],
            ['__dt-layout',    '⚙ Props',                                                     '#1c1917','#a78bfa'],
            ['__dt-save',      '⊕ Save',                                                      '#064e3b','#6ee7b7'],
            ['__dt-savelayout','⊞ Layout',                                                    '#065f46','#a7f3d0'],
            ['__dt-bfront',    '⬆ Front',                                                     '#1c1917','#38bdf8'],
            ['__dt-fwd',       '↑ Fwd',                                                       '#1c1917','#7dd3fc'],
            ['__dt-bwd',       '↓ Bwd',                                                       '#1c1917','#7dd3fc'],
            ['__dt-bback',     '⬇ Back',                                                      '#1c1917','#38bdf8'],
            ['__dt-lock',      mobileTb.isLocked ? '🔒 Unlock' : '🔓 Lock',                   '#1c1917','#d6d3d1'],
            ['__dt-selectmode',mobileTb.selectMode ? '☑ Select' : '☐ Select',                 mobileTb.selectMode ? '#f59e0b' : '#292524', mobileTb.selectMode ? '#0c0a09' : '#f59e0b'],
            ['__dt-group',
              mobileTb.canGroup ? `Group (${mobileTb.groupCount})` : mobileTb.canUngroup ? 'Ungroup' : 'Group',
              (mobileTb.canGroup || mobileTb.canUngroup) ? '#1d4ed8' : '#292524',
              (mobileTb.canGroup || mobileTb.canUngroup) ? '#bfdbfe' : '#6b7280'],
            ['__dt-del',       '🗑 Delete',                                                    '#450a0a','#fca5a5'],
            ['__dt-close',     '✕',                                                           'transparent','#a8a29e'],
          ] as [string,string,string,string][]).map(([id, label, bg, color]) => {
            // Group button is dimmed and non-interactive when neither group nor ungroup is possible.
            const groupDisabled = id === '__dt-group' && !mobileTb.canGroup && !mobileTb.canUngroup;
            return (
              <button
                key={id}
                onClick={() => {
                  if (groupDisabled) return;
                  if (id === '__dt-close') setMobileTb(null);
                  iframeRef.current?.contentWindow?.postMessage({ type: 'DESIGNER_TOOLBAR_BTN', id }, '*');
                }}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: groupDisabled ? 'default' : 'pointer', background: bg, color, whiteSpace: 'nowrap', opacity: groupDisabled ? 0.45 : 1 }}
              >{label}</button>
            );
          })}
        </div>
      )}
      {/* innerRef dimensions are set imperatively by the scale effect — start at 0 to avoid
          a height-overflow flash before the effect runs (which would cause the outer
          overflow-hidden container to briefly clip content). */}
      <div ref={innerRef} className="relative overflow-hidden" style={{ width: 0, height: 0, contain: 'strict' }}>
        <iframe
          ref={iframeRef}
          id={`preview-${device}`}
          title="Preview"
          className={classNames("absolute left-0 top-0 bg-white", {
            "rounded-xl border border-stone-700 shadow-xl": device === "desktop",
            "rounded-[2.5rem] border-[6px] border-stone-900 shadow-xl": device === "mobile",
          })}
          style={{ width: BASE_W[device], height: BASE_H[device] }}
          sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
        />
      </div>
      {/* EditPopup rendered OUTSIDE the overflow:hidden innerRef so it is never clipped.
          It uses the same absolute-coordinate math (event.clientX * scale) because outerRef
          has position:relative and innerRef is at offset (0,0) within it. */}
      {inSelectAndEditMode && !isInteractiveMode && (
        <EditPopup event={clickEvent} iframeRef={iframeRef} doUpdate={doUpdate} scale={scale} />
      )}
      {propsData && isInteractiveMode && createPortal(
        <PropertiesPanel data={propsData} iframeRef={iframeRef} onClose={() => setPropsData(null)} panelTop={panelTop} />,
        document.body
      )}
      {propsData && isInspectMode && !isInteractiveMode && createPortal(
        <InspectPanel data={propsData} onClose={() => { setPropsData(null); setInspectMode(false); }} panelTop={panelTop} />,
        document.body
      )}
      {/* Text Edit Modal — rendered OUTSIDE the iframe via portal so it's fully visible
          even when the mobile preview is CSS-scaled down to a small viewport. */}
      {textEditOpen && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setTextEditOpen(false); iframeRef.current?.contentWindow?.postMessage({ type: 'DESIGNER_TEXT_EDIT_APPLY', text: textEditValue }, '*'); } }}
        >
          <div style={{ background: '#1c1917', border: '1px solid #292524', borderRadius: 12, padding: 18, width: 'min(380px,90vw)', boxShadow: '0 20px 28px rgba(0,0,0,.6)', color: 'white' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace', color: '#f59e0b', textTransform: 'uppercase' }}>Edit Element Text</h4>
            <textarea
              autoFocus
              value={textEditValue}
              onChange={(e) => setTextEditValue(e.target.value)}
              style={{ width: '100%', height: 90, background: '#0c0a09', border: '1px solid #444', borderRadius: 8, padding: 10, color: 'white', fontSize: 13, resize: 'none', outline: 'none', marginBottom: 12, fontFamily: 'sans-serif', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setTextEditOpen(false)}
                style={{ padding: '5px 12px', background: '#292524', border: '1px solid #444', borderRadius: 6, color: '#a8a29e', fontSize: 11, cursor: 'pointer', fontWeight: 'bold' }}
              >Cancel</button>
              <button
                onClick={() => {
                  iframeRef.current?.contentWindow?.postMessage({ type: 'DESIGNER_TEXT_EDIT_APPLY', text: textEditValue }, '*');
                  setTextEditOpen(false);
                }}
                style={{ padding: '5px 14px', background: '#f59e0b', border: 'none', borderRadius: 6, color: '#0c0a09', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}
              >Save</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <p className="mt-2 flex select-none items-center justify-center gap-2 text-center font-mono text-[10px] uppercase tracking-widest text-stone-500">
        <span>{device === "desktop" ? `Desktop - ${BASE_W.desktop}px` : `Mobile - ${BASE_W.mobile}px`}</span>
        {aestheticMode === AestheticMode.HIGH_FI && (
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-amber-500">HIGH-FI</span>
        )}
        {aestheticMode === AestheticMode.WIREFRAME && (
          <span className="rounded border border-zinc-600/40 bg-zinc-800/40 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-zinc-400">WIREFRAME</span>
        )}
        {isInteractiveMode && (
          <span className="animate-pulse rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-emerald-400">EDIT ACTIVE</span>
        )}
        {isInspectMode && !isInteractiveMode && (
          <span className="animate-pulse rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-amber-400">INSPECT ACTIVE</span>
        )}
      </p>
    </div>
  );
}

export default PreviewComponent;
