# Test Generation Agent — 项目计划

> 基于 Claude Agent SDK 构建全自主 Coding Agent，为 TypeScript/React 项目自动生成测试套件。
> 第一期目标：在 RAG 项目（confluence-qa-assistant）上实现从 0% 到有意义的测试覆盖率。

---

## 项目定位

| 维度 | 说明 |
|------|------|
| **面试角色** | 全自主 Coding Agent——补完 Pipeline → Workflow → 全自主 的叙事弧线 |
| **业务场景** | 银行真实痛点：上线前必须满足测试覆盖率指标 |
| **技术载体** | Claude Agent SDK（TypeScript） |
| **测试目标** | 自己的 RAG 项目（Next.js 15 + React 19 + TypeScript） |
| **可扩展性** | Skills 机制支持未来接入 Java/Python，第一期只做 TypeScript |

---

## RAG 项目（测试目标）现状分析

### 代码规模

```
src/
├── app/                          # Next.js 页面 + API Route
│   ├── page.tsx                  # 首页（QA 聊天界面）
│   ├── layout.tsx                # 根布局
│   └── api/
│       └── qa/route.ts           # QA API endpoint（RAG 主入口）
│
├── components/                   # React 组件（16个 + 1个已有测试）
│   ├── ChatWindow/               # 核心聊天窗口组件
│   │   ├── ChatWindow.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   ├── MessageBubble.tsx         # 消息气泡
│   ├── MarkdownRenderer.tsx      # Markdown 渲染
│   ├── EnhancedMarkdownRenderer.tsx
│   ├── MarkdownComponents.tsx    # Markdown 子组件
│   ├── QAReferenceList.tsx       # 引用列表
│   ├── SendButton.tsx            # 发送按钮 ← 已有测试
│   ├── ThemeSelector.tsx         # 主题选择
│   ├── ErrorBoundary.tsx         # 错误边界
│   ├── ErrorMessage.tsx          # 错误提示
│   ├── CodeCopyButton.tsx        # 代码复制
│   ├── MessageFeedback.tsx       # 消息反馈
│   ├── CollapsibleSection.tsx    # 可折叠区域
│   ├── ScrollToBottomButton.tsx  # 滚动到底部
│   ├── CalloutBox.tsx            # 提示框
│   ├── VisualSeparator.tsx       # 视觉分隔
│   ├── index.ts                  # 导出入口
│   └── __tests__/
│       └── SendButton.test.tsx   # ← 已有：2个测试用例（渲染+点击）
│
├── hooks/                        # 自定义 Hooks（4个）
│   ├── useChat.ts                # 聊天逻辑（核心，最复杂）
│   ├── useTheme.ts               # 主题管理
│   ├── useDarkMode.ts            # 暗色模式
│   ├── useAutoScroll.ts          # 自动滚动
│   └── index.ts
│
├── lib/                          # 后端逻辑
│   ├── confluence/               # Confluence 数据源
│   │   ├── client.ts             # API 客户端
│   │   ├── chunk.ts              # 分块逻辑（核心——AST 三级语义分块）
│   │   ├── clean.ts              # 数据清洗
│   │   ├── types.ts              # 类型定义
│   │   └── index.ts
│   ├── pipeline/                 # RAG Pipeline（核心）
│   │   ├── qa.ts                 # 问答主流程
│   │   ├── queryTransform.ts     # 查询改写（意图分类+复合问题分解）
│   │   ├── contextManager.ts     # 上下文管理（summary + sliding window）
│   │   ├── reranker.ts           # Rerank 重排序
│   │   ├── loader.ts             # 文档加载
│   │   ├── evaluate.ts           # LLM-as-Judge 评测
│   │   ├── build.ts              # 索引构建
│   │   ├── vectorCache.ts        # 向量缓存（etag + embedVersion）
│   │   ├── vectorLog.ts          # 日志
│   │   ├── qaObservation.ts      # QA 可观测
│   │   └── index.ts
│   ├── search/                   # 检索
│   │   ├── bm25.ts               # BM25 关键词检索（倒排索引实现）
│   │   ├── fusion.ts             # RRF 混合检索
│   │   ├── tokenizer.ts          # 分词器
│   │   └── index.ts
│   ├── vectorstore/              # 向量存储
│   │   ├── pineconeStore.ts      # Pinecone 操作
│   │   ├── parentStore.ts        # Parent-Child 存储
│   │   └── index.ts
│   ├── embeddings/               # Embedding
│   │   └── index.ts
│   ├── providers/                # 模型 Provider
│   │   ├── modelProvider.ts      # 多 Provider 抽象层
│   │   └── types.ts
│   └── prompts/                  # Prompt 模板
│       ├── systemPrompts.ts
│       └── unifiedPrompt.ts
│
├── utils/                        # 工具函数
│   ├── markdownPreprocessor.ts   # Markdown 预处理
│   └── astMarkdownProcessor.ts   # AST Markdown 处理
│
└── styles/                       # 样式文件

scripts/                          # 独立脚本
├── vectorize.ts                  # 向量化
├── evaluate.ts                   # 评测运行
├── ingest-local-docs.ts          # 本地文档导入
├── clearEmbeddings.ts            # 清理 Embedding
└── verify-pinecone.ts            # Pinecone 验证
```

