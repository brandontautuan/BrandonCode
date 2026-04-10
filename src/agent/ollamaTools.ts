import type { Tool } from "ollama";

/** Tool definitions passed to Ollama `chat` (OpenAI-style function tools). */
export const AGENT_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file. Path is relative to cwd unless absolute.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string", description: "File path" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write or overwrite a file (user must confirm in terminal).",
      parameters: {
        type: "object",
        required: ["path", "content"],
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_bash",
      description:
        "Run a shell command (user must confirm). Streams stdout/stderr to the terminal.",
      parameters: {
        type: "object",
        required: ["command"],
        properties: {
          command: { type: "string", description: "Shell command string" },
        },
      },
    },
  },
];
