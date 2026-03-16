function normalizeBaseUrl(baseUrl) {
  const trimmed = (baseUrl || "").trim().replace(/\/$/, "");
  if (!trimmed) throw new Error("Base URL is required.");
  return trimmed;
}

export async function requestCompletion({ settings, prompt }) {
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const endpoint = `${baseUrl}/chat/completions`;

  if (!settings.apiKey) {
    throw new Error("API Key is missing.");
  }

  const body = {
    model: settings.model || "gpt-4o-mini",
    temperature: Number.isFinite(settings.temperature) ? settings.temperature : 0.2,
    max_tokens: Number.isFinite(settings.maxTokens) ? settings.maxTokens : 700,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ]
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Model request failed (${res.status}): ${txt.slice(0, 240)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Model returned empty content.");
  }

  return content;
}
