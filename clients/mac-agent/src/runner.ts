/**
 * Kısayol çalıştırıcı — panelden gelen "run" komutlarını uygular.
 * Yalnızca iki dar eylem tanınır; girdiler doğrulanır, kabuk kullanılmaz
 * (execFile = enjeksiyon yüzeyi yok).
 */
import { execFile } from "node:child_process";
import { cleanEnv } from "./env.js";
import { existsSync } from "node:fs";
import type { RunAction } from "./protocol.js";

function exec(cmd: string, args: string[]): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    // env: Claude izleri temizlenir — açılan VSCode/terminal "çocuk oturum" sanılmasın
    execFile(cmd, args, { timeout: 10_000, env: cleanEnv() }, (err, _stdout, stderr) => {
      if (err) resolve({ ok: false, message: (stderr || err.message).trim().split("\n")[0] });
      else resolve({ ok: true });
    });
  });
}

function execAppleScript(script: string): Promise<{ ok: boolean; message?: string }> {
  return exec("osascript", ["-e", script]);
}

function which(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("which", [name], (err, stdout) => resolve(err ? null : stdout.trim() || null));
  });
}

const HOST_RE = /^[A-Za-z0-9.\-]+$/;
const USER_RE = /^[A-Za-z0-9._\-]+$/;

export async function runShortcut(action: RunAction): Promise<{ ok: boolean; message?: string }> {
  if (action.kind === "project") {
    if (!existsSync(action.path)) {
      return { ok: false, message: `klasör bulunamadı: ${action.path}` };
    }
    // `code <klasör>`: kapalıysa açar, açıksa mevcut pencereyi öne getirir
    const code = await which("code");
    if (code) return exec(code, [action.path]);
    // code CLI kurulu değilse open ile — VSCode aynı klasör penceresini tekilleştirir
    return exec("open", ["-a", "Visual Studio Code", action.path]);
  }

  if (action.kind === "ssh") {
    if (!HOST_RE.test(action.host)) {
      return { ok: false, message: "geçersiz sunucu adresi" };
    }
    if (action.user !== undefined && !USER_RE.test(action.user)) {
      return { ok: false, message: "geçersiz kullanıcı adı" };
    }
    if (action.port !== undefined && (!Number.isInteger(action.port) || action.port < 1 || action.port > 65535)) {
      return { ok: false, message: "geçersiz port" };
    }
    // Terminal yolu: SSH anahtarı kuruluysa hiçbir şey sormadan bağlanır.
    // Girdiler yukarıda regex/aralık ile doğrulandı; komut bu doğrulanmış
    // parçalardan kurulur.
    if (action.via === "terminal") {
      const sshCmd = `ssh ${action.port ? `-p ${action.port} ` : ""}${
        action.user ? `${action.user}@` : ""
      }${action.host}`;
      return execAppleScript(
        `tell application "Terminal"
  activate
  do script "${sshCmd}"
end tell`
      );
    }

    // Termius yolu: port dahil tam ssh:// URL'i. Termius bunu "hızlı bağlantı"
    // olarak açar; kayıtlı kimlik dışarıdan tetiklenemez (Termius kısıtı).
    const url = `ssh://${action.user ? `${action.user}@` : ""}${action.host}${
      action.port ? `:${action.port}` : ""
    }`;
    const viaTermius = await exec("open", ["-a", "Termius", url]);
    if (viaTermius.ok) return viaTermius;
    // Termius yoksa sistemin varsayılan ssh işleyicisine bırak
    return exec("open", [url]);
  }

  return { ok: false, message: "bilinmeyen eylem" };
}
