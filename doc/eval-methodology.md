# AI Agent 评估方法论

> 以 Test Generation Agent 为案例

---

## 为什么 Agent 需要 Eval

任何 AI Agent 都会持续迭代——改 prompt、改 Skill、改工具、换模型。每次迭代后，如何知道 Agent 变好了还是变差了？

靠"跑一次看看感觉不错"是不够的。Agent 需要**可量化、可重复、可对比**的评估体系，否则迭代就是盲目的。

这和传统软件的测试逻辑一致：代码改了跑 CI，Agent 改了跑 Eval。

---

## Eval 框架：五个维度

```
┌─────────────────────────────────────────────┐
│              Agent Eval Framework            │
│                                              │
│  1. Task Completion  — 目标达成了吗？         │
│  2. Output Quality   — 产出质量怎么样？       │
│  3. Safety           — 有没有越界？           │
│  4. Efficiency       — 花了多少成本？          │
│  5. Robustness       — 换个场景还行不行？      │
└─────────────────────────────────────────────┘
```

这个框架适用于任何 Coding Agent，不限于测试生成。下面用 Test Generation Agent 作为具体案例说明每个维度怎么评、用什么指标、数据从哪来。

---

## 维度 1：Task Completion（任务达成）

**核心问题**：Agent 完成了交给它的任务吗？

### 指标设计

| 指标 | 定义 | 数据来源 | 本项目数据 |
|------|------|---------|-----------|
| 目标达成率 | 是否达到预设覆盖率目标（40%+） | jest --coverage | 41.07% ✅ |
| 测试通过率 | 生成的测试能通过的比例 | jest 运行结果 | 100%（443/443） |
| 模块完成率 | 计划测试的模块中实际完成的比例 | Agent 输出日志 | 31/31 = 100% |
| 放弃率 | 超过 3 次修复后放弃的模块比例 | Agent 输出日志 | 0% |

### 评估方法

```bash
# 每次迭代后运行，对比 baseline
npx jest --coverage --watchAll=false
# 用 coverage-parser 工具提取结构化数据
npx tsx src/agent.ts full
```

### 为什么这一维度不够

通过率 100% 看起来很好，但不能说明测试的真实价值。一个只写 `expect(true).toBe(true)` 的 Agent 也能达到 100% 通过率和高覆盖率。所以需要维度 2。

---

## 维度 2：Output Quality（产出质量）

**核心问题**：Agent 产出的东西，质量怎么样？

这是最难评、也最有区分度的维度。对测试生成 Agent 来说，"测试质量"有多个子维度：

### 2.1 变异测试（Mutation Testing）— 核心质量指标

**原理**：往源码里注入小 bug（mutant），看测试能不能抓到。

```
源码: if (score > 80) return "pass"
变异: if (score >= 80) return "pass"    ← 测试应该失败
      if (score > 80) return "fail"     ← 测试应该失败

如果测试没失败 → mutant "存活" → 测试对这个逻辑没有有效断言
```

| 指标 | 定义 | 工具 | 本项目数据 |
|------|------|------|-----------|
| Mutation Score（总） | killed / (killed + survived + no_cov) | Stryker | 46.70% |
| Mutation Score（已覆盖） | killed / (killed + survived) | Stryker | 73.28% |

**解读**：覆盖率 100% 的 safety.ts，mutation score 只有 81.48%。**覆盖率 ≠ 检测能力**。变异测试揭示了测试的真实盲区（正则锚点 `$` 的边界未被断言）。

### 2.2 静态质量指标

| 指标 | 定义 | 怎么算 | 好的标准 |
|------|------|-------|---------|
| 断言密度 | expect() 数 / test case 数 | 脚本统计 | ≥ 2 |
| Trivial 测试比例 | 只检查 `toBeDefined` / `toBeTruthy` 的测试 | 脚本统计 | 0% |
| Mock 比例 | 使用了 jest.mock 的测试 / 总测试 | 脚本统计 | 过高说明测试脆弱 |
| 测试隔离性 | `jest --randomize` 乱序执行通过率 | Jest flag | 100% |

### 2.3 首次通过率（First-Pass Rate）

Agent 生成的测试，不修改直接跑能通过的比例。这衡量的是 Agent 对目标代码的理解深度。

| 指标 | 本项目数据 |
|------|-----------|
| 首次通过率 | ~95%（441/443 无需修复） |
| 平均修复轮次 | 1 次（均首次修复成功） |

---

## 维度 3：Safety（安全性）

**核心问题**：Agent 有没有做不该做的事？

### 指标设计

| 指标 | 定义 | 验证方式 | 本项目数据 |
|------|------|---------|-----------|
| 源码零修改 | Agent 未修改目标项目 src/ 下的非测试文件 | Safety Hook 拦截日志 + git diff | ✅ 零次越界 |
| Hook 拦截率 | Safety Hook 是否 100% 拦截了越界尝试 | 单元测试（27 个用例） | 100% 拦截 |
| Hook 自身健壮性 | Hook 在边界场景下是否可靠 | 变异测试 | Mutation Score 81.48% |

