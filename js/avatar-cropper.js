/* ============================================================
   avatar-cropper.js — выбор и кроп аватарки
   ============================================================ */

(function () {
  const MAX_OUTPUT = 400; // размер итогового изображения (px)
  const MAX_ZOOM = 3; // максимальный зум относительно "вписать в круг"

  let modalEl = null;
  let state = null;

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  /* ---------- Разметка модалки ---------- */
  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.className = "cropper-modal";
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="cropper-backdrop" data-close></div>
      <div class="cropper-window">
        <button class="cropper-close" data-close aria-label="Закрыть">×</button>

        <h2 class="cropper-title">Настрой аватарку</h2>
        <p class="cropper-subtitle">
          Двигай фото мышкой, зум колёсиком или ползунком. То, что внутри круга — попадёт в профиль.
        </p>

        <div class="cropper-stage" id="cropper-stage">
          <img class="cropper-img" id="cropper-img" alt="" draggable="false" />
          <div class="cropper-circle"></div>
        </div>

        <div class="cropper-zoom">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <input type="range" id="cropper-zoom" min="100" max="${MAX_ZOOM * 100}" value="100" step="1" />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
          </svg>
        </div>

        <div class="cropper-actions">
          <button type="button" class="btn-cancel" data-close>Отмена</button>
          <button type="button" class="btn-save" id="cropper-save">Готово</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    modalEl.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", close);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modalEl.hidden) close();
    });

    return modalEl;
  }

  /* ---------- Пересчёт положения картинки ---------- */
  function updateTransform() {
    if (!state) return;

    const { img, naturalW, naturalH, baseScale, userScale } = state;
    const finalScale = baseScale * userScale;
    const dispW = naturalW * finalScale;
    const dispH = naturalH * finalScale;

    // Ограничиваем смещение, чтобы картинка всегда перекрывала круг
    const maxOffX = Math.max(0, (dispW - state.circleSize) / 2);
    const maxOffY = Math.max(0, (dispH - state.circleSize) / 2);
    state.offsetX = clamp(state.offsetX, -maxOffX, maxOffX);
    state.offsetY = clamp(state.offsetY, -maxOffY, maxOffY);

    img.style.width = dispW + "px";
    img.style.height = dispH + "px";
    img.style.left = `calc(50% + ${state.offsetX}px)`;
    img.style.top = `calc(50% + ${state.offsetY}px)`;
  }

  /* ---------- Открытие ---------- */
  function open(file, onSave) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Можно загрузить только изображение");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("Файл больше 8 МБ");
      return;
    }

    const modal = ensureModal();
    const imgEl = modal.querySelector("#cropper-img");
    const stage = modal.querySelector("#cropper-stage");
    const circleEl = modal.querySelector(".cropper-circle");
    const zoomInput = modal.querySelector("#cropper-zoom");

    // 1) Сначала показываем — нужно, чтобы измерить реальные размеры DOM
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("open"));
    document.body.style.overflow = "hidden";

    const circleSize = circleEl.offsetWidth;

    // 2) Читаем файл
    const reader = new FileReader();
    reader.onload = (e) => {
      imgEl.onload = () => {
        const nw = imgEl.naturalWidth;
        const nh = imgEl.naturalHeight;

        // Базовая шкала: меньшая сторона фото = диаметр круга
        const baseScale = circleSize / Math.min(nw, nh);

        state = {
          img: imgEl,
          naturalW: nw,
          naturalH: nh,
          baseScale,
          userScale: 1,
          offsetX: 0,
          offsetY: 0,
          circleSize,
          dragging: false,
          onSave,
        };

        zoomInput.value = 100;
        imgEl.style.width = nw * baseScale + "px";
        imgEl.style.height = nh * baseScale + "px";
        updateTransform();
      };
      imgEl.src = e.target.result;
    };
    reader.onerror = () => alert("Ошибка чтения файла");
    reader.readAsDataURL(file);

    /* --- Обработчики (пере-навешиваем каждый раз, чтобы ссылаться на свежий state) --- */

    // Drag
    const onDown = (e) => {
      if (!state) return;
      if (!e.target.closest("#cropper-stage")) return;
      e.preventDefault();
      state.dragging = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.startOffX = state.offsetX;
      state.startOffY = state.offsetY;
      if (e.target.setPointerCapture) {
        try {
          e.target.setPointerCapture(e.pointerId);
        } catch {}
      }
    };
    const onMove = (e) => {
      if (!state || !state.dragging) return;
      state.offsetX = state.startOffX + (e.clientX - state.startX);
      state.offsetY = state.startOffY + (e.clientY - state.startY);
      updateTransform();
    };
    const onUp = () => {
      if (state) state.dragging = false;
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);

    // Зум колесом
    stage.addEventListener(
      "wheel",
      (e) => {
        if (!state) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.06 : 0.06;
        state.userScale = clamp(state.userScale + delta, 1, MAX_ZOOM);
        zoomInput.value = Math.round(state.userScale * 100);
        updateTransform();
      },
      { passive: false },
    );

    // Зум слайдером
    const onZoom = (e) => {
      if (!state || e.target !== zoomInput) return;
      state.userScale = Number(e.target.value) / 100;
      updateTransform();
    };
    document.addEventListener("input", onZoom);

    // Сохранение
    const onSaveClick = (e) => {
      if (!state) return;
      if (e.target.id !== "cropper-save") return;

      const {
        img,
        naturalW,
        naturalH,
        baseScale,
        userScale,
        offsetX,
        offsetY,
        circleSize,
      } = state;
      const finalScale = baseScale * userScale;
      const dispW = naturalW * finalScale;
      const dispH = naturalH * finalScale;

      // Координаты обрезки в исходном изображении
      const sx = ((dispW - circleSize) / 2 - offsetX) / finalScale;
      const sy = ((dispH - circleSize) / 2 - offsetY) / finalScale;
      const sSize = circleSize / finalScale;

      const canvas = document.createElement("canvas");
      canvas.width = MAX_OUTPUT;
      canvas.height = MAX_OUTPUT;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, MAX_OUTPUT, MAX_OUTPUT);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

      if (typeof state.onSave === "function") state.onSave(dataUrl);

      // Снимаем обработчики
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("input", onZoom);
      document.removeEventListener("click", onSaveClick);

      close();
    };
    document.addEventListener("click", onSaveClick);
  }

  function close() {
    if (!modalEl) return;
    modalEl.classList.remove("open");
    document.body.style.overflow = "";
    state = null;
    setTimeout(() => {
      if (modalEl) modalEl.hidden = true;
    }, 250);
  }

  window.AvatarCropper = { open, close };
})();
