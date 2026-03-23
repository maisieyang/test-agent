# Claude Agent SDK — permissionMode 权限模式指南

## 第一性原理

Agent 能调用工具（读文件、写文件、执行命令）。核心问题是：

> **每次调用工具时，需不需要人类批准？**

`permissionMode` 就是这个问题的答案。5 个值构成从严到松的光谱：

```
plan → dontAsk → default → acceptEdits → bypassPermissions
 │        │         │           │              │
 纯规划    严格      标准        宽松           完全自主
```

---

## 5 种模式详解

### 1. `plan` — 只看不做

Agent 只能思考和规划，不实际执行任何工具。

| 操作 | 行为 |
|------|------|
| 读文件 | 不执行 |
| 写文件 | 不执行 |
| 执行命令 | 不执行 |

**类比**：建筑师只出图纸，不动一砖一瓦。

**适用场景**：让 Agent 先输出计划供人类审核，确认后再切换到其他模式执行。

---

### 2. `dontAsk` — 白名单严格模式

Agent 绝不弹窗问你。要么工具已经被预授权（在 `settings.local.json` 的 `allow` 列表或 `allowedTools` 里），要么直接拒绝。

| 操作 | 行为 |
|------|------|
| 预授权的操作 | 自动通过 |
| 未授权的操作 | **静默拒绝**（不问，直接 deny） |

**类比**：自动化流水线——只做被明确授权的事，遇到未授权的不停下来问，直接跳过。

**适用场景**：CI/CD、无人值守的自动化任务。不能有人类交互，一切权限必须提前声明。

---

### 3. `default` — 标准交互模式

Claude Code CLI 的日常模式。Agent 遇到"危险操作"时会暂停，弹窗问你。

| 操作 | 行为 |
|------|------|
| 读文件 | 自动通过（安全） |
| 写/编辑文件 | **弹窗询问** |
| 执行 Bash 命令 | **弹窗询问** |
| 已在 allow 列表里的 | 自动通过 |

**类比**：你正常用 Claude Code 时的体验——它想改文件会先问你。

**适用场景**：日常开发，人类在旁边监督。

---

### 4. `acceptEdits` — 自动接受编辑

**关键理解：名字不是"允许编辑"，而是"自动接受编辑"。**

和 `default` 的区别只有一个：文件的 Write/Edit 操作不再弹窗，自动通过。

| 操作 | 行为 |
|------|------|
| 读文件 | 自动通过 |
| 写/编辑文件 | **自动通过**（这是与 default 的区别） |
| 执行 Bash 命令 | **仍然弹窗询问**（除非在 allow 列表里） |

**类比**：你信任 Agent 改文件（反正有 git 可以回退），但执行命令仍要你确认。

**适用场景**：半自主的代码生成任务。Agent 需要频繁写文件但你希望保留对命令执行的控制。

---

### 5. `bypassPermissions` — 完全自主

跳过所有权限检查，Agent 想做什么就做什么。

必须显式加 `allowDangerouslySkipPermissions: true` 才能开启——命名本身就是警告。

| 操作 | 行为 |
|------|------|
| 读文件 | 自动通过 |
| 写文件 | 自动通过 |
| 执行命令 | 自动通过 |
| 一切操作 | 自动通过 |

**类比**：给 Agent root 权限。

**适用场景**：完全信任的受控环境，如沙箱容器内运行。

---

## 模式对比总览

| 模式 | 读文件 | 写文件 | Bash 命令 | 是否需要人类在场 |
|------|--------|--------|-----------|-----------------|
| `plan` | 不执行 | 不执行 | 不执行 | 否（只输出计划） |
| `dontAsk` | 预授权才通过 | 预授权才通过 | 预授权才通过 | 否（无人值守） |
| `default` | 自动通过 | 弹窗询问 | 弹窗询问 | 是 |
| `acceptEdits` | 自动通过 | 自动通过 | 弹窗询问 | 半自主 |
| `bypassPermissions` | 自动通过 | 自动通过 | 自动通过 | 否（完全自主） |

---

## 实际应用：test-agent 的分层安全设计

```typescript
// agent.ts
permissionMode: "acceptEdits",
allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", ...],
```

```json
// settings.local.json — 预授权特定 Bash 命令
{ "permissions": { "allow": ["Bash(npm install:*)", "Bash(npx tsx:*)", ...] } }
```

```typescript
// hooks/safety.ts — 即使有写权限，也只能写测试文件
if (!isTestRelatedPath(filePath)) return { decision: "block" };
```

三层叠加的效果：

| 层 | 机制 | 作用 |
|----|------|------|
| 第 1 层 | `acceptEdits` | Agent 可以自由写文件，不用每次弹窗 |
| 第 2 层 | `settings.local.json` | 预授权特定 Bash 命令（npm, git 等） |
| 第 3 层 | Safety Hook | 即使有写权限，也只能写测试文件，不能碰源码 |

结果 = Agent 足够自主去完成工作，又不会搞坏目标项目的源代码。

---

## 如何选择

- 想让 Agent 先出方案？→ `plan`
- 跑在 CI 里无人值守？→ `dontAsk`（提前配好 allow 列表）
- 日常结对编程？→ `default`
- 让 Agent 自主写代码但控制命令？→ `acceptEdits`
- 完全信任的沙箱环境？→ `bypassPermissions`
