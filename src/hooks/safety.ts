import type { PreToolUseHookInput, SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

/**
 * Safety hook: prevents the agent from modifying source code in the target project.
 * Only allows writing to test-related files.
 */

// Patterns that are allowed to be written/edited
const ALLOWED_PATTERNS = [
  /\/__tests__\//,          // Test directories
  /\.test\.[tj]sx?$/,       // Test files
  /\.spec\.[tj]sx?$/,       // Spec files
  /jest\.config\.[tj]s$/,   // Jest config
  /jest\.setup\.[tj]s$/,    // Jest setup
  /test-utils\.[tj]sx?$/,   // Test utilities
  /\/test\/.*$/,             // Generic test directory
  /\/tests\/.*$/,            // Generic tests directory
];

// Patterns that are always blocked
const BLOCKED_PATTERNS = [
  /\.env/,                   // Environment files
  /\/scripts\//,             // Script files
];

export function isTestRelatedPath(filePath: string): boolean {
  if (BLOCKED_PATTERNS.some((p) => p.test(filePath))) return false;
  if (ALLOWED_PATTERNS.some((p) => p.test(filePath))) return true;
  return false;
}

export function createSafetyHook(targetProjectPath: string) {
  return async (input: PreToolUseHookInput): Promise<SyncHookJSONOutput> => {
    const toolName = input.tool_name;
    const toolInput = input.tool_input as Record<string, unknown>;

    // Only intercept file-writing tools
    if (toolName !== "Write" && toolName !== "Edit") {
      return { decision: "approve" };
    }

    // Extract file path from tool input
    const filePath =
      (toolInput.file_path as string) || (toolInput.path as string) || "";

    // Only enforce for files inside the target project
    if (!filePath.startsWith(targetProjectPath)) {
      return { decision: "approve" };
    }

    // Check if the file is test-related
    if (isTestRelatedPath(filePath)) {
      return { decision: "approve" };
    }

    // Block: not a test-related file
    const reason = `BLOCKED: Cannot modify source file "${filePath}". Only test files (__tests__/*.test.ts(x)) are allowed.`;
    console.warn(`  [Safety Hook] ${reason}`);
    return {
      decision: "block",
      reason,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    };
  };
}
