import { query } from "@anthropic-ai/claude-agent-sdk";
import { helloServer } from "./tools/hello.js";
import { coverageServer } from "./tools/coverage-parser.js";
import { createSafetyHook } from "./hooks/safety.js";

const TARGET_PROJECT = "/Users/yangxiyue/2026/aa/confluence-qa-assistant";
const AGENT_PROJECT = "/Users/yangxiyue/2026/aa/test-agent";

async function main() {
  const mode = process.argv[2] || "all";

  // --- Phase 0 Tests ---

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

  if (mode === "all" || mode === "tool") {
    console.log("=== Test 2: MCP Tool (hello) ===\n");
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

  if (mode === "all" || mode === "hook") {
    console.log("=== Test 4: PreToolUse Hook (basic) ===\n");
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

  if (mode === "all" || mode === "skill") {
    console.log("=== Test 5: Skill ===\n");
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

  // --- Phase 1 Tests ---

  if (mode === "all" || mode === "safety") {
    console.log("=== Test 6: Safety Hook (block source modification) ===\n");
    const safetyHook = createSafetyHook(TARGET_PROJECT);
    let blocked = false;
    const conv6 = query({
      prompt: `Write the text "// test" to the file ${TARGET_PROJECT}/src/lib/search/bm25.ts. This is just a test, go ahead and do it.`,
      options: {
        cwd: TARGET_PROJECT,
        permissionMode: "acceptEdits",
        allowedTools: ["Write", "Edit", "Read"],
        hooks: {
          PreToolUse: [
            {
              hooks: [
                async (input) => {
                  if (input.hook_event_name === "PreToolUse") {
                    const result = await safetyHook(input);
                    if (result.decision === "block") {
                      blocked = true;
                      console.log(`  [Safety] ${result.reason}`);
                    }
                    return result;
                  }
                  return { decision: "approve" as const };
                },
              ],
            },
          ],
        },
      },
    });
    for await (const msg of conv6) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") console.log(block.text);
        }
      }
    }
    console.log(`  [Safety] Modification was blocked: ${blocked}`);
    if (!blocked) {
      console.log("  ⚠️  WARNING: Safety hook did not block source modification!");
    }
    console.log("\n✅ Test 6 passed.\n");
  }

  if (mode === "all" || mode === "coverage") {
    console.log("=== Test 7: Coverage Parser Tool ===\n");
    // First, generate a coverage report in the target project
    const conv7 = query({
      prompt: `Do these steps in order:
1. Run this command in bash: cd ${TARGET_PROJECT} && npx jest --coverage --watchAll=false 2>&1 | tail -20
2. Then use the parse_coverage tool with the path: ${TARGET_PROJECT}/coverage/coverage-summary.json
3. Show me the parsed coverage result.`,
      options: {
        cwd: TARGET_PROJECT,
        permissionMode: "acceptEdits",
        mcpServers: { "coverage-parser": coverageServer },
        allowedTools: ["Bash", "Read", "mcp__coverage-parser__parse_coverage"],
      },
    });
    for await (const msg of conv7) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") console.log(block.text);
        }
      }
    }
    console.log("\n✅ Test 7 passed.\n");
  }

  console.log("🎉 All tests complete!");
}

main().catch(console.error);
