# java-test-runner-mcp

An MCP (Model Context Protocol) server that compiles and runs Java projects (Maven & Gradle), parses test results, and returns structured output. Built for AI-assisted development workflows in Cursor, Claude Desktop, and other MCP clients.

## Tools

| Tool | Description |
|---|---|
| `compile` | Compile a Maven or Gradle project |
| `run_test` | Run a specific test/runner class |
| `run_main_class` | Execute a class with a `main()` method |
| `run_feature` | Run a Cucumber feature file by path and tags |
| `list_runners` | Discover JUnit/Cucumber runner classes |
| `list_test_classes` | Find test classes by glob pattern |
| `get_test_results` | Parse Surefire/Gradle XML reports into structured JSON |
| `get_build_info` | Read project metadata from pom.xml or build.gradle |

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

Runs a specific test or runner class.

| Parameter | Required | Description |
|---|---|---|
| `projectPath` | Yes | Absolute path to project root |
| `testClass` | Yes | Fully qualified class name (e.g. `runner.MyRunner`) |
| `javaHome` | No | JAVA_HOME override |
| `jvmArgs` | No | JVM arguments (e.g. `["-Xmx1g"]`) |
| `timeout` | No | Timeout in ms (default 300000) |

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
