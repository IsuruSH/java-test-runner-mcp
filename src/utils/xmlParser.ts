import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";

export interface TestCase {
  name: string;
  className: string;
  time: number;
  status: "passed" | "failed" | "error" | "skipped";
  failure?: string;
  /** Per-scenario Cucumber output from Surefire <system-out>, only populated for failed/errored tests */
  systemOut?: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  totalTime: number;
}

export interface TestReport {
  summary: TestSuiteSummary;
  tests: TestCase[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "testcase",
});

/**
 * Parse all TEST-*.xml files from a Surefire/Gradle report directory
 * and produce a unified TestReport.
 */
export function parseTestReports(reportDir: string): TestReport {
  if (!existsSync(reportDir)) {
    return { summary: emptySummary(), tests: [] };
  }

  const xmlFiles = readdirSync(reportDir).filter(
    (f) => f.startsWith("TEST-") && f.endsWith(".xml"),
  );

  if (xmlFiles.length === 0) {
    return { summary: emptySummary(), tests: [] };
  }

  const allTests: TestCase[] = [];
  const summary: TestSuiteSummary = emptySummary();

  for (const file of xmlFiles) {
    const xml = readFileSync(join(reportDir, file), "utf-8");
    const parsed = parser.parse(xml);
    const suite = parsed.testsuite;
    if (!suite) continue;

    summary.total += toInt(suite["@_tests"]);
    summary.failed += toInt(suite["@_failures"]);
    summary.errors += toInt(suite["@_errors"]);
    summary.skipped += toInt(suite["@_skipped"]);
    summary.totalTime += toFloat(suite["@_time"]);

    const testcases: unknown[] = suite.testcase ?? [];
    for (const tc of testcases) {
      const testCase = tc as Record<string, unknown>;
      const name = String(testCase["@_name"] ?? "unknown");
      const className = String(testCase["@_classname"] ?? "unknown");
      const time = toFloat(testCase["@_time"]);

      let status: TestCase["status"] = "passed";
      let failure: string | undefined;

      if (testCase["failure"]) {
        status = "failed";
        failure = extractMessage(testCase["failure"]);
      } else if (testCase["error"]) {
        status = "error";
        failure = extractMessage(testCase["error"]);
      } else if (testCase["skipped"] !== undefined) {
        status = "skipped";
      }

      let systemOut: string | undefined;
      if (status === "failed" || status === "error") {
        const rawOut = testCase["system-out"];
        if (rawOut) {
          systemOut = stripAnsi(String(rawOut)).slice(0, 4000);
        }
      }

      allTests.push({ name, className, time, status, failure, systemOut });
    }
  }

  summary.passed = summary.total - summary.failed - summary.errors - summary.skipped;

  return { summary, tests: allTests };
}

function emptySummary(): TestSuiteSummary {
  return { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0, totalTime: 0 };
}

function toInt(val: unknown): number {
  const n = Number(val);
  return Number.isNaN(n) ? 0 : Math.floor(n);
}

function toFloat(val: unknown): number {
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}

function extractMessage(node: unknown): string {
  if (typeof node === "string") return node;
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const cdata = obj["#text"];
    if (cdata) return String(cdata).slice(0, 2000);
    const msg = obj["@_message"] ?? "";
    return String(msg).slice(0, 2000);
  }
  return "";
}

export interface ScenarioOutput {
  name: string;
  className: string;
  status: string;
  systemOut: string;
}

/**
 * Return full, uncapped <system-out> for matching test cases.
 * If scenarioName is provided, matches any test whose name contains
 * that substring (case-insensitive). Otherwise returns all failed/errored tests.
 */
export function getScenarioOutput(
  reportDir: string,
  scenarioName?: string,
): ScenarioOutput[] {
  if (!existsSync(reportDir)) return [];

  const xmlFiles = readdirSync(reportDir).filter(
    (f) => f.startsWith("TEST-") && f.endsWith(".xml"),
  );

  const results: ScenarioOutput[] = [];
  const needle = scenarioName?.toLowerCase();

  for (const file of xmlFiles) {
    const xml = readFileSync(join(reportDir, file), "utf-8");
    const parsed = parser.parse(xml);
    const suite = parsed.testsuite;
    if (!suite) continue;

    const testcases: unknown[] = suite.testcase ?? [];
    for (const tc of testcases) {
      const testCase = tc as Record<string, unknown>;
      const name = String(testCase["@_name"] ?? "unknown");
      const className = String(testCase["@_classname"] ?? "unknown");

      let status: string = "passed";
      if (testCase["failure"]) status = "failed";
      else if (testCase["error"]) status = "error";
      else if (testCase["skipped"] !== undefined) status = "skipped";

      const rawOut = testCase["system-out"];
      if (!rawOut) continue;

      const match = needle
        ? name.toLowerCase().includes(needle)
        : status === "failed" || status === "error";
      if (!match) continue;

      results.push({
        name,
        className,
        status,
        systemOut: stripAnsi(String(rawOut)),
      });
    }
  }

  return results;
}

/** Strip ANSI escape codes and HTML-encoded ANSI from Surefire output */
function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/&#27;\[[0-9;]*m/g, "")
    .replace(/&amp#27;\[[0-9;]*m/g, "");
}
