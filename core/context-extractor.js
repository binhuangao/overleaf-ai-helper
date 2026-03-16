const SECTION_RE = /\\(section|subsection|subsubsection)\*?\{([^}]*)\}/g;

function detectLanguageHint(text) {
  if (!text || !text.trim()) return "mixed";
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  const latex = (text.match(/\\[A-Za-z]+|\$[^$]+\$/g) || []).length;

  if (latex > 0 && latex > en * 0.2) return "latex";
  if (zh > 0 && en === 0) return "zh";
  if (en > 0 && zh === 0) return "en";
  return "mixed";
}

function getNearestSectionTitle(beforeText) {
  if (!beforeText) return "";
  const matches = [...beforeText.matchAll(SECTION_RE)];
  if (!matches.length) return "";
  return matches[matches.length - 1][2]?.trim() || "";
}

export function buildContextPacket({
  projectUrl,
  fileName,
  fullText,
  selectionText,
  selectionStart,
  selectionEnd,
  cursorInfo,
  termMemory,
  taskType,
  contextChars
}) {
  const safeFull = fullText || "";
  const safeSelection = selectionText || "";
  const win = Number.isFinite(contextChars) ? Math.max(200, contextChars) : 800;

  const beforeIdx = Math.max(0, (selectionStart || 0) - win);
  const afterIdx = Math.min(safeFull.length, (selectionEnd || 0) + win);

  const beforeText = safeFull.slice(beforeIdx, selectionStart || 0);
  const afterText = safeFull.slice(selectionEnd || 0, afterIdx);
  const sectionTitle = getNearestSectionTitle(safeFull.slice(0, selectionStart || 0));

  return {
    projectUrl: projectUrl || "",
    fileName: fileName || "main.tex",
    sectionTitle,
    selectionText: safeSelection,
    beforeText,
    afterText,
    cursorInfo: cursorInfo || { line: -1, ch: -1 },
    languageHint: detectLanguageHint(safeSelection),
    termMemory: termMemory || {
      preferred_terms: {},
      forbidden_terms: [],
      style_rules: []
    },
    taskType: taskType || "rewrite"
  };
}
