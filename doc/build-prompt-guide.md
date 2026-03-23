# buildPrompt() 深度解析 — Agent 的任务分发器

## 它解决什么问题

Agent 每次运行需要一条精确的指令。但不同阶段要测的东西不同：有时测 3 个纯函数，有时测 9 个组件，有时让 Agent 完全自主。`buildPrompt()` 根据运行模式，生成对应的完整指令。

---

## 第一层：数据结构 — TARGET_MODULES

一个**任务注册表**，把 5 种 mode 映射到"测什么"和"怎么测"：

```
mode              files（测什么）                       description（怎么测）
─────────────     ──────────────────────                ──────────────────────
pure-functions    bm25, tokenizer, fusion               纯输入输出，不需要 mock
utils             markdownPreprocessor, ast...          纯函数，不需要 mock
components        ErrorMessage, CodeCopyButton...       用 RTL，测渲染和交互
pipeline          queryTransform, contextManager...     调外部 API，需要 mock
full              ALL                                   自主驱动，以覆盖率为目标
```

### 递进关系

这不是随意排列，是按**测试难度阶梯**设计的：

```
pure-functions → utils → components → pipeline → full
    简单              →              复杂
    无 mock           →           需要 mock
    指定文件          →           Agent 自己探索
    手动挡            →            自动挡
```

让 Agent 先在简单场景成功，再挑战复杂场景。

---

## 第二层：两条路径 — buildPrompt() 的分支逻辑

`buildPrompt` 只有两个分支：

### 分支 A：`full` 模式 — 给目标，不给路径

```typescript
if (runMode === "full") {
  return `You are a Test Generation Agent...
    Follow the EXPLORE → PLAN → EXECUTE → VERIFY loop from your CLAUDE.md rules.
    Your goal: achieve 40%+ statement coverage across the project.
    ...`;
}
```

关键特征：

| 特征 | 说明 |
|------|------|
| 不指定具体文件 | Agent 自己 Glob 探索 |
| 不指定优先级 | Agent 按 CLAUDE.md 的规则自己判断 |
| 给了退出条件 | 覆盖率 ≥ 40% 或所有可行模块都测完 |
| 引用了 CLAUDE.md | "Follow the ... loop from your CLAUDE.md rules" |

这是真正的**自主 Agent**：给目标，让它自己规划路径。

### 分支 B：其他 4 种模式 — 给目标，也给路径

```typescript
return `You are a Test Generation Agent...
  Generate tests for these specific files: ${target.files}
  Context: ${target.description}
  Steps:
  1. Read each source file thoroughly...
  2. Read the existing test (SendButton.test.tsx) to match the project's test style.
  3. Read jest.config.ts and tsconfig.json...
  4. For each file, write a comprehensive test file...
  5. After writing each test file, run it immediately...
  6. If a test fails, read the error, fix the test, and re-run. Max 3 attempts.
  7. After all tests pass, run coverage...
  8. Use the parse_coverage tool... to show structured results.`;
```

关键特征：

| 特征 | 说明 |
|------|------|
| 指定了具体文件 | `${target.files}` 列表 |
| 给了 8 步明确流程 | 读源码→读现有测试→读配置→写测试→跑→修→覆盖率→报告 |
| 给了参考样本 | "Read the existing test (SendButton.test.tsx) to match style" |

这是**半自主 Agent**：目标和路径都给了，Agent 负责执行。

---

## 第三层：两条 prompt 的共同骨架

虽然分两条路径，但共享一个核心结构：

```
1. 身份声明    → "You are a Test Generation Agent"
2. 目标项目    → TARGET_PROJECT 路径
3. 任务范围    → 具体文件 或 覆盖率目标
4. 执行步骤    → 8 步流程 或 EXPLORE→PLAN→EXECUTE→VERIFY
5. 验证要求    → npx jest --coverage + parse_coverage 工具
6. 输出格式    → 要求输出 summary
```

每条 prompt 都是**自包含的完整指令** — Agent 拿到这条 prompt 后，不需要额外信息就能开始工作。

---

## 关键设计：prompt 和 CLAUDE.md 和 Skill 的分工

| | prompt（buildPrompt 生成） | CLAUDE.md | Skill |
|---|---|---|---|
| 变化频率 | 每次运行不同（根据 mode） | 固定不变 | 固定不变 |
| 内容 | **这次**测什么、目标是什么 | **永远**怎么做、规矩是什么 | **领域**标准和规范 |
| 类比 | 今天的工单 | 员工手册 | 专业培训教材 |

`full` 模式的 prompt 里写了 `"Follow the ... loop from your CLAUDE.md rules"` — 这是 prompt 把控制权交给 CLAUDE.md 的时刻。

**prompt 说"做什么"，CLAUDE.md 说"怎么做"，Skill 说"做到什么标准"。**

---

## 使用方式

```bash
# 从简单到复杂，逐步运行
npx tsx src/agent.ts pure-functions    # 第 1 次：3 个纯函数
npx tsx src/agent.ts utils             # 第 2 次：2 个工具函数
npx tsx src/agent.ts components        # 第 3 次：9 个 React 组件
npx tsx src/agent.ts pipeline          # 第 4 次：3 个管道模块（需 mock）
npx tsx src/agent.ts full              # 第 5 次：完全自主，覆盖率驱动

# 不传参数默认为 pure-functions
npx tsx src/agent.ts
```

---

## 总结：buildPrompt 的本质

它是一个**任务分发器**。根据 mode 参数，生成一条精确的、自包含的指令：

- `pure-functions`：这 3 个纯函数，直接测输入输出
- `utils`：这 2 个工具函数，直接测
- `components`：这 9 个组件，用 RTL 测
- `pipeline`：这 3 个管道模块，要 mock 外部依赖
- `full`：你自己看着办，覆盖率到 40% 就行

**从手动挡到自动挡的渐进设计** — 前 4 个 mode 是你扶着 Agent 走，第 5 个 mode 是放手让它跑。
