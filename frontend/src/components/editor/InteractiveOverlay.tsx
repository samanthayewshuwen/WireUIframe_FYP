import { useCallback, useEffect } from "react";
import type { RefObject } from "react";
import { useAppStore } from "../../store/app-store";

interface Props {
  iframeRef: RefObject<HTMLIFrameElement>;
}

const buildEditorScript = () => String.raw`
(function () {
  if (window.__designerRuntimeActive) return;
  window.__designerRuntimeActive = true;

  /* ═══════════════════════════════════════════════════════════════════════
     CANVAS ARCHITECTURE
     ─────────────────────────────────────────────────────────────────────
     On entry we snapshot every element's viewport rect, then convert ALL
     elements to position:absolute with explicit px coords.  After that:
       • Drag   = update left/top on the already-absolute element only
       • Resize = update width/height on the already-absolute element only
       • Zero DOM surgery, zero sibling reflow, zero children overflowing
     This mirrors how Visily/Figma handle their canvas.
  ═══════════════════════════════════════════════════════════════════════ */

  var SEL  = null;   /* selected element */
  var HOV  = null;   /* hovered  element */
  var DRAG = null;   /* { el, startX, startY, startL, startT } */

  /* Tags we never touch */
  var SKIP = ['html','head','body','script','style','meta','link','title',
              'noscript','template','svg','path','circle','rect','polygon',
              'polyline','line','ellipse','text','tspan','defs','g','use',
              'symbol','clipPath','mask','filter','lineargradient',
              'radialgradient','stop','animate','animatetransform',
              'animatemotion','set'];

  function isDesigner(el) {
    return !!(el && el.closest && (
      el.closest('#__designer-toolbar')  ||
      el.closest('#__designer-inspector')||
      el.closest('#__designer-modal')    ||
      el.closest('#__designer-delete')
    ));
  }

  function isCanvasEl(el) {
    return !!(el && el.dataset && el.dataset.cvEl === '1');
  }

  function isSkippable(el) {
    if (!el || el === document.body || el === document.documentElement) return true;
    if (isDesigner(el)) return true;
    return SKIP.includes((el.tagName || '').toLowerCase());
  }

  /* Walk up from click target to find nearest canvas element */
  function findCanvasEl(target) {
    var el = target;
    while (el && el !== document.body) {
      if (isCanvasEl(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  /* ── CSS injection ───────────────────────────────────────────────────── */
  var styleTag = document.createElement('style');
  styleTag.id  = '__designer-runtime-styles';
  styleTag.textContent =
    '.dv-hov{outline:2px dashed #f59e0b!important;outline-offset:-1px!important;cursor:grab!important}' +
    '.dv-sel{outline:2.5px solid #38bdf8!important;outline-offset:-1px!important;' +
             'box-shadow:0 0 0 3px rgba(56,189,248,.18)!important;cursor:grab!important;z-index:100!important}' +
    '.dv-drag{opacity:.75!important;cursor:grabbing!important;z-index:9999!important;' +
              'outline:2px dashed #38bdf8!important;outline-offset:-1px!important}';
  document.head.appendChild(styleTag);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function S(el, css) { el.style.cssText = css; }

  function btn(label, title, danger) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.title = title || label;
    S(b, 'border:1px solid ' + (danger ? '#7f1d1d' : '#44403c') + ';background:#1c1917;' +
         'color:' + (danger ? '#f87171' : '#f5f5f4') + ';border-radius:7px;' +
         'padding:8px 14px;font:700 13px ui-sans-serif,system-ui;cursor:pointer;white-space:nowrap;flex-shrink:0');
    b.addEventListener('mouseenter', function () { this.style.background = danger ? '#450a0a' : '#292524'; });
    b.addEventListener('mouseleave', function () { this.style.background = '#1c1917'; });
    return b;
  }

  function field(label, inp) {
    var w = document.createElement('label');
    S(w, 'display:grid;gap:4px;color:#a8a29e;font:700 10px ui-monospace,monospace;' +
         'text-transform:uppercase;letter-spacing:.04em');
    var s = document.createElement('span'); s.textContent = label;
    w.appendChild(s); w.appendChild(inp); return w;
  }

  function numInput(min) {
    var i = document.createElement('input'); i.type = 'number'; i.min = String(min || 0);
    S(i, 'width:100%;background:#1c1917;color:#fff;border:1px solid #44403c;' +
         'border-radius:6px;padding:6px 8px;font-size:12px;box-sizing:border-box');
    return i;
  }

  function rangeInput(min, max, val) {
    var i = document.createElement('input');
    i.type = 'range'; i.min = String(min); i.max = String(max); i.value = String(val);
    return i;
  }

  /* ── TOOLBAR (2-row, big) ────────────────────────────────────────────── */
  var toolbar = document.createElement('div');
  toolbar.id  = '__designer-toolbar';
  S(toolbar, 'position:fixed;display:none;flex-direction:column;z-index:2147483647;' +
             'padding:12px 14px;background:#0c0a09;color:#fff;border:1.5px solid #292524;' +
             'border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.72);gap:9px');

  var row1 = document.createElement('div');
  S(row1, 'display:flex;flex-direction:row;align-items:center;gap:7px;flex-wrap:nowrap');
  var row2 = document.createElement('div');
  S(row2, 'display:flex;flex-direction:row;align-items:center;gap:7px;flex-wrap:nowrap');

  var tagLabel = document.createElement('span');
  S(tagLabel, 'background:#292524;color:#f59e0b;border:1px solid #44403c;border-radius:6px;' +
              'padding:7px 11px;font:800 12px ui-monospace,monospace;text-transform:uppercase;' +
              'letter-spacing:.05em;white-space:nowrap;flex-shrink:0');

  var bParent = btn('⬆ Parent',   'Select parent element');
  var bUp     = btn('↑ Up',       'Move before previous sibling');
  var bDown   = btn('↓ Down',     'Move after next sibling');
  var bClose  = btn('✕ Close',    'Deselect', true);
  var bReset  = btn('↺ Reset',    'Reset position to original');
  var bText   = btn('✎ Text',     'Edit inner text');
  var bSave   = btn('⊕ Save',     'Save as reusable block');
  var bDelete = btn('🗑 Delete',   'Remove element', true);

  [tagLabel, bParent, bUp, bDown, bClose].forEach(function (e) { row1.appendChild(e); });
  [bReset,   bText,   bSave, bDelete  ].forEach(function (e) { row2.appendChild(e); });
  toolbar.appendChild(row1); toolbar.appendChild(row2);
  document.body.appendChild(toolbar);

  /* ── INSPECTOR ───────────────────────────────────────────────────────── */
  var inspector = document.createElement('aside');
  inspector.id  = '__designer-inspector';
  S(inspector, 'position:fixed;right:14px;top:14px;bottom:14px;width:255px;z-index:2147483646;' +
               'display:none;overflow-y:auto;background:#0c0a09;color:#f5f5f4;' +
               'border:1px solid #292524;border-radius:12px;' +
               'box-shadow:0 20px 40px rgba(0,0,0,.6);padding:14px;font-family:ui-sans-serif,system-ui');
  var iTitle = document.createElement('div');
  iTitle.textContent = 'Element Properties';
  S(iTitle, 'font:800 11px ui-monospace,monospace;text-transform:uppercase;color:#f59e0b;' +
            'margin-bottom:12px;letter-spacing:.05em');
  inspector.appendChild(iTitle);

  var iX = numInput(0);   inspector.appendChild(field('X (px)', iX));
  var iY = numInput(0);   inspector.appendChild(field('Y (px)', iY));
  var iW = numInput(10);  inspector.appendChild(field('Width (px)', iW));
  var iH = numInput(4);   inspector.appendChild(field('Height (px)', iH));
  var iBorder = rangeInput(0, 12, 0);  inspector.appendChild(field('Border Width', iBorder));
  var iRadius = rangeInput(0, 48, 0);  inspector.appendChild(field('Corner Radius', iRadius));
  var iFontSz = rangeInput(8,  72, 16); inspector.appendChild(field('Font Size',    iFontSz));
  var iBg   = document.createElement('input'); iBg.type   = 'color'; iBg.value   = '#ffffff';
  inspector.appendChild(field('Background', iBg));
  var iColor = document.createElement('input'); iColor.type = 'color'; iColor.value = '#111827';
  inspector.appendChild(field('Text Color', iColor));
  document.body.appendChild(inspector);

  /* ── TEXT MODAL ──────────────────────────────────────────────────────── */
  var textModal = document.createElement('div');
  textModal.id  = '__designer-modal';
  S(textModal, 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);' +
               'display:none;align-items:center;justify-content:center');
  textModal.innerHTML =
    '<div style="width:340px;background:#1c1917;border:1px solid #292524;border-radius:12px;' +
    'padding:16px;color:white;font-family:ui-sans-serif">' +
    '<h4 style="margin:0 0 10px;color:#f59e0b;font:800 11px ui-monospace;text-transform:uppercase">Edit Text</h4>' +
    '<textarea id="__dt" style="width:100%;height:110px;background:#0c0a09;color:white;' +
    'border:1px solid #44403c;border-radius:8px;padding:10px;box-sizing:border-box"></textarea>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">' +
    '<button id="__dt-cancel" style="padding:7px 10px;background:#292524;color:#d6d3d1;' +
    'border:1px solid #44403c;border-radius:7px">Cancel</button>' +
    '<button id="__dt-save" style="padding:7px 12px;background:#f59e0b;color:#0c0a09;' +
    'border:0;border-radius:7px;font-weight:800">Save</button></div></div>';
  document.body.appendChild(textModal);
  var textArea = textModal.querySelector('#__dt');
  textModal.querySelector('#__dt-cancel').onclick = function () { textModal.style.display = 'none'; };
  textModal.querySelector('#__dt-save').onclick   = function () {
    if (SEL) { SEL.textContent = textArea.value; postUpdates(); }
    textModal.style.display = 'none';
  };

  /* ── DELETE MODAL ────────────────────────────────────────────────────── */
  var delModal = document.createElement('div');
  delModal.id  = '__designer-delete';
  S(delModal, 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);' +
              'display:none;align-items:center;justify-content:center');
  delModal.innerHTML =
    '<div style="width:300px;background:#1c1917;border:1px solid #292524;border-radius:12px;' +
    'padding:16px;color:white;text-align:center;font-family:ui-sans-serif">' +
    '<h4 style="margin:0 0 8px;color:#ef4444;font:800 12px ui-monospace;text-transform:uppercase">Delete element?</h4>' +
    '<p style="margin:0 0 14px;color:#d6d3d1;font-size:12px">This permanently removes it from the canvas.</p>' +
    '<button id="__dd-cancel" style="padding:7px 10px;background:#292524;color:#d6d3d1;' +
    'border:1px solid #44403c;border-radius:7px;margin-right:8px">Cancel</button>' +
    '<button id="__dd-ok" style="padding:7px 12px;background:#ef4444;color:white;' +
    'border:0;border-radius:7px;font-weight:800">Delete</button></div>';
  document.body.appendChild(delModal);
  delModal.querySelector('#__dd-cancel').onclick = function () { delModal.style.display = 'none'; };
  delModal.querySelector('#__dd-ok').onclick     = function () {
    if (SEL) {
      SEL.remove(); SEL = null;
      toolbar.style.display   = 'none';
      inspector.style.display = 'none';
      postUpdates();
    }
    delModal.style.display = 'none';
  };

  /* ── CANVAS CONVERSION ───────────────────────────────────────────────── */
  function canvasifyAll() {
    /* Step 1 — snapshot every element's viewport rect BEFORE any DOM mutation */
    var allEls = Array.prototype.slice.call(document.body.querySelectorAll('*'));
    var snap   = new Map();

    /* Body is the root canvas */
    snap.set(document.body, { r: document.body.getBoundingClientRect(), bl: 0, bt: 0 });

    allEls.forEach(function (el) {
      if (isSkippable(el) || isDesigner(el)) return;
      var r  = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      var cs = getComputedStyle(el);
      snap.set(el, {
        r  : r,
        bl : parseFloat(cs.borderLeftWidth) || 0,
        bt : parseFloat(cs.borderTopWidth)  || 0
      });
    });

    /* Step 2 — make body the positioned canvas root */
    document.body.style.position  = 'relative';
    document.body.style.minHeight = Math.max(
      document.documentElement.clientHeight,
      document.body.scrollHeight
    ) + 'px';

    /* Step 3 — canvasify in document order (Map preserves insertion = DOM order,
       which is parents before children for querySelectorAll) */
    snap.forEach(function (info, el) {
      if (el === document.body) return;

      var parent     = el.parentElement || document.body;
      var parentInfo = snap.get(parent) || snap.get(document.body);
      if (!parentInfo) return;

      var pr  = parentInfo.r;
      var sl  = (parent === document.body) ? (window.scrollX || 0) : (parent.scrollLeft || 0);
      var st  = (parent === document.body) ? (window.scrollY || 0) : (parent.scrollTop  || 0);

      /* Position relative to parent's padding edge (inside border) */
      var relL = info.r.left - pr.left - parentInfo.bl + sl;
      var relT = info.r.top  - pr.top  - parentInfo.bt + st;

      /* Freeze parent as a positioned containing block */
      if (parent !== document.body && !parent.dataset.cvFrozen) {
        if (getComputedStyle(parent).position === 'static') {
          parent.style.position = 'relative';
        }
        parent.style.width    = Math.round(pr.width)  + 'px';
        parent.style.height   = Math.round(pr.height) + 'px';
        parent.style.overflow = 'hidden';
        parent.dataset.cvFrozen = '1';
      }

      /* Convert element to absolute canvas node */
      el.style.position  = 'absolute';
      el.style.left      = Math.round(relL)         + 'px';
      el.style.top       = Math.round(relT)          + 'px';
      el.style.width     = Math.round(info.r.width)  + 'px';
      el.style.height    = Math.round(info.r.height) + 'px';
      el.style.margin    = '0';
      el.style.flexShrink = '0';
      el.style.boxSizing = 'border-box';
      el.dataset.cvEl    = '1';
      /* Store original position for Reset */
      el.dataset.cvOrigL = el.style.left;
      el.dataset.cvOrigT = el.style.top;
    });
  }

  /* ── CLEAN HTML ──────────────────────────────────────────────────────── */
  function getCleanHtml() {
    var doc = document.documentElement.cloneNode(true);
    ['#__designer-toolbar','#__designer-inspector','#__designer-modal',
     '#__designer-delete','#__designer-runtime-styles'].forEach(function (s) {
      doc.querySelectorAll(s).forEach(function (n) { n.remove(); });
    });
    doc.querySelectorAll('.dv-hov,.dv-sel,.dv-drag').forEach(function (n) {
      n.classList.remove('dv-hov','dv-sel','dv-drag');
    });
    /* Strip session-only attributes; keep left/top/width/height styles (canvas layout) */
    doc.querySelectorAll('[data-cv-frozen],[data-cv-orig-l],[data-cv-orig-t]').forEach(function (n) {
      n.removeAttribute('data-cv-frozen');
      n.removeAttribute('data-cv-orig-l');
      n.removeAttribute('data-cv-orig-t');
    });
    return '<!DOCTYPE html>\n' + doc.outerHTML;
  }

  function postUpdates() {
    window.parent.postMessage({ type: 'DESIGNER_DOM_UPDATED', html: getCleanHtml() }, '*');
  }

  /* ── TOOLBAR POSITION ────────────────────────────────────────────────── */
  function placeToolbar() {
    if (!SEL) return;
    var rect = SEL.getBoundingClientRect();
    toolbar.style.visibility = 'hidden';
    toolbar.style.display    = 'flex';
    var tw = toolbar.offsetWidth  || 420;
    var th = toolbar.offsetHeight || 82;
    toolbar.style.visibility = '';
    var left = Math.max(8, Math.min(window.innerWidth  - tw - 8, rect.left));
    var top  = (rect.top - th - 10 >= 8) ? (rect.top - th - 10) : (rect.bottom + 10);
    top = Math.max(8, Math.min(window.innerHeight - th - 8, top));
    toolbar.style.left = left + 'px';
    toolbar.style.top  = top  + 'px';
    tagLabel.textContent = SEL.dataset.componentCategory || SEL.tagName.toLowerCase();
  }

  /* ── INSPECTOR SYNC ──────────────────────────────────────────────────── */
  function syncInspector() {
    if (!SEL) return;
    inspector.style.display = 'block';
    iX.value = Math.round(parseFloat(SEL.style.left)   || 0);
    iY.value = Math.round(parseFloat(SEL.style.top)    || 0);
    iW.value = Math.round(parseFloat(SEL.style.width)  || SEL.offsetWidth);
    iH.value = Math.round(parseFloat(SEL.style.height) || SEL.offsetHeight);
    var cs = getComputedStyle(SEL);
    iBorder.value = String(parseInt(cs.borderWidth)  || 0);
    iRadius.value = String(parseInt(cs.borderRadius) || 0);
    iFontSz.value = String(parseInt(cs.fontSize)     || 16);
  }

  function applyInspector() {
    if (!SEL) return;
    var x = parseFloat(iX.value), y = parseFloat(iY.value);
    var w = parseFloat(iW.value), h = parseFloat(iH.value);
    if (!isNaN(x)) SEL.style.left   = x + 'px';
    if (!isNaN(y)) SEL.style.top    = y + 'px';
    if (!isNaN(w)) SEL.style.width  = w + 'px';
    if (!isNaN(h)) SEL.style.height = h + 'px';
    SEL.style.borderWidth  = iBorder.value + 'px';
    SEL.style.borderStyle  = Number(iBorder.value) > 0 ? 'solid' : 'none';
    SEL.style.borderRadius = iRadius.value + 'px';
    SEL.style.fontSize     = iFontSz.value + 'px';
    SEL.style.backgroundColor = iBg.value;
    SEL.style.color        = iColor.value;
    /* Clip children so they can't visually escape the resized boundary */
    if (SEL.children.length > 0) SEL.style.overflow = 'hidden';
    placeToolbar();
    postUpdates();
  }

  [iX, iY, iW, iH, iBorder, iRadius, iFontSz, iBg, iColor].forEach(function (inp) {
    inp.addEventListener('input',  applyInspector);
    inp.addEventListener('change', applyInspector);
  });

  /* ── SELECT ──────────────────────────────────────────────────────────── */
  function selectEl(el) {
    if (!el || !isCanvasEl(el)) return;
    if (SEL && SEL !== el) SEL.classList.remove('dv-sel');
    SEL = el;
    SEL.classList.add('dv-sel');
    placeToolbar();
    syncInspector();
  }

  /* ── HOVER ───────────────────────────────────────────────────────────── */
  document.addEventListener('mouseover', function (e) {
    var t = findCanvasEl(e.target);
    if (!t || isDesigner(t)) return;
    if (HOV && HOV !== t) HOV.classList.remove('dv-hov');
    HOV = t; HOV.classList.add('dv-hov');
  }, true);

  document.addEventListener('mouseout', function (e) {
    var t = findCanvasEl(e.target);
    if (HOV && (HOV === e.target || HOV === t)) {
      HOV.classList.remove('dv-hov'); HOV = null;
    }
  }, true);

  /* ── CLICK TO SELECT ─────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    if (isDesigner(e.target)) return;
    var t = findCanvasEl(e.target);
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    selectEl(t);
  }, true);

  /* ── DRAG — pure left/top update, NO DOM moves, NO siblings touched ─── */
  document.addEventListener('mousedown', function (e) {
    if (isDesigner(e.target)) return;
    var t = findCanvasEl(e.target);
    if (!t) return;
    selectEl(t);
    if (!SEL) return;
    DRAG = {
      el:     SEL,
      startX: e.clientX,
      startY: e.clientY,
      startL: parseFloat(SEL.style.left) || 0,
      startT: parseFloat(SEL.style.top)  || 0
    };
    SEL.classList.add('dv-drag');
    SEL.classList.remove('dv-sel');
    e.preventDefault(); e.stopPropagation();
  }, true);

  document.addEventListener('mousemove', function (e) {
    if (!DRAG) return;
    var dx = e.clientX - DRAG.startX;
    var dy = e.clientY - DRAG.startY;
    var nl = DRAG.startL + dx;
    var nt = DRAG.startT + dy;
    DRAG.el.style.left = nl + 'px';
    DRAG.el.style.top  = nt + 'px';
    iX.value = Math.round(nl);
    iY.value = Math.round(nt);
    placeToolbar();
    e.preventDefault();
  }, true);

  document.addEventListener('mouseup', function () {
    if (!DRAG) return;
    DRAG.el.classList.remove('dv-drag');
    DRAG.el.classList.add('dv-sel');
    DRAG = null;
    postUpdates();
  }, true);

  /* ── TOOLBAR BUTTONS ─────────────────────────────────────────────────── */
  bParent.onclick = function (e) {
    e.preventDefault();
    if (SEL && isCanvasEl(SEL.parentElement)) selectEl(SEL.parentElement);
  };
  bUp.onclick = function (e) {
    e.preventDefault();
    if (!SEL || !SEL.previousElementSibling) return;
    SEL.parentNode.insertBefore(SEL, SEL.previousElementSibling);
    postUpdates(); placeToolbar();
  };
  bDown.onclick = function (e) {
    e.preventDefault();
    if (!SEL || !SEL.nextElementSibling) return;
    SEL.parentNode.insertBefore(SEL.nextElementSibling, SEL);
    postUpdates(); placeToolbar();
  };
  bReset.onclick = function (e) {
    e.preventDefault();
    if (!SEL) return;
    if (SEL.dataset.cvOrigL) SEL.style.left = SEL.dataset.cvOrigL;
    if (SEL.dataset.cvOrigT) SEL.style.top  = SEL.dataset.cvOrigT;
    syncInspector(); postUpdates(); placeToolbar();
  };
  bText.onclick = function (e) {
    e.preventDefault();
    if (!SEL) return;
    textArea.value = (SEL.innerText || SEL.textContent || '').trim();
    textModal.style.display = 'flex'; textArea.focus();
  };
  bSave.onclick = function (e) {
    e.preventDefault();
    if (!SEL) return;
    window.parent.postMessage({ type: 'DESIGNER_SAVE_COMPONENT', html: SEL.outerHTML, tagName: SEL.tagName }, '*');
  };
  bDelete.onclick = function (e) {
    e.preventDefault();
    if (SEL) delModal.style.display = 'flex';
  };
  bClose.onclick = function (e) {
    e.preventDefault();
    if (SEL) SEL.classList.remove('dv-sel');
    SEL = null;
    toolbar.style.display   = 'none';
    inspector.style.display = 'none';
  };

  /* ── EXTERNAL COMPONENT INSERT ───────────────────────────────────────── */
  window.addEventListener('message', function (evt) {
    if (!evt.data || evt.data.type !== 'DESIGNER_INSERT_COMPONENT') return;
    var tmp = document.createElement('div');
    tmp.innerHTML = (evt.data.html || '').trim();
    var newEl = tmp.firstElementChild;
    if (!newEl) return;
    newEl.style.position = 'absolute';
    newEl.style.left     = '20px';
    newEl.style.top      = '20px';
    newEl.style.boxSizing = 'border-box';
    newEl.dataset.cvEl   = '1';
    document.body.appendChild(newEl);
    selectEl(newEl);
    postUpdates();
  });

  window.addEventListener('message', function (evt) {
    if (!evt.data || evt.data.type !== 'DESIGNER_SAVE_COMPONENT') return;
    window.dispatchEvent(new CustomEvent('designer:save-component', {
      detail: { html: evt.data.html, tagName: evt.data.tagName }
    }));
  });

  /* ── BOOT ────────────────────────────────────────────────────────────── */
  canvasifyAll();

})();
`;

