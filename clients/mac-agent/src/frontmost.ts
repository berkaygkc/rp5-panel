/**
 * Ön plandaki uygulama ve VSCode çalışma alanı:
 * - Uygulama: lsappinfo (izin gerektirmez)
 * - VSCode pencere başlığı → çalışma alanı (System Events, Erişilebilirlik izni)
 * Tek kullanım yeri: Claude "sizi bekliyor" bildirimi, önünüzde açık olan projeyi dürtmesin.
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanEnv } from "./env.js";
import { runAppleScript } from "./osascript.js";

export interface FrontApp {
  name: string;
  bundleId: string;
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 3000, env: cleanEnv() }, (err, stdout) => resolve(err ? "" : stdout));
  });
}

export async function frontmostApp(): Promise<FrontApp | null> {
  const asn = (await run("lsappinfo", ["front"])).trim();
  if (!asn) return null;
  const info = await run("lsappinfo", ["info", "-only", "name", "-only", "bundleid", asn]);
  const name = info.match(/"LSDisplayName"="([^"]*)"/)?.[1] ?? "";
  const bundleId = info.match(/"CFBundleIdentifier"="([^"]*)"/)?.[1] ?? "";
  if (!name && !bundleId) return null;
  return { name, bundleId };
}

/* ── VSCode ── */

const VSCODE_BUNDLES = new Set(["com.microsoft.VSCode", "com.microsoft.VSCodeInsiders"]);
export const isVSCode = (b: string) => VSCODE_BUNDLES.has(b);

/** Ön VSCode penceresinin başlığı: "dosya — klasör" */
export async function vscodeFrontTitle(): Promise<string | null> {
  const out = await runAppleScript(
    'tell application "System Events" to tell process "Code" to get name of window 1'
  );
  return out || null;
}

let wsCache: { at: number; map: Map<string, string> } | null = null;

/** VSCode'un kayıtlı çalışma alanları: klasör adı → tam yol */
function vscodeWorkspaces(): Map<string, string> {
  if (wsCache && Date.now() - wsCache.at < 60_000) return wsCache.map;
  const map = new Map<string, string>();
  try {
    const file = path.join(os.homedir(), "Library/Application Support/Code/User/globalStorage/storage.json");
    const json = JSON.parse(readFileSync(file, "utf8")) as {
      profileAssociations?: { workspaces?: Record<string, unknown> };
    };
    for (const uri of Object.keys(json.profileAssociations?.workspaces ?? {})) {
      if (!uri.startsWith("file://")) continue;
      const p = decodeURIComponent(uri.slice("file://".length));
      if (existsSync(p)) map.set(path.basename(p), p);
    }
  } catch {
    /* VSCode kurulu değil ya da dosya yok */
  }
  wsCache = { at: Date.now(), map };
  return map;
}

export interface VSCodeContext {
  workspaceName: string | null;
  workspacePath: string | null;
}

export async function vscodeContext(): Promise<VSCodeContext> {
  const title = await vscodeFrontTitle();
  if (!title) return { workspaceName: null, workspacePath: null };
  // "dosya — klasör" | "klasör" | "● dosya — klasör — Visual Studio Code"
  const parts = title
    .split(" — ")
    .map((s) => s.trim())
    .filter((s) => s && s !== "Visual Studio Code");
  const workspaceName = parts[parts.length - 1] ?? null;
  const workspacePath = workspaceName ? (vscodeWorkspaces().get(workspaceName) ?? null) : null;
  return { workspaceName, workspacePath };
}


/** Ön plandaki VSCode çalışma alanını periyodik izler (Claude bildirim kuralı için) */
export class FrontmostMonitor {
  private workspace: string | null = null;
  private busy = false;

  /** Ön planda VSCode ve bu çalışma alanı mı? */
  isWorkspaceInFront(name: string): boolean {
    return this.workspace !== null && this.workspace === name;
  }

  async poll(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const app = await frontmostApp();
      this.workspace = app && isVSCode(app.bundleId) ? (await vscodeContext()).workspaceName : null;
    } finally {
      this.busy = false;
    }
  }
}
