import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require(process.env.COUNT_MY_PUSH_TYPESCRIPT_PATH || "typescript");
const source = readFileSync(process.env.COUNT_MY_PUSH_APP_PATH || new URL("../src/App.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics, []);
const flush = () => new Promise(resolve => setImmediate(resolve));

function mount() {
  let cursor = 0, pending = [], tree;
  const slots = [], listeners = new Map(), timers = new Map();
  const h = { day: "2026-10-23", requests: 0, fail: false, total: 10 };
  const same = (a, b) => a && b && a.length === b.length && b.every((value, i) => Object.is(value, a[i]));
  const memo = (fn, deps) => {
    const index = cursor++;
    if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: fn(), deps };
    return slots[index].value;
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const react = {
    useCallback: (fn, deps) => memo(() => fn, deps),
    useMemo: memo,
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        const previous = slots[index];
        pending.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      }
    },
  };
  const document = {
    visibilityState: "visible",
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const context = {
    exports: {}, Date, document,
    Intl: { DateTimeFormat: function () { return { format: () => h.day, resolvedOptions: () => ({ timeZone: "Europe/Oslo" }) }; } },
    window: { setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id), clearTimeout() {} },
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "framer-motion") return { motion: { header: "header", div: "div" }, useReducedMotion: () => true };
      if (name === "./lib/api") return { async fetchState() {
        h.requests++;
        if (h.fail) throw new Error("Offline during refresh");
        return { timeZone: "Europe/Oslo", goals: { dailyGoal: 50, weeklyGoal: 300, monthlyGoal: 1000 }, quickAdd: [10, 20], totals: { daily: h.total, weekly: h.total, monthly: h.total }, recentEntries: [] };
      } };
      if (name.startsWith("./components/")) { const component = name.split("/").at(-1); return { [component]: component }; }
      if (name === "./lib/delight") return {};
      throw Error("Unexpected import: " + name);
    },
  };
  vm.runInNewContext(compiled.outputText, context);
  h.render = () => { cursor = 0; tree = context.exports.default(); const effects = pending; pending = []; effects.forEach(fn => fn()); return tree; };
  h.tick = async () => { for (const fn of [...timers.values()]) fn(); await flush(); h.render(); };
  h.visible = async value => { document.visibilityState = value; listeners.get("visibilitychange")?.(); await flush(); h.render(); };
  h.nodes = predicate => {
    const found = [];
    function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== "object") return;
      if (predicate(node)) found.push(node); visit(node.props?.children); }
    visit(tree); return found;
  };
  h.unmount = () => slots.forEach(slot => slot?.cleanup?.());
  return h;
}

test("failed day rollover retains totals, exposes the error and retries next minute", async () => {
  const h = mount(); h.render(); await flush(); h.render();
  assert.equal(h.requests, 1);
  h.day = "2026-10-24"; h.fail = true;
  await h.tick();
  assert.equal(h.requests, 2);
  assert.equal(h.nodes(node => node.type === "DailyRing")[0].props.total, 10);
  assert.equal(h.nodes(node => node.props?.role === "alert").length, 1);
  h.fail = false; h.total = 0;
  await h.tick();
  assert.equal(h.requests, 3);
  assert.equal(h.nodes(node => node.type === "DailyRing")[0].props.total, 0);
  assert.equal(h.nodes(node => node.props?.role === "alert").length, 0);
  await h.tick(); assert.equal(h.requests, 3, "successful rollover does not keep polling the same day");
  h.unmount();
});

test("visibility refresh handles offline failure and recovers on the next foreground event", async () => {
  const h = mount(); h.render(); await flush(); h.render();
  await h.visible("hidden"); assert.equal(h.requests, 1);
  h.fail = true; await h.visible("visible");
  assert.equal(h.nodes(node => node.props?.role === "alert").length, 1);
  h.fail = false; h.total = 30; await h.visible("visible");
  assert.equal(h.requests, 3);
  assert.equal(h.nodes(node => node.type === "DailyRing")[0].props.total, 30);
  assert.equal(h.nodes(node => node.props?.role === "alert").length, 0);
  h.unmount();
});

test("unmount removes automatic refresh triggers", async () => {
  const h = mount(); h.render(); await flush(); h.render(); h.unmount();
  h.day = "2026-10-24"; await h.tick(); await h.visible("visible");
  assert.equal(h.requests, 1);
});
