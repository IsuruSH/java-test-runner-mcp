import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBuildTool, getTestCommand, getTestReportDir } from "../utils/buildTool.js";
import { execute, formatResultCompact } from "../utils/executor.js";
import { parseTestReports } from "../utils/xmlParser.js";
import { resolveProjectPath, resolveJavaHome, resolveTimeout } from "../utils/env.js";

export function registerRunTestTool(server: McpServer): void {
  server.registerTool(
    "run_test",
    {
      title: "Run Test Class",
      description:
        "Run a specific test or runner class in a Maven/Gradle project. Returns a structured summary with test results. For failed tests, includes the full scenario output (API responses, DataTables, stack traces) so the agent can debug without reading external files.",
      inputSchema: {
        projectPath: z
          .string()
          .optional()
          .describe("Absolute path to the Java project root (falls back to PROJECT_PATH env var)"),
        testClass: z
          .string()
          .describe("Fully qualified class name (e.g. runner.WpandTaskStatusRemapping)"),
        javaHome: z
          .string()
          .optional()
          .describe("JAVA_HOME override (absolute path)"),
        jvmArgs: z
          .array(z.string())
          .optional()
          .describe("JVM arguments (e.g. ['-Xmx1g'])"),
        timeout: z
          .number()
          .optional()
          .describe("Timeout in milliseconds (default 300000 = 5 min)"),
      },
    },
    async ({ projectPath, testClass, javaHome, jvmArgs, timeout }) => {
      const resolvedPath = resolveProjectPath(projectPath);
      if (!resolvedPath) {
        return {
          content: [{ type: "text" as const, text: "Error: projectPath is required. Provide it as a parameter or set PROJECT_PATH env var." }],
          isError: true,
        };
      }

      const buildInfo = detectBuildTool(resolvedPath);
      const command = getTestCommand(buildInfo, testClass, jvmArgs);

      const env: Record<string, string> = {};
      const resolvedJavaHome = resolveJavaHome(javaHome);
      if (resolvedJavaHome) env["JAVA_HOME"] = resolvedJavaHome;

      const result = await execute(command, {
        cwd: resolvedPath,
        env,
        timeoutMs: resolveTimeout(timeout),
      });

      const logDir = join(resolvedPath, ".java-test-runner");
      mkdirSync(logDir, { recursive: true });
      writeFileSync(
        join(logDir, "last-run.log"),
        result.stdout + "\n---STDERR---\n" + result.stderr,
        "utf-8",
      );

      const reportDir = getTestReportDir(buildInfo, resolvedPath);
      const report = parseTestReports(reportDir);

      const sections: string[] = [];

      sections.push(`=== Run Test: ${testClass} ===`);
      sections.push(`Exit code: ${result.exitCode ?? "N/A"} | Elapsed: ${(result.elapsedMs / 1000).toFixed(1)}s`);
      if (result.timedOut) sections.push("*** TIMED OUT ***");
      sections.push("");

      if (report.tests.length > 0) {
        const s = report.summary;
        sections.push("--- Test Results ---");
        sections.push(
          `Total: ${s.total} | Passed: ${s.passed} | Failed: ${s.failed} | Errors: ${s.errors} | Skipped: ${s.skipped} | Time: ${s.totalTime.toFixed(1)}s`,
        );
        sections.push("");

        sections.push("--- All Scenarios ---");
        for (const t of report.tests) {
          const icon =
            t.status === "passed"
              ? "PASS"
              : t.status === "skipped"
                ? "SKIP"
                : "FAIL";
          sections.push(
            `  [${icon}] ${t.name} (${t.time.toFixed(2)}s)`,
          );
        }

        const failures = report.tests.filter(
          (t) => t.status === "failed" || t.status === "error",
        );

        if (failures.length > 0) {
          sections.push("");
          for (let i = 0; i < failures.length; i++) {
            const t = failures[i];
            sections.push(`--- Failure #${i + 1}: ${t.name} [${t.time.toFixed(2)}s] ---`);

            if (t.failure) {
              sections.push(t.failure.trim());
              sections.push("");
            }

            if (t.systemOut) {
              sections.push("Scenario output:");
              sections.push(t.systemOut.trim());
              sections.push("");
            }
          }
        }
      } else {
        sections.push(formatResultCompact(result, `Test: ${testClass}`, 80));
      }

      const text = sections.join("\n");

      return {
        content: [{ type: "text" as const, text }],
        isError: result.exitCode !== 0,
      };
    },
  );
}
