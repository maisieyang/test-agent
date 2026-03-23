import { parseCoverageSummary } from "../coverage-parser.js";

describe("parseCoverageSummary", () => {
  const makeCoverageMetric = (pct: number, total = 10) => ({
    total,
    covered: Math.round(total * pct / 100),
    skipped: 0,
    pct,
  });

  const makeFileCoverage = (lines: number, branches: number, functions: number, statements: number) => ({
    lines: makeCoverageMetric(lines),
    branches: makeCoverageMetric(branches),
    functions: makeCoverageMetric(functions),
    statements: makeCoverageMetric(statements),
  });

  it("should extract total coverage percentages", () => {
    const data = {
      total: makeFileCoverage(80, 60, 90, 75),
    };

    const result = parseCoverageSummary(data);

    expect(result.total).toEqual({
      lines: 80,
      branches: 60,
      functions: 90,
      statements: 75,
    });
  });

  it("should return zero fileCount when only total exists", () => {
    const data = {
      total: makeFileCoverage(0, 0, 0, 0),
    };

    const result = parseCoverageSummary(data);

    expect(result.fileCount).toBe(0);
    expect(result.coveredFiles).toEqual([]);
    expect(result.uncoveredFiles).toEqual([]);
  });

  it("should classify fully uncovered files (lines=0 AND functions=0)", () => {
    const data = {
      total: makeFileCoverage(10, 5, 10, 10),
      "/src/untested.ts": makeFileCoverage(0, 0, 0, 0),
    };

    const result = parseCoverageSummary(data);

    expect(result.uncoveredFiles).toHaveLength(1);
    expect(result.uncoveredFiles[0].file).toBe("/src/untested.ts");
    expect(result.coveredFiles).toHaveLength(0);
  });

  it("should classify files with any coverage as covered", () => {
    const data = {
      total: makeFileCoverage(50, 30, 50, 50),
      "/src/partial.ts": makeFileCoverage(30, 10, 20, 25),
    };

    const result = parseCoverageSummary(data);

    expect(result.coveredFiles).toHaveLength(1);
    expect(result.coveredFiles[0]).toEqual({
      file: "/src/partial.ts",
      lines: 30,
      branches: 10,
      functions: 20,
      statements: 25,
    });
    expect(result.uncoveredFiles).toHaveLength(0);
  });

  it("should treat file with lines=0 but functions>0 as covered", () => {
    // Edge case: lines.pct=0 but functions.pct>0 → not uncovered
    const data = {
      total: makeFileCoverage(10, 10, 10, 10),
      "/src/edge.ts": makeFileCoverage(0, 0, 50, 0),
    };

    const result = parseCoverageSummary(data);

    expect(result.coveredFiles).toHaveLength(1);
    expect(result.uncoveredFiles).toHaveLength(0);
  });

  it("should treat file with functions=0 but lines>0 as covered", () => {
    const data = {
      total: makeFileCoverage(10, 10, 10, 10),
      "/src/edge2.ts": makeFileCoverage(50, 0, 0, 50),
    };

    const result = parseCoverageSummary(data);

    expect(result.coveredFiles).toHaveLength(1);
    expect(result.uncoveredFiles).toHaveLength(0);
  });

  it("should sort uncovered files alphabetically by file path", () => {
    const data = {
      total: makeFileCoverage(0, 0, 0, 0),
      "/src/z-module.ts": makeFileCoverage(0, 0, 0, 0),
      "/src/a-module.ts": makeFileCoverage(0, 0, 0, 0),
      "/src/m-module.ts": makeFileCoverage(0, 0, 0, 0),
    };

    const result = parseCoverageSummary(data);

    expect(result.uncoveredFiles.map((f) => f.file)).toEqual([
      "/src/a-module.ts",
      "/src/m-module.ts",
      "/src/z-module.ts",
    ]);
  });

  it("should sort covered files by lines coverage descending", () => {
    const data = {
      total: makeFileCoverage(50, 50, 50, 50),
      "/src/low.ts": makeFileCoverage(20, 10, 30, 20),
      "/src/high.ts": makeFileCoverage(95, 80, 100, 90),
      "/src/mid.ts": makeFileCoverage(60, 50, 70, 60),
    };

    const result = parseCoverageSummary(data);

    expect(result.coveredFiles.map((f) => f.file)).toEqual([
      "/src/high.ts",
      "/src/mid.ts",
      "/src/low.ts",
    ]);
  });

  it("should correctly count files excluding total", () => {
    const data = {
      total: makeFileCoverage(50, 50, 50, 50),
      "/src/a.ts": makeFileCoverage(100, 100, 100, 100),
      "/src/b.ts": makeFileCoverage(0, 0, 0, 0),
      "/src/c.ts": makeFileCoverage(50, 50, 50, 50),
    };

    const result = parseCoverageSummary(data);

    expect(result.fileCount).toBe(3);
    expect(result.coveredFiles).toHaveLength(2);
    expect(result.uncoveredFiles).toHaveLength(1);
  });

  it("should handle a realistic coverage report", () => {
    const data = {
      total: makeFileCoverage(41.07, 31.99, 46.64, 41.07),
      "/project/src/lib/search/bm25.ts": makeFileCoverage(100, 85, 100, 100),
      "/project/src/lib/search/tokenizer.ts": makeFileCoverage(92, 75, 100, 90),
      "/project/src/components/Button.tsx": makeFileCoverage(80, 60, 90, 78),
      "/project/src/lib/pipeline/reranker.ts": makeFileCoverage(0, 0, 0, 0),
      "/project/src/app/api/chat/route.ts": makeFileCoverage(0, 0, 0, 0),
    };

    const result = parseCoverageSummary(data);

    expect(result.total.statements).toBe(41.07);
    expect(result.fileCount).toBe(5);
    expect(result.coveredFiles).toHaveLength(3);
    expect(result.uncoveredFiles).toHaveLength(2);

    // Covered sorted by lines desc
    expect(result.coveredFiles[0].file).toBe("/project/src/lib/search/bm25.ts");
    expect(result.coveredFiles[2].file).toBe("/project/src/components/Button.tsx");

    // Uncovered sorted alphabetically
    expect(result.uncoveredFiles[0].file).toBe("/project/src/app/api/chat/route.ts");
    expect(result.uncoveredFiles[1].file).toBe("/project/src/lib/pipeline/reranker.ts");
  });
});
