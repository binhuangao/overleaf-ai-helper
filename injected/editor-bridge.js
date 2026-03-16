(function () {
  function getActiveEditable() {
    const el = document.activeElement;
    if (!el) return null;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el;
    if (el.isContentEditable) return el;
    return null;
  }

  function safeReplace(mode, expectedOriginal, suggested) {
    const el = getActiveEditable();
    if (!el) return { ok: false, error: "No active editor element." };

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || start;
      const current = el.value.slice(start, end);

      if (mode === "replace") {
        if (current !== expectedOriginal) {
          return { ok: false, error: "源文本已变化，请重新获取上下文。" };
        }
        el.value = `${el.value.slice(0, start)}${suggested}${el.value.slice(end)}`;
        const pos = start + suggested.length;
        el.setSelectionRange(pos, pos);
      } else {
        el.value = `${el.value.slice(0, end)}${suggested}${el.value.slice(end)}`;
        const pos = end + suggested.length;
        el.setSelectionRange(pos, pos);
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return { ok: true };
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { ok: false, error: "No active range." };
    const range = sel.getRangeAt(0);
    if (mode === "replace") {
      const current = sel.toString();
      if (current !== expectedOriginal) return { ok: false, error: "源文本已变化，请重新获取上下文。" };
      range.deleteContents();
      range.insertNode(document.createTextNode(suggested));
    } else {
      range.collapse(false);
      range.insertNode(document.createTextNode(suggested));
    }
    sel.removeAllRanges();
    return { ok: true };
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.type === "OA_EDITOR_BRIDGE_PING") {
      window.postMessage({ type: "OA_EDITOR_BRIDGE_PONG" }, "*");
      return;
    }
    if (data.type === "OA_EDITOR_BRIDGE_WRITEBACK") {
      const result = safeReplace(data.mode, data.expectedOriginal, data.suggested || "");
      window.postMessage({ type: "OA_EDITOR_BRIDGE_WRITEBACK_RESULT", requestId: data.requestId, result }, "*");
    }
  });
})();
