import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBuildTool, getCompileCommand } from "../utils/buildTool.js";
import { execute, formatResultCompact } from "../utils/executor.js";
import { resolveProjectPath, resolveJavaHome, resolveTimeout, resolveMavenProfiles } from "../utils/env.js";

export function registerCompileTool(server: McpServer): void {
  server.registerTool(
    "compile",
    {
      title: "Compile Java Project",
      description:
        "Compile a Maven or Gradle Java project. Auto-detects the build tool from the project root. Returns stdout/stderr, exit code, and elapsed time.",
      inputSchema: {
        projectPath: z
          .string()
          .optional()
          .describe("Absolute path to the Java project root (falls back to PROJECT_PATH env var)"),
        javaHome: z
          .string()
          .optional()
          .describe("JAVA_HOME override (absolute path)"),
        profiles: z
          .array(z.string())
          .optional()
          .describe("Maven profiles to activate (e.g. ['dev','ci'])"),
        args: z
          .array(z.string())
          .optional()
          .describe("Extra CLI arguments appended to the build command"),
      },
    },
    async ({ projectPath, javaHome, profiles, args }) => {
      const resolvedPath = resolveProjectPath(projectPath);
      if (!resolvedPath) {
        return {
          content: [{ type: "text" as const, text: "Error: projectPath is required. Provide it as a parameter or set PROJECT_PATH env var." }],
          isError: true,
        };
      }

      const buildInfo = detectBuildTool(resolvedPath);
      const resolvedProfiles = resolveMavenProfiles(profiles);
      const command = getCompileCommand(buildInfo, resolvedProfiles);
      if (args) command.push(...args);

      const env: Record<string, string> = {};
      const resolvedJavaHome = resolveJavaHome(javaHome);
      if (resolvedJavaHome) env["JAVA_HOME"] = resolvedJavaHome;

      const result = await execute(command, {
        cwd: resolvedPath,
        env,
        timeoutMs: resolveTimeout(),
      });
      const text = formatResultCompact(result, `Compile (${buildInfo.type})`, 40);

      return {
        content: [{ type: "text" as const, text }],
        isError: result.exitCode !== 0,
      };
    },
  );
}
