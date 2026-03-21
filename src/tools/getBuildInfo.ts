import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { detectBuildTool } from "../utils/buildTool.js";

interface BuildInfoResult {
  buildTool: string;
  groupId?: string;
  artifactId?: string;
  version?: string;
  javaVersion?: string;
  packaging?: string;
  name?: string;
}

export function registerGetBuildInfoTool(server: McpServer): void {
  server.registerTool(
    "get_build_info",
    {
      title: "Get Build Info",
      description:
        "Read project metadata from pom.xml or build.gradle. Returns build tool, groupId, artifactId, version, Java version, and packaging type.",
      inputSchema: {
        projectPath: z.string().describe("Absolute path to the Java project root"),
      },
    },
    async ({ projectPath }) => {
      const buildInfo = detectBuildTool(projectPath);
      let result: BuildInfoResult;

      if (buildInfo.type === "maven") {
        result = parseMavenPom(projectPath);
      } else {
        result = parseGradleBuild(projectPath);
      }

      const lines: string[] = [];
      lines.push(`Build tool: ${result.buildTool}`);
      if (result.groupId) lines.push(`Group ID: ${result.groupId}`);
      if (result.artifactId) lines.push(`Artifact ID: ${result.artifactId}`);
      if (result.version) lines.push(`Version: ${result.version}`);
      if (result.javaVersion) lines.push(`Java version: ${result.javaVersion}`);
      if (result.packaging) lines.push(`Packaging: ${result.packaging}`);
      if (result.name) lines.push(`Name: ${result.name}`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );
}

function parseMavenPom(projectPath: string): BuildInfoResult {
  const pomPath = join(projectPath, "pom.xml");
  if (!existsSync(pomPath)) {
    return { buildTool: "maven" };
  }

  const xml = readFileSync(pomPath, "utf-8");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const project = parsed.project ?? {};

  const properties = project.properties ?? {};
  const javaVersion =
    properties["maven.compiler.source"] ??
    properties["java.version"] ??
    properties["maven.compiler.release"];

  return {
    buildTool: "maven",
    groupId: project.groupId ?? project.parent?.groupId,
    artifactId: project.artifactId,
    version: project.version ?? project.parent?.version,
    javaVersion: javaVersion ? String(javaVersion) : undefined,
    packaging: project.packaging,
    name: project.name,
  };
}

function parseGradleBuild(projectPath: string): BuildInfoResult {
  const buildPath = join(projectPath, "build.gradle");
  const buildKtsPath = join(projectPath, "build.gradle.kts");
  const filePath = existsSync(buildKtsPath) ? buildKtsPath : buildPath;

  if (!existsSync(filePath)) {
    return { buildTool: "gradle" };
  }

  const content = readFileSync(filePath, "utf-8");

  const groupMatch = content.match(/group\s*=\s*['"]([^'"]+)['"]/);
  const versionMatch = content.match(/version\s*=\s*['"]([^'"]+)['"]/);
  const javaMatch =
    content.match(/sourceCompatibility\s*=\s*['"]?([^'"\s]+)/) ??
    content.match(/JavaVersion\.VERSION_(\d+)/);

  return {
    buildTool: "gradle",
    groupId: groupMatch?.[1],
    version: versionMatch?.[1],
    javaVersion: javaMatch?.[1],
  };
}
