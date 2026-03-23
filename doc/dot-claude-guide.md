# .claude 目录 — Claude Code 的"大脑配置"指南

## 第一性原理

一个 AI Agent 要工作，必须回答三个根本问题：

| 问题 | 解决方案 | 对应文件 |
|------|---------|---------|
| **它是谁？该做什么？** | 行为规则 | `CLAUDE.md` |
| **它会什么技能？** | 领域知识模块 | `skills/` |
| **它被允许做什么？** | 权限白名单 | `settings.local.json` |

类比人类：`CLAUDE.md` 是岗位职责，`skills/` 是专业培训手册，`settings.local.json` 是权限卡。

---

## 目录结构

```
.claude/
├── CLAUDE.md                          # Agent 的行为宪法
├── settings.local.json                # 权限白名单（本地，不提交到 git）
└── skills/
    ├── typescript-jest/
    │   └── SKILL.md                   # TypeScript + Jest 测试技能
    └── test-skill/
        └── SKILL.md                   # 演示用的 toy skill
```

---

## 1. CLAUDE.md — 行为宪法

### 是什么

Claude Code 启动时会**自动读取**项目中所有 `CLAUDE.md` 文件并注入上下文。这不是文档，是**指令**——Claude 会把它当作必须遵守的规则来执行。

### 层级加载规则

`CLAUDE.md` 可以出现在多个位置，按优先级从高到低：

| 位置 | 作用域 | 典型内容 |
|------|--------|---------|
| `.claude/CLAUDE.md` | 项目级（Claude 专用目录） | Agent 的核心行为规则 |
| `CLAUDE.md`（项目根目录） | 项目级 | 项目概述、架构、开发规范 |
| `src/feature/CLAUDE.md` | 子目录级 | 特定模块的规则 |

所有层级的 CLAUDE.md 都会被加载，子目录的规则会叠加到项目级规则上。

### 本项目的 .claude/CLAUDE.md 做了什么

定义了一个全自主测试生成 Agent 的完整行为：

```
1. EXPLORE → 2. PLAN → 3. EXECUTE → 4. VERIFY → (repeat or finish)
```

- **身份**：全自主测试生成 Agent
- **核心循环**：探索项目 → 规划测试 → 编写测试 → 验证覆盖率
- **硬约束**：
  - 永远不改源码（只写测试文件）
  - 必须跑测试验证（不能只生成不跑）
  - 每个测试文件最多重试 3 次
  - 禁止生成无意义测试（如 `expect(fn).toBeDefined()`）
- **技术栈检测**：读 `package.json` 判断用哪个 Skill

### CLAUDE.md vs 普通 prompt 的区别

| | 普通 prompt | CLAUDE.md |
|---|---|---|
| 生命周期 | 单次对话 | 每次启动自动加载 |
| 作用域 | 当前问题 | 整个项目 |
| 维护方式 | 每次手写 | 版本控制，团队共享 |
| 本质 | 一次性指令 | 持久化的系统 prompt |

---

## 2. skills/ — 领域知识模块

### 是什么

Skills 是**可复用的知识模块**，本质是条件触发的 prompt 片段。当 Agent 遇到匹配的场景时，Skill 的内容会被加载到上下文中，指导 Agent 如何做好特定领域的工作。

### Skill 文件结构

每个 Skill 是一个目录，包含一个 `SKILL.md` 文件：

```markdown
---
name: TypeScript Jest Testing        # Skill 名称
description: Conventions and ...     # 触发条件描述（Claude 靠这个判断何时启用）
---

# 正文：具体的领域知识和规范
```

- **frontmatter**（`---` 之间）：元数据，`description` 字段决定了 Claude 什么时候选用这个 Skill
- **正文**：具体的规范、模式、示例代码、禁止事项

### 本项目的两个 Skill

#### typescript-jest（核心 Skill）

把"怎么写好 TypeScript 测试"的领域知识编码成了 Agent 可遵循的规范：

- **文件规范**：`src/[feature]/__tests__/[Module].test.ts(x)`
- **Import 模式**：用 `@/` 路径别名，不要 import jest/describe/it/expect
- **测试模板**：纯函数(P0)、React 组件(P1)、Hooks(P2) 各有标准写法
- **Mock 规范**：在模块边界 mock，永远不 mock 被测模块本身
- **禁止事项**：
  - 不写 trivial 测试
  - 不用 snapshot 测试
  - 不用 `fireEvent`（用 `userEvent`）
  - 不用 `getByTestId` 作为首选（优先语义查询）
  - 不用 `any` 类型
  - 不用 `setTimeout`（用 `waitFor`）

