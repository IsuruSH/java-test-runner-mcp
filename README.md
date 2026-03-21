# java-test-runner-mcp

An MCP (Model Context Protocol) server that compiles and runs Java projects (Maven & Gradle), parses test results, and returns structured output. Built for AI-assisted development workflows in Cursor, Claude Desktop, and other MCP clients.

## Tools

| Tool | Description |
|---|---|
| `compile` | Compile a Maven or Gradle project |
| `run_test` | Run a specific test/runner class and get a compact debug summary |
| `get_full_report` | Deep-dive fallback: full scenario logs or full build output |
| `run_main_class` | Execute a class with a `main()` method |
| `run_feature` | Run a Cucumber feature file by path and tags |
| `list_runners` | Discover JUnit/Cucumber runner classes |
| `list_test_classes` | Find test classes by glob pattern |
| `get_test_results` | Parse Surefire/Gradle XML reports into structured JSON |
| `get_build_info` | Read project metadata from pom.xml or build.gradle |

## Recommended Agent Workflow

```
1. compile          -- verify the project builds cleanly
2. run_test         -- execute the test; get a compact summary with
                       pass/fail per scenario and capped failure output
3. get_full_report  -- if the compact summary isn't enough:
      source=scenario   -> full uncapped Cucumber step log for a scenario
      source=build_log  -> full Maven/Gradle console output
4. Fix the code, then go back to step 1.
```

## Installation

### Using npx (recommended for Cursor)

No installation needed. Add to your Cursor MCP configuration:

**Project-level** (`.cursor/mcp.json` in your repo):

```json
{
  "mcpServers": {
    "java-test-runner": {
      "command": "npx",
      "args": ["-y", "java-test-runner-mcp"]
    }
  }
}
```

