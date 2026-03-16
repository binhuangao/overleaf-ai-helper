let latestContext = null;
let latestSuggestion = null;
let rebuttalActiveTab = "response";
let cachedSettings = null;
const taskButtons = {};
const DEFAULT_PROMPT_OVERRIDES = {
  system: "",
  rewrite: "",
  compress: "",
  expand: "",
  logic_enhance: "",
  proofread: "",
  translate_literal: "",
  translate_academic: "",
  rebuttal: "",
  latex_formula: "",
  latex_table: "",
  latex_error_help: ""
};
const DISCIPLINE_PRESETS = {
  "Power Systems": [
    "use standard power-system terms (e.g., unit commitment, dispatch, HVDC, N-1 security)",
    "keep variable symbols and subscripts unchanged",
    "describe results with system-operation implications, not marketing language"
  ],
  "Computer Vision": [
    "use standard CV terminology (backbone, detector, segmentation, mAP, IoU)",
    "separate method contribution from benchmark outcome",
    "avoid claiming SOTA unless explicitly supported by numbers"
  ],
  NLP: [
    "use standard NLP terminology (tokenization, encoder, decoder, attention, F1/BLEU)",
    "distinguish linguistic explanation from empirical gains",
    "avoid anthropomorphic wording for model behavior"
  ],
  "Control Systems": [
    "use standard control terminology (stability, robustness, observer, controller, Lyapunov)",
    "state assumptions and operating region explicitly",
    "avoid over-claiming generality beyond tested regimes"
  ]
};
const PROVIDER_PRESETS = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini"
  },
  anthropic: {
    // For users with OpenAI-compatible proxy endpoint for Anthropic.
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-latest"
  },
  gemini: {
    // For users with OpenAI-compatible proxy endpoint for Gemini.
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash"
  },
  compatible: {
    baseUrl: "",
    model: ""
  }
};

const TASK_ORDER = [
  "rewrite",
  "compress",
  "expand",
  "logic_enhance",
  "proofread",
  "translate_literal",
  "translate_academic",
  "rebuttal"
];

const els = {
  ctxMeta: document.getElementById("ctx-meta"),
  status: document.getElementById("status"),
  original: document.getElementById("original"),
  suggested: document.getElementById("suggested"),
  diff: document.getElementById("diff"),
  rationale: document.getElementById("rationale"),
  warnings: document.getElementById("warnings"),
  errorDiagnosis: document.getElementById("errorDiagnosis"),
  refreshBtn: document.getElementById("refresh-context"),
  replaceBtn: document.getElementById("replace-btn"),
  insertBtn: document.getElementById("insert-btn"),
  copyBtn: document.getElementById("copy-btn"),
  saveSettings: document.getElementById("save-settings"),
  saveMemory: document.getElementById("save-memory"),
  refreshHistory: document.getElementById("refresh-history"),
  clearHistory: document.getElementById("clear-history"),
  historyList: document.getElementById("historyList"),
  baseUrl: document.getElementById("baseUrl"),
  provider: document.getElementById("provider"),
  applyProvider: document.getElementById("apply-provider"),
  targetVenue: document.getElementById("targetVenue"),
  discipline: document.getElementById("discipline"),
  applyDiscipline: document.getElementById("apply-discipline"),
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  maxTokens: document.getElementById("maxTokens"),
  temperature: document.getElementById("temperature"),
  sendLargeContext: document.getElementById("sendLargeContext"),
  defaultAcademicEnglish: document.getElementById("defaultAcademicEnglish"),
  uploadErrorNearbyCode: document.getElementById("uploadErrorNearbyCode"),
  privacyMode: document.getElementById("privacyMode"),
  promptSystem: document.getElementById("promptSystem"),
  promptRewrite: document.getElementById("promptRewrite"),
  promptCompress: document.getElementById("promptCompress"),
  promptTranslateAcademic: document.getElementById("promptTranslateAcademic"),
  promptRebuttal: document.getElementById("promptRebuttal"),
  resetPrompts: document.getElementById("reset-prompts"),
  preferredTerms: document.getElementById("preferredTerms"),
  forbiddenTerms: document.getElementById("forbiddenTerms"),
  styleRules: document.getElementById("styleRules"),
  reviewerComment: document.getElementById("reviewerComment"),
  includeRecentStyle: document.getElementById("includeRecentStyle"),
  rebuttalBox: document.getElementById("rebuttalBox"),
  rebuttalOutput: document.getElementById("rebuttalOutput"),
  tabResponse: document.getElementById("tab-response"),
  tabRevised: document.getElementById("tab-revised"),
  latexInput: document.getElementById("latexInput"),
  includeErrorContext: document.getElementById("includeErrorContext")
};

