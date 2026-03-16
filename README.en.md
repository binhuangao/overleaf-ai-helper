# Overleaf AI Helper

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg) ![Chrome Extension](https://img.shields.io/badge/chrome-extension-blue) ![Manifest](https://img.shields.io/badge/manifest-v3-orange)

A lightweight AI writing assistant for Overleaf. It turns the workflow from "select text -> open AI tool -> rewrite -> paste back" into one or two steps inside Overleaf.

Chinese version: [README.md](README.md)

## Quick Setup (5 Minutes)

### 1. Install the extension
1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select folder: `overleaf-ai-helper`
5. Open an Overleaf project page (`overleaf.com` or `cn.overleaf.com`)

### 2. First-time configuration
1. Open the extension side panel
2. Fill in:
   - `Base URL` (your OpenAI-compatible endpoint)
   - `API Key`
   - `Model`
3. Choose provider preset:
   - `OpenAI / Anthropic / Gemini / OpenAI-Compatible`
   - Click `Apply Provider Preset`
4. Choose submission style:
   - Dropdown `Submission Style` or quick buttons `IEEE / Elsevier / Generic`
5. Set discipline (for example `Power Systems`) and click `Apply Discipline Preset`
6. Click `Save Settings`

### 3. Use immediately
1. Select text in Overleaf editor
2. Use either:
   - Side panel actions (rewrite/compress/expand/logic/proofread/translate)
   - Inline `AI` trigger in page and open floating panel
3. Generate and click `Replace Selection`

## Key Features
- Writing actions: rewrite, compress, expand, logic enhancement, proofreading
- Custom instruction mode in floating window
- Translation: faithful translation and academic rewrite
- Rebuttal helper: `Response Letter` + `Revised Manuscript`
- Lightweight LaTeX helper: equations, tables, compile-error hints
- Memory: preferred terms, forbidden words, style rules
- Prompt templates editable from settings
- Safe writeback: source-text change check before replacing

## How This Differs from Other Workflows

### Compared to traditional Overleaf plugins
- Lighter context policy: sends selected block + local context by default
- Safer editing: always preview first, then confirm writeback
- Higher customization: provider endpoint, discipline, journal style, prompt templates
- Personal workflow focus: local term/style memory, editable anytime

### Compared to VSCode + Overleaf Git sync
- Lower setup cost: no need to switch to full local LaTeX engineering flow
- Faster writing loop: rewrite directly where you edit in Overleaf
- Better for micro-edits: optimized for paragraph-level polishing
- Can coexist: keep your Git workflow, use this only for writing assistance

## Prompt Template Editing
No code changes needed. Edit in Settings -> Prompt Templates:
- System prompt
- Academic rewrite template
- Compression template
- Chinese-to-English academic template
- Rebuttal template

## Shortcuts
- Side panel: `Alt+1..8`
- Global: `Ctrl/Cmd+Shift+1/2/3`
- Customizable at `chrome://extensions/shortcuts`

## Project Structure
```text
manifest.json
service-worker.js
sidepanel/
content/
injected/
core/
assets/
```

## Open Source Docs
- [CONTRIBUTING](CONTRIBUTING.md)
- [SECURITY](SECURITY.md)
- [PRIVACY](PRIVACY.md)
- [CHANGELOG](CHANGELOG.md)
