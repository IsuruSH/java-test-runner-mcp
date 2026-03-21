import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { glob } from "glob";
import { join, relative, sep } from "node:path";
import { resolveProjectPath, resolveTestBaseDir } from "../utils/env.js";

export function registerListTestClassesTool(server: McpServer): void {
  server.registerTool(
    "list_test_classes",
    {
      title: "List Test Classes",
      description:
        "Discover test classes in a Java project by glob pattern. Returns file paths and fully qualified class names.",
      inputSchema: {
        projectPath: z
          .string()
          .optional()
          .describe("Absolute path to the Java project root (falls back to PROJECT_PATH env var)"),
        pattern: z
          .string()
          .optional()
          .describe("Glob pattern for test files (default '**/*Test*.java')"),
        baseDir: z
          .string()
          .optional()
          .describe("Directory to scan relative to project root (default 'src/test/java')"),
      },
    },
    async ({ projectPath, pattern, baseDir }) => {
      const resolvedPath = resolveProjectPath(projectPath);
      if (!resolvedPath) {
        return {
          content: [{ type: "text" as const, text: "Error: projectPath is required. Provide it as a parameter or set PROJECT_PATH env var." }],
          isError: true,
        };
      }

      const resolvedBaseDir = resolveTestBaseDir(baseDir);
      const scanDir = join(resolvedPath, resolvedBaseDir);
      const globPattern = pattern ?? "**/*Test*.java";
      const files = await glob(globPattern, { cwd: scanDir, absolute: false });

      if (files.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No test classes found matching '${globPattern}' in ${relative(resolvedPath, scanDir) || "."}`,
            },
          ],
        };
      }

      const entries = files.map((f) => {
        const fqcn = f
          .replace(/\.java$/, "")
          .split(/[/\\]/)
          .join(".");
        return { path: join(resolvedBaseDir, f), fqcn };
      });

      const lines = entries.map((e) => `${e.fqcn}  (${e.path})`);
      const text = `Found ${entries.length} test class(es):\n\n${lines.join("\n")}`;

      return { content: [{ type: "text" as const, text }] };
    },
  );
}
