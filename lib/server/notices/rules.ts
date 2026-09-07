import { getRulesSync, type RuleRow } from "@/lib/server/config/settings";
import type { NoticeInput } from "@/lib/notices/types";

/**
 * Önem kuralları — veritabanından (NoticeRule), yönetim panelinden düzenlenir.
 * Üreticiler ham olayı gönderir, kural önemi/türü/ekranı belirler. Sırayla uygulanır.
 */
const SEVERITIES = new Set(["info", "attention", "urgent"]);
const regexCache = new Map<string, RegExp | null>();

function compile(pattern: string): RegExp | null {
  if (regexCache.has(pattern)) return regexCache.get(pattern)!;
  let re: RegExp | null = null;
  try {
    re = new RegExp(pattern, "i");
  } catch {
    re = null; // geçersiz desen: kural atlanır
  }
  regexCache.set(pattern, re);
  return re;
}

function fieldValue(n: NoticeInput, field: string): string {
  switch (field) {
    case "title": return n.title;
    case "body": return n.body ?? "";
    case "kind": return n.kind ?? "";
    case "account": return n.meta?.account ?? "";
    default: return `${n.title} ${n.body ?? ""}`;
  }
}

export function ruleMatches(rule: RuleRow, n: NoticeInput): boolean {
  const re = compile(rule.pattern);
  return !!re && re.test(fieldValue(n, rule.field));
}

export function applyRules(input: NoticeInput, rules: RuleRow[] = getRulesSync()): NoticeInput {
  const out = { ...input };
  for (const rule of rules) {
    if (!rule.enabled || !ruleMatches(rule, out)) continue;
    if (rule.setSeverity && SEVERITIES.has(rule.setSeverity)) out.severity = rule.setSeverity as NoticeInput["severity"];
    if (rule.setKind) out.kind = rule.setKind;
    if (rule.setScreen) out.screen = rule.setScreen;
  }
  return out;
}
