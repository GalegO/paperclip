import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export default {
  id: "governance-harness",
  displayName: "Governance File Harness",
  description: "Native plugin to enforce artifact path governance for AI agents.",
  version: "0.1.0",
  apiVersion: 1,
  author: "Paperclip",
  categories: ["automation", "workspace"],
  capabilities: ["project.workspaces.read", "agent.tools.register", "issues.read", "issue.documents.read", "issue.documents.write"],
  entrypoints: {
    worker: "./dist/worker.js"
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      allowedArtifactsDir: {
        type: "string",
        description: "The directory where agents are allowed to write artifacts (e.g., Docs/Issues/)",
        default: "Docs/Issues/",
      },
    },
    required: ["allowedArtifactsDir"],
  },
  tools: [
    {
      name: "write_ticket_artifact",
      displayName: "Governance: Escrever Artefato",
      description: "Escreve um arquivo de artefato de ticket de forma segura. Só pode ser usado em caminhos autorizados.",
      parametersSchema: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "O caminho relativo do arquivo no repositório. DEVE começar com o diretório autorizado (ex: Docs/Issues/...)",
          },
          content: {
            type: "string",
            description: "O conteúdo Markdown ou código a ser escrito.",
          },
        },
        required: ["filePath", "content"],
      },
    },
  ],
} satisfies PaperclipPluginManifestV1;
