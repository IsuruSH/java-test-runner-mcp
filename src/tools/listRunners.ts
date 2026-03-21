import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { glob } from "glob";
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export function registerListRunnersTool(server: McpServer): void {
  server.registerTool(
    "list_runners",
    {
      title: "List Test Runners",
      description:
        "Discover Cucumber/JUnit runner classes in a Java project by scanning for @Suite, @RunWith, @SelectPackages annotations.",
      inputSchema: {
        projectPath: z.string().describe("Absolute path to the Java project root"),
        baseDir: z
          .string()
          .optional()
          .describe("Directory to scan relative to project root (default 'src/test/java')"),
      },
    },
    async ({ projectPath, baseDir }) => {
      const scanDir = join(projectPath, baseDir ?? "src/test/java");
      const pattern = "**/*.java";
      const files = await glob(pattern, { cwd: scanDir, absolute: true });

      const runners: Array<{ path: string; fqcn: string }> = [];

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const isRunner =
          content.includes("@Suite") ||
          content.includes("@RunWith") ||
          content.includes("@SelectPackages") ||
          content.includes("@SelectClasspathResource") ||
          content.includes("@CucumberOptions");

        if (isRunner) {
          const relPath = relative(scanDir, file);
          const fqcn = relPath
            .replace(/\.java$/, "")
            .split(sep)
            .join(".");
          runners.push({ path: relative(projectPath, file), fqcn });
        }
      }

      if (runners.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No runner classes found." }],
        };
      }

      const lines = runners.map((r) => `${r.fqcn}  (${r.path})`);
      const text = `Found ${runners.length} runner(s):\n\n${lines.join("\n")}`;

      return { content: [{ type: "text" as const, text }] };
    },
  );
}
