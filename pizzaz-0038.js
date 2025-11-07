// супер-простой показ window.openai.toolOutput
(() => {
  // где рисуем
  const rootId = "toolOutput-root";

  // ждем готовности страницы
  function start() {
    // создаём контейнер если его нет
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement("div");
      root.id = rootId;
      document.body.appendChild(root);
    }

    // стили — только фон и высота
    root.style.background = "white";
    root.style.minHeight = "500px";
    root.style.padding = "10px";

    // получаем данные из openai
    const data = window.openai?.toolOutput;

    // если нет данных — пишем
    if (!data) {
      root.textContent = "нет данных (window.openai.toolOutput пуст)";
      return;
    }

    // делаем список
    const ul = document.createElement("ul");

    for (const key in data) {
      const value = data[key];
      const li = document.createElement("li");
      li.textContent = `${key}: ${typeof value === "object"
        ? JSON.stringify(value)
        : value}`;
      ul.appendChild(li);
    }

    // вставляем в документ
    root.appendChild(ul);
  }

  // запускаем после загрузки DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
