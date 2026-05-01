## 2026-05-01 架构文档完善工作完成

- 文档: `docs/architecture.md` 686→912 行
- v1.0 → v1.1
- 10项改进全部应用，3批次执行，每批次逐一验证通过

### 新增章节
- 3.2 部署拓扑视图 (ASCII diagram)
- 5.5 统一错误处理 (JSON格式/状态码/Zod/越权)
- 5.6 日志策略 (级别/脱敏/审计)
- 11.5 性能基线 (11项指标，placeholder)

### 替换/增强章节
- 5.2 API表: +R/W列, 拆分为30行精确标记
- 5.4: ASCII→Mermaid sequenceDiagram
- 7.1: ASCII→Mermaid stateDiagram-v2 + Bot错误重试表
- 10.3: +限流降级策略
- 11.4: →测试金字塔 + Mock策略表

### 验证状态: 全部通过 ✅
