export interface EnvConfig {
  projectPath?: string;
  javaHome?: string;
  timeoutMs?: number;
  buildTool?: "maven" | "gradle";
  testBaseDir?: string;
  mavenProfiles?: string[];
}

let _cached: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (_cached) return _cached;

  const timeoutRaw = process.env["TIMEOUT_MS"];
  const timeoutMs = timeoutRaw ? parseInt(timeoutRaw, 10) : undefined;

  const buildToolRaw = process.env["BUILD_TOOL"]?.toLowerCase();
  const buildTool =
    buildToolRaw === "maven" || buildToolRaw === "gradle"
      ? buildToolRaw
      : undefined;

  const profilesRaw = process.env["MAVEN_PROFILES"];
  const mavenProfiles = profilesRaw
    ? profilesRaw.split(",").map((p) => p.trim()).filter(Boolean)
    : undefined;

  _cached = {
    projectPath: process.env["PROJECT_PATH"] || undefined,
    javaHome: process.env["JAVA_HOME"] || undefined,
    timeoutMs: timeoutMs && !Number.isNaN(timeoutMs) ? timeoutMs : undefined,
    buildTool,
    testBaseDir: process.env["TEST_BASE_DIR"] || undefined,
    mavenProfiles,
  };

  return _cached;
}

/**
 * Resolve projectPath: prefer tool parameter, fall back to env.
 * Returns undefined if neither is set (tool should report an error).
 */
export function resolveProjectPath(paramValue?: string): string | undefined {
  return paramValue || getEnvConfig().projectPath;
}

export function resolveJavaHome(paramValue?: string): string | undefined {
  return paramValue || getEnvConfig().javaHome;
}

export function resolveTimeout(paramValue?: number): number | undefined {
  return paramValue ?? getEnvConfig().timeoutMs;
}

export function resolveTestBaseDir(paramValue?: string): string {
  return paramValue || getEnvConfig().testBaseDir || "src/test/java";
}

export function resolveMavenProfiles(paramValue?: string[]): string[] | undefined {
  if (paramValue && paramValue.length > 0) return paramValue;
  return getEnvConfig().mavenProfiles;
}
