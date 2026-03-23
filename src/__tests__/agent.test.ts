import { jest } from "@jest/globals";
import { buildPrompt, TARGET_MODULES } from "../agent.js";

describe("TARGET_MODULES", () => {
  it("should define all five run modes", () => {
    const modes = Object.keys(TARGET_MODULES);
    expect(modes).toEqual(
      expect.arrayContaining([
        "pure-functions",
        "utils",
        "components",
        "pipeline",
        "full",
      ])
    );
    expect(modes).toHaveLength(5);
  });

  it("should have files and description for every mode", () => {
    for (const [mode, config] of Object.entries(TARGET_MODULES)) {
      expect(config).toHaveProperty("files");
      expect(config).toHaveProperty("description");
      expect(config.files.length).toBeGreaterThan(0);
      expect(config.description.length).toBeGreaterThan(0);
    }
  });

  it("full mode should have files set to ALL", () => {
    expect(TARGET_MODULES["full"].files).toBe("ALL");
  });
});

describe("buildPrompt", () => {
  it("should return a string containing the target project path", () => {
    const prompt = buildPrompt("pure-functions");
    expect(prompt).toContain("confluence-qa-assistant");
  });

  it("should include module files for specific modes", () => {
    const prompt = buildPrompt("pure-functions");
    expect(prompt).toContain("bm25.ts");
    expect(prompt).toContain("tokenizer.ts");
    expect(prompt).toContain("fusion.ts");
  });

  it("should include component files for components mode", () => {
    const prompt = buildPrompt("components");
    expect(prompt).toContain("ErrorMessage.tsx");
    expect(prompt).toContain("CodeCopyButton.tsx");
  });

  it("should generate a different prompt for full mode", () => {
    const fullPrompt = buildPrompt("full");
    const specificPrompt = buildPrompt("pure-functions");

    // Full mode has unique instructions
    expect(fullPrompt).toContain("EXPLORE");
    expect(fullPrompt).toContain("40%+");
    expect(fullPrompt).toContain("parse_coverage");

    // Specific mode doesn't have the full loop
    expect(specificPrompt).not.toContain("EXPLORE → PLAN → EXECUTE → VERIFY");
  });

  it("should include step-by-step instructions for specific modes", () => {
    const prompt = buildPrompt("utils");
    expect(prompt).toContain("Read each source file");
    expect(prompt).toContain("run it immediately");
    expect(prompt).toContain("Max 3 attempts");
  });

  it("should exit on unknown mode", () => {
    const mockExit = jest
      .spyOn(process, "exit")
      .mockImplementation((code?: number | string | null | undefined) => {
        throw new Error(`process.exit(${code})`);
      });
    const mockError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => buildPrompt("nonexistent-mode")).toThrow("process.exit(1)");

    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("Unknown mode: nonexistent-mode")
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });
});
