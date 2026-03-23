# 常见问题 Q&A

## Q: 用户可以直接通过 API 调用 `model: "claude-sonnet-4-6"` 而不需要 API key 吗？

不是。`verify.ts` 和 `agent.ts` 不是直接调 Anthropic API，它们调的是 **Claude Agent SDK**（`@anthropic-ai/claude-agent-sdk`）。

关键区别：

| | Anthropic API | Claude Agent SDK |
|---|---|---|
| 认证方式 | 需要 `ANTHROPIC_API_KEY` | 复用你本机 Claude Code 的登录态 |
| 调用方式 | `new Anthropic().messages.create()` | `query({ prompt, options })` |
| 计费 | 按 token 计费到你的 API 账户 | 计入你的 Claude Code 订阅额度 |

SDK 的 `query()` 本质上是**在你本机启动一个 Claude Code 子进程**。它继承了你 `claude login` 时的认证——你用 Claude Code CLI 登录过，SDK 就能用。

所以 `model: "claude-sonnet-4-6"` 不需要 API key，但**需要你有 Claude Code 的有效订阅**（Pro/Max/Team/Enterprise）。模型选择受你的订阅计划限制——比如 Max 订阅才能大量使用 Opus。

---

## Q: 从资深测试工程师角度，如何点评这个项目？

### 做得好的地方

**1. Safety Hook 纵深防御设计**

"只能写测试文件，不能改源码"是测试生成场景的核心安全需求。项目用三层防护实现：
- `permissionMode: "acceptEdits"` — 自动批准文件操作
- `settings.local.json` — 预授权特定 Bash 命令
- `PreToolUse Hook` — 精确拦截（只有测试文件可写）

这体现了纵深防御（Defense in Depth）思想。

**2. Skill 抽象前瞻性好**

TypeScript/Jest 测试规范抽成独立 Skill，与 Agent 行为规则（CLAUDE.md）分离。未来扩展到 Python/Java 只需加 Skill，不改 Agent 核心逻辑。架构上留了扩展点。

**3. 核心循环务实**

`EXPLORE → PLAN → EXECUTE → VERIFY` 循环，加上"写完立刻跑、失败最多修 3 次"的策略，避免了无限循环修 bug 的陷阱，是务实的工程决策。

**4. Coverage Parser 工具化**

把覆盖率解析做成 MCP Tool 而非让 Agent 自行解析 JSON，降低了 Agent 出错概率，让覆盖率数据结构化可用。

### 需要改进的地方

**1. 缺少对测试质量的深层度量**

项目有通过率（100%）、首次通过率（95%）、覆盖率（41%），但缺少测试有效性度量：

- **Mutation Testing（变异测试）**：覆盖率只说明"代码被执行了"，变异测试才能回答"测试真的能抓到 bug 吗"。建议集成 Stryker 跑一轮，用 mutation score 验证测试的断言价值。
- **断言密度**：平均每个 test case 有多少有效断言？如果大量测试只有 1 个 `expect()`，质量要打折扣。
- **边界覆盖**：Skill 里提到了 edge cases 和 error paths，但 evaluation report 没有这些维度的统计。

**2. 覆盖率分析不够深入**

41% statement coverage 作为起步合理，但报告缺少对剩余 59% 的分析：
- 哪些模块是 0% 覆盖？为什么跳过？
- 原因是复杂度高（需要集成环境）、还是 Agent 能力不足（mock 不了）、还是时间不够？
- 建议在 report 加"未覆盖模块分析"章节，按跳过原因分类。

**3. Safety Hook 本身的测试覆盖不足**

`safety.ts` 是整个系统最关键的安全组件，但之前只有 `verify.ts` 里的简单集成测试。作为安全关键组件，需要：
- 单元测试覆盖各种路径匹配的边界
- 路径穿越场景（如 `src/__tests__/../../src/real.ts`）
- 符号链接、相对路径绕过

**4. Agent 自身代码零测试（已修复）**

一个测试生成项目自身没有自动化测试，"铁匠的刀不能钝"。这是最明显的说服力矛盾。

**5. 测试隔离性存疑**

Agent 生成的 443 个测试直接跑在目标项目的 Jest 环境里：
- 有没有做过 `jest --randomize` 乱序运行验证？是否存在共享状态导致的顺序依赖？
- `jest.mock()` 如果没有正确清理，会导致测试间污染。Skill 里是否强调了 `afterEach(() => jest.restoreAllMocks())`？
- 测试是否依赖特定环境变量、文件系统状态或网络？

**6. Skill 的禁止规则缺少正面示范**