const CLEANUP_SCRIPT = String.raw`
(function() {
  window.__designerRuntimeActive = false;
  ["#__designer-toolbar","#__designer-inspector","#__designer-modal",
   "#__designer-delete","#__designer-runtime-styles"].forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(n) { n.remove(); });
  });
  document.querySelectorAll(".dv-hov,.dv-sel,.dv-drag").forEach(function(n) {
    n.classList.remove("dv-hov","dv-sel","dv-drag");
  });
})();
`;

function InteractiveOverlay({ iframeRef }: Props) {
  const { isInteractiveMode } = useAppStore();

  const runInIframe = useCallback(
    (scriptText: string) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow?.document?.body) return;
      const script = iframe.contentWindow.document.createElement("script");
      script.textContent = scriptText;
      iframe.contentWindow.document.body.appendChild(script);
      script.remove();
    },
    [iframeRef]
  );

  const injectRuntime = useCallback(() => {
    // If PreviewComponent's runtime (injectEditorRuntime) is already active, skip injection.
    // Both runtimes conflict: they use different element namespaces (__dsr-* vs __designer-*),
    // and their canvasify + event-listener approaches interfere with each other.
    const iframe = iframeRef.current;
    if (iframe?.contentDocument?.querySelector('#__dsr-toolbar')) return;
    runInIframe(CLEANUP_SCRIPT);
    runInIframe(buildEditorScript());
  }, [runInIframe, iframeRef]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (isInteractiveMode) {
      const tryInject = () => {
        if (iframe.contentDocument?.body) injectRuntime();
      };
      iframe.addEventListener("load", tryInject);
      if (["complete", "interactive"].includes(iframe.contentDocument?.readyState ?? "")) {
        injectRuntime();
      }
      return () => iframe.removeEventListener("load", tryInject);
    }

    if (iframe.contentDocument?.body) runInIframe(CLEANUP_SCRIPT);
  }, [iframeRef, injectRuntime, isInteractiveMode, runInIframe]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "DESIGNER_SAVE_COMPONENT") return;
      window.dispatchEvent(
        new CustomEvent("designer:save-component", {
          detail: { html: event.data.html, tagName: event.data.tagName },
        })
      );
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

export default InteractiveOverlay;