function ensureVenueOptions() {
  const options = [
    { value: "ieee", label: "IEEE" },
    { value: "elsevier", label: "Elsevier" },
    { value: "generic", label: "Generic Journal" }
  ];
  if (!els.targetVenue) return;
  if (els.targetVenue.options.length === 0) {
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      els.targetVenue.appendChild(o);
    });
  }
}

function syncVenueButtons() {
  document.querySelectorAll("#venueButtons button[data-venue]").forEach((b) => {
    b.classList.toggle("active", b.dataset.venue === els.targetVenue.value);
  });
}

document.querySelectorAll("button[data-task]").forEach((btn) => {
  taskButtons[btn.dataset.task] = btn;
});

function setStatus(text, error = false) {
  els.status.textContent = text;
  els.status.style.color = error ? "#bf1f2f" : "#147d3f";
}

function termMapToText(map) {
  return Object.entries(map || {})
    .map(([k, v]) => `${k} => ${v}`)
    .join("\n");
}

function textToTermMap(text) {
  const out = {};
  (text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split("=>");
      if (parts.length >= 2) {
        const k = parts[0].trim();
        const v = parts.slice(1).join("=>").trim();
        if (k && v) out[k] = v;
      }
    });
  return out;
}

function lines(text) {
  return (text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function readPromptOverridesFromUI() {
  return {
    ...DEFAULT_PROMPT_OVERRIDES,
    system: (els.promptSystem.value || "").trim(),
    rewrite: (els.promptRewrite.value || "").trim(),
    compress: (els.promptCompress.value || "").trim(),
    translate_academic: (els.promptTranslateAcademic.value || "").trim(),
    rebuttal: (els.promptRebuttal.value || "").trim()
  };
}

function renderPromptOverrides(overrides = {}) {
  const p = { ...DEFAULT_PROMPT_OVERRIDES, ...(overrides || {}) };
  els.promptSystem.value = p.system || "";
  els.promptRewrite.value = p.rewrite || "";
  els.promptCompress.value = p.compress || "";
  els.promptTranslateAcademic.value = p.translate_academic || "";
  els.promptRebuttal.value = p.rebuttal || "";
}

function isRebuttalMode() {
  return latestSuggestion?.taskType === "rebuttal";
}

function getCopyText() {
  if (!latestSuggestion) return "";
  if (!isRebuttalMode()) return els.suggested.value || "";
  if (rebuttalActiveTab === "response") return els.rebuttalOutput.value || "";
  return els.suggested.value || "";
}

function setRebuttalTab(tab) {
  rebuttalActiveTab = tab;
  els.tabResponse.classList.toggle("active", tab === "response");
  els.tabRevised.classList.toggle("active", tab === "revised");
  if (!isRebuttalMode()) return;
  els.rebuttalOutput.value =
    tab === "response" ? latestSuggestion.responseLetter || "" : els.suggested.value || "";
}

function formatTaskLabel(taskType) {
  const map = {
    rewrite: "学术改写",
    compress: "压缩",
    expand: "扩写",
    logic_enhance: "逻辑增强",
    proofread: "纠错",
    translate_literal: "中译英-忠实翻译",
    translate_academic: "中译英-学术重写",
    rebuttal: "审稿回复",
    latex_formula: "LaTeX-公式",
    latex_table: "LaTeX-表格",
    latex_error_help: "LaTeX-报错辅助"
  };
  return map[taskType] || taskType;
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length) throw new Error("No active tab.");
  const tab = tabs[0];
  const url = String(tab.url || "");
  let isOverleaf = false;
  try {
    const u = new URL(url);
    isOverleaf = u.protocol === "https:" && (u.hostname === "overleaf.com" || u.hostname.endsWith(".overleaf.com"));
  } catch {
    isOverleaf = false;
  }
  if (!isOverleaf) {
    throw new Error("请先切到 Overleaf 编辑页再使用插件。");
  }
  return tab.id;
}

async function ensureContentConnection(tabId) {
  async function ping() {
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { type: "OA_PING" });
      return !!pong?.ok;
    } catch {
      return false;
    }
  }

  if (await ping()) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content/selection.js", "content/writeback.js", "content/content.js"]
  });

  for (let i = 0; i < 6; i += 1) {
    if (await ping()) return;
    await new Promise((r) => setTimeout(r, 120));
  }

  throw new Error("无法连接 Overleaf 编辑器，请刷新 Overleaf 页面后重试。");
}

