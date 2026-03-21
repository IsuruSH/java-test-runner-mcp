import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBuildTool, getRunFeatureCommand } from "../utils/buildTool.js";
import { execute, formatResultCompact } from "../utils/executor.js";
import { resolveProjectPath, resolveJavaHome, resolveTimeout } from "../utils/env.js";

export function registerRunFeatureTool(server: McpServer): void {
  server.registerTool(
    "run_feature",
    {
      title: "Run Cucumber Feature",
      description:
        "Run a Cucumber feature file by path and optional tag filter. Returns stdout/stderr, exit code, and elapsed time.",
      inputSchema: {
        projectPath: z
          .string()
          .optional()
          .describe("Absolute path to the Java project root (falls back to PROJECT_PATH env var)"),
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
      const resolvedPath = resolveProjectPath(projectPath);
      if (!resolvedPath) {
        return {
          content: [{ type: "text" as const, text: "Error: projectPath is required. Provide it as a parameter or set PROJECT_PATH env var." }],
          isError: true,
        };
      }

      const buildInfo = detectBuildTool(resolvedPath);
      const command = getRunFeatureCommand(buildInfo, featurePath, tags);

      const env: Record<string, string> = {};
      const resolvedJavaHome = resolveJavaHome(javaHome);
      if (resolvedJavaHome) env["JAVA_HOME"] = resolvedJavaHome;

      const result = await execute(command, {
        cwd: resolvedPath,
        env,
        timeoutMs: resolveTimeout(timeout),
      });
      const text = formatResultCompact(result, `Feature: ${featurePath}`, 80);

      return {
        content: [{ type: "text" as const, text }],
        isError: result.exitCode !== 0,
      };
    },
  );
}
