# ISOM 3770 · 考前查缺补漏

单文件、离线可用的期中考前诊断页。打开根目录的 **`ISOM3770_Midterm_GapCheck.html`** 即可使用，不需要安装、服务器或 API。

## 功能

- **自选题量**：10–100 题；20 / 40 / 60 / 80 / 100 快捷按钮，默认 100。
- **全英文 A–E 单选**：A–D 为正常选项，E 固定为 `不知道 / I don't know`；所有题（含 E）作答后才能交卷。
- **两种出题方式**：均衡覆盖（按 Session 题量比例）与薄弱优先（按上一次各 Session 漏洞率加权）。
- **答题辅助**：题号跳转、上一题/下一题、标记、跳到未答、键盘 `A–E` / `1–5` / `←` `→` / `F`。
- **自动保存**：每次选择、翻题、标记都会写入浏览器 `localStorage`；关闭后重新打开可继续。
- **交卷后诊断**：
  - 正确 / 答错 / 不知道 / 有效正确率；
  - 知识空白、理解错误、应用不足三类拆分；
  - Session 章节诊断与优先级；
  - 题型诊断（Concept / Calculation / Model / Scenario / Case）；
  - 69 个知识点逐项诊断，对应复习页 `Sx · xx` 知识框；
  - 逐题正确答案、你的选择、英文解析与重点复习建议。
- **下一步动作**：练本章、练知识点、只重练错题与不知道的题、再练一组。
- **导出诊断 JSON**：报告页点击「导出诊断 JSON」，把文件上传到对话即可做进一步分析；也可「复制 JSON」。
- **打印 / PDF**：报告页支持打印，A4 排版。

## 使用流程

1. 双击打开 `ISOM3770_Midterm_GapCheck.html`。
2. 选择题量，点「开始 X 题诊断」。
3. 不确定就选 **E**，不要猜；做完后交卷。
4. 先看高优先级 Session，再点「练」做 10 题验证；或点「重练错题与不知道」。
5. 点击「导出诊断 JSON」，把下载的 `ISOM3770_gapcheck_日期_XQ.json` 上传到对话。

## 范围

- 覆盖：S1–S12，战略与六大驱动、网络规划/MILP、库存模型、Risk Pooling、Bullwhip、S&OP/Red Tomato、Seven-Eleven Japan、Zara，以及 Beer Game 情境。
- 排除：S13（仅考试形式说明）、Gravity Model、独立的 Z & Loss Function 表。
- 题库 100 题，69 个知识点；Newsvendor 临界比/z 值计算仍保留。

## 复习页链接

页面中的「复习页」链接默认指向：

```text
../ISOM3770_review.html
```

复习页是私人学习资料，不在本仓库中。使用时把 `ISOM3770_review.html` 放在本 HTML 的上一级目录；也可以把两个文件放在同一目录，或把 `src/app.js` 里的 `REVIEW_HREF` 改成实际相对路径后重新构建。

## 数据与隐私

- 所有答题数据只存在当前浏览器的 `localStorage`，不会上传。
- 换浏览器、无痕模式或清除站点数据后，进度和历史会丢失。
- 导出的 JSON 包含题目、选项、你的选择、正确答案、解析和诊断，上传前请确认是否愿意分享这些内容。

## 诊断 JSON 结构

导出的 JSON 以 `schemaVersion: "isom3770.gapcheck.v1"` 开头，主要字段：

- `exam`：本次配置（题量、模式、开始/交卷时间、用时、seed）。
- `summary`：总数、正确、答错、不知道、未答、漏洞数；`accuracy` 为 0–1 小数，`accuracyPercent` 为百分数；另有 `effectiveAccuracy`（排除 E）与三类漏洞计数。
- `sections` / `types` / `topics`：章节、题型、知识点的题数、正确/答错/不知道、漏洞率（`gapRate` 0–1，`gapRatePercent` 百分数）、优先级或问题类型。
- `recommendations`：按优先级排序的复习动作、预计分钟数、涉及题号。
- `strengths`：本次全对的知识点。
- `answers`：逐题的题目、选项、你的选择、正确答案、状态、解析与 `reviewTip`。

## 文件

```text
ISOM3770_Midterm_GapCheck.html      最终单文件（直接打开）
isom3770-gapcheck/
├── build.py                         构建脚本
├── src/
│   ├── bank.json                    100 题题库 + 知识点映射
│   ├── styles.css                   样式
│   ├── app.js                       答题、诊断、导出逻辑
│   └── template.html                单文件模板
├── tests/                           Playwright 验收脚本
├── dist/                            构建副本（不入库）
└── test-output/                     验收截图与导出样例（不入库）
```

## 重新构建 / 验收

```bash
cd isom3770-gapcheck
python3 build.py

# 需要 Playwright Chromium；脚本会复用
# personal-learning-platform/node_modules 里的 Playwright
node tests/smoke.mjs
node tests/advanced.mjs
node tests/full100.mjs
```

验收覆盖：20 题作答与统计、交卷拦截、E 计数、章节/题型/知识点诊断、JSON 导出、错题重练、章节练习、薄弱优先、刷新续答、100 题完整流程、移动端与深色模式。
