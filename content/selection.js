(function () {
  let lastSnapshot = null;

  function getActiveEditable() {
    const el = document.activeElement;
    if (!el) return null;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el;
    if (el.isContentEditable) return el;
    return null;
  }

  function readSelectionFromEditable(el) {
    if (!el) return null;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const fullText = el.value || "";
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || start;
      return {
        fullText,
        selectionText: fullText.slice(start, end),
        selectionStart: start,
        selectionEnd: end,
        _snapshot: {
          kind: "textinput",
          el,
          selectionStart: start,
          selectionEnd: end
        }
      };
    }

    if (el.isContentEditable) {
      const fullText = el.innerText || "";
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        return { fullText, selectionText: "", selectionStart: 0, selectionEnd: 0 };
      }
      const range = sel.getRangeAt(0);
      const selectionText = sel.toString();
      const preRange = document.createRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.startContainer, range.startOffset);
      const start = preRange.toString().length;
      return {
        fullText,
        selectionText,
        selectionStart: start,
        selectionEnd: start + selectionText.length,
        _snapshot: {
          kind: "contenteditable",
          el,
          range: range.cloneRange()
        }
      };
    }
    return null;
  }

  function findFileName() {
    const title = document.title || "";
    const tex = title.match(/([^/\\]+\.tex)/i);
    return tex ? tex[1] : "main.tex";
  }

  function getCursorInfoFromText(fullText, index) {
    const left = (fullText || "").slice(0, Math.max(0, index || 0));
    const lines = left.split("\n");
    return {
      line: lines.length,
      ch: (lines[lines.length - 1] || "").length
    };
  }

  function normalizeSelectionResult(raw) {
    if (raw?._snapshot) {
      lastSnapshot = {
        ...raw._snapshot,
        selectionText: raw.selectionText || "",
        ts: Date.now()
      };
    }

    return {
      fullText: raw.fullText || "",
      selectionText: raw.selectionText || "",
      selectionStart: Number.isFinite(raw.selectionStart) ? raw.selectionStart : 0,
      selectionEnd: Number.isFinite(raw.selectionEnd) ? raw.selectionEnd : 0,
      fileName: findFileName(),
      cursorInfo: getCursorInfoFromText(raw.fullText || "", raw.selectionEnd || 0)
    };
  }

  function readSelection() {
    const editable = getActiveEditable();
    const fromEditable = readSelectionFromEditable(editable);
    if (fromEditable) return normalizeSelectionResult(fromEditable);

    const sel = window.getSelection();
    const selectionText = sel ? sel.toString() : "";
    const containerText = (document.body?.innerText || "").trim();
    const idx = selectionText ? containerText.indexOf(selectionText) : 0;
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    return normalizeSelectionResult({
      fullText: containerText,
      selectionText: selectionText || "",
      selectionStart: Math.max(0, idx),
      selectionEnd: Math.max(0, idx + (selectionText || "").length),
      _snapshot: range
        ? {
            kind: "range",
            range
          }
        : null
    });
  }

  function readErrorContext(maxLen = 3000) {
    const candidates = Array.from(document.querySelectorAll("pre, code, .error, .log, .logs, [role='log']"))
      .map((el) => (el.innerText || "").trim())
      .filter(Boolean)
      .filter((txt) => /error|undefined control sequence|missing \$|! LaTeX Error|line \d+/i.test(txt))
      .slice(0, 6);

    const merged = candidates.join("\n\n---\n\n");
    if (merged) return merged.slice(0, maxLen);

    const body = (document.body?.innerText || "").slice(0, 12000);
    const lines = body
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    const hit = lines.findIndex((ln) => /error|undefined control sequence|! latex error/i.test(ln));
    if (hit < 0) return "";
    return lines.slice(Math.max(0, hit - 10), Math.min(lines.length, hit + 25)).join("\n").slice(0, maxLen);
  }

  window.OverleafAISelection = {
    readSelection,
    readErrorContext,
    getActiveEditable,
    getLastSnapshot: () => lastSnapshot
  };
})();
