import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

export const helloTool = tool(
  "hello",
  "A test tool that greets the user by name. Use this when asked to greet someone.",
  { name: z.string().describe("The name to greet") },
  async ({ name }) => ({
    content: [{ type: "text" as const, text: `Hello, ${name}! 🎉 The MCP Tool is working!` }],
  })
);

export const helloServer = createSdkMcpServer({
  name: "hello-server",
  version: "1.0.0",
  tools: [helloTool],
});