### 当前测试状态

测试环境已配置完毕，有一个种子测试确认环境可用：

- **测试框架**：Jest 30 + jsdom + next/jest（已安装并配置）
- **测试库**：@testing-library/react 16 + @testing-library/jest-dom 6 + @testing-library/user-event 14
- **Jest 配置**：`jest.config.ts`（已处理 Next.js module alias `@/`、jsdom 环境、jest-dom setup）
- **已有测试**：`src/components/__tests__/SendButton.test.tsx`（2个用例，全部通过）
- **npm scripts**：`test`（jest）、`test:watch`（jest --watch）
- **覆盖率基线**：接近 0%（仅 SendButton 一个组件有覆盖）

### 测试分层策略（Agent 需要制定的计划）

| 测试层 | 目标代码 | 策略 | 优先级 |
|--------|---------|------|--------|
| **纯函数单元测试** | `lib/search/bm25.ts`, `tokenizer.ts`, `fusion.ts`, `utils/*.ts`, `confluence/chunk.ts`, `confluence/clean.ts` | 无需 Mock，输入→输出，最容易生成且最有价值 | P0 |
| **Pipeline 逻辑测试** | `lib/pipeline/queryTransform.ts`, `contextManager.ts`, `reranker.ts`, `vectorCache.ts` | 需要 Mock 外部依赖（LLM API、Pinecone），测试逻辑分支 | P1 |
| **React 组件测试** | `components/*.tsx`（SendButton 已有，需扩展其他组件） | RTL 渲染测试、用户交互、条件渲染 | P1 |
| **Hook 测试** | `hooks/useChat.ts`, `useTheme.ts` | renderHook + act，测试状态变化 | P2 |
| **API Route 测试** | `app/api/qa/route.ts` | Mock Request/Response，测试端到端逻辑 | P2 |

---

## 架构设计

### 整体架构

```
test-agent/
│
├── src/
│   ├── agent.ts                    # 入口：配置 Agent + 启动
│   ├── tools/
│   │   └── coverage-parser.ts      # MCP Tool：解析 Jest coverage-summary.json
│   ├── hooks/
│   │   └── safety.ts               # PreToolUse：禁止修改 src/（只允许写测试相关文件）
│   └── subagents/
│       └── definitions.ts          # Subagent 定义
│
├── .claude/
│   ├── CLAUDE.md                   # Agent Core 行为规则
│   └── skills/
│       ├── typescript-jest/        # ← 第一期：TypeScript + Jest + RTL
│       │   └── SKILL.md
│       ├── java-spring/            # ← 第二期（占位）
│       │   └── SKILL.md
│       └── python-pytest/          # ← 未来（占位）
│           └── SKILL.md
│
├── evaluation/
│   └── report.md                   # Agent 运行结果记录
│
├── package.json
├── tsconfig.json
└── README.md
```

### Agent 核心流程

