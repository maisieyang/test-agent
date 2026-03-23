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
