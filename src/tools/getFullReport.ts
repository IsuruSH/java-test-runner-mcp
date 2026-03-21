import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBuildTool, getTestReportDir } from "../utils/buildTool.js";
import { getScenarioOutput } from "../utils/xmlParser.js";

export function registerGetFullReportTool(server: McpServer): void {
  server.registerTool(
    "get_full_report",
    {
      title: "Get Full Report",
      description:
        "Deep-dive fallback when the compact run_test summary is insufficient. " +
        'Use source="scenario" to retrieve the complete, uncapped Cucumber step log (API requests/responses, DataTables, stack traces) for a specific scenario or all failed scenarios. ' +
        'Use source="build_log" to retrieve the full Maven/Gradle console output from the most recent run_test execution.',
      inputSchema: {
        projectPath: z.string().describe("Absolute path to the Java project root"),
        source: z
          .enum(["scenario", "build_log"])
          .default("scenario")
          .describe('What to retrieve: "scenario" for Surefire XML per-test output, "build_log" for the full Maven/Gradle console log'),
        scenarioName: z
          .string()
          .optional()
          .describe("Scenario name substring to match (case-insensitive). If omitted with source=scenario, returns all failed/errored scenarios."),
        maxLines: z
          .number()
          .optional()
          .describe("Max lines to return for build_log mode (default 500, 0 = unlimited). Ignored for scenario mode."),
      },
    },
    async ({ projectPath, source, scenarioName, maxLines }) => {
      if (source === "build_log") {
        return buildLogMode(projectPath, maxLines ?? 500);
      }
      return scenarioMode(projectPath, scenarioName);
    },
  );
}

function scenarioMode(
  projectPath: string,
  scenarioName?: string,
): { content: { type: "text"; text: string }[]; isError: boolean } {
  const buildInfo = detectBuildTool(projectPath);
  const reportDir = getTestReportDir(buildInfo, projectPath);
  const scenarios = getScenarioOutput(reportDir, scenarioName);

  if (scenarios.length === 0) {
    const detail = scenarioName
      ? `No scenario matching "${scenarioName}" found (or it has no system-out).`
      : "No failed/errored scenarios with system-out found.";
    return {
      content: [{ type: "text" as const, text: `=== Full Report: scenario ===\n${detail}` }],
      isError: false,
    };
  }

  const sections: string[] = [];
  sections.push(`=== Full Report: scenario (${scenarios.length} match${scenarios.length > 1 ? "es" : ""}) ===`);
  sections.push("");

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    sections.push(`--- [${s.status.toUpperCase()}] ${s.name} (${s.className}) ---`);
    sections.push(s.systemOut.trim());
    sections.push("");
  }

  return {
    content: [{ type: "text" as const, text: sections.join("\n") }],
    isError: false,
  };
}

function buildLogMode(
  projectPath: string,
  maxLines: number,
): { content: { type: "text"; text: string }[]; isError: boolean } {
  const logPath = join(projectPath, ".java-test-runner", "last-run.log");

  if (!existsSync(logPath)) {
    return {
      content: [
        {
          type: "text" as const,
          text: "=== Full Report: build_log ===\nNo last-run.log found. Run run_test first to generate the build log.",
        },
      ],
      isError: true,
    };
  }

  let log = readFileSync(logPath, "utf-8");
  const totalLines = log.split("\n").length;

  if (maxLines > 0) {
    const lines = log.split("\n");
    if (lines.length > maxLines) {
      const skipped = lines.length - maxLines;
      log = `... [${skipped} lines skipped, showing last ${maxLines}] ...\n` + lines.slice(-maxLines).join("\n");
    }
  }

  const header = `=== Full Report: build_log (${totalLines} lines) ===\n`;
  return {
    content: [{ type: "text" as const, text: header + log }],
    isError: false,
  };
}