```
输入：目标项目路径 + 覆盖率目标（如 60%）

┌─────────────────────────────────────────────────┐
│  Agent Core（全自主，LLM 决定每一步）              │
│                                                   │
│  1. 探索目标项目                                   │
│     Glob: 找到所有源文件                           │
│     Read: package.json → 识别技术栈和依赖          │
│     Read: 抽样阅读关键源文件 → 理解代码结构        │
│                                                   │
│  2. 制定测试计划                                   │
│     → 按优先级排列待测模块                         │
│     → 确定测试策略（纯函数优先、需要Mock的后做）    │
│     → 选择匹配的 Skill（TypeScript Jest Skill）    │
│                                                   │
│  3. 环境确认                                      │
│     Bash: npm test → 确认 Jest 环境可用            │
│     Read: jest.config.ts → 了解已有配置            │
│     Read: 已有测试文件 → 了解项目测试风格           │
│                                                   │
│  4. 生成测试（可委托 Subagent 并行）               │
│     Read: 目标源文件                              │
│     Write: 测试文件                               │
│     Bash: 运行单个测试文件验证                     │
│     → 失败 → 读错误信息 → 修复 → 重跑             │
│     → 通过 → 继续下一个模块                       │
│                                                   │
│  5. 验证覆盖率                                    │
│     Bash: npx jest --coverage --watchAll=false    │
│     MCP Tool: 解析 coverage-summary.json          │
│     → 未达标 → 分析未覆盖路径 → 补充测试          │
│     → 达标 → 输出最终报告                         │
└─────────────────────────────────────────────────┘
```

### 技术栈检测：方案 A（System Prompt 注入）

不写代码检测逻辑。在 CLAUDE.md 中写明：

> "探索目标项目后，根据你发现的技术栈（package.json / pom.xml / requirements.txt / go.mod）选择对应的 Testing Skill。如果项目是 TypeScript/React，使用 typescript-jest Skill。"

Agent 自主完成技术栈识别和 Skill 选择。新增语言只需要加 SKILL.md，不改代码。

### Skill 设计

**第一期：`typescript-jest` Skill**

覆盖前端和后端，因为 RAG 项目全栈都是 TypeScript：
- 前端组件：Jest + React Testing Library + user-event
- 后端逻辑：Jest（纯函数测试 + Mock 外部依赖）
- Hooks：@testing-library/react-hooks（renderHook）
- 覆盖率：Istanbul（Jest 内置）

合并为一个 Skill 而非拆成"react-testing"和"node-testing"，原因：
- 同一个 Jest 配置文件
- 同一个 coverage 报告
- 同一套 Mock 工具（jest.mock / jest.fn）
- 只有组件测试需要 RTL，Skill 里写清楚"组件用 RTL，纯函数直接测"即可

**第二期占位：`java-spring` Skill**

```markdown
---
name: Java Spring Testing
description: TODO - 需要和后端同事确认 JUnit5/Mockito 约定后填充
---

# 待填充
- 第二期和 Java 后端同事对齐后编写
- 需要确认：JUnit5 vs JUnit4、Mockito 版本、JaCoCo 配置、Spring Boot Test 约定
```

### Subagent 定义

| Subagent | 职责 | 工具权限 | 使用时机 |
|----------|------|---------|---------|
| **analyzer** | 读代码、理解模块结构、识别函数签名和依赖关系 | Read, Glob, Grep | Plan 阶段 |
| **generator** | 基于分析结果 + Skill 知识生成测试文件 | Read, Write, Bash | Execute 阶段 |
| **verifier** | 运行测试、解析覆盖率、分析失败原因 | Bash, Read, Grep + coverage-parser MCP Tool | Verify 阶段 |

**注意**：Subagent 是可选的——Agent Core 也可以自己完成所有工作。Subagent 的价值在于：
1. 上下文隔离（analyzer 不需要知道 Jest 语法，generator 不需要看所有源文件）
2. 并行能力（多个 generator 可以同时为不同模块生成测试）

第一期可以先让 Agent Core 自己跑完整流程，确认 Skill 和 Hooks 工作正常后，再拆 Subagent。

### Hooks 安全约束

```typescript
// PreToolUse Hook：禁止修改源代码
// 允许写入的路径白名单：
// - **/*.test.ts / **/*.test.tsx（测试文件）
// - jest.config.ts（Jest 配置）
// - src/test-utils.tsx（测试工具）
// - package.json（安装依赖时会修改）
// 禁止修改的路径：
// - src/**/*.ts / src/**/*.tsx（除了测试文件和 test-utils）
// - .env*（环境变量）
// - scripts/*（脚本）
```

