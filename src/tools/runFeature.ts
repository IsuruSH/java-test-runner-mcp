import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBuildTool, getRunFeatureCommand } from "../utils/buildTool.js";
import { execute, formatResultCompact } from "../utils/executor.js";

export function registerRunFeatureTool(server: McpServer): void {
  server.registerTool(
    "run_feature",
    {
      title: "Run Cucumber Feature",
      description:
        "Run a Cucumber feature file by path and optional tag filter. Returns stdout/stderr, exit code, and elapsed time.",
      inputSchema: {
        projectPath: z.string().describe("Absolute path to the Java project root"),
        featurePath: z
          .string()
          .describe("Feature file path relative to project root (e.g. src/test/resources/myFeature/MyFeature.feature)"),
        tags: z
          .string()
          .optional()
          .describe("Cucumber tag expression (e.g. '@smoke and not @wip')"),
        javaHome: z
          .string()
          .optional()
          .describe("JAVA_HOME override (absolute path)"),
        timeout: z
          .number()
          .optional()
          .describe("Timeout in milliseconds (default 300000 = 5 min)"),
      },
    },
    async ({ projectPath, featurePath, tags, javaHome, timeout }) => {
      const buildInfo = detectBuildTool(projectPath);
      const command = getRunFeatureCommand(buildInfo, featurePath, tags);

      const env: Record<string, string> = {};
      if (javaHome) env["JAVA_HOME"] = javaHome;

      const result = await execute(command, {
        cwd: projectPath,
        env,
        timeoutMs: timeout,
      });
      const text = formatResultCompact(result, `Feature: ${featurePath}`, 80);

      return {
        content: [{ type: "text" as const, text }],
        isError: result.exitCode !== 0,
      };
    },
  );
}
