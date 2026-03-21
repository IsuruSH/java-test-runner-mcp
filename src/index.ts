#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerCompileTool } from "./tools/compile.js";
import { registerRunTestTool } from "./tools/runTest.js";
import { registerRunMainClassTool } from "./tools/runMainClass.js";
import { registerRunFeatureTool } from "./tools/runFeature.js";
import { registerListRunnersTool } from "./tools/listRunners.js";
import { registerListTestClassesTool } from "./tools/listTestClasses.js";
import { registerGetTestResultsTool } from "./tools/getTestResults.js";
import { registerGetBuildInfoTool } from "./tools/getBuildInfo.js";
import { registerGetFullReportTool } from "./tools/getFullReport.js";

const server = new McpServer({
  name: "java-test-runner",
  version: "1.1.0",
});

registerCompileTool(server);
registerRunTestTool(server);
registerRunMainClassTool(server);
registerRunFeatureTool(server);
registerListRunnersTool(server);
registerListTestClassesTool(server);
registerGetTestResultsTool(server);
registerGetBuildInfoTool(server);
registerGetFullReportTool(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Java Test Runner MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
