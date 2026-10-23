import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require(process.env.COUNT_MY_PUSH_TYPESCRIPT_PATH || "typescript");
const compiled = ts.transpileModule(readFileSync(new URL("../src/components/SettingsSheet.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics, []);

function mount(amounts) {
  let cursor = 0, effectCursor = 0, effects = [];
  const state = [], dependencies = [], saves = [];
  const props = { open: true, goals: { dailyGoal: 50, weeklyGoal: 300, monthlyGoal: 1000 },
    quickAdd: amounts, onClose() {}, onSave: async payload => saves.push(JSON.parse(JSON.stringify(payload))) };
  const jsx = (type, props) => typeof type === "function" ? type(props) : { type, props: props || {} };
  const context = { exports: {}, window: { addEventListener() {}, removeEventListener() {} }, require(name) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (name === "framer-motion") return { AnimatePresence: "presence", motion: { div: "div" }, useReducedMotion: () => true };
    if (name === "react") return {
      useId: () => "settings-title",
      useRef(initial) { const index = cursor++; if (!(index in state)) state[index] = { current: initial };
        return state[index]; },
      useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = value; }]; },
      useEffect(fn, deps) { const index = effectCursor++;
        if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) effects.push(fn);
        dependencies[index] = deps;
      },
    };
    throw Error("Unexpected import: " + name);
  } };
  vm.runInNewContext(compiled.outputText, context);
  const render = () => {
    cursor = 0; effectCursor = 0;
    let tree = context.exports.SettingsSheet(props);
    const pending = effects; effects = [];
    for (const effect of pending) effect();
    if (pending.length) { cursor = 0; effectCursor = 0; tree = context.exports.SettingsSheet(props); }
    return tree;
  };
  const text = node => Array.isArray(node) ? node.map(text).join("")
    : node && typeof node === "object" ? text(node.props.children) : typeof node === "string" ? node : "";
  const nodes = (tree, predicate) => {
    const found = [];
    function visit(node) { if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      if (predicate(node)) found.push(node);
      visit(node.props.children);
    }
    visit(tree); return found;
  };
  function setField(label, value) {
    const field = nodes(render(), node => node.type === "label" && text(node).startsWith(label))[0];
    assert.ok(field, "Field " + label);
    nodes(field, node => node.type === "input")[0].props.onChange({ target: { value } });
  }
  async function save() {
    const button = nodes(render(), node => node.type === "button" && text(node) === "Save")[0];
    button.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
  }
  return { props, saves, render, setField, save, text };
}

for (const amounts of [[10, 20], [5, 15, 25], [5, 10, 15, 20]]) {
  test(`saving goals preserves ${amounts.length} configured quick amounts`, async () => {
    const h = mount(amounts);
    h.setField("Daily goal", "60");
    await h.save();
    assert.equal(h.saves.length, 1);
    assert.deepEqual(h.saves[0].quickAdd, amounts);
    assert.equal(h.saves[0].goals.dailyGoal, 60);
  });
}

test("reopening after a two-button configuration keeps the third amount blank", async () => {
  const h = mount([10, 20, 30]);
  h.render();
  h.props.open = false; h.render();
  h.props.quickAdd = [7, 14]; h.props.open = true; h.render();
  await h.save();
  assert.deepEqual(h.saves[0].quickAdd, [7, 14]);
});

test("users can opt into a third amount or clear it back to two", async () => {
  const h = mount([10, 20]);
  assert.match(h.text(h.render()), /Amount 3 \(optional\)/);
  h.setField("Amount 3", "40"); await h.save();
  assert.deepEqual(h.saves[0].quickAdd, [10, 20, 40]);
  h.setField("Amount 3", ""); await h.save();
  assert.deepEqual(h.saves[1].quickAdd, [10, 20]);
});

test("fewer than two amounts still fails before saving", async () => {
  const h = mount([10, 20]);
  h.setField("Amount 2", "");
  await h.save();
  assert.equal(h.saves.length, 0);
  assert.match(h.text(h.render()), /Add at least two quick amounts/);
});

test("same-valued fresh background props preserve the open settings draft", async () => {
  const h = mount([10, 20]);
  h.setField("Daily goal", "60");
  h.setField("Amount 1", "7");
  h.props.goals = { ...h.props.goals };
  h.props.quickAdd = [...h.props.quickAdd];
  h.render();
  await h.save();
  assert.equal(h.saves[0].goals.dailyGoal, 60);
  assert.deepEqual(h.saves[0].quickAdd, [7, 20]);
});

test("changed background settings preserve the draft until closing and reopening", async () => {
  const h = mount([10, 20, 30, 40]);
  h.setField("Daily goal", "60");
  h.setField("Weekly goal", "400");
  h.setField("Monthly goal", "1400");
  h.setField("Amount 1", "7");
  h.setField("Amount 2", "14");
  h.setField("Amount 3", "");
  h.setField("Amount 4", "");
  h.props.goals = { dailyGoal: 80, weeklyGoal: 560, monthlyGoal: 2000 };
  h.props.quickAdd = [12, 24];
  h.render();
  await h.save();
  assert.deepEqual(h.saves[0], { goals: { dailyGoal: 60, weeklyGoal: 400, monthlyGoal: 1400 }, quickAdd: [7, 14] });

  h.props.open = false; h.render();
  h.props.open = true; h.render();
  await h.save();
  assert.deepEqual(h.saves[1], { goals: { dailyGoal: 80, weeklyGoal: 560, monthlyGoal: 2000 }, quickAdd: [12, 24] });
});
