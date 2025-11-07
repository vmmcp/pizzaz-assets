// Показ window.openai.toolOutput + реактивные обновления без перезагрузки
(() => {
  const SET_GLOBALS_EVENT_TYPE =
    window.SET_GLOBALS_EVENT_TYPE || "openai:set-globals";

  const rootId = "toolinput-root";

  function ensureOpenAI() {
    if (!window.openai) window.openai = {};
    return window.openai;
  }

  // делаем ключ window.openai.toolOutput реактивным: любое присваивание -> событие
  function makeReactiveToolOutput() {
    const openai = ensureOpenAI();

    // сохраним текущее значение, если уже было
    let _toolOutput = openai.toolOutput;

    // если уже есть наш getter/setter — повторно не переопределяем
    const desc = Object.getOwnPropertyDescriptor(openai, "toolOutput");
    if (desc && (desc.get || desc.set)) return;

    Object.defineProperty(openai, "toolOutput", {
      configurable: true,
      enumerable: true,
      get() {
        return _toolOutput ?? null;
      },
      set(v) {
        _toolOutput = v;
        // кладём также на верхний уровень для снапшота хука useOpenAiGlobal('toolOutput')
        // (он как раз читает window.openai?.toolOutput)
        // и эмитим событие, которое слушает хук
        const ev = new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
          detail: { globals: { toolOutput: _toolOutput } },
        });
        window.dispatchEvent(ev);
      },
    });

    // экстра: даст возможность обновлять программно из любого места
    openai.setGlobals = function setGlobals(globals) {
      if (!globals || typeof globals !== "object") return;
      if ("toolOutput" in globals) openai.toolOutput = globals.toolOutput;
      // можете добавить другие ключи по аналогии
    };
  }

  // простая отрисовка
  function render() {
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement("div");
      root.id = rootId;
      document.body.appendChild(root);
    }

    root.style.background = "white";
    root.style.minHeight = "500px";
    root.style.padding = "10px";

    // очистим контейнер перед новой отрисовкой
    root.textContent = "";

    const data = window.openai?.toolOutput;
    if (!data) {
      root.textContent = "нет данных (window.openai.toolOutput пуст)";
      return;
    }

    const ul = document.createElement("ul");
    for (const key in data) {
      const value = data[key];
      const li = document.createElement("li");
      li.textContent = `${key}: ${
        typeof value === "object" ? JSON.stringify(value) : value
      }`;
      ul.appendChild(li);
    }
    root.appendChild(ul);
  }

  function start() {
    makeReactiveToolOutput();
    render();

    // перерисовываем ТОЛЬКО когда пришёл наш ивент и в нём есть toolOutput
    const onGlobals = (event) => {
      const g = event?.detail?.globals || {};
      if ("toolOutput" in g) render();
    };

    window.addEventListener(SET_GLOBALS_EVENT_TYPE, onGlobals, { passive: true });

    // если страница где-то позже присвоит window.openai.toolOutput = ...,
    // наш setter сам эмитит событие и вызовется render() выше
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { passive: true });
  } else {
    start();
  }
})();
