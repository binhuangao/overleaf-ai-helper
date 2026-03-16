import { buildPrompt } from "./core/prompt-builder.js";
import { requestCompletion } from "./core/api-client.js";
import { buildDiffHtml } from "./core/diff.js";
import {
  getSettings,
  saveSettings,
  getTermMemory,
  saveTermMemory,
  appendHistory,
  getHistory,
  clearHistory
} from "./core/memory-store.js";

const QUICK_RESULT_KEY = "quickSuggestion";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeSuggestion(taskType, context, modelText) {
  const parsed = safeJsonParse(modelText);
  const suggested =
    taskType === "rebuttal"
      ? parsed?.revisedManuscript || String(modelText || "").trim()
      : parsed?.suggested || String(modelText || "").trim();

  const likelyCause = parsed?.likelyCause || "";
  const minimalFix = parsed?.minimalFix || "";
  const briefRationale = parsed?.briefRationale || "";
  const warnings = Array.isArray(parsed?.warnings) ? parsed.warnings : [];
  const responseLetter = parsed?.responseLetter || "";
  const revisedManuscript = parsed?.revisedManuscript || suggested;

  return {
    taskType,
    original: context.selectionText,
    suggested,
    diffHtml: buildDiffHtml(context.selectionText, suggested),
    briefRationale,
    warnings,
    responseLetter,
    revisedManuscript,
    likelyCause,
    minimalFix
  };
}

function buildRecentStyleSamples(history, contextPacket) {
  const section = String(contextPacket.sectionTitle || "").toLowerCase();
  const fileName = String(contextPacket.fileName || "").toLowerCase();
  return history
    .filter((x) => String(x.fileName || "").toLowerCase() === fileName || section.includes("intro") || section.includes("conclusion"))
    .slice(0, 3)
    .map((x) => String(x.suggested || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((x) => x.slice(0, 280));
}

function injectDefaultStyle(memory, settings, taskType) {
  if (!settings.defaultAcademicEnglish) return memory;
  const next = { ...memory, style_rules: [...(memory.style_rules || [])] };
  if (["rewrite", "compress", "expand", "logic_enhance", "proofread", "translate_literal", "translate_academic"].includes(taskType)) {
    if (!next.style_rules.includes("prefer concise academic English style")) {
      next.style_rules.push("prefer concise academic English style");
    }
  }
  if (settings.targetVenue === "ieee" && !next.style_rules.includes("follow IEEE tone: concise, objective, and technically precise")) {
    next.style_rules.push("follow IEEE tone: concise, objective, and technically precise");
  }
  if (settings.targetVenue === "elsevier" && !next.style_rules.includes("follow Elsevier tone: rigorous, structured, and claim-conservative")) {
    next.style_rules.push("follow Elsevier tone: rigorous, structured, and claim-conservative");
  }
  if (settings.discipline) {
    const dRule = `discipline focus: ${settings.discipline}`;
    if (!next.style_rules.includes(dRule)) next.style_rules.push(dRule);
  }
  return next;
}

async function handleGenerate({
  contextPacket,
  taskType,
  reviewerComment,
  includeRecentStyle,
  latexInput,
  errorContext,
  customInstruction
}) {
  const settings = await getSettings();
  const rawMemory = await getTermMemory();
  const memory = injectDefaultStyle(rawMemory, settings, taskType);
  const history = includeRecentStyle ? await getHistory() : [];

  const packed = {
    ...contextPacket,
    taskType,
    termMemory: memory
  };

  const prompt = buildPrompt(packed, {
    taskType,
    customInstruction,
    reviewerComment,
    includeRecentStyle,
    recentStyleSamples: includeRecentStyle ? buildRecentStyleSamples(history, packed) : [],
    latexInput,
    errorContext,
    targetVenue: settings.targetVenue,
    discipline: settings.discipline,
    systemPromptOverride: settings.promptOverrides?.system || "",
    taskTemplatesOverride: settings.promptOverrides || {}
  });

  const modelText = await requestCompletion({ settings, prompt });
  const suggestion = normalizeSuggestion(taskType, packed, modelText);

  if (!settings.privacyMode) {
    await appendHistory({
      fileName: packed.fileName,
      sectionTitle: packed.sectionTitle,
      taskType,
      original: packed.selectionText,
      suggested: suggestion.suggested,
      warnings: suggestion.warnings
    });
  }

  return suggestion;
}

async function getActiveOverleafTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs.find((t) => {
    try {
      const u = new URL(String(t.url || ""));
      return u.protocol === "https:" && (u.hostname === "overleaf.com" || u.hostname.endsWith(".overleaf.com"));
    } catch {
      return false;
    }
  });
  return tab || null;
}

async function notifyPanels(message) {
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // No open extension pages. Safe to ignore.
  }
}

async function runQuickTask(taskType) {
  const tab = await getActiveOverleafTab();
  if (!tab?.id) return;

  const allowEmptySelection = taskType === "latex_error_help";
  const includeErrorContext = taskType === "latex_error_help";
  const contextRes = await chrome.tabs.sendMessage(tab.id, {
    type: "OA_GET_CONTEXT",
    payload: { allowEmptySelection, includeErrorContext, contextChars: 1400 }
  });
  if (!contextRes?.ok) {
    await notifyPanels({ type: "OA_QUICK_ERROR", error: contextRes?.error || "Quick task failed while reading context." });
    return;
  }

  const suggestion = await handleGenerate({
    contextPacket: contextRes.context,
    taskType,
    includeRecentStyle: false,
    latexInput: "",
    errorContext: contextRes?.errorContext || ""
  });

  await chrome.storage.local.set({
    [QUICK_RESULT_KEY]: {
      suggestion,
      context: contextRes.context,
      ts: Date.now()
    }
  });
  await chrome.sidePanel.open({ windowId: tab.windowId });
  await notifyPanels({ type: "OA_QUICK_SUGGESTION", suggestion, context: contextRes.context });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "quick-rewrite") runQuickTask("rewrite").catch(console.error);
  if (command === "quick-translate") runQuickTask("translate_academic").catch(console.error);
  if (command === "quick-latex-error-help") runQuickTask("latex_error_help").catch(console.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "OA_GET_SETTINGS") {
      sendResponse({ ok: true, settings: await getSettings() });
      return;
    }

    if (message?.type === "OA_SAVE_SETTINGS") {
      sendResponse({ ok: true, settings: await saveSettings(message.payload || {}) });
      return;
    }

    if (message?.type === "OA_GET_TERM_MEMORY") {
      sendResponse({ ok: true, termMemory: await getTermMemory() });
      return;
    }

    if (message?.type === "OA_SAVE_TERM_MEMORY") {
      sendResponse({ ok: true, termMemory: await saveTermMemory(message.payload || {}) });
      return;
    }

    if (message?.type === "OA_GET_HISTORY") {
      sendResponse({ ok: true, history: await getHistory() });
      return;
    }

    if (message?.type === "OA_CLEAR_HISTORY") {
      await clearHistory();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "OA_GET_QUICK_SUGGESTION") {
      const data = await chrome.storage.local.get(QUICK_RESULT_KEY);
      sendResponse({ ok: true, quick: data?.[QUICK_RESULT_KEY] || null });
      return;
    }

    if (message?.type === "OA_GENERATE") {
      const suggestion = await handleGenerate(message.payload || {});
      sendResponse({ ok: true, suggestion });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type." });
  })().catch((err) => {
    console.error("[OverleafAI] worker error", err);
    sendResponse({ ok: false, error: err?.message || String(err) });
  });

  return true;
});