### 自定义 MCP Tool：coverage-parser

```
输入：覆盖率报告路径（coverage/coverage-summary.json）
输出：结构化覆盖率数据
{
  total: { lines: 45.2, branches: 38.1, functions: 52.3, statements: 44.8 },
  uncoveredFiles: [
    { file: "src/lib/search/bm25.ts", lines: 0, branches: 0 },
    { file: "src/components/ChatWindow.tsx", lines: 0, branches: 0 },
    ...
  ],
  coveredFiles: [...],
  delta: { lines: +45.2, branches: +38.1 }  // 相比上次的变化
}
```

让 Agent 能精确知道"哪些文件还没覆盖"、"覆盖率离目标差多少"，而不是让 LLM 自己去解析 JSON 报告。

---

## 执行计划

### Phase 0：环境搭建（Day 1）

| 任务 | 详情 | 完成标志 |
|------|------|---------|
| 初始化项目 | `mkdir test-agent && npm init && npm install @anthropic-ai/claude-agent-sdk` | package.json 创建完成 |
| 验证 SDK | 写一个最小 agent.ts，用 `query()` + Read 工具读一个文件 | 能正常输出文件内容 |
| 验证 MCP Tool | 写一个 hello-world MCP Tool，确认自定义工具能被 Agent 调用 | Agent 成功调用自定义工具 |
| 验证 Subagent | 定义一个简单 Subagent，确认 AgentDefinition 工作正常 | Subagent 能执行并返回结果 |
| 验证 Skills | 创建 `.claude/skills/test-skill/SKILL.md`，确认 Agent 能识别和使用 | Agent 在回复中引用 Skill 内容 |

### Phase 1：Skill + CLAUDE.md + Hooks（Day 2-3）

| 任务 | 详情 | 完成标志 |
|------|------|---------|
| 编写 CLAUDE.md | Agent Core 行为规则：探索→计划→执行→验证的循环，技术栈检测指令 | 文件就绪 |
| 编写 typescript-jest Skill | Jest + RTL + Hook 测试约定、文件规范、常见 Pattern、禁止模式 | 文件就绪 |
| 实现 safety Hook | PreToolUse：检查 Write/Edit 目标路径，只允许写测试相关文件 | Hook 能正确拦截对 src/ 的修改 |
| 实现 coverage-parser Tool | 解析 Jest coverage-summary.json，返回结构化数据 | 工具能正确解析真实报告 |

### Phase 2：在 RAG 项目上运行（Day 3-5）

| 任务 | 详情 | 完成标志 |
|------|------|---------|
| 第一次运行：纯函数 | 让 Agent 给 `lib/search/bm25.ts`, `tokenizer.ts`, `fusion.ts` 生成测试 | 测试文件生成且通过 |
| 第二次运行：utils | 让 Agent 给 `utils/markdownPreprocessor.ts`, `astMarkdownProcessor.ts` 生成测试 | 测试通过 |
| 第三次运行：组件 | 让 Agent 给 `components/SendButton.tsx`, `ErrorMessage.tsx` 等简单组件生成测试 | RTL 测试通过 |
| 第四次运行：Pipeline 逻辑 | 让 Agent 给 `lib/pipeline/queryTransform.ts`, `contextManager.ts` 生成测试（需要 Mock） | Mock 测试通过 |
| 第五次运行：完整覆盖率 | 让 Agent 自主运行完整流程，以覆盖率目标驱动 | 覆盖率报告生成，有可量化的数据 |

### Phase 3：评估 + 文档（Day 5-7）

| 任务 | 详情 | 完成标志 |
|------|------|---------|
| 评估记录 | 记录覆盖率数据（before/after）、Agent 调用轮次、每个模块的成功/失败统计、修复迭代次数 | evaluation/report.md 完成 |
| README | 项目说明 + 架构图 + 运行方式 + 评估结果 | 面试可展示 |

> **关于 Subagent 拆分的决策**：经评估，当前目标项目规模（~20 个可测模块）下，单 Agent + `full` 模式在 200 轮内完全能处理。拆分 Subagent 的收益（并行加速、上下文隔离）不抵其成本（协调复杂度、调试困难、token 翻倍）。若未来目标项目扩展到 100+ 文件或上下文窗口成为瓶颈，再考虑拆分。

