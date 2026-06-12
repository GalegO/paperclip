import {
  definePlugin,
  runWorker,
  type PaperclipPlugin,
} from "@paperclipai/plugin-sdk";
// @ts-ignore
import manifest from "./manifest.js";
import path from "node:path";
import fs from "node:fs/promises";
import process from "node:process";

interface PluginConfig {
  allowedArtifactsDir?: string;
}

const plugin: PaperclipPlugin = definePlugin({
  async setup(ctx) {
    ctx.tools.register(
      "write_ticket_artifact",
      {
        displayName: "Write Ticket Artifact",
        description: "Escreve um arquivo de artefato de ticket de forma segura.",
        parametersSchema: {
          type: "object",
          properties: {
            filePath: { type: "string" },
            content: { type: "string" }
          },
          required: ["filePath", "content"]
        }
      },
      async (params: any, runContext: any) => {
      const config = (await ctx.config.get()) as PluginConfig;
      
      const allowedDir = config.allowedArtifactsDir || "Docs/Issues";
      const filePath = typeof params.filePath === "string" ? params.filePath : "";
      const content = typeof params.content === "string" ? params.content : "";

      if (!filePath || !content) {
         throw new Error("filePath and content are required parameters");
      }

      const normalizedFilePath = filePath.replace(/\\/g, "/");
      const normalizedAllowedDir = allowedDir.replace(/\\/g, "/");

      if (!normalizedFilePath.startsWith(normalizedAllowedDir)) {
        throw new Error(`Erro de Governança: Rejeitado pelo Harness do Paperclip. Você SÓ tem permissão para modificar/criar artefatos dentro de "${allowedDir}/". Você tentou gravar em "${filePath}". Corrija o caminho e tente novamente.`);
      }

      try {
        const rootDir = runContext?.workspacePath ?? process.cwd();
        const absolutePath = path.resolve(rootDir, filePath);
        
        if (!absolutePath.startsWith(path.resolve(rootDir))) {
           throw new Error("Caminho escapou da raiz do repositório.");
        }

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content, "utf8");

        // Sincronização com o banco de dados
        try {
          const match = filePath.match(/([A-Z0-9]+-\d+)/i);
          if (match && runContext?.companyId) {
            const issueKey = match[1].toUpperCase();
            const fileBase = path.basename(filePath, path.extname(filePath));
            let docKey = fileBase.toLowerCase();
            const knownDocKeys = ["design", "schema", "tasks", "proposal", "tests", "legal", "specs", "ui_ux"];
            
            if (!knownDocKeys.includes(docKey)) {
              for (const knownKey of knownDocKeys) {
                if (docKey.endsWith("-" + knownKey) || docKey.endsWith("_" + knownKey)) {
                  docKey = knownKey;
                  break;
                }
              }
            }

            if (knownDocKeys.includes(docKey)) {
              ctx.logger.info(`Sincronizando documento ${docKey} para a issue ${issueKey} no banco de dados.`);
              
              const issues = await ctx.issues.list({
                companyId: runContext.companyId,
                limit: 1000
              });
              
              const issue = issues.find(i => i.identifier?.toUpperCase() === issueKey);
              if (issue) {
                const docTitle = docKey.charAt(0).toUpperCase() + docKey.slice(1);
                await ctx.issues.documents.upsert({
                  companyId: runContext.companyId,
                  issueId: issue.id,
                  key: docKey,
                  body: content,
                  title: docTitle,
                  format: "markdown"
                });
                ctx.logger.info(`Sucesso: Documento ${docKey} para a issue ${issueKey} foi salvo no banco.`);
              } else {
                ctx.logger.warn(`Aviso: Issue ${issueKey} não foi encontrada na empresa ${runContext.companyId} para sincronizar o documento.`);
              }
            } else {
              ctx.logger.info(`O arquivo ${filePath} não foi sincronizado ao banco porque a chave do documento "${docKey}" não faz parte dos documentos SDD conhecidos.`);
            }
          }
        } catch (syncErr: any) {
          ctx.logger.error(`Erro ao sincronizar artefato com o banco de dados: ${syncErr.message}`);
        }

        return {
          content: `Sucesso: Artefato salvo em ${filePath}`
        };
      } catch (err: any) {
        throw new Error(`Erro ao salvar o arquivo no disco: ${err.message}`);
      }
    });
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
