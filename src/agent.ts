import { query } from "@anthropic-ai/claude-agent-sdk";
import { coverageServer } from "./tools/coverage-parser.js";
import { createSafetyHook } from "./hooks/safety.js";

const TARGET_PROJECT = "/Users/yangxiyue/2026/aa/confluence-qa-assistant";
const AGENT_PROJECT = "/Users/yangxiyue/2026/aa/test-agent";

// Run modes:
//   "pure-functions" — bm25, tokenizer, fusion
//   "utils"          — markdownPreprocessor, astMarkdownProcessor
//   "components"     — React components
//   "pipeline"       — queryTransform, contextManager (needs mocks)
//   "full"           — autonomous coverage-driven full run
const mode = process.argv[2] || "pure-functions";

const TARGET_MODULES: Record<string, { files: string; description: string }> = {
  "pure-functions": {
    files: "src/lib/search/bm25.ts, src/lib/search/tokenizer.ts, src/lib/search/fusion.ts",
    description: "Pure function unit tests for search modules (BM25, tokenizer, fusion). No mocks needed — test inputs and outputs directly.",
  },
  utils: {
    files: "src/utils/markdownPreprocessor.ts, src/utils/astMarkdownProcessor.ts",
    description: "Pure function unit tests for utility modules. No mocks needed.",
  },
  components: {
    files: "src/components/ErrorMessage.tsx, src/components/ErrorBoundary.tsx, src/components/CodeCopyButton.tsx, src/components/MessageFeedback.tsx, src/components/CollapsibleSection.tsx, src/components/ScrollToBottomButton.tsx, src/components/CalloutBox.tsx, src/components/VisualSeparator.tsx, src/components/ThemeSelector.tsx",
    description: "React component tests using RTL. Test rendering, user interactions, conditional rendering, and callback props.",
  },
  pipeline: {
    files: "src/lib/pipeline/queryTransform.ts, src/lib/pipeline/contextManager.ts, src/lib/pipeline/reranker.ts",
    description: "Pipeline logic tests. These modules call external APIs (LLM, embeddings) — mock all external dependencies, test the logic branches.",
  },
  full: {
    files: "ALL",
    description: "Autonomous coverage-driven run. Explore the project, identify all untested modules, generate tests prioritized by value, and iterate until coverage target (40%+) is met.",
  },
};

function buildPrompt(runMode: string): string {
  const target = TARGET_MODULES[runMode];
  if (!target) {
    console.error(`Unknown mode: ${runMode}. Available: ${Object.keys(TARGET_MODULES).join(", ")}`);
    process.exit(1);
  }

  if (runMode === "full") {
    return `You are a Test Generation Agent. Your target project is at: ${TARGET_PROJECT}

Follow the EXPLORE → PLAN → EXECUTE → VERIFY loop from your CLAUDE.md rules.

Your goal: achieve 40%+ statement coverage across the project.

Steps:
1. EXPLORE: Read package.json, jest.config.ts, tsconfig.json, and existing tests. Glob all source files.
2. PLAN: List all untested modules, prioritize by value (pure functions first, then components, then pipeline logic with mocks).
3. EXECUTE: For each module, read the source, write the test file, run it, fix if needed (max 3 attempts per file).
4. VERIFY: Run full coverage with \`npx jest --coverage --coverageReporters=json-summary --watchAll=false\`, then use parse_coverage tool on ${TARGET_PROJECT}/coverage/coverage-summary.json.

If coverage < 40%, identify uncovered files and generate more tests. Repeat until target is met or all feasible modules are tested.

Output a final summary with: modules tested, pass/fail status, coverage before and after.`;
  }

  return `You are a Test Generation Agent. Your target project is at: ${TARGET_PROJECT}

Generate tests for these specific files: ${target.files}

Context: ${target.description}

Steps:
1. Read each source file thoroughly to understand exports, logic, and edge cases.
2. Read the existing test (src/components/__tests__/SendButton.test.tsx) to match the project's test style.
3. Read jest.config.ts and tsconfig.json to understand path aliases (@/ → src/).
4. For each file, write a comprehensive test file at src/[feature]/__tests__/[Module].test.ts(x).
5. After writing each test file, run it immediately: \`npx jest <test-file-path> --no-coverage\`
6. If a test fails, read the error, fix the test (NOT the source code), and re-run. Max 3 attempts per file.
7. After all tests pass, run coverage: \`npx jest --coverage --coverageReporters=json-summary --watchAll=false\`
8. Use the parse_coverage tool on ${TARGET_PROJECT}/coverage/coverage-summary.json to show structured results.

Output a summary: which files were tested, pass/fail status, and coverage data.`;
}

async function main() {
  const prompt = buildPrompt(mode);
  const safetyHook = createSafetyHook(TARGET_PROJECT);

  console.log(`\n🚀 Test Generation Agent — mode: ${mode}\n`);
  console.log(`📁 Target: ${TARGET_MODULES[mode]?.files}\n`);
  console.log("─".repeat(60) + "\n");

  const conversation = query({
    prompt,
    options: {
      cwd: TARGET_PROJECT,
      permissionMode: "acceptEdits",
      allowedTools: [
        "Read", "Write", "Edit", "Glob", "Grep", "Bash",
        "mcp__coverage-parser__parse_coverage",
      ],
      mcpServers: { "coverage-parser": coverageServer },
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === "PreToolUse") {
                  return await safetyHook(input);
                }
                return { decision: "approve" as const };
              },
            ],
          },
        ],
      },
      maxTurns: 200,
      model: "claude-sonnet-4-6",
    },
  });

  for await (const msg of conversation) {
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
    }
  }

  console.log("\n" + "─".repeat(60));
  console.log("✅ Agent finished.\n");
}

main().catch(console.error);
