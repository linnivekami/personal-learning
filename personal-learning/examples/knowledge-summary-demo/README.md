# 知识归纳演示（公开数据）

虚构的“基础统计”主题，用来演示知识归纳模式；不对应任何真实课程或学习者。

| 文件 | 作用 |
| --- | --- |
| `cards.json` | 卡片数据（plos-knowledge-summary/1） |
| `knowledge-map.md` | 带 `#id` 的知识地图，卡片 `id` / `node` 与之对齐 |
| `state.md` | 演示用学习状态：含可用等级、待核验、合并记录、到期复习和最近失败 |
| `stats-overview.html` | 构建结果，直接用浏览器打开 |

重新构建（在 `personal-learning/` 下）：

```bash
python3 scripts/build_summary.py examples/knowledge-summary-demo/cards.json \
  --state examples/knowledge-summary-demo/state.md \
  --map examples/knowledge-summary-demo/knowledge-map.md \
  --out examples/knowledge-summary-demo/stats-overview.html
```
