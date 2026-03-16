function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tokenize(text) {
  // Keep punctuation and whitespace as separate tokens for better replace highlighting.
  return (text || "")
    .split(/(\s+|[.,;:!?()[\]{}])/g)
    .filter((x) => x !== "");
}

function lcsMatrix(a, b) {
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
  const ops = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: "eq", text: a[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "ins", text: b[j - 1] });
      j -= 1;
    } else {
      ops.push({ type: "del", text: a[i - 1] });
      i -= 1;
    }
  }
  return ops.reverse();
}

function collapseReplaceOps(ops) {
  const merged = [];
  for (let i = 0; i < ops.length; i += 1) {
    const cur = ops[i];
    const next = ops[i + 1];
    if (cur?.type === "del" && next?.type === "ins") {
      merged.push({ type: "rep", from: cur.text, to: next.text });
      i += 1;
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

export function buildDiffHtml(original, suggested) {
  if (!original && !suggested) return "";
  if (!original) return `<ins>${escapeHtml(suggested)}</ins>`;
  if (!suggested) return `<del>${escapeHtml(original)}</del>`;

  const a = tokenize(original);
  const b = tokenize(suggested);
  const ops = collapseReplaceOps(backtrack(a, b, lcsMatrix(a, b)));

  return ops
    .map((op) => {
      if (op.type === "eq") return `<span>${escapeHtml(op.text)}</span>`;
      if (op.type === "ins") return `<ins>${escapeHtml(op.text)}</ins>`;
      if (op.type === "del") return `<del>${escapeHtml(op.text)}</del>`;
      return `<span class="rep"><del>${escapeHtml(op.from)}</del><ins>${escapeHtml(op.to)}</ins></span>`;
    })
    .join("");
}
