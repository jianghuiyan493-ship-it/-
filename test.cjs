const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createApp(saved = {}) {
  const elements = new Map();
  const storage = { ...saved };
  function element(key) {
    if (!elements.has(key)) {
      const classes = new Set();
      elements.set(key, {
        textContent: "", innerHTML: "", hidden: false, dataset: {},
        style: {}, attributes: {},
        classList: {
          toggle(name, active) { if (active) classes.add(name); else classes.delete(name); },
          contains(name) { return classes.has(name); }
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener() {}, insertAdjacentHTML() {}, focus() {}
      });
    }
    return elements.get(key);
  }
  const context = vm.createContext({
    document: {
      querySelector: element,
      querySelectorAll: () => [],
      addEventListener() {}
    },
    localStorage: {
      getItem: key => storage[key] ?? null,
      setItem: (key, value) => { storage[key] = value; }
    },
    location: { hash: "#base" },
    window: { addEventListener() {}, scrollTo() {} },
    console
  });
  vm.runInContext(fs.readFileSync("main.js", "utf8"), context);
  return { context, element, storage, eval: code => vm.runInContext(code, context) };
}

const app = createApp();
assert.equal(app.element("#achievement-count").textContent, "0 / 13");
for (const key of ["rest", "garden", "signal"]) {
  for (let i = 0; i < 3; i++) {
    app.eval(`currentGame = "${key}"; level = ${i}; won = false; complete()`);
    assert.equal(app.element("#total-count").textContent,
      `${["rest", "garden", "signal"].indexOf(key) * 3 + i + 1} / 9`);
    assert.equal(app.element(`.map-hotspot.${key}`).dataset.stage, String(i + 1));
    assert.match(app.element("#earned-achievements").innerHTML, /新成就解锁/);
    if (i === 2) assert.match(app.element("#earned-achievements").innerHTML, /守护者|培育者|联络员/);
  }
}
assert.equal(app.element("#achievement-count").textContent, "13 / 13");
assert.equal(app.element("#base-message").hidden, false);
assert.match(app.element("#earned-achievements").innerHTML, /星屿重启/);
app.eval("won = false; complete()");
assert.match(app.element("#earned-achievements").innerHTML, /再次完成任务/);
assert.doesNotMatch(app.element("#earned-achievements").innerHTML, /星屿重启/);
app.eval("renderAchievements()");
assert.match(app.element("#achievement-list").innerHTML, /星屿重启/);
assert.match(app.element("#achievement-list").innerHTML, /已获得/);

const restored = createApp(app.storage);
assert.equal(restored.element("#achievement-count").textContent, "13 / 13");
assert.equal(restored.element(".map-hotspot.garden").dataset.stage, "3");

const firstLevel = createApp();
firstLevel.eval('openGame("rest", 0)');
assert.equal(firstLevel.eval("slide.every((value, i) => value === (i + 1) % 9)"), false);
firstLevel.eval("moveSlide(8)");
assert.equal(firstLevel.element("#total-count").textContent, "1 / 9");

for (let level = 0; level < 3; level++) {
  const puzzle = createApp();
  puzzle.eval(`openGame("garden", ${level})`);
  const path = Array.from(puzzle.eval(`pipePaths[${level}]`));
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    const desired = [
      i > 0 ? path[i - 1] : null,
      i < path.length - 1 ? path[i + 1] : null
    ].filter(value => value !== null);
    for (let turn = 0; turn < 4; turn++) {
      const ports = Array.from(puzzle.eval(`pipe[${cell}].ports`));
      const target = desired.map(next => puzzle.eval(`pipeDirection(${cell}, ${next})`));
      if (ports.every(port => target.includes(port))) break;
      puzzle.eval(`movePipe(${cell})`);
    }
  }
  assert.equal(puzzle.eval("pipeConnected()"), true, `Water puzzle ${level + 1} is solvable`);
}

function findFlowPaths(size, pairs) {
  const endpoints = new Set(pairs.flat());
  function solve(pair, occupied, paths) {
    if (pair === pairs.length) return paths;
    const [start, end] = pairs[pair];
    const path = [start];
    function walk(cell) {
      if (cell === end) return solve(pair + 1, new Set([...occupied, ...path]), [...paths, [...path]]);
      for (const next of [cell - size, cell + 1, cell + size, cell - 1]) {
        if (next < 0 || next >= size * size || path.includes(next) || occupied.has(next) ||
            (endpoints.has(next) && next !== end) ||
            Math.abs(Math.floor(cell / size) - Math.floor(next / size)) +
            Math.abs(cell % size - next % size) !== 1) continue;
        path.push(next);
        const answer = walk(next);
        if (answer) return answer;
        path.pop();
      }
      return null;
    }
    return walk(start);
  }
  return solve(0, new Set(), []);
}

for (let level = 0; level < 3; level++) {
  const puzzle = createApp();
  puzzle.eval(`openGame("signal", ${level})`);
  const data = puzzle.eval(`flowLevels[${level}]`);
  const paths = findFlowPaths(data.size, data.pairs);
  assert.ok(paths, `Signal puzzle ${level + 1} is solvable`);
  paths.forEach(path => path.forEach(cell => puzzle.eval(`moveFlow(${cell})`)));
  assert.equal(puzzle.element("#total-count").textContent, "1 / 9");
}

console.log("Progress, rewards, replay and persistence: OK");
