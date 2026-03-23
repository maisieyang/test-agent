import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface FileCoverage {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

type CoverageSummary = Record<string, FileCoverage>;

interface ParsedCoverage {
  total: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  uncoveredFiles: Array<{
    file: string;
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  }>;
  coveredFiles: Array<{
    file: string;
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  }>;
  fileCount: number;
}

export function parseCoverageSummary(data: CoverageSummary): ParsedCoverage {
  const total = data["total"];
  const files = Object.entries(data).filter(([key]) => key !== "total");

  const coveredFiles: ParsedCoverage["coveredFiles"] = [];
  const uncoveredFiles: ParsedCoverage["uncoveredFiles"] = [];

  for (const [filePath, metrics] of files) {
    const entry = {
      file: filePath,
      lines: metrics.lines.pct,
      branches: metrics.branches.pct,
      functions: metrics.functions.pct,
      statements: metrics.statements.pct,
    };

    if (metrics.lines.pct === 0 && metrics.functions.pct === 0) {
      uncoveredFiles.push(entry);
    } else {
      coveredFiles.push(entry);
    }
  }

  // Sort: uncovered by file name, covered by lines descending
  uncoveredFiles.sort((a, b) => a.file.localeCompare(b.file));
  coveredFiles.sort((a, b) => b.lines - a.lines);

  return {
    total: {
      lines: total.lines.pct,
      branches: total.branches.pct,
      functions: total.functions.pct,
      statements: total.statements.pct,
    },
    uncoveredFiles,
    coveredFiles,
    fileCount: files.length,
  };
}

const parseCoverageTool = tool(
  "parse_coverage",
  "Parse a Jest coverage-summary.json file and return structured coverage data including total percentages, uncovered files, and covered files sorted by coverage.",
  {
    coverage_path: z
      .string()
      .describe(
        "Absolute path to the coverage-summary.json file (e.g., /path/to/project/coverage/coverage-summary.json)"
      ),
  },
  async ({ coverage_path }) => {
    if (!existsSync(coverage_path)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { error: `File not found: ${coverage_path}` },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    try {
      const raw = await readFile(coverage_path, "utf-8");
      const data: CoverageSummary = JSON.parse(raw);
      const result = parseCoverageSummary(data);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { error: `Failed to parse coverage: ${String(err)}` },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }
);

export const coverageServer = createSdkMcpServer({
  name: "coverage-parser",
  version: "1.0.0",
  tools: [parseCoverageTool],
});