---

## 风险与应对

| 风险 | 可能性 | 影响 | 应对 |
|------|-------|------|------|
| Agent 生成的测试质量低（trivial tests） | 中 | 覆盖率虚高但无意义 | Skill 里明确禁止 trivial pattern，评估时做 mutation testing 验证 |
| 组件依赖复杂 Provider（如 Theme） | 中 | 组件渲染失败 | Skill 里包含 renderWithProviders pattern |
| LLM 的 Mock 模拟不准确 | 中 | 测试逻辑错误 | Agent 必须运行测试验证，不能只生成不跑 |
| coverage-parser 解析报告格式变化 | 低 | 工具失效 | Jest coverage-summary.json 格式稳定，风险低 |

### 已解决的卡点

**Jest + Next.js 15 + React 19 环境配置**（已完成）：
- Jest 30 + jsdom + next/jest 已安装并配置
- `jest.config.ts` 已处理 Next.js module alias（`@/` → `<rootDir>/src/`）
- `jest.setup.ts` 已引入 `@testing-library/jest-dom`
- `SendButton.test.tsx` 种子测试已验证环境可用（2个用例全部通过）
- `npm test` / `npm run test:watch` scripts 已就绪

Agent 可以直接在已配置好的环境上生成测试，无需处理环境搭建。

---

## 评估指标

| 指标 | 怎么测 | 目标 |
|------|-------|------|
| **覆盖率提升** | `jest --coverage` 的 statements/branches/functions/lines | 从接近 0%（仅 SendButton）到有意义的覆盖（目标 40%+） |
| **测试通过率** | 生成的测试能 pass 的比例 | > 90% |
| **Agent 效率** | 完成一个模块的测试需要多少轮 tool call | 记录，用于调优 prompt |
| **Debug 循环次数** | 测试失败后 Agent 自修复的平均迭代次数 | 记录，用于评估 Agent 可靠性 |
| **测试质量（可选）** | Mutation testing：注入 mutation 后测试能否 catch | 有效测试 / 全部测试 > 70% |

---

## 面试价值对照

| 面试岗位 | 这个项目证明什么 |
|---------|----------------|
| **AI 应用工程师** | 全自主 Agent 的工程化实现：上下文工程、验证闭环、Safety Hooks、MCP Tool 扩展 |
| **FDE** | 真实业务痛点驱动、Skills 可扩展设计、跨技术栈适配能力 |
| **AI Coding Agent PM** | 深入理解 Coding Agent 产品机制：Skills/Rules/Subagent/Memory 的设计取舍 |

---

## 项目核心价值主张

### 为什么不直接用 Claude Code 对话？

直接和 Claude Code 对话也能生成测试、做质量点评。但这个 Agent 项目解决的不是"能不能做"，而是**"如何保证每次都做到高标准"**。

| 维度 | 直接对话 | Agent + Skill 体系 |
|------|---------|-------------------|
| 测试风格 | 取决于提问者的措辞 | Skill 固化了规范，每次一致 |
| 质量下限 | 依赖对话者的测试经验 | CLAUDE.md + Skill 的禁止规则兜底 |
| 跨语言扩展 | 每次要重新说明约定 | 加一个 Skill 文件即可 |
| 经验迭代 | 停留在对话记忆里 | 沉淀到 Skill 中，版本可追溯 |
| 安全约束 | 靠人口头说"别改源码" | Safety Hook 程序化强制执行 |

**核心价值：Skill + CLAUDE.md = 测试专家经验的模块化封装。**

不同的人用这个 Agent，都能得到同样高标准的测试。换一种语言（Java/Python），只需插入对应 Skill，不需要重新传递专家经验。这是"经验标准化平台"，不是简单的"自动化脚本"。

---

## 第一期回顾与自身测试补充

### 一期成果

- 443 个测试，32 个测试套件，100% 通过率，~95% 首次通过率
- 覆盖率从 ~0% 提升到 41.07%（目标项目 confluence-qa-assistant）

### 自身测试补充（一期收尾）

