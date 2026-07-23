import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

const FD = "fd";
const RG = "rg";

function cleanPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const clean = path.trim().replace(/^@/, "");
  if (clean === "~") return homedir();
  if (clean.startsWith("~/")) return join(homedir(), clean.slice(2));
  return clean;
}

async function boundedOutput(output: string, prefix: string) {
  const truncated = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });
  if (!truncated.truncated) return { text: truncated.content, truncated: false };

  const directory = await mkdtemp(join(tmpdir(), `pi-${prefix}-`));
  const outputPath = join(directory, "output.txt");
  await writeFile(outputPath, output, "utf8");
  const note = `\n\n[Output truncated: ${truncated.outputLines} of ${truncated.totalLines} lines (${formatSize(truncated.outputBytes)} of ${formatSize(truncated.totalBytes)}). Full output saved to: ${outputPath}]`;
  return { text: truncated.content + note, truncated: true, outputPath };
}

export default function fileSearch(pi: ExtensionAPI) {
  pi.registerTool({
    name: "fd",
    label: "Find Files",
    description: "Find files and directories quickly by name or glob. Respects .gitignore by default. Output is limited to 10,000 matches and truncated at 2,000 lines or 50KB.",
    promptSnippet: "Find files and directories by name, glob, type, or extension",
    promptGuidelines: [
      "Use fd for fast file and directory discovery when its filters are more convenient than find.",
    ],
    parameters: Type.Object({
      pattern: Type.Optional(Type.String({ description: "Name pattern; regular expression by default" })),
      path: Type.Optional(Type.String({ description: "Directory to search, relative to the working directory" })),
      type: Type.Optional(StringEnum(["file", "directory", "symlink"] as const)),
      extension: Type.Optional(Type.String({ description: "File extension, with or without a leading dot" })),
      glob: Type.Optional(Type.Boolean({ description: "Interpret pattern as a glob instead of a regular expression" })),
      hidden: Type.Optional(Type.Boolean({ description: "Include hidden files and directories" })),
      max_depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 64 })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
    }),
    async execute(_id, params, signal, _update, ctx) {
      const args = ["--color=never"];
      if (params.hidden) args.push("--hidden");
      if (params.glob) args.push("--glob");
      if (params.type) args.push("--type", params.type === "file" ? "f" : params.type === "directory" ? "d" : "l");
      if (params.extension) args.push("--extension", params.extension.replace(/^\./, ""));
      if (params.max_depth !== undefined) args.push("--max-depth", String(params.max_depth));
      args.push("--max-results", String(params.limit ?? 1000), "--", params.pattern ?? "");
      const path = cleanPath(params.path);
      if (path) args.push(path);

      const result = await pi.exec(FD, args, { cwd: ctx.cwd, signal, timeout: 60_000 });
      if (result.code !== 0) throw new Error(`fd failed: ${result.stderr.trim() || `exit code ${result.code}`}`);
      if (!result.stdout.trim()) return { content: [{ type: "text" as const, text: "No files found" }], details: { matches: 0, truncated: false } };
      const output = await boundedOutput(result.stdout, "fd");
      return {
        content: [{ type: "text" as const, text: output.text }],
        details: { matches: result.stdout.split("\n").filter(Boolean).length, truncated: output.truncated, outputPath: output.outputPath },
      };
    },
    renderCall(args, theme) {
      const pattern = args.pattern ? `“${args.pattern}”` : "(all)";
      const path = args.path ? ` in ${args.path}` : "";
      return new Text(theme.fg("toolTitle", theme.bold("fd ")) + theme.fg("accent", pattern) + theme.fg("muted", path), 0, 0);
    },
    renderResult(result, { isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Searching…"), 0, 0);
      const details = result.details as { matches?: number; truncated?: boolean } | undefined;
      const count = details?.matches ?? 0;
      return new Text(theme.fg(count ? "success" : "dim", count ? `${count} ${count === 1 ? "entry" : "entries"}${details?.truncated ? " (truncated)" : ""}` : "No files found"), 0, 0);
    },
  });

  pi.registerTool({
    name: "rg",
    label: "Search Content",
    description: "Search file contents quickly with ripgrep. Respects .gitignore by default. Output is truncated at 2,000 lines or 50KB, with full output saved to a temporary file.",
    promptSnippet: "Search file contents with regex, glob, type, literal, and context controls",
    promptGuidelines: [
      "Use rg for fast content search when regex, glob, file-type, literal, or context controls are useful.",
    ],
    parameters: Type.Object({
      pattern: Type.String({ description: "Regular expression or literal text to search for" }),
      path: Type.Optional(Type.String({ description: "File or directory to search" })),
      glob: Type.Optional(Type.String({ description: "Include or exclude glob, such as '*.ts' or '!dist/**'" })),
      file_type: Type.Optional(Type.String({ description: "Ripgrep file type, such as ts, js, rust, or py" })),
      case_sensitive: Type.Optional(Type.Boolean({ description: "True forces case-sensitive; false forces case-insensitive; omitted uses smart case" })),
      fixed_strings: Type.Optional(Type.Boolean({ description: "Treat the pattern as literal text" })),
      hidden: Type.Optional(Type.Boolean({ description: "Include hidden files" })),
      context: Type.Optional(Type.Integer({ minimum: 0, maximum: 20, description: "Context lines before and after each match" })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, description: "Maximum matches per file" })),
    }),
    async execute(_id, params, signal, _update, ctx) {
      const args = ["--line-number", "--color=never", "--no-heading", "--with-filename"];
      if (params.case_sensitive === true) args.push("--case-sensitive");
      else if (params.case_sensitive === false) args.push("--ignore-case");
      else args.push("--smart-case");
      if (params.fixed_strings) args.push("--fixed-strings");
      if (params.hidden) args.push("--hidden");
      if (params.context !== undefined) args.push("--context", String(params.context));
      if (params.glob) args.push("--glob", params.glob);
      if (params.file_type) args.push("--type", params.file_type);
      args.push("--max-count", String(params.limit ?? 100), "--", params.pattern);
      const path = cleanPath(params.path);
      if (path) args.push(path);

      const result = await pi.exec(RG, args, { cwd: ctx.cwd, signal, timeout: 60_000 });
      if (result.code === 1 && !result.stdout.trim()) return { content: [{ type: "text" as const, text: "No matches found" }], details: { lines: 0, truncated: false } };
      if (result.code !== 0) throw new Error(`rg failed: ${result.stderr.trim() || `exit code ${result.code}`}`);
      const output = await boundedOutput(result.stdout, "rg");
      return {
        content: [{ type: "text" as const, text: output.text }],
        details: { lines: result.stdout.split("\n").filter(Boolean).length, truncated: output.truncated, outputPath: output.outputPath },
      };
    },
    renderCall(args, theme) {
      const path = args.path ? ` in ${args.path}` : "";
      return new Text(theme.fg("toolTitle", theme.bold("rg ")) + theme.fg("accent", `“${args.pattern}”`) + theme.fg("muted", path), 0, 0);
    },
    renderResult(result, { isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Searching…"), 0, 0);
      const details = result.details as { lines?: number; truncated?: boolean } | undefined;
      const count = details?.lines ?? 0;
      return new Text(theme.fg(count ? "success" : "dim", count ? `${count} output ${count === 1 ? "line" : "lines"}${details?.truncated ? " (truncated)" : ""}` : "No matches found"), 0, 0);
    },
  });
}