**User-level** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "java-test-runner": {
      "command": "npx",
      "args": ["-y", "java-test-runner-mcp"]
    }
  }
}
```

### Local development server

If you've cloned and built this repo locally, point directly to the built entry point:

```json
{
  "mcpServers": {
    "java-test-runner": {
      "command": "node",
      "args": ["C:\\Repos\\java-test-runner-mcp\\build\\index.js"]
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or `%AppData%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "java-test-runner": {
      "command": "npx",
      "args": ["-y", "java-test-runner-mcp"]
    }
  }
}
```

### Global install

```bash
npm install -g java-test-runner-mcp
```

## Usage Examples

Once configured, the AI agent can use these tools automatically. Here are example interactions:

**Compile a project:**
> "Compile my Java project at C:\Repos\my-app"

**Run a test runner:**
> "Run the WpandTaskStatusRemapping test runner"

**Debug a failure after run_test gives a compact summary:**
> "Get the full scenario output for the failed test"

**Get the full Maven build log:**
> "Show me the full build log from the last run"

**Get test results with metrics:**
> "Show me the test results with execution times"

**List all runners:**
> "What test runners are available in this project?"

## Tool Details

### compile

Compiles a Maven or Gradle project. Auto-detects the build tool from the project root.

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to the Java project root |
| `javaHome` | No | JAVA_HOME override |
| `profiles` | No | Maven profiles to activate |
| `args` | No | Extra CLI arguments |

### run_test

Runs a specific test or runner class. Returns a compact, agent-friendly summary:
- Pass/fail status per scenario with execution times
- For **failed** scenarios: the assertion message plus the first 4000 chars of the Cucumber step log (API requests/responses, DataTables, stack traces)
- The full build output is persisted to `<projectPath>/.java-test-runner/last-run.log` for retrieval via `get_full_report`

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to project root |
| `testClass` | Yes | Fully qualified class name (e.g. `runner.MyRunner`) |
| `javaHome` | No | JAVA_HOME override |
| `jvmArgs` | No | JVM arguments (e.g. `["-Xmx1g"]`) |
| `timeout` | No | Timeout in ms (default 300000) |

**Example output:**

```
=== Run Test: runner.WpandTaskStatusRemapping ===
Exit code: 1 | Elapsed: 343.0s

--- Test Results ---
Total: 9 | Passed: 8 | Failed: 1 | Errors: 0 | Skipped: 0 | Time: 316.5s

--- All Scenarios ---
  [FAIL] Create HM Contract with contract rule (5.59s)
  [PASS] Create WP1 with ad hoc task (126.82s)
  [PASS] Create customer order for WP1 (3.53s)
  ...

--- Failure #1: Create HM Contract with contract rule [5.59s] ---
java.lang.AssertionError: Create contract rule failed with status 500

Scenario output:
@api @PreRequisite
Scenario: Create HM Contract with contract rule  # feature:9
  Given User creates HM contract ...
    | Company | ContractId | ...
  {"error":{"code":"DB_OBJECT_EXIST","message":"Resource already in use."}}
```

### get_full_report

Deep-dive fallback when the compact `run_test` summary is insufficient to diagnose a failure. Supports two modes:

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to project root |
| `source` | No | `"scenario"` (default) or `"build_log"` |
| `scenarioName` | No | Scenario name substring to match (case-insensitive). If omitted with `source=scenario`, returns all failed/errored scenarios. |
| `maxLines` | No | Max lines for build_log mode (default 500, 0 = unlimited) |

**source=scenario** -- Returns the full, uncapped `<system-out>` from Surefire XML for matching scenarios. Contains the complete Cucumber step log including API request/response JSON, DataTables, and full stack traces.

- With `scenarioName`: fuzzy substring match returns output for any matching scenario (even passing ones).
- Without `scenarioName`: returns all failed/errored scenarios.

**source=build_log** -- Returns the full Maven/Gradle console output from the most recent `run_test` execution (saved to `.java-test-runner/last-run.log`). Useful for diagnosing compilation errors, dependency issues, or plugin failures.

### run_main_class

Executes a Java class with a `main()` method.

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to project root |
| `mainClass` | Yes | Fully qualified class name (e.g. `smoke.MySmokeTest`) |
| `classpathScope` | No | Maven scope: compile, test, runtime (default `test`) |
| `javaHome` | No | JAVA_HOME override |
| `args` | No | Program arguments |
| `timeout` | No | Timeout in ms (default 300000) |

### run_feature

Runs a Cucumber feature file.

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to project root |
| `featurePath` | Yes | Feature file path relative to project root |
| `tags` | No | Cucumber tag expression |
| `javaHome` | No | JAVA_HOME override |
| `timeout` | No | Timeout in ms (default 300000) |

### get_test_results

Parses Surefire/Gradle XML test reports and returns structured results.

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to project root |
| `reportDir` | No | Custom report directory (defaults to surefire-reports) |

Returns structured JSON:

```json
{
  "summary": {
    "total": 9,
    "passed": 9,
    "failed": 0,
    "errors": 0,
    "skipped": 0,
    "totalTime": 324.79
  },
  "tests": [
    {
      "name": "Create HM Contract with contract rule",
      "className": "WP and Task Status Remapping",
      "time": 6.66,
      "status": "passed"
    }
  ]
}
```

### get_build_info

Reads project metadata from pom.xml or build.gradle.

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to project root |

### list_runners / list_test_classes

Discovery tools for finding runner and test classes.

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to project root |
| `pattern` | No | Glob pattern (list_test_classes only) |
| `baseDir` | No | Scan directory relative to project root |

## Requirements

- Node.js >= 18
- Java project with Maven (`pom.xml`) or Gradle (`build.gradle` / `build.gradle.kts`)
- Maven or Gradle installed and available on PATH (or project includes wrapper scripts)

## Development

```bash
# Clone the repo
git clone <repo-url>
cd java-test-runner-mcp

# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev
```

## Publishing

```bash
# Build and publish to npm
pnpm build
pnpm publish --access public
```

## License

MIT