`typescript-jest/SKILL.md` 列了很多 Prohibited Patterns（不要用 snapshot、不要用 fireEvent、不要用 getByTestId），但缺少"Instead, do this"的具体代码示例。对 LLM 来说，"不要做 X"不如"用 Y 替代 X"有效。

**7. 错误恢复策略过于简单**

"最多修 3 次然后跳过"是合理兜底，但：
- 有没有记录失败的具体原因分类？（import 错误、mock 配置、类型错误、运行时错误）
- 失败原因能否反馈回 Skill，让下一轮避免同类错误？
- 3 次修复是否有策略递进（第 1 次修语法、第 2 次换 mock 策略、第 3 次简化测试），还是每次自由发挥？

### 综合评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | 8/10 | Skill 分离、Safety Hook 纵深防御、核心循环设计都很好 |
| 测试质量度量 | 5/10 | 有覆盖率但缺少变异测试、断言密度等深层指标 |
| 安全性 | 7/10 | 思路正确但 hook 本身缺少充分测试，路径绕过风险未验证 |
| 工程完整性 | 6/10 | 项目自身零测试是硬伤（已通过补充测试修复） |
| 可扩展性 | 8/10 | Skill 机制、运行模式设计都考虑了未来扩展 |
| 文档 | 8/10 | Plan、Report、README 齐全，分析有数据支撑 |

**综合：7/10 — 架构和思路专业，测试质量验证和自身工程实践有提升空间。**

### 如果继续迭代，优先建议

1. **给项目自身加测试（已完成）** — 消除"说服力矛盾"
2. **跑一轮变异测试** — 用 Stryker 验证 443 个测试的实际 bug 检测能力
3. **未覆盖模块分析** — 把剩余 59% 说清楚，比提高覆盖率数字更有价值
4. **测试乱序运行验证** — `jest --randomize` 确认没有顺序依赖

---

## Q: 项目自身的测试是怎么加上的？

### 环境搭建

安装 `jest` + `ts-jest`，配置 ESM 支持：

```bash
npm install --save-dev jest ts-jest @types/jest
```

`jest.config.ts` 使用 `ts-jest/presets/default-esm` preset，配合 `NODE_OPTIONS='--experimental-vm-modules'` 运行。

### 源码最小改动（不改逻辑）

为可测试性导出内部纯函数：
- `safety.ts`：`export function isTestRelatedPath`
- `coverage-parser.ts`：`export function parseCoverageSummary`
- `agent.ts`：`export function buildPrompt`、`export const TARGET_MODULES`
- `agent.ts`：`main()` 加入口保护（`process.argv[1]` 判断），避免 import 时执行副作用

### 三个测试文件

**`src/hooks/__tests__/safety.test.ts`（27 个测试）— 最关键的安全组件**
- `isTestRelatedPath` 纯函数测试：允许路径（`__tests__/`、`.test.ts`、`jest.config.ts` 等）、拦截路径（源码、`package.json`）、always-blocked 模式（`.env`、`scripts/`）、边界情况（空路径、深层嵌套、路径穿越）
- `createSafetyHook` 集成测试：非写入工具放行、目标外文件放行、测试文件放行、源码文件拦截、空 file_path 处理

**`src/tools/__tests__/coverage-parser.test.ts`（10 个测试）**
- total 提取、空文件列表、uncovered/covered 分类逻辑、边界条件（lines=0 但 functions>0、反之亦然）、排序验证（uncovered 按字母序、covered 按覆盖率降序）、真实数据模拟

**`src/__tests__/agent.test.ts`（9 个测试）— 不依赖 SDK，只测纯逻辑**
- `TARGET_MODULES` 配置完整性验证（5 种模式、必须有 files 和 description）
- `buildPrompt` 各模式输出验证（包含正确文件名、full 模式特有指令）
- 未知模式的 `process.exit(1)` 行为测试

### 覆盖率结果

| 文件 | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| safety.ts | 100% | 100% | 100% | 100% |
| coverage-parser.ts | 68% | 66.66% | 80% | 63.63% |
| agent.ts | 43.33% | 50% | 33.33% | 43.33% |
| **总计** | **67.53%** | **72.97%** | **76.92%** | **64.28%** |

`coverage-parser.ts` 未覆盖的部分（97-127 行）是 MCP tool handler 的文件 I/O 和错误处理，涉及 SDK 的 `tool()` 封装，适合用集成测试覆盖而非 mock 到失去意义。`agent.ts` 未覆盖的部分（84-131 行）是 `main()` 函数，包含 SDK `query()` 调用和流式输出处理，属于集成测试范畴。
