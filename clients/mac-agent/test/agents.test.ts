/**
 * Alt ajan takibi: dökümde sonucu gelmemiş `Agent` çağrısı varsa oturum
 * duruyor değil, işi devretmiş demektir.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { applyAgentRecord, runningAgents, type AgentPending } from "../src/claude/agents.js";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  console.log("  ✓", name);
  passed++;
};

const launch = (id: string, description: string) => ({
  type: "assistant",
  message: { content: [{ type: "tool_use", name: "Agent", id, input: { description, prompt: "…", subagent_type: "general-purpose" } }] },
});
const result = (id: string) => ({
  type: "user",
  message: { content: [{ type: "tool_result", tool_use_id: id, content: "bitti" }] },
});

const fresh = (): AgentPending => new Map();

test("sonucu gelmemiş çağrı çalışıyor sayılır", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "Envoy kod tabanını incele"), 1000);
  const r = runningAgents(p);
  assert.equal(r.count, 1);
  assert.equal(r.label, "Envoy kod tabanını incele");
});

test("sonuç gelince düşer", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "Envoy"), 1000);
  applyAgentRecord(p, result("toolu_1"), 2000);
  assert.deepEqual(runningAgents(p), { count: 0, label: null });
});

test("iki çağrıdan biri biterse kalan sayılır", () => {
  const p = fresh();
  applyAgentRecord(p, launch("a", "ilk"), 1000);
  applyAgentRecord(p, launch("b", "ikinci"), 1100);
  applyAgentRecord(p, result("a"), 1200);
  const r = runningAgents(p);
  assert.equal(r.count, 1);
  assert.equal(r.label, "ikinci");
});

test("etiket en son başlayandan gelir", () => {
  const p = fresh();
  applyAgentRecord(p, launch("a", "eski"), 1000);
  applyAgentRecord(p, launch("b", "yeni"), 5000);
  assert.equal(runningAgents(p).label, "yeni");
});

test("Agent olmayan araçlar sayılmaz", () => {
  const p = fresh();
  applyAgentRecord(p, { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", id: "x", input: {} }] } }, 1000);
  assert.equal(runningAgents(p).count, 0);
});

test("Task adı da tanınır", () => {
  const p = fresh();
  applyAgentRecord(p, { type: "assistant", message: { content: [{ type: "tool_use", name: "Task", id: "t", input: { description: "eski ad" } }] } }, 1000);
  assert.equal(runningAgents(p).count, 1);
});

test("açıklama yoksa genel etiket kullanılır", () => {
  const p = fresh();
  applyAgentRecord(p, { type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", id: "n", input: {} }] } }, 1000);
  assert.equal(runningAgents(p).label, "alt ajan");
});

test("bozuk kayıtlar hata vermez", () => {
  const p = fresh();
  for (const bad of [{}, { type: "assistant" }, { type: "assistant", message: {} }, { type: "user", message: { content: "düz metin" } }, { type: "assistant", message: { content: [null, 42, "x"] } }]) {
    applyAgentRecord(p, bad as Record<string, unknown>, 1000);
  }
  assert.equal(runningAgents(p).count, 0);
});

console.log(`\n${passed} test geçti`);
