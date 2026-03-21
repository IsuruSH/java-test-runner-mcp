import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectBuildTool, getCompileCommand } from "../utils/buildTool.js";
import { execute, formatResultCompact } from "../utils/executor.js";

export function registerCompileTool(server: McpServer): void {
  server.registerTool(
    "compile",
    {
      title: "Compile Java Project",
      description:
        "Compile a Maven or Gradle Java project. Auto-detects the build tool from the project root. Returns stdout/stderr, exit code, and elapsed time.",
      inputSchema: {
        projectPath: z.string().describe("Absolute path to the Java project root"),
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
      const buildInfo = detectBuildTool(projectPath);
      const command = getCompileCommand(buildInfo, profiles);
      if (args) command.push(...args);

      const env: Record<string, string> = {};
      if (javaHome) env["JAVA_HOME"] = javaHome;

      const result = await execute(command, { cwd: projectPath, env });
      const text = formatResultCompact(result, `Compile (${buildInfo.type})`, 40);

      return {
        content: [{ type: "text" as const, text }],
        isError: result.exitCode !== 0,
      };
    },
  );
}
