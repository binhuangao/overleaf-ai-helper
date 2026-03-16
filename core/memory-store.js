const DEFAULT_SETTINGS = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  maxTokens: 700,
  temperature: 0.2,
  sendLargeContext: false,
  defaultAcademicEnglish: true,
  uploadErrorNearbyCode: false,
  privacyMode: false,
  targetVenue: "ieee",
  discipline: "Power Systems",
  promptOverrides: {
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
  }
};

const DEFAULT_TERM_MEMORY = {
  preferred_terms: {},
  forbidden_terms: [],
  style_rules: []
};

export async function getSettings() {
  const data = await chrome.storage.sync.get("settings");
  return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
}

export async function saveSettings(partial) {
  const settings = await getSettings();
  const merged = { ...settings, ...partial };
  await chrome.storage.sync.set({ settings: merged });
  return merged;
}

export async function getTermMemory() {
  const data = await chrome.storage.sync.get("termMemory");
  return { ...DEFAULT_TERM_MEMORY, ...(data.termMemory || {}) };
}

export async function saveTermMemory(partial) {
  const current = await getTermMemory();
  const next = {
    preferred_terms: {
      ...(current.preferred_terms || {}),
      ...(partial.preferred_terms || {})
    },
    forbidden_terms: partial.forbidden_terms || current.forbidden_terms || [],
    style_rules: partial.style_rules || current.style_rules || []
  };
  await chrome.storage.sync.set({ termMemory: next });
  return next;
}

export async function appendHistory(item) {
  const data = await chrome.storage.local.get("history");
  const history = Array.isArray(data.history) ? data.history : [];
  history.unshift({ ...item, ts: Date.now() });
  const limited = history.slice(0, 30);
  await chrome.storage.local.set({ history: limited });
  return limited;
}

export async function getHistory() {
  const data = await chrome.storage.local.get("history");
  return Array.isArray(data.history) ? data.history : [];
}

export async function clearHistory() {
  await chrome.storage.local.remove("history");
}
