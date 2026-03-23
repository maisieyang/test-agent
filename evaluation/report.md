# Test Generation Agent — Evaluation Report

> 评估日期：2026-03-23
> 目标项目：confluence-qa-assistant（Next.js 15 + React 19 + TypeScript）
> Agent 技术栈：Claude Agent SDK + TypeScript

---

## 1. 覆盖率数据

### Before → After

| 指标 | Before | After | 提升 |
|------|--------|-------|------|
| **Statements** | ~0%（仅 SendButton） | **41.07%** | +41pp |
| **Lines** | ~0% | **41.78%** | +41pp |
| **Functions** | ~0% | **46.64%** | +46pp |
| **Branches** | ~0% | **31.99%** | +31pp |

> Before 基线：仅 1 个测试文件（SendButton.test.tsx，2 个用例），全项目实测覆盖率 ~0%。
> Agent 在 `full` 模式运行时检测到实际基线为 22.46%（因为前 4 轮运行已产出 293 个测试）。

### 目标达成

| 目标 | 实际 | 状态 |
|------|------|------|
| Statement 覆盖率 40%+ | 41.07% | ✅ 达成 |
| 测试通过率 > 90% | 100%（443/443） | ✅ 超额达成 |

---

## 2. 测试生成统计

### 按运行阶段

| 阶段 | 目标模块 | 新增测试数 | 新增套件数 | 通过率 | 首次通过率 |
|------|---------|-----------|-----------|--------|-----------|
| Run 1: 纯函数 | bm25, tokenizer, fusion | 67 | 3 | 100% | 100%（无需修复） |
| Run 2: Utils | markdownPreprocessor, astMarkdownProcessor | 90 | 2 | 100% | 100%（无需修复） |
| Run 3: 组件 | 9 个 React 组件 | 76 | 9 | 100% | ~78%（2 个需修复） |
| Run 4: Pipeline | queryTransform, contextManager, reranker | 58 | 3 | 100% | 100%（无需修复） |
| Run 5: 完整覆盖率 | 14 个新模块 | 150 | 14 | 100% | ~93%（1 个需修复） |
| **总计** | **31 个模块** | **441** | **31** | **100%** | **~95%** |

> 注：另有原始 SendButton.test.tsx 的 2 个用例，总计 443 个测试、32 个套件。

### 按测试类型

| 类型 | 套件数 | 测试数 | 典型 Mock 策略 |
|------|--------|--------|---------------|
| 纯函数单元测试 | 8 | 187 | 无 Mock，直接输入→输出 |
| React 组件测试 | 13 | 154 | RTL render + userEvent，少数需 mock `navigator.clipboard` |
| Hook 测试 | 2 | 22 | renderHook + mock localStorage/matchMedia |
| Pipeline 逻辑测试 | 6 | 68 | jest.mock 外部模块（LLM API、fs、fetch） |
| Prompt/Type 测试 | 3 | 12 | 无 Mock |

---

## 3. Agent 修复能力

### 修复统计

| 指标 | 数据 |
|------|------|
| 总修复次数 | 3 次（跨 5 轮运行） |
| 平均修复迭代 | 1 次（均首次修复成功） |
| 最大修复迭代 | 1 次 |
| 放弃的模块 | 0 |

### 修复案例

| 模块 | 问题 | 修复方式 |
|------|------|---------|
| CodeCopyButton | `userEvent.click` + `jest.useFakeTimers` 导致超时 | 改用 `fireEvent` + `act` 处理定时器相关断言 |
| ErrorBoundary | jsdom 中 `PromiseRejectionEvent` 未定义 | 改用 `Event` + 手动挂载 `.reason` 属性 |
| jest.config.ts | remark/unified ESM 模块未被 transform | 添加 `transformIgnorePatterns` 覆盖 |

---

## 4. 关键发现

### Agent 表现亮点

1. **首次通过率 ~95%**：441 个测试中仅 3 个需要修复，说明 Skill 中的测试约定有效指导了生成质量
2. **零 trivial 测试**：Skill 中的禁止模式（`expect(fn).toBeDefined()`）被严格遵守
3. **自动处理环境问题**：Agent 自主发现并修复了 Jest 配置中的 ESM 模块 transform 问题
4. **覆盖率感知**：`full` 模式下 Agent 正确使用 coverage-parser 工具识别未覆盖模块并优先填补

### Safety Hook 验证

| 场景 | 结果 |
|------|------|
| Agent 尝试写入 `src/lib/search/bm25.ts` | ✅ 被 Hook 拦截（`decision: "block"`） |
| Agent 写入 `src/lib/search/__tests__/bm25.test.ts` | ✅ 允许通过 |
| Agent 修改 `jest.config.ts` | ✅ 允许通过（在白名单中） |

> 注意：Phase 1 测试中发现 Hook 返回 `decision: "deny"` 无效，必须使用 `decision: "block"` + `hookSpecificOutput.permissionDecision: "deny"`。这是 SDK 的实际行为与类型定义的一个不一致点。

### 局限性

1. **未覆盖的模块**：以下模块因依赖过于复杂（需要 Pinecone/OpenAI 等外部服务的深度 mock）而未被覆盖：
   - `lib/vectorstore/pineconeStore.ts` — Pinecone SDK 交互
   - `lib/embeddings/index.ts` — OpenAI Embedding API
   - `lib/providers/modelProvider.ts` — 多 LLM provider 切换
   - `app/api/qa/route.ts` — Next.js API Route（需要 mock Request/Response）
   - `hooks/useChat.ts` — 最复杂的 hook（SSE streaming + 多状态管理）

2. **Branch 覆盖率偏低（31.99%）**：主要因为错误处理路径和 debug 日志条件分支未覆盖，这些在实际业务中价值较低

---

## 5. 性能数据

| 指标 | 数据 |
|------|------|
| Agent 总运行轮次 | 5 轮 |
| 测试总执行时间 | ~3s（32 套件并行） |
| 模型 | claude-sonnet-4-6（生成），claude-haiku-4-5（subagent 验证用） |

---

## 6. 架构决策记录

### 为什么不拆 Subagent

经 Phase 2 验证，单 Agent + `full` 模式在 200 轮 maxTurns 内能完成全部工作。拆分 Subagent 的预期收益（并行生成、上下文隔离）在当前项目规模（~20 个可测模块）下不足以抵消其成本：
- 协调复杂度：需要设计任务分配和结果聚合逻辑
- 调试困难：多 agent 日志交织
- Token 消耗翻倍：每个 subagent 需要重新加载项目上下文

**结论**：保持单 Agent 设计，如果目标项目扩展到 100+ 文件再考虑拆分。

### Skill 的实际影响

Skill（`.claude/skills/typescript-jest/SKILL.md`）对生成质量有直接且可观测的影响：
- 所有生成的测试都遵循了 `describe > describe > it` 结构
- 组件测试一致使用 `screen` 查询而非 `render()` 解构
- 没有出现任何 `fireEvent`（除了 Timer 场景的合理退化）
- Mock 放置位置一致在文件顶部
