import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require(process.env.COUNT_MY_PUSH_TYPESCRIPT_PATH || "typescript");
const compiled = ts.transpileModule(readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics, []);

const savedState = (daily) => ({ goals: { dailyGoal: 50, weeklyGoal: 300, monthlyGoal: 1000 },
  quickAdd: [10, 20], totals: { daily, weekly: daily + 20, monthly: daily + 100 }, recentEntries: [] });
const flush = () => new Promise((resolve) => setImmediate(resolve));

function mount(responses, { postEntry = async () => { throw new Error("set rejected"); } } = {}) {
  let now = Date.parse("2026-10-23T12:00:00Z"), cursor = 0, effects = [], calls = 0;
  const slots = [], intervals = new Map(), listeners = new Map();
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (factory, deps) => {
    const index = cursor++;
    if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, value: factory() };
    return slots[index].value;
  };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const react = {
    useMemo: memo,
    useCallback: (callback, deps) => memo(() => callback, deps),
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const context = { exports: {}, Date: Clock, Intl, Error, window: {
    setInterval(fn) { intervals.set(1, fn); return 1; }, clearInterval(id) { intervals.delete(id); },
    setTimeout() { return 2; }, clearTimeout() {},
  }, document: { visibilityState: "visible", addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); } }, require(name) {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "framer-motion") return { motion: new Proxy({}, { get: (_, name) => name }), useReducedMotion: () => true };
    if (name === "./lib/api") return { postEntry, fetchState: async () => {
      calls++;
      assert.ok(responses.length, "no unexpected API request");
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return result;
    } };
    if (name === "./lib/delight") return { randomSuccessLine: () => "Saved", randomMilestoneLine: () => "Goal reached" };
    if (name.startsWith("./components/")) {
      const component = name.split("/").at(-1);
      return { [component]: component };
    }
    throw Error("Unexpected import: " + name);
  } };
  vm.runInNewContext(compiled.outputText, context);
  let tree;
  function render() {
    cursor = 0;
    tree = context.exports.default();
    const pending = effects; effects = [];
    for (const effect of pending) effect();
    return tree;
  }
  function find(predicate) {
    function visit(node) {
      if (Array.isArray(node)) {
        for (const child of node) { const found = visit(child); if (found) return found; }
        return;
      }
      if (!node || typeof node !== "object") return;
      if (predicate(node)) return node;
      return visit(node.props?.children);
    }
    return visit(render());
  }
  const text = (node) => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object"
    ? text(node.props.children) : typeof node === "string" ? node : "";
  render();
  return {
    get calls() { return calls; },
    get daily() { return find((node) => node.type === "DailyRing")?.props.total; },
    get error() { return text(find((node) => node.props.role === "alert")); },
    async ready() { await flush(); render(); },
    async tick() { intervals.get(1)(); await flush(); render(); },
    async visible() { listeners.get("visibilitychange")(); await flush(); render(); },
    async add() { await find((node) => node.type === "QuickAddBar").props.onAdd(10); await flush(); render(); },
    nextDay() { now += 24 * 60 * 60 * 1000; },
  };
}

test("a failed midnight refresh keeps saved totals and retries on the next tick", async () => {
  const app = mount([savedState(40), new Error("offline"), savedState(0)]);
  await app.ready();
  assert.equal(app.daily, 40);
  app.nextDay();
  await app.tick();
  assert.equal(app.daily, 40);
  assert.match(app.error, /offline/);
  await app.tick();
  assert.equal(app.calls, 3);
  assert.equal(app.daily, 0);
  assert.equal(app.error, "");
  await app.tick();
  assert.equal(app.calls, 3, "successful refresh advances the calendar marker");
});

test("visibility refresh failures are handled and a later visibility event can recover", async () => {
  const app = mount([savedState(10), new Error("connection lost"), savedState(20)]);
  await app.ready();
  await app.visible();
  assert.equal(app.daily, 10);
  assert.match(app.error, /connection lost/);
  await app.visible();
  assert.equal(app.daily, 20);
  assert.equal(app.error, "");
  assert.equal(app.calls, 3);
});

test("ordinary same-day timer ticks do not refetch", async () => {
  const app = mount([savedState(10)]);
  await app.ready();
  await app.tick(); await app.tick();
  assert.equal(app.calls, 1);
  assert.equal(app.daily, 10);
});

test("background recovery preserves an intervening failed user operation", async () => {
  const app = mount([savedState(10), new Error("offline"), savedState(10)]);
  await app.ready();
  await app.visible();
  assert.match(app.error, /offline/);
  await app.add();
  assert.match(app.error, /set rejected/);
  await app.visible();
  assert.equal(app.daily, 10);
  assert.match(app.error, /set rejected/);
});


test("successful user mutation refresh retires an obsolete background error", async () => {
  const app = mount([savedState(10), new Error("offline"), savedState(20)], {
    postEntry: async () => ({ entry: { id: 1, count: 10, performedAt: "2026-10-23T12:00:00Z" } }),
  });
  await app.ready();
  await app.visible();
  assert.match(app.error, /offline/);
  await app.add();
  assert.equal(app.daily, 20);
  assert.equal(app.error, "");
  assert.equal(app.calls, 3);
});

test("failed user mutation refresh still reports its own failure", async () => {
  const app = mount([savedState(10), new Error("offline"), new Error("saved but refresh failed")], {
    postEntry: async () => ({ entry: { id: 1, count: 10, performedAt: "2026-10-23T12:00:00Z" } }),
  });
  await app.ready();
  await app.visible();
  await app.add();
  assert.equal(app.daily, 20);
  assert.match(app.error, /saved but refresh failed/);
});
