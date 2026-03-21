import { existsSync } from "node:fs";
import { join } from "node:path";

export type BuildToolType = "maven" | "gradle";

export interface BuildToolInfo {
  type: BuildToolType;
  executable: string;
  wrapperPath: string | null;
}

/**
 * Detects whether a project uses Maven or Gradle by checking for
 * wrapper scripts and build files. Prefers wrappers over system-installed commands.
 */
export function detectBuildTool(projectPath: string): BuildToolInfo {
  const isWindows = process.platform === "win32";

  const mvnWrapper = join(projectPath, isWindows ? "mvnw.cmd" : "mvnw");
  const gradleWrapper = join(projectPath, isWindows ? "gradlew.bat" : "gradlew");
  const pomXml = join(projectPath, "pom.xml");
  const buildGradle = join(projectPath, "build.gradle");
  const buildGradleKts = join(projectPath, "build.gradle.kts");

  if (existsSync(pomXml)) {
    const wrapperExists = existsSync(mvnWrapper);
    return {
      type: "maven",
      executable: wrapperExists ? mvnWrapper : "mvn",
      wrapperPath: wrapperExists ? mvnWrapper : null,
    };
  }

  if (existsSync(buildGradle) || existsSync(buildGradleKts)) {
    const wrapperExists = existsSync(gradleWrapper);
    return {
      type: "gradle",
      executable: wrapperExists ? gradleWrapper : "gradle",
      wrapperPath: wrapperExists ? gradleWrapper : null,
    };
  }

  return {
    type: "maven",
    executable: "mvn",
    wrapperPath: null,
  };
}

export function getCompileCommand(info: BuildToolInfo, profiles?: string[]): string[] {
  if (info.type === "maven") {
    const cmd = [info.executable, "compile", "-q"];
    if (profiles && profiles.length > 0) {
      cmd.push(`-P${profiles.join(",")}`);
    }
    return cmd;
  }
  return [info.executable, "compileJava", "-q"];
}

export function getTestCommand(
  info: BuildToolInfo,
  testClass: string,
  jvmArgs?: string[],
): string[] {
  if (info.type === "maven") {
    const cmd = [info.executable, "test", `-Dtest=${testClass}`];
    if (jvmArgs && jvmArgs.length > 0) {
      cmd.push(`-DargLine=${jvmArgs.join(" ")}`);
    }
    return cmd;
  }
  const cmd = [info.executable, "test", `--tests`, testClass];
  if (jvmArgs && jvmArgs.length > 0) {
    for (const arg of jvmArgs) {
      cmd.push(`-Dorg.gradle.jvmargs=${arg}`);
    }
  }
  return cmd;
}

export function getRunMainClassCommand(
  info: BuildToolInfo,
  mainClass: string,
  classpathScope: string = "test",
  args?: string[],
): string[] {
  if (info.type === "maven") {
    const cmd = [
      info.executable,
      `exec:java`,
      `-Dexec.mainClass=${mainClass}`,
      `-Dexec.classpathScope=${classpathScope}`,
    ];
    if (args && args.length > 0) {
      cmd.push(`-Dexec.args=${args.join(" ")}`);
    }
    return cmd;
  }
  const cmd = [info.executable, "run", `--args=${args?.join(" ") ?? ""}`];
  return cmd;
}

export function getRunFeatureCommand(
  info: BuildToolInfo,
  featurePath: string,
  tags?: string,
): string[] {
  if (info.type === "maven") {
    const cmd = [
      info.executable,
      "test",
      `-Dcucumber.features=${featurePath}`,
    ];
    if (tags) {
      cmd.push(`-Dcucumber.filter.tags=${tags}`);
    }
    return cmd;
  }
  const cmd = [info.executable, "test", `-Dcucumber.features=${featurePath}`];
  if (tags) {
    cmd.push(`-Dcucumber.filter.tags=${tags}`);
  }
  return cmd;
}

export function getTestReportDir(info: BuildToolInfo, projectPath: string): string {
  if (info.type === "maven") {
    return join(projectPath, "target", "surefire-reports");
  }
  return join(projectPath, "build", "test-results", "test");
}