function getEditableTarget(el) {
  if (!el) return null;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "textarea" || tag === "input") return el;
  if (el.isContentEditable) return el;
  return null;
}

function installKeyboardClipboardFallback() {
  document.addEventListener("keydown", (ev) => {
    const target = getEditableTarget(ev.target);
    if (!target) return;

    const mod = ev.ctrlKey || ev.metaKey;
    if (!mod || ev.altKey) return;
    const key = String(ev.key || "").toLowerCase();

    if (key === "a") {
      ev.preventDefault();
      if (typeof target.select === "function") {
        target.select();
      } else {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return;
    }

    if (key === "c") {
      ev.preventDefault();
      const text =
        typeof target.value === "string"
          ? target.value.slice(target.selectionStart || 0, target.selectionEnd || 0)
          : window.getSelection()?.toString() || "";
      copyText(text).catch(() => {});
    }
  });
}

async function safeSendTabMessage(tabId, msg) {
  await ensureContentConnection(tabId);
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch (err) {
    await ensureContentConnection(tabId);
    try {
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch {
      throw new Error(err?.message || "无法连接 Overleaf 页面脚本。");
    }
  }
}

async function fetchContext(options = {}) {
  const tabId = await getActiveTabId();
  const contextChars = cachedSettings?.sendLargeContext ? 1600 : 800;
  const res = await safeSendTabMessage(tabId, {
    type: "OA_GET_CONTEXT",
    payload: { ...options, contextChars }
  });
  if (!res?.ok) throw new Error(res?.error || "Failed to get context.");
  latestContext = res.context;
  els.ctxMeta.textContent = `${latestContext.fileName} | ${latestContext.sectionTitle || "(no section)"} | ${latestContext.selectionText.length} chars`;
  els.original.value = latestContext.selectionText;
  return res;
}

function renderSuggestion(s) {
  latestSuggestion = s;
  els.original.value = s.original || "";
  els.suggested.value = s.suggested || "";
  els.diff.innerHTML = s.diffHtml || "";
  els.rationale.textContent = s.briefRationale || "";
  els.errorDiagnosis.textContent =
    s.taskType === "latex_error_help"
      ? [s.likelyCause ? `可能原因：${s.likelyCause}` : "", s.minimalFix ? `最小修改：${s.minimalFix}` : ""]
          .filter(Boolean)
          .join(" | ")
      : "";

  els.warnings.innerHTML = "";
  (s.warnings || []).forEach((w) => {
    const li = document.createElement("li");
    li.textContent = w;
    els.warnings.appendChild(li);
  });

  const rebuttal = s.taskType === "rebuttal";
  els.rebuttalBox.classList.toggle("hidden", !rebuttal);
  if (rebuttal) setRebuttalTab("response");
}

async function generate(taskType) {
  if (taskType === "rebuttal" && !els.reviewerComment.value.trim()) {
    throw new Error("审稿回复模式需要先填写 Reviewer Comment。");
  }

  if (["latex_formula", "latex_table"].includes(taskType) && !els.latexInput.value.trim()) {
    throw new Error("请先输入公式/表格描述。");
  }

  const allowEmptySelection = ["rebuttal", "latex_error_help", "latex_formula", "latex_table"].includes(taskType);
  const includeErrorContext =
    taskType === "latex_error_help" && (els.includeErrorContext.checked || !!cachedSettings?.uploadErrorNearbyCode);

  setStatus("正在读取上下文...");
  const ctxRes = await fetchContext({ allowEmptySelection, includeErrorContext });

  setStatus("正在请求模型...");
  const res = await chrome.runtime.sendMessage({
    type: "OA_GENERATE",
    payload: {
      contextPacket: ctxRes.context,
      taskType,
      reviewerComment: els.reviewerComment.value.trim(),
      includeRecentStyle: els.includeRecentStyle.checked,
      latexInput: els.latexInput.value.trim(),
      errorContext: ctxRes.errorContext || ""
    }
  });
  if (!res?.ok) throw new Error(res?.error || "Generation failed.");

  renderSuggestion(res.suggestion);
  await loadHistory();
  setStatus(`生成完成：${formatTaskLabel(taskType)}`);
}

async function writeback(mode) {
  if (!latestSuggestion || !latestContext) throw new Error("No suggestion to write back.");
  if (!latestContext.selectionText) throw new Error("当前没有原始选区，无法安全替换，请先在 Overleaf 选中正文。");
  if (isRebuttalMode()) setStatus("审稿回复模式写回的是正文建议稿（Revised Manuscript）。");

  const tabId = await getActiveTabId();
  const res = await safeSendTabMessage(tabId, {
    type: "OA_WRITEBACK",
    payload: {
      mode,
      expectedOriginal: latestContext.selectionText,
      suggested: els.suggested.value
    }
  });
  if (!res?.ok) throw new Error(res?.error || "Writeback failed.");
  setStatus("写回成功");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || "");
    return;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text || "";
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) throw new Error("复制失败，请手动复制。");
  }
}