项目自身作为测试生成工具却没有测试，是一个明显的说服力矛盾。已补充：

| 测试文件 | 测试数 | 覆盖目标 | 覆盖率 |
|---------|-------|---------|--------|
| `src/hooks/__tests__/safety.test.ts` | 27 | Safety Hook 路径匹配 + 决策逻辑 | 100% |
| `src/tools/__tests__/coverage-parser.test.ts` | 10 | 覆盖率解析、分类、排序 | 68% |
| `src/__tests__/agent.test.ts` | 9 | prompt 构建、模式配置 | 43% |
| **总计** | **58** | | **67.53% stmts** |

自身未覆盖的部分主要是 SDK `query()` 调用和 MCP tool handler 的 I/O 层，属于集成测试范畴。

### 专业测试点评发现的改进方向

从资深测试工程师角度的点评识别了以下问题，已计划纳入后续 Skill 迭代：

1. **缺少变异测试（Mutation Testing）**：覆盖率只说明代码被执行了，不能证明测试真的能抓到 bug
2. **断言密度未度量**：平均每个 test case 的 expect() 数量没有统计
3. **测试隔离性未验证**：没有做过 `jest --randomize` 乱序运行
4. **Skill 的禁止规则缺少正面示范**："不要用 X" 应该配上 "用 Y 替代 X"
5. **错误恢复策略缺少分类**：3 次修复没有按失败原因递进

这些发现应**回流到 Skill 和 CLAUDE.md 中**，形成"专家 review → 经验固化"的闭环。

---

## 第二期规划

### 方向一：Java Skill 扩展 + 对比实验

**目标**：证明 Skill 机制的跨语言泛化能力，并用数据证明"经验固化"的价值。

| 任务 | 详情 | 完成标志 |
|------|------|---------|
| 编写 `java-spring` Skill | JUnit5 + Mockito + Spring Boot Test + JaCoCo 约定 | Skill 文件就绪 |
| JaCoCo 覆盖率解析 | 新增 MCP Tool 或扩展 coverage-parser 支持 JaCoCo XML | 工具能解析 JaCoCo 报告 |
| Java 项目运行验证 | 在后端 Java 项目上跑 Agent | 测试生成且通过 |
| **对比实验** | 同一个 Java 项目：Agent+Skill vs 裸 Claude Code 对话，对比覆盖率、首次通过率、断言密度 | 量化数据证明 Skill 的价值 |
| Agent Core 零改动验证 | 确认只加 Skill 文件，agent.ts 和 CLAUDE.md 无需改动 | 可扩展性的工程证明 |

### 方向二：Skill 质量深化

**目标**：让 Skill 从"约定文档"升级为"可验证的质量标准"。

| 任务 | 详情 | 完成标志 |
|------|------|---------|
| Skill 正面示范补充 | 每条禁止规则配一个 "Instead, do this" 代码示例 | Skill 更新 |
| 断言密度规则 | 在 CLAUDE.md 中加入"每个 test case 至少 2 个有效断言"约束 | 规则生效 |
| Mock 清理规范 | 在 Skill 中强制要求 `afterEach(() => jest.restoreAllMocks())` | 规则写入 |
| 错误修复策略递进 | CLAUDE.md 中明确 3 次修复的递进策略（语法→mock→简化） | 规则写入 |
| 测试乱序验证 | VERIFY 阶段增加 `jest --randomize` 检查 | CLAUDE.md 更新 |


---

## 二期优先级排序

| 优先级 | 方向 | 理由 |
|--------|------|------|
| **P0** | 方向二：Skill 质量深化 | 投入最小、回报最快，直接提升测试质量 |
| **P0** | 方向一：Java Skill + 对比实验 | 证明跨语言能力和经验固化价值，是项目核心卖点 |

---

## 二期评估指标

| 指标 | 怎么测 | 目标 |
|------|-------|------|
| **跨语言适配** | Java 项目 Agent 运行成功率 | Agent Core 零改动即可跑 Java |
| **Skill 价值量化** | Agent+Skill vs 裸对话的对比实验 | Skill 模式的首次通过率高 10%+ |
| **测试质量提升** | 断言密度、乱序通过率 | 平均断言密度 ≥ 2/case，乱序 100% 通过 |
