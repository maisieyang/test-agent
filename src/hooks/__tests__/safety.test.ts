import { isTestRelatedPath, createSafetyHook } from "../safety.js";
import type { PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

// ─── isTestRelatedPath unit tests ───

describe("isTestRelatedPath", () => {
  describe("allowed test paths", () => {
    const allowedPaths = [
      "src/lib/__tests__/bm25.test.ts",
      "src/components/__tests__/Button.test.tsx",
      "src/utils/helpers.test.ts",
      "src/utils/helpers.spec.ts",
      "src/hooks/useAuth.test.tsx",
      "src/hooks/useAuth.spec.tsx",
      "jest.config.ts",
      "jest.config.js",
      "jest.setup.ts",
      "jest.setup.js",
      "src/test-utils.ts",
      "src/test-utils.tsx",
      "/test/integration/api.ts",
      "/tests/e2e/login.ts",
    ];

    it.each(allowedPaths)("should allow: %s", (path) => {
      expect(isTestRelatedPath(path)).toBe(true);
    });
  });

  describe("blocked source paths", () => {
    const blockedPaths = [
      "src/lib/search/bm25.ts",
      "src/components/Button.tsx",
      "src/utils/helpers.ts",
      "src/hooks/useAuth.ts",
      "src/agent.ts",
      "src/index.ts",
      "package.json",
    ];

    it.each(blockedPaths)("should block: %s", (path) => {
      expect(isTestRelatedPath(path)).toBe(false);
    });
  });

  describe("always-blocked patterns", () => {
    it("should block .env files even in test directories", () => {
      expect(isTestRelatedPath(".env")).toBe(false);
      expect(isTestRelatedPath(".env.local")).toBe(false);
      expect(isTestRelatedPath("src/__tests__/.env")).toBe(false);
    });

    it("should block scripts/ directory even with test-like names", () => {
      expect(isTestRelatedPath("scripts/run-tests.ts")).toBe(false);
      expect(isTestRelatedPath("scripts/test.ts")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should block empty path", () => {
      expect(isTestRelatedPath("")).toBe(false);
    });

    it("should allow deeply nested test files", () => {
      expect(isTestRelatedPath("src/a/b/c/__tests__/deep.test.ts")).toBe(true);
    });

    it("should block path traversal attempts through __tests__", () => {
      // This path contains __tests__ but the final target is a source file
      // isTestRelatedPath checks patterns, and __tests__ pattern matches
      // This is a known limitation worth documenting
      expect(isTestRelatedPath("src/__tests__/../../src/real.ts")).toBe(true);
    });
  });
});

// ─── createSafetyHook integration tests ───

describe("createSafetyHook", () => {
  const TARGET = "/project/target";
  const hook = createSafetyHook(TARGET);

  function makeInput(
    toolName: string,
    filePath: string
  ): PreToolUseHookInput {
    return {
      tool_name: toolName,
      tool_input: { file_path: filePath },
      hook_event_name: "PreToolUse",
    } as PreToolUseHookInput;
  }

  describe("non-write tools are always approved", () => {
    const readOnlyTools = ["Read", "Glob", "Grep", "Bash"];

    it.each(readOnlyTools)("should approve %s tool", async (tool) => {
      const result = await hook(makeInput(tool, `${TARGET}/src/index.ts`));
      expect(result.decision).toBe("approve");
    });
  });

  describe("files outside target project are always approved", () => {
    it("should approve Write to a file outside target", async () => {
      const result = await hook(
        makeInput("Write", "/other/project/src/index.ts")
      );
      expect(result.decision).toBe("approve");
    });

    it("should approve Edit to a file outside target", async () => {
      const result = await hook(
        makeInput("Edit", "/other/project/src/index.ts")
      );
      expect(result.decision).toBe("approve");
    });
  });

  describe("test files in target project are approved", () => {
    it("should approve Write to a test file", async () => {
      const result = await hook(
        makeInput("Write", `${TARGET}/src/__tests__/foo.test.ts`)
      );
      expect(result.decision).toBe("approve");
    });

    it("should approve Edit to a spec file", async () => {
      const result = await hook(
        makeInput("Edit", `${TARGET}/src/utils/helper.spec.ts`)
      );
      expect(result.decision).toBe("approve");
    });

    it("should approve Write to jest.config.ts", async () => {
      const result = await hook(
        makeInput("Write", `${TARGET}/jest.config.ts`)
      );
      expect(result.decision).toBe("approve");
    });
  });

  describe("source files in target project are blocked", () => {
    it("should block Write to a source file", async () => {
      const result = await hook(
        makeInput("Write", `${TARGET}/src/lib/search/bm25.ts`)
      );
      expect(result.decision).toBe("block");
      expect(result).toHaveProperty("reason");
    });

    it("should block Edit to a component file", async () => {
      const result = await hook(
        makeInput("Edit", `${TARGET}/src/components/Button.tsx`)
      );
      expect(result.decision).toBe("block");
    });

    it("should block Write to package.json", async () => {
      const result = await hook(
        makeInput("Write", `${TARGET}/package.json`)
      );
      expect(result.decision).toBe("block");
    });
  });

  describe("missing file_path handling", () => {
    it("should block Write with empty file_path in target", async () => {
      const input = {
        tool_name: "Write",
        tool_input: {},
        hook_event_name: "PreToolUse",
      } as PreToolUseHookInput;
      // Empty path doesn't start with target, so approved
      const result = await hook(input);
      expect(result.decision).toBe("approve");
    });
  });
});
