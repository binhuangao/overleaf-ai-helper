(function () {
  function insertForTextInput(el, text) {
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || start;
    el.value = `${el.value.slice(0, end)}${text}${el.value.slice(end)}`;
    const pos = end + text.length;
    el.setSelectionRange(pos, pos);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function replaceForTextInput(el, expectedOriginal, text) {
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || start;
    const currentSelected = el.value.slice(start, end);
    if (currentSelected !== expectedOriginal) {
      return { ok: false, error: "源文本已变化，请重新获取上下文。" };
    }

    el.value = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return { ok: true };
  }

  function replaceForContentEditable(expectedOriginal, text) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { ok: false, error: "未找到可替换选区。" };
    const range = sel.getRangeAt(0);
    const currentSelected = sel.toString();
    if (currentSelected !== expectedOriginal) {
      return { ok: false, error: "源文本已变化，请重新获取上下文。" };
    }
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    sel.removeAllRanges();
    return { ok: true };
  }

  function insertForContentEditable(text) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { ok: false, error: "未找到光标位置。" };
    const range = sel.getRangeAt(0);
    range.collapse(false);
    range.insertNode(document.createTextNode(text));
    sel.removeAllRanges();
    return { ok: true };
  }

  function localWriteback({ mode, expectedOriginal, suggested }) {
    const el = window.OverleafAISelection?.getActiveEditable?.();
    if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
      if (mode === "replace") return replaceForTextInput(el, expectedOriginal, suggested);
      if (mode === "insert_after") {
        insertForTextInput(el, suggested);
        return { ok: true };
      }
    }

    if (el && el.isContentEditable) {
      if (mode === "replace") return replaceForContentEditable(expectedOriginal, suggested);
      if (mode === "insert_after") return insertForContentEditable(suggested);
    }

    // Fallback: when inline UI steals focus, reuse the last captured selection snapshot.
    const snap = window.OverleafAISelection?.getLastSnapshot?.();
    if (snap?.kind === "textinput" && snap.el) {
      const target = snap.el;
      const start = snap.selectionStart || 0;
      const end = snap.selectionEnd || start;
      const current = (target.value || "").slice(start, end);

      if (mode === "replace") {
        if (current !== expectedOriginal) {
          return { ok: false, error: "源文本已变化，请重新获取上下文。" };
        }
        target.value = `${target.value.slice(0, start)}${suggested}${target.value.slice(end)}`;
        const pos = start + suggested.length;
        target.focus();
        target.setSelectionRange(pos, pos);
        target.dispatchEvent(new Event("input", { bubbles: true }));
        return { ok: true };
      }

      if (mode === "insert_after") {
        target.value = `${target.value.slice(0, end)}${suggested}${target.value.slice(end)}`;
        const pos = end + suggested.length;
        target.focus();
        target.setSelectionRange(pos, pos);
        target.dispatchEvent(new Event("input", { bubbles: true }));
        return { ok: true };
      }
    }

    if (snap?.kind === "contenteditable" && snap.range) {
      const r = snap.range.cloneRange();
      const current = r.toString();
      if (mode === "replace") {
        if (current !== expectedOriginal) {
          return { ok: false, error: "源文本已变化，请重新获取上下文。" };
        }
        r.deleteContents();
        r.insertNode(document.createTextNode(suggested));
        return { ok: true };
      }
      if (mode === "insert_after") {
        r.collapse(false);
        r.insertNode(document.createTextNode(suggested));
        return { ok: true };
      }
    }

    if (snap?.kind === "range" && snap.range) {
      const r = snap.range.cloneRange();
      const current = r.toString();
      if (mode === "replace") {
        if (current !== expectedOriginal) {
          return { ok: false, error: "源文本已变化，请重新获取上下文。" };
        }
        r.deleteContents();
        r.insertNode(document.createTextNode(suggested));
        return { ok: true };
      }
      if (mode === "insert_after") {
        r.collapse(false);
        r.insertNode(document.createTextNode(suggested));
        return { ok: true };
      }
    }

    return { ok: false, error: "当前编辑器不支持直接写回，尝试 bridge 兜底中..." };
  }

  function bridgeWriteback({ mode, expectedOriginal, suggested }) {
    return new Promise((resolve) => {
      const requestId = `oa_bridge_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const timeout = setTimeout(() => {
        resolve({ ok: false, error: "Bridge 写回超时，请使用复制按钮。" });
      }, 1200);

      function onMessage(event) {
        if (event.source !== window) return;
        if (event.data?.type !== "OA_EDITOR_BRIDGE_WRITEBACK_RESULT") return;
        if (event.data?.requestId !== requestId) return;
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve(event.data?.result || { ok: false, error: "Bridge 写回失败。" });
      }

      window.addEventListener("message", onMessage);
      window.postMessage(
        {
          type: "OA_EDITOR_BRIDGE_WRITEBACK",
          requestId,
          mode,
          expectedOriginal,
          suggested
        },
        "*"
      );
    });
  }

  async function writeback(payload) {
    const local = localWriteback(payload);
    if (local.ok) return local;
    const bridged = await bridgeWriteback(payload);
    return bridged.ok ? bridged : { ok: false, error: bridged.error || local.error };
  }

  window.OverleafAIWriteback = { writeback };
})();