function renderHistory(history) {
  els.historyList.innerHTML = "";
  if (!history.length) {
    els.historyList.textContent = "暂无历史记录。";
    return;
  }

  history.slice(0, 12).forEach((item) => {
    const card = document.createElement("div");
    card.className = "history-item";
    const time = new Date(item.ts || Date.now()).toLocaleString();
    const snippet = String(item.suggested || "").slice(0, 120).replace(/\n/g, " ");

    const p1 = document.createElement("p");
    p1.className = "task";
    p1.textContent = `${formatTaskLabel(item.taskType)} | ${item.fileName || "unknown"} | ${time}`;
    const p2 = document.createElement("p");
    p2.textContent = snippet || "(empty)";
    card.appendChild(p1);
    card.appendChild(p2);

    const row = document.createElement("div");
    row.className = "actions-row";
    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.textContent = "载入到建议稿";
    useBtn.addEventListener("click", () => {
      els.suggested.value = item.suggested || "";
      setStatus("已从历史载入建议稿");
    });
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "复制";
    copyBtn.addEventListener("click", async () => {
      await copyText(item.suggested || "");
      setStatus("已复制历史项");
    });
    row.appendChild(useBtn);
    row.appendChild(copyBtn);
    card.appendChild(row);
    els.historyList.appendChild(card);
  });
}

async function loadHistory() {
  const res = await chrome.runtime.sendMessage({ type: "OA_GET_HISTORY" });
  if (!res?.ok) throw new Error(res?.error || "Load history failed.");
  renderHistory(res.history || []);
}

