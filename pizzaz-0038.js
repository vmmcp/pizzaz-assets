(() => {
  const ROOT_ID = "toolOutput-root";

  // ——— helpers ———
  const ensureRoot = () => {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    root.style.background = "white";
    root.style.minHeight = "500px";
    root.style.padding = "10px";
    return root;
  };

  const render = () => {
    const root = ensureRoot();
    root.innerHTML = ""; // очистка

    const data = window.openai?.toolOutput ?? null;

    if (!data) {
      root.textContent = "ждём данные… (window.openai.toolOutput пуст)";
      return;
    }

    const ul = document.createElement("ul");
    for (const key of Object.keys(data)) {
      const li = document.createElement("li");
      const value = data[key];
      li.textContent = `${key}: ${
        typeof value === "object" ? JSON.stringify(value) : String(value)
      }`;
      ul.appendChild(li);
    }
    root.appendChild(ul);
  };

  // ——— start once DOM is ready ———
  const start = () => {
    render(); // первичный рендер (может показать «ждём данные…»)

    // подписка на обновления от хоста ChatGPT
    const SET_GLOBALS = "openai:set_globals";
    const onSetGlobals = (evt) => {
      // перерисовываем только если реально пришло новое toolOutput
      if (evt?.detail?.globals && "toolOutput" in evt.detail.globals) {
        render();
      }
    };
    window.addEventListener(SET_GLOBALS, onSetGlobals, { passive: true });

    // на всякий случай дернём рендер ещё раз чуть позже —
    // полезно, если initial toolOutput прилетит сразу после монтирования
    setTimeout(render, 0);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
