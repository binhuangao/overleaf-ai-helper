(async function () {
  const moduleUrl = chrome.runtime.getURL("core/context-extractor.js");
  const { buildContextPacket } = await import(moduleUrl);

  function injectBridgeScriptOnce() {
    if (document.getElementById("oa-editor-bridge")) return;
    const script = document.createElement("script");
    script.id = "oa-editor-bridge";
    script.src = chrome.runtime.getURL("injected/editor-bridge.js");
    script.type = "text/javascript";
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  }

  injectBridgeScriptOnce();

  function getTaskTypeForContext() {
    return "rewrite";
  }

  function getContext(payload = {}) {
    const data = window.OverleafAISelection?.readSelection?.();
    const allowEmptySelection = !!payload?.allowEmptySelection;
    const includeErrorContext = !!payload?.includeErrorContext;
    const contextChars = Number(payload?.contextChars) || 800;

    if (!data || (!data.selectionText && !allowEmptySelection)) {
      return { ok: false, error: "请先在 Overleaf 中选中要处理的文本。" };
    }

    const packet = buildContextPacket({
      projectUrl: location.href,
      fileName: data.fileName,
      fullText: data.fullText,
      selectionText: data.selectionText,
      selectionStart: data.selectionStart,
      selectionEnd: data.selectionEnd,
      cursorInfo: data.cursorInfo,
      taskType: getTaskTypeForContext(),
      contextChars
    });

    const errorContext = includeErrorContext ? window.OverleafAISelection?.readErrorContext?.(3500) || "" : "";
    return { ok: true, context: packet, errorContext };
  }

  async function doWriteback(payload = {}) {
    const res = await window.OverleafAIWriteback?.writeback?.(payload);
    return res || { ok: false, error: "Writeback unavailable." };
  }

  window.OverleafAIContent = {
    getContext,
    writeback: doWriteback
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (message?.type === "OA_PING") {
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "OA_GET_CONTEXT") {
        sendResponse(getContext(message?.payload || {}));
        return;
      }

      if (message?.type === "OA_WRITEBACK") {
        sendResponse(await doWriteback(message.payload || {}));
        return;
      }

      sendResponse({ ok: false, error: "Unknown content message." });
    })().catch((err) => {
      sendResponse({ ok: false, error: err?.message || String(err) });
    });

    return true;
  });
})();
