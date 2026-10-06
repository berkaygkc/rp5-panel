/**
 * Alt ajan takibi.
 *
 * İki ayrı biçim var ve ikisi de gerçek dökümlerden alınmıştır:
 *  - bloklayan çağrı: sonucu gelmemiş `Agent` tool_use'u çalışıyor demektir;
 *  - arka plan çağrısı: sonuç ANINDA gelir ("Async agent launched"), bu yüzden
 *    sonucun varlığı bitiş sayılmaz; bitişi `<task-notification>` bildirir.
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

/* Arka plan biçimi — kayıtlar gerçek dökümden kısaltılarak alındı. */
const asyncResult = (toolUseId: string, agentId: string) => ({
  type: "user",
  message: {
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: [
          {
            type: "text",
            text:
              "Async agent launched successfully. (This tool result is internal metadata…)\n" +
              `agentId: ${agentId} (internal ID - do not mention to user.)\n` +
              "The agent is working in the background. You will be notified automatically when it completes.",
          },
        ],
      },
    ],
  },
});
const taskDone = (agentId: string, status = "completed") => ({
  type: "queue-operation",
  operation: "enqueue",
  content:
    `<task-notification>\n<task-id>${agentId}</task-id>\n` +
    `<tool-use-id>toolu_yoksay</tool-use-id>\n<status>${status}</status>\n` +
    `<summary>Agent "bir iş" finished</summary>\n</task-notification>`,
});

/** Alt ajanın son raporu — bazı oturumlarda bitişin tek izi budur. */
const handback = (agentId: string) => ({
  type: "user",
  message: {
    role: "user",
    content:
      `Another Claude session sent a message:\n<agent-message from="${agentId}">\n` +
      "[Subagent hand-back] The text below is the final report of a subagent…\n  ### Rapor\n",
  },
});
/** Ajanlar arası sıradan yazışma — bitiş değildir. */
const chatter = (agentId: string) => ({
  type: "user",
  message: { role: "user", content: `Another Claude session sent a message:\n<agent-message from="${agentId}">\nBir sorum var.\n` },
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

test("arka plan ajanı anında gelen sonuçla düşmez", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "H9 anlık görüntü"), 1000);
  applyAgentRecord(p, asyncResult("toolu_1", "a475369d8d26acf61"), 1001);
  const r = runningAgents(p);
  assert.equal(r.count, 1);
  assert.equal(r.label, "H9 anlık görüntü");
});

test("arka plan ajanı task-notification ile düşer", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "H9"), 1000);
  applyAgentRecord(p, asyncResult("toolu_1", "a475369d8d26acf61"), 1001);
  applyAgentRecord(p, taskDone("a475369d8d26acf61"), 9000);
  assert.deepEqual(runningAgents(p), { count: 0, label: null });
});

test("başka ajanın bildirimi çalışanı düşürmez", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "süren"), 1000);
  applyAgentRecord(p, asyncResult("toolu_1", "aaa"), 1001);
  applyAgentRecord(p, taskDone("bbb"), 9000);
  assert.equal(runningAgents(p).count, 1);
});

test("completed dışındaki durumlar da bitiş sayılır", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "düşen"), 1000);
  applyAgentRecord(p, asyncResult("toolu_1", "ccc"), 1001);
  applyAgentRecord(p, taskDone("ccc", "failed"), 9000);
  assert.equal(runningAgents(p).count, 0);
});

test("üç arka plan ajanından ikisi biterse biri kalır", () => {
  const p = fresh();
  for (const [t, a, d] of [["t1", "a1", "ilk"], ["t2", "a2", "orta"], ["t3", "a3", "son"]]) {
    applyAgentRecord(p, launch(t, d), 1000);
    applyAgentRecord(p, asyncResult(t, a), 1001);
  }
  applyAgentRecord(p, taskDone("a1"), 2000);
  applyAgentRecord(p, taskDone("a3"), 2100);
  const r = runningAgents(p);
  assert.equal(r.count, 1);
  assert.equal(r.label, "orta");
});

test("bloklayan çağrı eski davranışını korur", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "önde"), 1000);
  applyAgentRecord(p, result("toolu_1"), 2000);
  assert.equal(runningAgents(p).count, 0);
});

test("son rapor da bitiş sayılır", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "F6 düzeltmeleri"), 1000);
  applyAgentRecord(p, asyncResult("toolu_1", "a9a53e311c325748a"), 1001);
  applyAgentRecord(p, handback("a9a53e311c325748a"), 5000);
  assert.equal(runningAgents(p).count, 0);
});

test("sıradan ajan yazışması bitiş sayılmaz", () => {
  const p = fresh();
  applyAgentRecord(p, launch("toolu_1", "süren"), 1000);
  applyAgentRecord(p, asyncResult("toolu_1", "aaa"), 1001);
  applyAgentRecord(p, chatter("aaa"), 5000);
  assert.equal(runningAgents(p).count, 1);
});

console.log(`\n${passed} test geçti`);