async function loadSettingsAndMemory() {
  ensureVenueOptions();
  const settingsRes = await chrome.runtime.sendMessage({ type: "OA_GET_SETTINGS" });
  if (settingsRes?.ok) {
    const s = settingsRes.settings;
    cachedSettings = s;
    els.provider.value = s.provider || "openai";
    els.targetVenue.value = s.targetVenue || "ieee";
    els.discipline.value = s.discipline || "Power Systems";
    els.baseUrl.value = s.baseUrl || "";
    els.apiKey.value = s.apiKey || "";
    els.model.value = s.model || "";
    els.maxTokens.value = s.maxTokens || 700;
    els.temperature.value = s.temperature ?? 0.2;
    els.sendLargeContext.checked = !!s.sendLargeContext;
    els.defaultAcademicEnglish.checked = !!s.defaultAcademicEnglish;
    els.uploadErrorNearbyCode.checked = !!s.uploadErrorNearbyCode;
    els.privacyMode.checked = !!s.privacyMode;
    renderPromptOverrides(s.promptOverrides || {});
    syncVenueButtons();
  }

  const memoryRes = await chrome.runtime.sendMessage({ type: "OA_GET_TERM_MEMORY" });
  if (memoryRes?.ok) {
    const m = memoryRes.termMemory;
    els.preferredTerms.value = termMapToText(m.preferred_terms || {});
    els.forbiddenTerms.value = (m.forbidden_terms || []).join("\n");
    els.styleRules.value = (m.style_rules || []).join("\n");
  }
}

async function saveSettings() {
  const payload = {
    provider: els.provider.value || "openai",
    targetVenue: els.targetVenue.value || "ieee",
    discipline: els.discipline.value.trim(),
    baseUrl: els.baseUrl.value.trim(),
    apiKey: els.apiKey.value.trim(),
    model: els.model.value.trim(),
    maxTokens: Number(els.maxTokens.value || 700),
    temperature: Number(els.temperature.value || 0.2),
    sendLargeContext: els.sendLargeContext.checked,
    defaultAcademicEnglish: els.defaultAcademicEnglish.checked,
    uploadErrorNearbyCode: els.uploadErrorNearbyCode.checked,
    privacyMode: els.privacyMode.checked,
    promptOverrides: readPromptOverridesFromUI()
  };
  const res = await chrome.runtime.sendMessage({ type: "OA_SAVE_SETTINGS", payload });
  if (!res?.ok) throw new Error(res?.error || "Save settings failed.");
  cachedSettings = res.settings;
}

function applyProviderPreset() {
  const key = els.provider.value || "openai";
  const preset = PROVIDER_PRESETS[key];
  if (!preset) return false;
  if (preset.baseUrl) els.baseUrl.value = preset.baseUrl;
  if (preset.model) els.model.value = preset.model;
  return true;
}

function applyDisciplinePreset() {
  const key = (els.discipline.value || "").trim();
  if (!key) return false;
  const preset = DISCIPLINE_PRESETS[key];
  if (!preset) return false;
  const existing = new Set(lines(els.styleRules.value));
  preset.forEach((r) => existing.add(r));
  els.styleRules.value = Array.from(existing).join("\n");
  return true;
}

async function saveMemory() {
  const payload = {
    preferred_terms: textToTermMap(els.preferredTerms.value),
    forbidden_terms: lines(els.forbiddenTerms.value),
    style_rules: lines(els.styleRules.value)
  };
  const res = await chrome.runtime.sendMessage({ type: "OA_SAVE_TERM_MEMORY", payload });
  if (!res?.ok) throw new Error(res?.error || "Save memory failed.");
}

async function loadQuickSuggestionIfAny() {
  const res = await chrome.runtime.sendMessage({ type: "OA_GET_QUICK_SUGGESTION" });
  const quick = res?.quick;
  if (!quick?.suggestion) return;
  latestContext = quick.context || null;
  if (latestContext) {
    els.ctxMeta.textContent = `${latestContext.fileName} | ${latestContext.sectionTitle || "(no section)"} | ${latestContext.selectionText.length} chars`;
  }
  renderSuggestion(quick.suggestion);
  setStatus("已载入快捷键任务结果");
}

