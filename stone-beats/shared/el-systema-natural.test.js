const assert = require("assert");
const Natural = require("./el-systema-natural.js");

const names = ["pink", "logistic", "lorenz", "gold", "fib", "brown", "sine", "ca", "levy"];

function collect(name, seed, count) {
  const fn = Natural[name];
  const state = fn.init(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const value = fn.next(state);
    assert.ok(value >= 0 && value <= 1, name + " out of range at " + i);
    out.push(Number(value.toFixed(6)));
  }
  return out;
}

names.forEach(function (name) {
  const a = collect(name, 0.5, 100);
  const b = collect(name, 0.5, 100);
  assert.deepStrictEqual(b, a, name + " is not deterministic for seed=0.5");
});

console.log("deterministic:", names.join(", "));
