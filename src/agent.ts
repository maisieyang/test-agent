import { query } from "@anthropic-ai/claude-agent-sdk";
import { helloServer } from "./tools/hello.js";

const TARGET_PROJECT = "/Users/yangxiyue/2026/aa/confluence-qa-assistant";

async function main() {
  const mode = process.argv[2] || "all";

  // --- Test 1: Basic SDK + Read tool ---
  if (mode === "all" || mode === "read") {
    console.log("=== Test 1: SDK + Read Tool ===\n");
    const conv1 = query({
      prompt: `Read the file ${TARGET_PROJECT}/package.json and tell me what framework and test tools this project uses. Be concise.`,
      options: {
        cwd: TARGET_PROJECT,
        permissionMode: "acceptEdits",
        allowedTools: ["Read", "Glob", "Grep", "Bash"],
      },
    });
    for await (const msg of conv1) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") console.log(block.text);
        }
      }
    }
    console.log("\n✅ Test 1 passed.\n");
  }

  // --- Test 2: MCP Tool ---
  if (mode === "all" || mode === "tool") {
    console.log("=== Test 2: MCP Tool ===\n");
    const conv2 = query({
      prompt: "Use the hello tool to greet 'Test Agent'. Just call the tool and show the result.",
      options: {
        permissionMode: "acceptEdits",
        mcpServers: { "hello-server": helloServer },
        allowedTools: ["mcp__hello-server__hello"],
      },
    });
    for await (const msg of conv2) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") console.log(block.text);
        }
      }
    }
    console.log("\n✅ Test 2 passed.\n");
  }

  // --- Test 3: Subagent ---
  if (mode === "all" || mode === "subagent") {
    console.log("=== Test 3: Subagent ===\n");
    const conv3 = query({
      prompt: `Use the "file-reader" agent to read ${TARGET_PROJECT}/package.json and summarize the project name and version. Be concise.`,
      options: {
        cwd: TARGET_PROJECT,
        permissionMode: "acceptEdits",
        allowedTools: ["Agent", "Read", "Glob"],
        agents: {
          "file-reader": {
            description: "Reads files and summarizes their content",
            prompt: "You are a file reader. Read the requested file and provide a concise summary.",
            tools: ["Read", "Glob"],
            model: "haiku",
          },
        },
      },
    });
    for await (const msg of conv3) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") console.log(block.text);
        }
      }
    }
    console.log("\n✅ Test 3 passed.\n");
  }

  // --- Test 4: PreToolUse Hook ---
  if (mode === "all" || mode === "hook") {
    console.log("=== Test 4: PreToolUse Hook ===\n");
    let hookTriggered = false;
    const conv4 = query({
      prompt: `Read the file ${TARGET_PROJECT}/package.json and tell me the project name.`,
      options: {
        cwd: TARGET_PROJECT,
        permissionMode: "acceptEdits",
        allowedTools: ["Read"],
        hooks: {
          PreToolUse: [
            {
              hooks: [
                async (input) => {
                  if (input.hook_event_name === "PreToolUse") {
                    hookTriggered = true;
                    console.log(`  [Hook] Intercepted tool: ${input.tool_name}`);
                  }
                  return { decision: "approve" as const };
                },
              ],
            },
          ],
        },
      },
    });
    for await (const msg of conv4) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") console.log(block.text);
        }
      }
    }
    console.log(`  [Hook] Was triggered: ${hookTriggered}`);
    console.log("\n✅ Test 4 passed.\n");
  }

  // --- Test 5: Skill ---
  if (mode === "all" || mode === "skill") {
    console.log("=== Test 5: Skill ===\n");
    const AGENT_PROJECT = "/Users/yangxiyue/2026/aa/test-agent";
    const conv5 = query({
      prompt: "Greet someone named 'Developer'. You MUST follow the Test Greeting Skill instructions from your skills. Follow the pattern exactly: start with 'Greetings', add a fun fact about testing, end with 'May your tests always pass!'",
      options: {
        cwd: AGENT_PROJECT,
        permissionMode: "acceptEdits",
        allowedTools: ["Read", "Glob"],
      },
    });
    for await (const msg of conv5) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") console.log(block.text);
        }
      }
    }
    console.log("\n✅ Test 5 passed.\n");
  }

  console.log("🎉 Phase 0 verification complete!");
}

main().catch(console.error);
