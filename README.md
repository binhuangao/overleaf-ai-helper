# Overleaf AI Helper

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg) ![Chrome Extension](https://img.shields.io/badge/chrome-extension-blue) ![Manifest](https://img.shields.io/badge/manifest-v3-orange)

一个面向 Overleaf 的本地 AI 写作助手。目标是把“选中 -> 提示改写 -> 确认回填”变成一步到两步。
English version: [README.en.md](README.en.md)

## 小白快速配置（5 分钟）

### 1. 安装插件
1. 打开 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择目录到：`overleaf-ai-helper`
5. 打开任意 Overleaf 项目页（`overleaf.com` 或 `cn.overleaf.com`）

### 2. 首次设置
1. 打开插件侧栏
2. 在“设置区”填：
   - `Base URL`（例如 OpenAI 兼容接口地址）
   - `API Key`
   - `模型名称`
3. 选择模型提供商并应用预设：
   - `OpenAI / Anthropic / Gemini / OpenAI-Compatible`
   - 点击“应用提供商预设”自动填入常见 Base URL/模型
4. 选择投稿风格：
   - 下拉框 `投稿风格` 或下面按钮 `IEEE / Elsevier / Generic` 二选一都可
5. 选学科（可填 `Power Systems`）后点“应用学科预设”
6. 点“保存设置”

### 3. 立刻使用
1. 在 Overleaf 中选中一段文字
2. 两种入口任选：
   - 侧栏按钮（学术改写/压缩/扩写/逻辑增强/纠错/翻译）
   - 页面中出现 `AI` 悬浮按钮，点开浮窗操作
3. 生成后点“替换选区”写回

## 功能总览
- 写作编辑：学术改写、压缩、扩写、逻辑增强、纠错（语法/拼写）
- 自定义改写：在浮窗输入任意修改要求执行
- 翻译：忠实翻译、学术重写
- 审稿回复：Response Letter + Revised Manuscript
- LaTeX 辅助：公式、表格、报错辅助
- 记忆：术语映射、禁用规则、风格偏好
- 设置：投稿风格、学科、提示词模板覆盖
- 安全写回：源文本变化检测 + 回填兜底

## 与其他方案的区别

### 相比“传统 Overleaf 插件”
- 更轻量：默认只发送“选中段落 + 局部上下文”，不走整篇上传
- 更可控：所有 AI 结果先预览（含 diff）再写回，不直接覆盖正文
- 更可定制：可配 OpenAI-compatible 接口、学科预设、投稿风格、提示词模板
- 更贴近个人工作流：术语记忆与风格记忆是本地可编辑的

### 相比“VSCode 直接拉 Overleaf Git 仓库”
- 更低门槛：不需要先搭 Git 同步工作流，也不依赖本地 LaTeX 工程
- 更快闭环：在 Overleaf 页面中选中即改，不用来回切 IDE
- 更专注局部润色：不是替代完整版本管理，而是减少高频改写动作成本
- 可并行使用：你仍可保留 Git/VSCode 流程，本插件只负责写作辅助与安全回填

## 提示词怎么改
不需要改代码，直接在“设置区 -> 提示词模板”修改即可：
- 系统提示词
- 学术改写模板
- 压缩模板
- 中译英学术重写模板
- 审稿回复模板

改完点击“保存设置”。

## 快捷键
- 侧栏内：`Alt+1..8`
- 全局快捷键：`Ctrl/Cmd+Shift+1/2/3`
  - 可在 `chrome://extensions/shortcuts` 修改

## 常见问题排查

### A. 点按钮没反应
1. 先 `Reload` 插件（`chrome://extensions`）
2. 再刷新 Overleaf 页面
3. 确认当前标签页是 Overleaf 编辑页

### B. 投稿风格下拉没有选项/不好点
- 可直接用下方按钮 `IEEE / Elsevier / Generic` 切换（与下拉等价）

### C. 写回时报错（如 no active editor element）
1. 重新选中文本后再生成一次
2. 用“替换选区”而不是直接复制粘贴
3. 若仍失败，先复制结果手动贴入，再反馈页面结构样例

### D. 提示 Extension context invalidated
- 这是扩展更新后旧脚本失效，刷新 Overleaf 页面即可

## 当前已知限制
- Overleaf 编辑器 DOM 持续迭代，极少数页面下回填可能不稳定
- 报错辅助是启发式提取，不保证覆盖所有隐藏日志

## 目录结构
```text
manifest.json
service-worker.js
sidepanel/
  index.html
  index.js
  index.css
content/
  content.js
  inline-ui.js
  selection.js
  writeback.js
injected/
  editor-bridge.js
core/
  prompt-builder.js
  api-client.js
  diff.js
  context-extractor.js
  memory-store.js
```


## 开源文档
- [CONTRIBUTING](CONTRIBUTING.md)
- [SECURITY](SECURITY.md)
- [PRIVACY](PRIVACY.md)
- [CHANGELOG](CHANGELOG.md)
