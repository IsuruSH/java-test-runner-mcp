import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBuildTool, getRunMainClassCommand } from "../utils/buildTool.js";
import { execute, formatResultCompact } from "../utils/executor.js";
import { resolveProjectPath, resolveJavaHome, resolveTimeout } from "../utils/env.js";

export function registerRunMainClassTool(server: McpServer): void {
  server.registerTool(
    "run_main_class",
    {
      title: "Run Main Class",
      description:
        "Execute a Java class with a main() method via Maven exec:java or Gradle run. Returns stdout/stderr, exit code, and elapsed time.",
      inputSchema: {
        projectPath: z
          .string()
          .optional()
          .describe("Absolute path to the Java project root (falls back to PROJECT_PATH env var)"),
        mainClass: z
          .string()
          .describe("Fully qualified class name (e.g. smoke.ContractRuleSmokeTest)"),
        classpathScope: z
          .string()
          .optional()
          .describe("Maven classpath scope: compile, test, runtime (default 'test')"),
        javaHome: z
          .string()
          .optional()
          .describe("JAVA_HOME override (absolute path)"),
        args: z
          .array(z.string())
          .optional()
          .describe("Program arguments passed to the main method"),
        timeout: z
          .number()
          .optional()
          .describe("Timeout in milliseconds (default 300000 = 5 min)"),
      },
    },
    async ({ projectPath, mainClass, classpathScope, javaHome, args, timeout }) => {
      const resolvedPath = resolveProjectPath(projectPath);
      if (!resolvedPath) {
        return {
          content: [{ type: "text" as const, text: "Error: projectPath is required. Provide it as a parameter or set PROJECT_PATH env var." }],
          isError: true,
        };
      }

      const buildInfo = detectBuildTool(resolvedPath);
      const command = getRunMainClassCommand(
        buildInfo,
        mainClass,
        classpathScope ?? "test",
        args,
      );

      const env: Record<string, string> = {};
      const resolvedJavaHome = resolveJavaHome(javaHome);
      if (resolvedJavaHome) env["JAVA_HOME"] = resolvedJavaHome;

      const result = await execute(command, {
        cwd: resolvedPath,
        env,
        timeoutMs: resolveTimeout(timeout),
      });
      const text = formatResultCompact(result, `Main: ${mainClass}`, 80);

      return {
        content: [{ type: "text" as const, text }],
        isError: result.exitCode !== 0,
      };
    },
  );
}
