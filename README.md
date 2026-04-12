# Brandon Code CLI

A terminal CLI tool for managing AI models and running an interactive agent with customizable branding and model switching capabilities.

## Features

- **Model Management**: Add, remove, list, and switch between AI models from multiple providers (Google Gemini, MiniMax, Ollama)
- **Interactive Agent**: Run a local REPL-style agent powered by Ollama with extended thinking support
- **Terminal Branding**: Display branded banners and themes in your terminal
- **Context Persistence**: Save and manage agent context across sessions
- **Provider Profiles**: Support for both local (Ollama) and cloud-based AI providers
- **Voice Integration**: Optional voice wake-word detection and interaction support

## Installation

### Prerequisites

- Node.js >= 20
- For Ollama support: [Ollama](https://ollama.ai) installed and running
- For voice features: Python 3

### Setup

```bash
npm install
npm run build
```

### Global CLI Registration

After building, register the CLI globally:

```bash
npm link
```

Then use the `brandon` command from anywhere:

```bash
brandon --help
```

## Usage

### Model Management

```bash
# List available models
brandon model list

# Show the currently active model
brandon model current

# Switch to a different model
brandon model switch <model-id>

# Add a custom model
brandon model add <id> --label "Display Name" [--provider <name>] [--mode local|cloud]

# Remove a custom model
brandon model remove <id>

# Hide a built-in model
brandon model remove <id> --force-default
```

### Agent REPL

Start the interactive agent (default when no subcommand provided):

```bash
brandon agent
```

Or explicitly:

```bash
brandon agent [options]
```

**Agent Options:**
- `--no-context-finish` - Skip context update proposal on exit
- `--planner-only` - Testing mode: run planner only, skip worker execution
- `--no-think` - Disable Ollama extended thinking
- `--activity-diagnostics` - Enable verbose pipeline diagnostics

### Context Management

```bash
# Propose updating agent context file
brandon context finish [note]

# With session logging
brandon context finish "Session summary" \
  --built "- Implemented feature X" \
  --changed "- Updated configuration" \
  --next "- Deploy changes"
```

### General Options

```bash
brandon --no-banner    # Skip startup banner
brandon --version      # Show version
brandon --help         # Show help
```

## Built-in Models

The CLI comes with these pre-configured models:

- **gemini-3-pro** (default) - Google Gemini 3 Pro (cloud)
- **minimax-m2.5** - MiniMax M2.5 (cloud)
- **minimax-m2.7** - MiniMax M2.7 (cloud)
- **ollama/qwen2.5-coder:14b** - Ollama Qwen2.5 Coder 14B (local)
- **ollama/qwen2.5-coder:7b** - Ollama Qwen2.5 Coder 7B (local)
- **ollama/glm-4.7:cloud** - Ollama GLM 4.7 (cloud)

## Development

### Build

```bash
npm run build
```

### Development Mode

Run with hot-reload using tsx:

```bash
npm run dev
```

### Testing

```bash
npm test
```

### Voice Features (Development)

```bash
# Standard wake-word listening
npm run voice:wake

# Verbose output
npm run voice:wake:verbose

# Sensitive mode (more responsive)
npm run voice:wake:sensitive
```

## Project Structure

```
src/
├── agent/          # Agent logic (planner, worker, tools, streaming)
├── cli/            # CLI entry points and utilities
├── commands/       # CLI command implementations
├── config/         # Configuration, model registry, settings
├── context/        # Context loading and updating
├── ui/             # Terminal UI (banners, themes)
├── types.ts        # Shared TypeScript types
└── index.ts        # Main CLI entry point
```

## Configuration

Configuration is stored using the `conf` package and persists in the OS-specific config directory.

### Provider Profiles

Configure different AI provider profiles and their connection settings.

### Observability Settings

Enable detailed logging and diagnostics for troubleshooting.

## Technology Stack

- **TypeScript** - Type-safe development
- **Commander.js** - CLI framework
- **Ollama SDK** - AI model integration
- **Chalk** - Terminal styling
- **Figlet** - ASCII art banners
- **Vitest** - Testing framework
- **tsx** - TypeScript execution

## License

ISC