#### test-skill（演示用）

一个 toy skill，演示 Skill 的最小结构：

```markdown
---
name: Test Greeting Skill
description: A test skill that defines how to greet users.
---
When greeting someone:
1. Start with "Greetings, [name]!"
2. Add a fun fact about testing
3. End with "May your tests always pass!"
```

### Skill 的触发机制

Skill 不是一直加载在上下文里的（那样会浪费 token）。触发流程：

```
Agent 遇到任务 → 匹配 Skill 的 description → 加载 Skill 内容到上下文 → 按 Skill 规范执行
```

在本项目中，`CLAUDE.md` 里显式指导了 Skill 选择逻辑：

```
读 package.json → TypeScript/React → 使用 typescript-jest Skill
读 pom.xml → Spring → 使用 java-spring Skill（未来）
读 requirements.txt → Python → 使用 python-pytest Skill（未来）
```

### 如何创建新 Skill

```bash
mkdir -p .claude/skills/your-skill-name/
```

然后创建 `SKILL.md`：

```markdown
---
name: Your Skill Name
description: 一句话描述何时应该使用这个 Skill
---

# 正文
## 规范、模板、示例代码、禁止事项...
```

---

## 3. settings.local.json — 权限白名单

### 是什么

Claude Code 的**本地权限配置**。预授权特定工具调用，让 Agent 运行时不会卡在权限弹窗上。

### 本项目的配置

```json
{
  "permissions": {
    "allow": [
      "WebSearch",
      "Bash(npm install:*)",
      "Bash(npx tsx:*)",
      "Bash(git init:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git remote:*)",
      "Bash(git branch:*)",
      "Bash(git push:*)"
    ]
  }
}
```

### 权限规则语法

| 规则 | 含义 |
|------|------|
| `"WebSearch"` | 允许使用 WebSearch 工具 |
| `"Bash(npm install:*)"` | 允许所有以 `npm install` 开头的 Bash 命令 |
| `"Bash(npx tsx:*)"` | 允许所有以 `npx tsx` 开头的 Bash 命令 |
| `"Bash(git add:*)"` | 允许所有以 `git add` 开头的 Bash 命令 |

格式：`工具名(命令前缀:*)` — 冒号后的 `*` 是通配符。

### 注意没有的

- 没有 `Bash(rm:*)` — 不允许删除文件
- 没有 `Bash(npx jest:*)` — 跑测试仍需人类确认
- 没有 `Bash(curl:*)` — 不允许网络请求

这些"不在列表上"的缺失本身就是安全决策。

### settings.local.json vs settings.json

| | settings.local.json | settings.json |
|---|---|---|
| 位置 | `.claude/settings.local.json` | `.claude/settings.json` |
| 是否提交 git | 通常**不提交**（个人配置） | **提交**（团队共享） |
| 用途 | 开发者个人的权限偏好 | 项目统一的权限规范 |

---

## 三者如何协同工作

```
启动 Agent
  │
  ├─ 加载 CLAUDE.md → Agent 知道"我是谁、该做什么"
  │
  ├─ 加载 settings.local.json → Agent 知道"哪些操作不用问"
  │
  └─ 运行中遇到匹配场景 → 加载对应 Skill → Agent 知道"怎么做好"
```

在 `agent.ts` 中的体现：

```typescript
const conversation = query({
  prompt,                              // ← 基于 CLAUDE.md 的行为规则
  options: {
    permissionMode: "acceptEdits",     // ← 文件编辑自动通过
    allowedTools: [...],               // ← 允许使用的工具列表
    mcpServers: { "coverage-parser": coverageServer },  // ← MCP 工具
    hooks: { PreToolUse: [...] },      // ← Safety Hook（第三层安全）
  },
});
```

三层安全叠加：

```
┌─────────────────────────────────────────────┐
│  第 1 层：permissionMode: "acceptEdits"     │  ← 文件操作自动通过
│  ┌─────────────────────────────────────────┐│
│  │  第 2 层：settings.local.json           ││  ← 预授权特定 Bash 命令
│  │  ┌─────────────────────────────────────┐││
│  │  │  第 3 层：Safety Hook               │││  ← 只能写测试文件
│  │  │                                     │││
│  │  │  Agent 在这里自由工作               │││
│  │  └─────────────────────────────────────┘││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

结果：Agent 足够自主去完成测试生成工作，又不会搞坏目标项目的源代码。
