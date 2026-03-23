# Test Generation Agent

基于 [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) 构建的全自主 Coding Agent，为 TypeScript/React 项目自动生成测试套件。

## 成果

在 RAG 项目（confluence-qa-assistant）上运行，实现从 **~0% → 41% 测试覆盖率**：

| 指标 | Before | After |
|------|--------|-------|
| 测试套件 | 1 | 32 |
| 测试用例 | 2 | 443 |
| Statement 覆盖率 | ~0% | 41.07% |
| 通过率 | — | 100% |

## 架构

```
test-agent/
├── src/
│   ├── agent.ts                        # Agent 入口（多模式：pure-functions/utils/components/pipeline/full）
│   ├── verify.ts                       # Phase 0/1 SDK 验证脚本
│   ├── tools/
│   │   ├── coverage-parser.ts          # MCP Tool：解析 Jest coverage-summary.json
│   │   └── hello.ts                    # MCP Tool 验证用示例
│   └── hooks/
│       └── safety.ts                   # PreToolUse Hook：禁止修改源代码
├── .claude/
│   ├── CLAUDE.md                       # Agent Core 行为规则
│   └── skills/
│       └── typescript-jest/
│           └── SKILL.md                # TypeScript + Jest + RTL 测试约定
├── evaluation/
│   └── report.md                       # 评估报告
└── package.json
```

## Agent SDK 能力使用

| SDK 能力 | 用途 | 文件 |
|----------|------|------|
| **`query()`** | Agent 主循环，接收 prompt 返回 AsyncGenerator | `src/agent.ts` |
| **MCP Tool** (`createSdkMcpServer` + `tool()`) | 自定义 coverage-parser 工具，解析覆盖率报告 | `src/tools/coverage-parser.ts` |
| **PreToolUse Hook** | Safety 约束：拦截 Write/Edit，只允许写测试文件 | `src/hooks/safety.ts` |
| **Subagent** (`agents` option) | Phase 0 验证用；Phase 2 单 Agent 够用，未拆分 | `src/verify.ts` |
| **Skills** (`.claude/skills/`) | 注入 TypeScript + Jest 测试生成约定 | `.claude/skills/typescript-jest/SKILL.md` |
| **CLAUDE.md** | Agent 行为规则：探索→计划→执行→验证循环 | `.claude/CLAUDE.md` |

## 工作流程

```
Agent 接收目标项目路径 + 运行模式
        ↓
   1. EXPLORE — 读 package.json / jest.config / tsconfig / 已有测试
        ↓
   2. PLAN   — 分类模块（纯函数/组件/Hook/Pipeline），按价值排优先级
        ↓
   3. EXECUTE — 读源码 → 写测试 → 运行验证 → 失败则修复（最多3次）
        ↓                                    ↑
   4. VERIFY — 运行覆盖率 → coverage-parser 解析 → 未达标则补测试
        ↓
     输出总结报告
```

## 运行方式

```bash
# 安装依赖
npm install

# 按模块类型运行
npx tsx src/agent.ts pure-functions    # 纯函数测试（bm25, tokenizer, fusion）
npx tsx src/agent.ts utils             # 工具函数测试
npx tsx src/agent.ts components        # React 组件测试
npx tsx src/agent.ts pipeline          # Pipeline 逻辑测试（需要 Mock）
npx tsx src/agent.ts full              # 全自主覆盖率驱动运行

# SDK 验证（Phase 0/1）
npx tsx src/verify.ts all              # 运行所有验证测试
npx tsx src/verify.ts safety           # 单独验证 Safety Hook
npx tsx src/verify.ts coverage         # 单独验证 Coverage Parser
```

## 关键设计决策

### 单 Agent vs Subagent 拆分

经评估，当前目标项目规模（~20 个可测模块）下，单 Agent + `full` 模式在 200 轮内完成全部工作。Subagent 的收益（并行、上下文隔离）不抵其成本（协调复杂度、token 翻倍）。

### Safety Hook 的必要性

Agent 的 `permissionMode: "acceptEdits"` 让它能自由写文件——必须通过 PreToolUse Hook 确保只写测试文件。Phase 1 测试中发现了 SDK hook 的正确返回格式（`decision: "block"` 而非 `"deny"`）。

### Skill 对生成质量的影响

Skill 中的约定（semantic queries > testId、userEvent > fireEvent、禁止 trivial 测试）被严格遵循，首次通过率达 ~95%。

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Agent SDK**: `@anthropic-ai/claude-agent-sdk`
- **Target Project**: Next.js 15 + React 19 + TypeScript
- **Test Framework**: Jest 30 + React Testing Library + user-event