### 安全评估的特殊性

安全不能只看"有没有出事"，还要看"如果 Agent 试图越界，防线能不能挡住"。这就是为什么 Safety Hook 自身需要单元测试 + 变异测试——它是最后一道防线，不能有盲区。

**本项目发现的安全隐患**：正则表达式 `$` 锚点的变异全部存活，意味着路径后缀攻击（如 `file.test.ts.malicious`）可以绕过 Hook。虽然实际风险低（Agent 不太会生成这种路径），但作为安全组件应该堵住。

---

## 维度 4：Efficiency（效率）

**核心问题**：Agent 花了多少成本完成任务？

### 指标设计

| 指标 | 定义 | 本项目数据 |
|------|------|-----------|
| 总轮次 | Agent 完成任务的 tool call 总数 | 5 轮运行 |
| 测试生成速度 | 测试数 / 运行轮次 | 443 / 5 ≈ 89 tests/run |
| 修复效率 | 修复成功的迭代次数 | 平均 1 次 |
| 模型选择 | 使用的模型及成本 | claude-sonnet-4-6 |

### 效率优化方向

- **模型降级实验**：同样任务用 haiku 跑，对比质量差异和成本节省
- **Skill 对效率的影响**：有 Skill vs 无 Skill 的首次通过率差异，直接影响修复轮次

---

## 维度 5：Robustness（鲁棒性）

**核心问题**：换个项目、换个语言，Agent 还能工作吗？

### 指标设计

| 指标 | 定义 | 验证方式 |
|------|------|---------|
| 跨项目泛化 | 同一 Agent 在不同项目上的表现 | 对比实验 |
| 跨语言适配 | 加新 Skill 后 Agent Core 零改动能否工作 | 二期 Java Skill 验证 |
| Skill 价值量化 | Agent+Skill vs 裸对话的质量差异 | A/B 对比实验 |

### 对比实验设计

```
实验：同一个 Java 项目

控制组 A：直接用 Claude Code 对话生成测试
控制组 B：用 Agent，但不加载 Skill
实验组 C：用 Agent + java-spring Skill

对比指标：覆盖率、mutation score、首次通过率、断言密度
```

如果 C > B > A，证明了两件事：
1. Agent 框架（CLAUDE.md 核心循环）比裸对话有优势
2. Skill（经验固化）在 Agent 框架之上进一步提升质量

---

## Eval 在迭代中的位置

```
┌──────────────────────────────────────────────────┐
│                Agent 迭代循环                      │
│                                                    │
│  改 Prompt / Skill / Tool / Model                  │
│         ↓                                          │
│  跑 Eval（五个维度）                                │
│         ↓                                          │
│  对比 Baseline                                     │
│         ↓                                          │
│  ┌─────────┐     ┌──────────┐                      │
│  │ 指标提升 │ →   │ 合入变更  │                      │
│  └─────────┘     └──────────┘                      │
│  ┌─────────┐     ┌──────────┐                      │
│  │ 指标下降 │ →   │ 回滚分析  │                      │
│  └─────────┘     └──────────┘                      │
└──────────────────────────────────────────────────┘
```

每次变更都有 Eval 数据支撑，而非凭直觉判断好坏。这和软件工程中"代码改了跑 CI"是同一个逻辑。

---

## 当前 Eval Baseline

以下是本项目当前的 Eval 基线数据，后续迭代以此为对比基准：

### Task Completion

| 指标 | Baseline |
|------|----------|
| 目标覆盖率达成 | ✅ 41.07%（目标 40%） |
| 测试通过率 | 100% |
| 模块完成率 | 100%（31/31） |
| 放弃率 | 0% |

### Output Quality

| 指标 | Baseline |
|------|----------|
| Mutation Score（已覆盖代码） | 73.28% |
| 首次通过率 | ~95% |
| Trivial 测试 | 0 |

### Safety

| 指标 | Baseline |
|------|----------|
| 源码零修改 | ✅ |
| Safety Hook Mutation Score | 81.48% |

### Efficiency

| 指标 | Baseline |
|------|----------|
| 总运行轮次 | 5 |
| 模型 | claude-sonnet-4-6 |

### Robustness

| 指标 | Baseline |
|------|----------|
| 已验证语言 | TypeScript（1 种） |
| 已验证项目 | confluence-qa-assistant（1 个） |
| Skill 对比实验 | 待做（二期） |

---

## 工具链

| 用途 | 工具 | 命令 |
|------|------|------|
| 任务达成 | Jest coverage | `npx jest --coverage --watchAll=false` |
| 变异测试 | Stryker | `npx stryker run` |
| 覆盖率解析 | coverage-parser（MCP Tool） | Agent 内部调用 |
| 测试隔离 | Jest randomize | `npx jest --randomize` |
| 静态分析 | 自定义脚本 | 待建 |
