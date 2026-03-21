import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBuildTool, getTestReportDir } from "../utils/buildTool.js";
import { parseTestReports, type TestReport } from "../utils/xmlParser.js";

export function registerGetTestResultsTool(server: McpServer): void {
  server.registerTool(
    "get_test_results",
    {
      title: "Get Test Results",
      description:
        "Parse Surefire/Gradle XML test reports and return structured results with per-test metrics (name, class, time, status, failure message).",
      inputSchema: {
        projectPath: z.string().describe("Absolute path to the Java project root"),
        reportDir: z
          .string()
          .optional()
          .describe(
            "Custom report directory (absolute or relative). Defaults to target/surefire-reports (Maven) or build/test-results/test (Gradle).",
          ),
      },
      outputSchema: z.object({
        summary: z.object({
          total: z.number(),
          passed: z.number(),
          failed: z.number(),
          errors: z.number(),
          skipped: z.number(),
          totalTime: z.number(),
        }),
        tests: z.array(
          z.object({
            name: z.string(),
            className: z.string(),
            time: z.number(),
            status: z.string(),
            failure: z.string().optional(),
          }),
        ),
      }),
    },
    async ({ projectPath, reportDir }) => {
      const buildInfo = detectBuildTool(projectPath);
      const dir = reportDir ?? getTestReportDir(buildInfo, projectPath);
      const report: TestReport = parseTestReports(dir);

      const textSummary = formatTextSummary(report);

      return {
        content: [{ type: "text" as const, text: textSummary }],
        structuredContent: JSON.parse(JSON.stringify(report)) as Record<string, unknown>,
      };
    },
  );
}

function formatTextSummary(report: TestReport): string {
  const { summary, tests } = report;
  const lines: string[] = [];

  lines.push("=== Test Results ===");
  lines.push(
    `Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Errors: ${summary.errors} | Skipped: ${summary.skipped}`,
  );
  lines.push(`Total time: ${summary.totalTime.toFixed(2)}s`);
  lines.push("");

  const failures = tests.filter((t) => t.status === "failed" || t.status === "error");
  if (failures.length > 0) {
    lines.push("--- Failures ---");
    for (const t of failures) {
      lines.push(`  ${t.className}.${t.name} [${t.time.toFixed(2)}s] - ${t.status.toUpperCase()}`);
      if (t.failure) {
        lines.push(`    ${t.failure.split("\n")[0]}`);
      }
    }
    lines.push("");
  }

  if (tests.length <= 50) {
    lines.push("--- All Tests ---");
    for (const t of tests) {
      const icon = t.status === "passed" ? "PASS" : t.status === "skipped" ? "SKIP" : "FAIL";
      lines.push(`  [${icon}] ${t.className}.${t.name} (${t.time.toFixed(2)}s)`);
    }
  } else {
    lines.push(`(${tests.length} tests total -- showing failures only)`);
  }

  return lines.join("\n");
}
