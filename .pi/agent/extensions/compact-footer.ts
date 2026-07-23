import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

function formatTokens(count: number): string {
  if (count < 1_000) return String(count);
  if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}

export default function (pi: ExtensionAPI) {
  let changeCount = 0;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let requestRender: (() => void) | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    const refreshChanges = async () => {
      const result = await pi.exec("git", ["status", "--porcelain"], { timeout: 2_000 });
      const nextCount = result.code === 0
        ? result.stdout.split("\n").filter((line) => line.length > 0).length
        : 0;
      if (nextCount !== changeCount) {
        changeCount = nextCount;
        requestRender?.();
      }
    };

    void refreshChanges();
    refreshTimer = setInterval(() => void refreshChanges(), 3_000);

    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRender = () => tui.requestRender();
      const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsubscribe,
        invalidate() {},
        render(width: number): string[] {
          let input = 0;
          let output = 0;

          for (const entry of ctx.sessionManager.getEntries()) {
            let usage: { input?: number; output?: number } | undefined;
            if (entry.type === "message" && entry.message.role === "assistant") {
              usage = entry.message.usage;
            } else if (entry.type === "message" && entry.message.role === "toolResult") {
              usage = entry.message.usage;
            } else if (entry.type === "branch_summary" || entry.type === "compaction") {
              usage = entry.usage;
            }
            input += usage?.input ?? 0;
            output += usage?.output ?? 0;
          }

          const context = ctx.getContextUsage();
          const contextWindow = context?.contextWindow ?? ctx.model?.contextWindow ?? 0;
          const contextDisplay = context?.percent == null
            ? `?/${formatTokens(contextWindow)}`
            : `${context.percent.toFixed(1)}%/${formatTokens(contextWindow)}`;
          const stats = `↑${formatTokens(input)} ↓${formatTokens(output)} ${contextDisplay} (auto)`;

          const branch = footerData.getGitBranch();
          const model = ctx.model?.id ?? "no-model";
          const reasoning = pi.getThinkingLevel();
          const git = branch ? ` ${branch}${changeCount > 0 ? ` ±${changeCount}` : ""}` : undefined;
          const metadata = [git, model, reasoning].filter(Boolean).join(" • ");
          const left = theme.fg("dim", stats);
          const right = theme.fg("accent", metadata);
          const gap = " ".repeat(Math.max(2, width - visibleWidth(left) - visibleWidth(right)));

          return [truncateToWidth(left + gap + right, width, "…")];
        },
      };
    });
  });

  pi.on("session_shutdown", () => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = undefined;
    requestRender = undefined;
  });
}
