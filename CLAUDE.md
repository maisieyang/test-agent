# Test Generation Agent

## Project Overview

基于 Claude Agent SDK 构建的全自主 Coding Agent，为 TypeScript/React 项目自动生成测试套件。
第一期目标：在 RAG 项目（confluence-qa-assistant）上实现从 0% 到有意义的测试覆盖率。

## Architecture

```
test-agent/
├── src/
│   ├── agent.ts                    # 入口：配置 Agent + 启动
│   ├── tools/
│   │   └── coverage-parser.ts      # MCP Tool：解析 Jest coverage-summary.json
│   ├── hooks/
│   │   └── safety.ts               # PreToolUse：禁止修改 src/（只允许写测试相关文件）
│   └── subagents/
│       └── definitions.ts          # Subagent 定义
├── .claude/
│   ├── CLAUDE.md                   # Agent Core 行为规则（Phase 1 编写）
│   └── skills/
│       └── typescript-jest/
│           └── SKILL.md            # TypeScript + Jest + RTL 测试 Skill
├── evaluation/
│   └── report.md                   # Agent 运行结果记录
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Core Dependency**: `@anthropic-ai/claude-agent-sdk`
- **Target Project**: confluence-qa-assistant（Next.js 15 + React 19 + TypeScript）
  - 位置：`/Users/yangxiyue/2026/aa/confluence-qa-assistant`

## Development Conventions

- 使用 TypeScript strict mode
- 使用 ESM modules（`"type": "module"` in package.json）
- 入口文件：`src/agent.ts`
- 所有 Agent SDK 相关代码放在 `src/` 下
- Agent 的行为规则（prompt engineering）放在 `.claude/` 下

## Execution Plan

项目按 Phase 推进，详见 `test-agent-plan.md`：

- **Phase 0**: 环境搭建 — 安装 SDK、验证 Agent/MCP Tool/Subagent/Skills 基本能力
- **Phase 1**: Skill + CLAUDE.md + Hooks — 编写 Agent 行为规则和安全约束
- **Phase 2**: 在 RAG 项目上运行 — 从纯函数到组件到 Pipeline 逐步验证
- **Phase 3**: 评估 + 文档 — 评估报告、README


## Important Notes

- 修改代码前先阅读 `test-agent-plan.md` 了解完整计划
- 每完成一个 Phase 的任务后，确认所有完成标志都满足
- Agent 生成测试时**必须运行验证**，不能只生成不跑
- Safety Hook 必须确保 Agent 不会修改目标项目的源代码（只能写测试文件）
- 目标项目的测试环境（Jest 30 + RTL）已配置完毕，无需重新搭建

## Commands

```bash
# 开发阶段
npx tsx src/agent.ts                    # 运行 Agent

# 目标项目测试（在 confluence-qa-assistant 目录下）
npm test                                # 运行测试
npx jest --coverage --watchAll=false    # 运行测试 + 覆盖率报告
```