async function onAction(fn) {
  try {
    await fn();
  } catch (err) {
    setStatus(err?.message || String(err), true);
  }
}

Object.keys(taskButtons).forEach((taskType) => {
  taskButtons[taskType].addEventListener("click", () => onAction(() => generate(taskType)));
});

els.tabResponse.addEventListener("click", () => setRebuttalTab("response"));
els.tabRevised.addEventListener("click", () => setRebuttalTab("revised"));
els.refreshBtn.addEventListener("click", () => onAction(() => fetchContext()));
els.replaceBtn.addEventListener("click", () => onAction(() => writeback("replace")));
els.insertBtn.addEventListener("click", () => onAction(() => writeback("insert_after")));
els.copyBtn.addEventListener("click", () =>
  onAction(async () => {
    await copyText(getCopyText());
    setStatus("已复制到剪贴板");
  })
);
els.saveSettings.addEventListener("click", () =>
  onAction(async () => {
    await saveSettings();
    setStatus("设置已保存");
  })
);
els.resetPrompts.addEventListener("click", () =>
  onAction(async () => {
    renderPromptOverrides(DEFAULT_PROMPT_OVERRIDES);
    await saveSettings();
    setStatus("提示词已恢复默认并保存");
  })
);
els.applyDiscipline.addEventListener("click", () =>
  onAction(async () => {
    const ok = applyDisciplinePreset();
    if (!ok) {
      setStatus("未找到该学科预设，请先输入预设学科名（如 Power Systems）。", true);
      return;
    }
    await saveMemory();
    setStatus("学科预设已应用到风格记忆");
  })
);
els.applyProvider.addEventListener("click", () =>
  onAction(async () => {
    const ok = applyProviderPreset();
    if (!ok) {
      setStatus("提供商预设不存在。", true);
      return;
    }
    await saveSettings();
    setStatus(`已应用提供商预设：${els.provider.value}`);
  })
);
els.saveMemory.addEventListener("click", () =>
  onAction(async () => {
    await saveMemory();
    setStatus("记忆已保存");
  })
);
els.targetVenue.addEventListener("change", () => {
  syncVenueButtons();
  setStatus(`投稿风格已切换为：${els.targetVenue.value}`);
});
document.querySelectorAll("#venueButtons button[data-venue]").forEach((btn) => {
  btn.addEventListener("click", () => {
    els.targetVenue.value = btn.dataset.venue;
    syncVenueButtons();
    setStatus(`投稿风格已切换为：${els.targetVenue.value}`);
  });
});
els.refreshHistory.addEventListener("click", () => onAction(loadHistory));
els.clearHistory.addEventListener("click", () =>
  onAction(async () => {
    const res = await chrome.runtime.sendMessage({ type: "OA_CLEAR_HISTORY" });
    if (!res?.ok) throw new Error(res?.error || "清空失败");
    await loadHistory();
    setStatus("历史已清空");
  })
);

document.addEventListener("keydown", (ev) => {
  if (!ev.altKey) return;
  const idx = Number(ev.key);
  if (!Number.isInteger(idx) || idx < 1 || idx > TASK_ORDER.length) return;
  ev.preventDefault();
  const taskType = TASK_ORDER[idx - 1];
  onAction(() => generate(taskType));
});

installKeyboardClipboardFallback();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "OA_QUICK_SUGGESTION") {
    latestContext = message.context || latestContext;
    renderSuggestion(message.suggestion);
    setStatus("快捷键任务已完成");
  } else if (message?.type === "OA_QUICK_ERROR") {
    setStatus(message.error || "快捷键任务失败", true);
  }
});

onAction(async () => {
  // Ensure key controls are always enabled even if browser restores stale disabled state.
  if (els.saveMemory) els.saveMemory.disabled = false;
  if (els.targetVenue) els.targetVenue.disabled = false;
  ensureVenueOptions();
  await loadSettingsAndMemory();
  await loadHistory();
  await loadQuickSuggestionIfAny();
});
