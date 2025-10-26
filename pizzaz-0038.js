/*! pizzaz-0038.js — fixed
 *  Changes:
 *   - Correct source selection before normalizeData (no early truthy {})
 *   - Listeners installed ASAP to avoid race with structuredContent
 *   - Robust dataset handling: data-pizza-topping / data-pizzatopping
 *   - Safer postMessage + CustomEvent ingestion
 */
(() => {
  'use strict';

  const NS = '[pizzaz]';
  const ROOT_SELECTOR = '#pizzaz-root';

  /** @type {{ pizzaTopping: string|undefined, source: string, _raw: any }} */
  let state = {
    pizzaTopping: undefined,
    source: 'initial',
    _raw: {}
  };

  // -------------------- helpers --------------------

  function normalizeData(src) {
    if (!src || typeof src !== 'object') {
      return { pizzaTopping: undefined, _raw: {} };
    }
    // accept several common key variants
    let topping =
      src.pizzaTopping ??
      src.pizzatopping ??
      src['pizza-topping'] ??
      src.topping;

    if (typeof topping === 'string') topping = topping.trim();
    return { pizzaTopping: topping, _raw: src };
  }

  function readFromGlobals() {
    // Try a few likely globals used by hosts/platforms
    const g =
      (globalThis.__structuredContent && typeof globalThis.__structuredContent === 'object' && globalThis.__structuredContent) ||
      (globalThis.structuredContent && typeof globalThis.structuredContent === 'object' && globalThis.structuredContent) ||
      (globalThis.__PIZZAZ__ && typeof globalThis.__PIZZAZ__ === 'object' && globalThis.__PIZZAZ__) ||
      null;

    if (!g) return null;

    const sc = g && typeof g === 'object' && 'structuredContent' in g && g.structuredContent
      ? g.structuredContent
      : g;

    if (sc && typeof sc === 'object' && (
      'pizzaTopping' in sc || 'pizzatopping' in sc || 'pizza-topping' in sc || 'topping' in sc
    )) {
      return sc;
    }
    return null;
  }

  function readFromDom(rootEl) {
    if (!rootEl) return null;
    const ds = rootEl.dataset || {};
    if ('pizzaTopping' in ds) return { pizzaTopping: ds.pizzaTopping };
    if ('pizzatopping' in ds) return { pizzaTopping: ds.pizzatopping };
    if ('topping' in ds)      return { pizzaTopping: ds.topping };
    return null;
  }

  function readFromUrl() {
    try {
      const p = new URLSearchParams(location.search);
      if (p.has('pizzaTopping'))  return { pizzaTopping: p.get('pizzaTopping') };
      if (p.has('pizza-topping')) return { pizzaTopping: p.get('pizza-topping') };
      if (p.has('topping'))       return { pizzaTopping: p.get('topping') };
    } catch {}
    return null;
  }

  // Choose source BEFORE normalizing to avoid truthy {} swallowing other sources
  function initialData(rootEl) {
    const src =
      readFromGlobals() ||
      readFromDom(rootEl) ||
      readFromUrl() ||
      null;
    return normalizeData(src);
  }

  function setState(next, source) {
    const prev = state;
    state = {
      pizzaTopping: next.pizzaTopping,
      source: source || prev.source,
      _raw: next._raw ?? next
    };
    render();
  }

  function updateFrom(src, source) {
    const norm = normalizeData(src);
    setState(norm, source);
    console.debug(NS, 'update <-', source, norm);
  }

  // -------------------- listeners --------------------

  function onMessage(ev) {
    const data = ev?.data;
    if (!data) return;

    // Prefer explicit structuredContent envelope
    if (data && typeof data === 'object' && 'structuredContent' in data) {
      return updateFrom(data.structuredContent, 'postMessage/structuredContent');
    }
    // Or accept a plain object with known keys
    if (typeof data === 'object' && (
      'pizzaTopping' in data || 'pizzatopping' in data || 'pizza-topping' in data || 'topping' in data
    )) {
      return updateFrom(data, 'postMessage');
    }
  }

  function onCustomEvent(ev) {
    const detail = ev?.detail;
    if (!detail) return;
    if (detail && typeof detail === 'object' && 'structuredContent' in detail) {
      updateFrom(detail.structuredContent, 'CustomEvent/structuredContent');
    } else {
      updateFrom(detail, 'CustomEvent');
    }
  }

  function setupListeners() {
    // Install ASAP to avoid racing the host's initial message
    globalThis.addEventListener('message', onMessage);
    globalThis.addEventListener('pizzaz:structuredContent', onCustomEvent);

    // Debug/escape hatch
    globalThis.__setPizzaTopping = (t) => updateFrom({ pizzaTopping: t }, 'global');
    globalThis.__getPizzaState = () => ({ ...state });
  }

  setupListeners(); // <— install immediately at module eval time

  // -------------------- UI --------------------

  let ui = null;

  function mountUI(root) {
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'pz-wrap';

    wrap.innerHTML = `
      <div class="pz-card">
        <h1>🍕 Pizza Map (demo)</h1>

        <div class="pz-row">
          <div class="pz-label">topping</div>
          <div class="pz-value" id="pz-topping">— не задан —</div>
        </div>

        <div class="pz-row">
          <label for="pz-input" class="pz-label">введите topping...</label>
          <input id="pz-input" class="pz-input" placeholder="pepperoni" />
          <button id="pz-apply" class="pz-btn">Применить</button>
        </div>

        <details class="pz-details">
          <summary>source raw:</summary>
          <pre id="pz-raw">{}</pre>
        </details>

        <div class="pz-hint">
          Источники: structuredContent от платформы, postMessage/CustomEvent, data-атрибуты, query-параметр.
          Можно руками: <code>window.__setPizzaTopping('pepperoni')</code>
        </div>
      </div>
    `;
    root.appendChild(wrap);

    ui = {
      topping: wrap.querySelector('#pz-topping'),
      input:   wrap.querySelector('#pz-input'),
      apply:   wrap.querySelector('#pz-apply'),
      raw:     wrap.querySelector('#pz-raw')
    };

    ui.apply.addEventListener('click', () => {
      const v = ui.input.value.trim();
      updateFrom({ pizzaTopping: v }, 'input');
    });
  }

  function render() {
    if (!ui) return;
    const t = state.pizzaTopping;
    ui.topping.textContent = (t && String(t)) || '— не задан —';

    const dbg = {
      source: state.source,
      structuredContent: { pizzaTopping: state.pizzaTopping },
      raw: state._raw
    };
    ui.raw.textContent = JSON.stringify(dbg, null, 2);
  }

  // -------------------- boot --------------------

  function boot() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) {
      console.warn(NS, 'Root element not found:', ROOT_SELECTOR);
      return;
    }
    mountUI(root);
    const init = initialData(root);
    setState(init, 'initial');
    console.info(NS, 'initial STATE', state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
