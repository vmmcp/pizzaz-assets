// ПРИЁМ structuredContent и pizzaTopping из максимально широкого набора мест,
// чтобы проще тестировать: платформа, postMessage, CustomEvent, URL, data-* и т.п.

(function () {
  const ROOT_ID = 'pizzaz-root';

  function $(sel, root = document) { return root.querySelector(sel); }

  function log(...args) {
    // Помогает видеть, что реально прилетело
    console.log('[pizzaz]', ...args);
  }

  function safeJsonParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function readFromUrl() {
    const url = new URL(window.location.href);
    const topping = url.searchParams.get('pizzaTopping');
    return topping ? { pizzaTopping: topping } : null;
  }

  function readFromDom(rootEl) {
    if (!rootEl) return null;
    const ds = rootEl.dataset || {};
    if (ds.pizzatopping) return { pizzaTopping: ds.pizzatopping };

    // <script type="application/json" id="structured-content">...</script>
    const el = document.getElementById('structured-content');
    if (el && el.textContent) {
      const json = safeJsonParse(el.textContent, null);
      if (json && typeof json === 'object') return json;
    }
    return null;
  }

  function readFromGlobals() {
    // Популярные "глобалки", на которые могли положить structuredContent
    const candidates = [
      window.__OPENAI_WIDGET__,
      window.__WIDGET_DATA__,
      window.__structuredContent,
      window.openai && window.openai.structuredContent,
      window.__OPENAI__,
    ].filter(Boolean);

    for (const c of candidates) {
      if (c && typeof c === 'object') {
        // либо целиком structuredContent, либо прямо pizzaTopping на корне
        if (c.structuredContent && typeof c.structuredContent === 'object') {
          return c.structuredContent;
        }
        if ('pizzaTopping' in c) return { pizzaTopping: c.pizzaTopping };
      }
    }
    return null;
  }

  function normalizeData(data) {
    if (!data || typeof data !== 'object') return { pizzaTopping: undefined, _raw: {} };
    const pizzaTopping = data.pizzaTopping ?? data.topping ?? data.pizza ?? undefined;
    return { pizzaTopping, _raw: data };
  }

  function initialData(rootEl) {
    // приоритет: платформа/глобалки -> DOM -> URL -> пусто
    return (
      normalizeData(readFromGlobals()) ||
      normalizeData(readFromDom(rootEl)) ||
      normalizeData(readFromUrl()) ||
      { pizzaTopping: undefined, _raw: {} }
    );
  }

  function render(state) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    const toppingText = state.pizzaTopping ? String(state.pizzaTopping) : '— не задан —';

    root.innerHTML = `
      <div class="pz-header">
        <div class="pz-title">🍕 Pizza Map (demo)</div>
        <div class="pz-badge">topping</div>
      </div>

      <div class="pz-card">
        <div class="pz-kv">
          <div class="k">pizzaTopping:</div>
          <div class="v" id="pz-topping-value">${escapeHtml(toppingText)}</div>

          <div class="k">source raw:</div>
          <div class="v"><pre style="margin:0;white-space:pre-wrap">${escapeHtml(JSON.stringify(state._raw ?? {}, null, 2))}</pre></div>
        </div>

        <div class="pz-row">
          <input class="pz-input" id="pz-input" placeholder="введите topping..." value="${escapeAttr(state.pizzaTopping ?? '')}"/>
          <button class="pz-btn" id="pz-apply">Применить</button>
        </div>

        <div class="pz-note">
          Источники: structuredContent от платформы, postMessage/CustomEvent, data-атрибуты, query-параметр.<br/>
          Можно руками: <code>window.__setPizzaTopping('pepperoni')</code>
        </div>
      </div>
    `;

    // Локальное изменение, чтобы быстро проверить
    $('#pz-apply')?.addEventListener('click', () => {
      const val = $('#pz-input')?.value ?? '';
      update({ pizzaTopping: val }, 'local');
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
  function escapeAttr(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;');
  }

  // Глобальная точка входа для ручного теста
  window.__setPizzaTopping = function (topping) {
    update({ pizzaTopping: topping }, 'global');
  };

  // Обновление состояния из любого источника
  let STATE = { pizzaTopping: undefined, _raw: {} };

  function update(data, source = 'unknown') {
    const normalized = normalizeData(data);
    // Обновляем "сырой" источник для визуализации
    STATE = { pizzaTopping: normalized.pizzaTopping, _raw: { ...(STATE._raw || {}), ...data, _source: source } };
    log('update <-', source, STATE);
    render(STATE);
  }

  // Подписки на разные варианты доставки structuredContent
  function setupListeners() {
    // 1) postMessage
    window.addEventListener('message', (event) => {
      const d = event?.data;
      if (!d || typeof d !== 'object') return;

      // часто платформы кладут либо structuredContent, либо прямо ключи
      if (d.structuredContent && typeof d.structuredContent === 'object') {
        update(d.structuredContent, 'postMessage.structuredContent');
      } else if ('pizzaTopping' in d) {
        update({ pizzaTopping: d.pizzaTopping }, 'postMessage.direct');
      }
    });

    // 2) CustomEvent на window/document
    function ceHandler(e) {
      const d = e?.detail;
      if (d && typeof d === 'object') {
        if (d.structuredContent) update(d.structuredContent, 'CustomEvent.structuredContent');
        else if ('pizzaTopping' in d) update({ pizzaTopping: d.pizzaTopping }, 'CustomEvent.direct');
      }
    }
    window.addEventListener('openai:structured-content', ceHandler);
    document.addEventListener('openai:structured-content', ceHandler);

    // 3) Fallback: периодическая проверка глобалок (на случай ленивой инициализации)
    let polls = 0;
    const iv = setInterval(() => {
      polls += 1;
      const g = readFromGlobals();
      if (g && g.pizzaTopping !== undefined) {
        update(g, 'poll.globals');
        clearInterval(iv);
      }
      if (polls > 30) clearInterval(iv);
    }, 300);
  }

  function boot() {
    const root = document.getElementById(ROOT_ID);
    if (!root) {
      log(`Не найден #${ROOT_ID} — виджет не инициализирован`);
      return;
    }
    STATE = initialData(root);
    log('initial STATE', STATE);
    render(STATE);
    setupListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
