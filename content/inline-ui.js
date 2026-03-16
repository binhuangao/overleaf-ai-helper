(function () {
  const ID = "oa-inline-root";
  const BTN_ID = "oa-inline-trigger";
  const POS_KEY = "oa_inline_modal_pos_v1";

  let btn = null;
  let modal = null;
  let lastContext = null;

  function hasRuntime() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function isContextInvalidError(err) {
    return /Extension context invalidated|Receiving end does not exist/i.test(String(err?.message || err));
  }

  async function safeRuntimeSendMessage(payload) {
    if (!hasRuntime()) {
      throw new Error("插件上下文已失效，请刷新 Overleaf 页面后重试。");
    }
    try {
      return await chrome.runtime.sendMessage(payload);
    } catch (err) {
      if (isContextInvalidError(err)) {
        throw new Error("插件已更新，请刷新 Overleaf 页面后继续使用。");
      }
      throw err;
    }
  }

  function ensureStyles() {
    if (document.getElementById("oa-inline-style")) return;
    const style = document.createElement("style");
    style.id = "oa-inline-style";
    style.textContent = `
      #${BTN_ID}{position:fixed;z-index:2147483646;background:#10a37f;color:#fff;border:none;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(16,163,127,.35);backdrop-filter:blur(8px)}
      #${ID}{position:fixed;z-index:2147483647;right:20px;bottom:20px;width:500px;max-width:calc(100vw - 20px);max-height:84vh;background:rgba(255,255,255,.98);border:1px solid #e6e8eb;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.18);display:flex;flex-direction:column;overflow:hidden}
      #${ID} .hd{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #eceff3;font:600 13px "Segoe UI","PingFang SC",sans-serif;background:linear-gradient(180deg,#fbfcfd,#f7f9fb);cursor:grab;user-select:none}
      #${ID} .hd:active{cursor:grabbing}
      #${ID} .bd{padding:12px;overflow:auto;display:grid;gap:10px;background:#f8fafb}
      #${ID} textarea{width:100%;min-height:72px;border:1px solid #dfe5ea;border-radius:10px;padding:9px;font-size:12px;resize:vertical;background:#fff}
      #${ID} textarea[readonly]{background:#f6f8fa;color:#374151}
      #${ID} .ops{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      #${ID} button{border:1px solid #dfe5ea;background:#fff;border-radius:10px;padding:7px 8px;font-size:12px;cursor:pointer;color:#0f172a}
      #${ID} button:hover{border-color:#10a37f}
      #${ID} .quick-btn{font-size:11px;padding:6px 6px;border-radius:8px}
      #${ID} .row{display:flex;gap:8px;flex-wrap:wrap}
      #${ID} .st{font-size:12px;color:#4b5563}
      #${ID} .lb{font-size:11px;color:#6b7280;margin-bottom:3px}
      #${ID} .diff{min-height:60px;max-height:150px;overflow:auto;background:#fff;border:1px solid #dfe5ea;border-radius:10px;padding:8px;line-height:1.55;font-size:12px;color:#111827}
      #${ID} .diff ins{background:#dcfce7;color:#065f46;text-decoration:none}
      #${ID} .diff del{background:#fee2e2;color:#991b1b}
    `;
    document.documentElement.appendChild(style);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function tokens(text) {
    return String(text || "")
      .split(/(\s+|[.,;:!?()[\]{}])/g)
      .filter((x) => x !== "");
  }

  function lcs(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp;
  }

  function backtrack(a, b, dp) {
    const out = [];
    let i = a.length;
    let j = b.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        out.push({ t: "eq", v: a[i - 1] });
        i -= 1;
        j -= 1;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        out.push({ t: "ins", v: b[j - 1] });
        j -= 1;
      } else {
        out.push({ t: "del", v: a[i - 1] });
        i -= 1;
      }
    }
    return out.reverse();
  }

  function diffHtml(aText, bText) {
    const a = tokens(aText);
    const b = tokens(bText);
    return backtrack(a, b, lcs(a, b))
      .map((op) => {
        const v = escapeHtml(op.v);
        if (op.t === "eq") return `<span>${v}</span>`;
        if (op.t === "ins") return `<ins>${v}</ins>`;
        return `<del>${v}</del>`;
      })
      .join("");
  }

  function loadPos() {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
      return p;
    } catch {
      return null;
    }
  }

  function savePos(x, y) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ x, y }));
    } catch {
      // Ignore.
    }
  }

  function closeModal() {
    if (modal) modal.remove();
    modal = null;
  }

  function removeTrigger() {
    if (btn) btn.remove();
    btn = null;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text || "");
      return;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text || "";
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  function setStatus(el, text, err = false) {
    el.textContent = text;
    el.style.color = err ? "#b91c1c" : "#4b5563";
  }

  function getContext() {
    const res = window.OverleafAIContent?.getContext?.({ allowEmptySelection: false, contextChars: 900 });
    if (!res?.ok) throw new Error(res?.error || "读取选区失败");
    return res.context;
  }

  async function generate(taskType, customInstruction, originalEl, suggestedEl, diffEl, statusEl) {
    setStatus(statusEl, "正在读取上下文...");
    const ctx = getContext();
    lastContext = ctx;
    originalEl.value = ctx.selectionText || "";

    setStatus(statusEl, "正在请求模型...");
    const payload = {
      contextPacket: ctx,
      taskType: customInstruction ? "rewrite" : taskType,
      includeRecentStyle: false,
      customInstruction: customInstruction || ""
    };
    const res = await safeRuntimeSendMessage({ type: "OA_GENERATE", payload });
    if (!res?.ok) throw new Error(res?.error || "生成失败");

    const suggested = res.suggestion?.suggested || "";
    suggestedEl.value = suggested;
    diffEl.innerHTML = res.suggestion?.diffHtml || diffHtml(originalEl.value, suggested);
    setStatus(statusEl, "完成");
  }

  async function replace(statusEl, suggestedEl) {
    if (!lastContext?.selectionText) throw new Error("没有可替换的原始选区");
    const res = await window.OverleafAIContent?.writeback?.({
      mode: "replace",
      expectedOriginal: lastContext.selectionText,
      suggested: suggestedEl.value || ""
    });
    if (!res?.ok) throw new Error(res?.error || "写回失败");
    setStatus(statusEl, "已替换到正文");
  }

  function makeDraggable(root, handle) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("mousedown", (ev) => {
      if (ev.target.closest("button")) return;
      dragging = true;
      const rect = root.getBoundingClientRect();
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;
      ev.preventDefault();
    });

    window.addEventListener("mousemove", (ev) => {
      if (!dragging) return;
      const x = Math.max(8, Math.min(window.innerWidth - root.offsetWidth - 8, ev.clientX - offsetX));
      const y = Math.max(8, Math.min(window.innerHeight - root.offsetHeight - 8, ev.clientY - offsetY));
      root.style.left = `${x}px`;
      root.style.top = `${y}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      const rect = root.getBoundingClientRect();
      savePos(rect.left, rect.top);
    });
  }

  function openModal() {
    closeModal();
    modal = document.createElement("div");
    modal.id = ID;
    modal.innerHTML = `
      <div class="hd">
        <span>Overleaf AI 浮窗</span>
        <button type="button" data-close>x</button>
      </div>
      <div class="bd">
        <div>
          <div class="lb">自定义修改要求</div>
          <textarea id="oa-custom-instruction" placeholder="例如：仅修正语法和拼写，不改变术语与公式"></textarea>
          <button type="button" id="oa-custom-run">执行自定义修改</button>
        </div>
        <div>
          <div class="lb">常见修改</div>
          <div class="ops">
            <button class="quick-btn" type="button" data-task="rewrite">改写</button>
            <button class="quick-btn" type="button" data-task="compress">压缩</button>
            <button class="quick-btn" type="button" data-task="expand">扩写</button>
            <button class="quick-btn" type="button" data-task="logic_enhance">逻辑</button>
            <button class="quick-btn" type="button" data-task="proofread">纠错</button>
            <button class="quick-btn" type="button" data-task="translate_literal">忠实翻译</button>
            <button class="quick-btn" type="button" data-task="translate_academic">学术翻译</button>
          </div>
        </div>
        <div>
          <div class="lb">原文</div>
          <textarea id="oa-inline-original" readonly placeholder="原文"></textarea>
        </div>
        <div>
          <div class="lb">差异高亮</div>
          <div id="oa-inline-diff" class="diff"></div>
        </div>
        <div>
          <div class="lb">建议稿</div>
          <textarea id="oa-inline-suggested" placeholder="建议稿会显示在这里"></textarea>
        </div>
        <div class="row">
          <button type="button" data-act="replace">替换选区</button>
          <button type="button" data-act="copy">复制</button>
          <button type="button" data-close>关闭</button>
        </div>
        <div class="st" id="oa-inline-status">就绪</div>
      </div>
    `;
    document.body.appendChild(modal);

    const pos = loadPos();
    if (pos) {
      modal.style.left = `${Math.max(8, Math.min(window.innerWidth - modal.offsetWidth - 8, pos.x))}px`;
      modal.style.top = `${Math.max(8, Math.min(window.innerHeight - modal.offsetHeight - 8, pos.y))}px`;
      modal.style.right = "auto";
      modal.style.bottom = "auto";
    }

    const hd = modal.querySelector(".hd");
    makeDraggable(modal, hd);

    const originalEl = modal.querySelector("#oa-inline-original");
    const suggestedEl = modal.querySelector("#oa-inline-suggested");
    const diffEl = modal.querySelector("#oa-inline-diff");
    const statusEl = modal.querySelector("#oa-inline-status");
    const customInstructionEl = modal.querySelector("#oa-custom-instruction");
    const customRunBtn = modal.querySelector("#oa-custom-run");

    modal.querySelectorAll("button[data-task]").forEach((b) => {
      b.addEventListener("click", async () => {
        try {
          await generate(b.dataset.task, "", originalEl, suggestedEl, diffEl, statusEl);
        } catch (e) {
          setStatus(statusEl, e?.message || String(e), true);
        }
      });
    });

    customRunBtn.addEventListener("click", async () => {
      try {
        const instruction = (customInstructionEl.value || "").trim();
        if (!instruction) throw new Error("请先输入自定义修改要求。");
        await generate("rewrite", instruction, originalEl, suggestedEl, diffEl, statusEl);
      } catch (e) {
        setStatus(statusEl, e?.message || String(e), true);
      }
    });

    suggestedEl.addEventListener("input", () => {
      diffEl.innerHTML = diffHtml(originalEl.value || "", suggestedEl.value || "");
    });

    modal.querySelector("button[data-act='replace']").addEventListener("click", async () => {
      try {
        await replace(statusEl, suggestedEl);
      } catch (e) {
        setStatus(statusEl, e?.message || String(e), true);
      }
    });

    modal.querySelector("button[data-act='copy']").addEventListener("click", async () => {
      await copyText(suggestedEl.value || "");
      setStatus(statusEl, "已复制");
    });

    modal.querySelectorAll("button[data-close]").forEach((b) => {
      b.addEventListener("click", closeModal);
    });
  }

  function showTriggerAt(x, y) {
    ensureStyles();
    removeTrigger();
    btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "AI";
    btn.style.left = `${Math.min(window.innerWidth - 60, Math.max(8, x + 6))}px`;
    btn.style.top = `${Math.min(window.innerHeight - 34, Math.max(8, y + 6))}px`;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openModal();
    });
    document.body.appendChild(btn);
  }

  function onSelectionMaybeChanged() {
    const sel = window.getSelection();
    const text = (sel?.toString() || "").trim();
    if (!text) {
      removeTrigger();
      return;
    }
    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range) {
      removeTrigger();
      return;
    }
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    showTriggerAt(rect.right + window.scrollX, rect.bottom + window.scrollY);
  }

  let timer = null;
  const debounceSelection = () => {
    clearTimeout(timer);
    timer = setTimeout(onSelectionMaybeChanged, 120);
  };

  document.addEventListener("selectionchange", debounceSelection);
  document.addEventListener("mousedown", (e) => {
    const inUi = e.target.closest(`#${ID}`) || e.target.closest(`#${BTN_ID}`);
    if (!inUi) removeTrigger();
  });
})();
