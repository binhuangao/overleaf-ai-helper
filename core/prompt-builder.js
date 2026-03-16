export const DEFAULT_SYSTEM_RULES = [
  "You are an assistant for scientific writing in Overleaf.",
  "Do not alter LaTeX commands, labels, citations, references, or math symbols unless explicitly requested.",
  "Preserve original meaning and terminology consistency.",
  "Do not fabricate experimental results, citations, datasets, or claims.",
  "Keep output concise, technically precise, and publication-ready."
].join("\n");

export const DEFAULT_TASK_TEMPLATES = {
  rewrite:
    "Rewrite the selected passage into polished journal style. Keep all technical meanings unchanged. Preserve symbols, equations, references, and labels.",
  compress:
    "Compress the selected passage with minimal information loss. Keep key claims, assumptions, constraints, and quantitative details.",
  expand:
    "Expand the selected passage with stronger transitions and clearer logic without adding unsupported claims or new results.",
  logic_enhance:
    "Strengthen causality, argument flow, and contribution-to-result alignment while preserving facts and not inventing evidence.",
  proofread:
    "Proofread the selected text for grammar, spelling, punctuation, and basic academic wording issues. Do not change technical meaning or symbols.",
  translate_literal:
    "Translate Chinese to English faithfully. Keep variables, acronyms, proper nouns, and LaTeX syntax unchanged.",
  translate_academic:
    "Rewrite Chinese draft into polished journal English. Allow sentence restructuring, but keep factual scope unchanged and avoid exaggerated claims.",
  rebuttal:
    "Classify reviewer concern type first, then generate response letter and revised manuscript proposal separately, with polite but confident tone.",
  latex_formula:
    "Convert natural language formula description into valid LaTeX equation/align code with clear variable placeholders.",
  latex_table:
    "Convert CSV/TSV/plain table description into valid LaTeX tabular code. Prefer booktabs style when appropriate.",
  latex_error_help:
    "Analyze compile error context and provide likely cause plus minimum-change fix with corrected LaTeX snippet."
};

function parseTaggedStyleRule(rule) {
  const m = String(rule || "").match(
    /^\[(intro|introduction|abstract|conclusion|results|method|discussion)\]\s*(.+)$/i
  );
  if (!m) return { tag: "generic", text: String(rule || "") };
  return { tag: m[1].toLowerCase(), text: m[2].trim() };
}

function pickStyleRules(memory, contextPacket, taskType) {
  const all = (memory?.style_rules || []).map(parseTaggedStyleRule).filter((x) => x.text);
  if (!all.length) return [];
  if (taskType === "rebuttal") return all.map((x) => x.text);

  const sec = String(contextPacket?.sectionTitle || "").toLowerCase();
  const secTags = [];
  if (/intro/.test(sec)) secTags.push("intro", "introduction");
  if (/abstract/.test(sec)) secTags.push("abstract");
  if (/conclusion|summary/.test(sec)) secTags.push("conclusion");
  if (/result|experiment/.test(sec)) secTags.push("results");
  if (/method|methodology/.test(sec)) secTags.push("method");
  if (/discussion/.test(sec)) secTags.push("discussion");

  return all
    .filter((x) => x.tag === "generic" || secTags.includes(x.tag))
    .map((x) => x.text);
}

function buildMemoryBlock(memory, contextPacket, taskType, includeRecentStyle, recentStyleSamples) {
  const preferred = Object.entries(memory?.preferred_terms || {})
    .map(([k, v]) => `- ${k} => ${v}`)
    .join("\n");
  const forbidden = (memory?.forbidden_terms || []).map((x) => `- ${x}`).join("\n");
  const style = pickStyleRules(memory, contextPacket, taskType)
    .map((x) => `- ${x}`)
    .join("\n");
  const historyStyle =
    includeRecentStyle && Array.isArray(recentStyleSamples) && recentStyleSamples.length
      ? recentStyleSamples.map((x) => `- ${x}`).join("\n")
      : "";

  const blocks = [
    "[Term Memory]",
    preferred || "- (none)",
    "[Forbidden Terms/Rules]",
    forbidden || "- (none)",
    "[Style Rules]",
    style || "- (none)"
  ];

  if (historyStyle) {
    blocks.push("[Recent Style References]");
    blocks.push(historyStyle);
  }
  return blocks.join("\n");
}

function getVenueGuideline(targetVenue) {
  if (targetVenue === "elsevier") {
    return [
      "Prefer Elsevier-style scientific writing.",
      "Avoid overstatement; keep claims proportionate to evidence.",
      "Use clear structure: motivation, method, key findings, limitations.",
      "Keep sentences concise and avoid promotional adjectives."
    ].join("\n");
  }
  if (targetVenue === "ieee") {
    return [
      "Prefer IEEE paper style.",
      "Use concise, objective, technical language.",
      "Prioritize precision, reproducibility cues, and symbol consistency.",
      "Avoid first-person exaggeration and unsupported novelty claims."
    ].join("\n");
  }
  return "Use neutral top-tier engineering journal style.";
}

function getDisciplineGuideline(discipline) {
  const d = String(discipline || "").trim();
  if (!d) return "(none)";
  return [
    `Field: ${d}`,
    "Keep terminology aligned to this discipline and avoid cross-domain wording drift."
  ].join("\n");
}

function getOutputRule(taskType) {
  if (taskType === "rebuttal") {
    return "Output JSON with keys: responseLetter, revisedManuscript, briefRationale, warnings.";
  }
  if (taskType === "latex_error_help") {
    return "Output JSON with keys: suggested, likelyCause, minimalFix, briefRationale, warnings.";
  }
  return "Output JSON with keys: suggested, briefRationale, warnings. Do not include markdown fences.";
}

function resolveTemplate(taskType, promptOverrides) {
  const base = DEFAULT_TASK_TEMPLATES[taskType] || DEFAULT_TASK_TEMPLATES.rewrite;
  const override = String(promptOverrides?.[taskType] || "").trim();
  return override || base;
}

export function buildPrompt(contextPacket, extra = {}) {
  const taskType = extra.taskType || contextPacket.taskType || "rewrite";
  const system = String(extra.systemPromptOverride || "").trim() || DEFAULT_SYSTEM_RULES;
  const taskInstruction =
    String(extra.customInstruction || "").trim() || resolveTemplate(taskType, extra.taskTemplatesOverride || {});

  const userContent = [
    `[Task]\n${taskInstruction}`,
    `[Metadata]\nprojectUrl: ${contextPacket.projectUrl}\nfileName: ${contextPacket.fileName}\nsectionTitle: ${contextPacket.sectionTitle}\nlanguageHint: ${contextPacket.languageHint}`,
    `[Venue Guideline]\n${getVenueGuideline(extra.targetVenue)}`,
    `[Discipline Guideline]\n${getDisciplineGuideline(extra.discipline)}`,
    buildMemoryBlock(
      contextPacket.termMemory,
      contextPacket,
      taskType,
      !!extra.includeRecentStyle,
      extra.recentStyleSamples || []
    ),
    taskType === "rebuttal" ? `[Reviewer Comment]\n${extra.reviewerComment || ""}` : "",
    extra.latexInput ? `[Latex Input]\n${extra.latexInput}` : "",
    extra.errorContext ? `[Compile Error Context]\n${extra.errorContext}` : "",
    `[Context Before]\n${contextPacket.beforeText}`,
    `[Selection]\n${contextPacket.selectionText}`,
    `[Context After]\n${contextPacket.afterText}`,
    `[Output Rule]\n${getOutputRule(taskType)}`
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user: userContent };
}
