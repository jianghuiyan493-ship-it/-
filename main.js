const games = {
  rest: {
    name: "休息舱", title: "整理能源模块", type: "数字华容道",
    instruction: "点击空格旁的数字，将 1 到 8 按顺序排好。",
    tip: "也可以使用方向键移动空格。", done: "休息舱的灯亮了。"
  },
  garden: {
    name: "温室", title: "接通灌溉水路", type: "旋转水管",
    instruction: "点击管道使它旋转，让水从金色起点流到珊瑚色终点。",
    tip: "每点击一次，管道顺时针旋转 90°。", done: "温室的水循环恢复了。"
  },
  signal: {
    name: "通讯塔", title: "连接星际信号", type: "信号连线",
    instruction: "点选一个字母，再逐格连接到同字母终点；不同线路不能共用格子。",
    tip: "点击已走过的格子可以退回那一步。", done: "通讯塔重新收到了远方的回音。"
  }
};
const achievementNames = {
  rest: ["舱门解锁", "能源归位", "安稳之夜"],
  garden: ["第一滴水", "绿意回归", "温室复苏"],
  signal: ["微弱电波", "线路接通", "远方回音"]
};
const facilityBadges = {
  rest: "休息舱守护者",
  garden: "温室培育者",
  signal: "星际联络员"
};

const pipePaths = [
  [0, 1, 2, 6, 10, 11, 15],
  [4, 0, 1, 5, 9, 10, 6, 7, 11, 15],
  [0, 4, 8, 9, 5, 1, 2, 6, 10, 11, 15]
];
const flowLevels = [
  { size: 3, pairs: [[0, 8], [3, 7]] },
  { size: 4, pairs: [[0, 14], [3, 15]] },
  { size: 4, pairs: [[0, 10], [3, 14], [4, 9]] }
];
const colors = ["#79e1cf", "#ff9a7c", "#ffd17a"];
const directions = [-4, 1, 4, -1];
const letters = ["A", "B", "C"];
const board = document.querySelector("#game-board");
const overlay = document.querySelector("#complete-overlay");
let progress = loadProgress();
let currentGame = null;
let level = 0;
let moves = 0;
let slide = [];
let pipe = [];
let flow = [];
let selected = null;
let won = false;
let achievementReturn = "base";

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem("star-base-progress") || "{}");
    return Object.fromEntries(Object.keys(games).map(key => [
      key, Array.from({ length: 3 }, (_, i) => Boolean(data[key]?.[i]))
    ]));
  } catch {
    return { rest: [false, false, false], garden: [false, false, false], signal: [false, false, false] };
  }
}

function saveProgress() {
  try { localStorage.setItem("star-base-progress", JSON.stringify(progress)); } catch {}
}

function updateProgress() {
  const total = Object.values(progress).flat().filter(Boolean).length;
  document.querySelector("#total-count").textContent = `${total} / 9`;
  document.querySelector("#base-message").hidden = total !== 9;
  document.querySelector("#map-screen").classList.toggle("base-restored", total === 9);
  const earned = total + Object.keys(games).filter(key => progress[key].every(Boolean)).length + Number(total === 9);
  document.querySelector("#achievement-count").textContent = `${earned} / 13`;
  for (const key of Object.keys(games)) {
    const count = progress[key].filter(Boolean).length;
    document.querySelector(`[data-map-status="${key}"]`).textContent = count === 3 ? "已修复" : `${count} / 3`;
    document.querySelector(`[data-list-status="${key}"]`).textContent = count === 3 ? "已修复" : `${count} / 3`;
    const hotspot = document.querySelector(`.map-hotspot.${key}`);
    hotspot.dataset.stage = String(count);
    hotspot.setAttribute("aria-label", `进入${games[key].name}，${games[key].type}，已完成 ${count} / 3 关`);
    document.querySelectorAll(`.map-hotspot.${key} .repair-pips i`).forEach((pip, i) => {
      pip.classList.toggle("lit", progress[key][i]);
    });
    document.querySelector(`.location-list button[data-game="${key}"]`).classList.toggle("facility-restored", count === 3);
  }
}

function renderAchievements() {
  const total = Object.values(progress).flat().filter(Boolean).length;
  const completeFacilities = Object.keys(games).filter(key => progress[key].every(Boolean)).length;
  document.querySelector("#achievement-summary").textContent = `已获得 ${total + completeFacilities + Number(total === 9)} / 13`;
  const groups = Object.keys(games).map(key => {
    const seals = achievementNames[key].map((name, i) =>
      achievementItem(name, `完成${games[key].name}第 ${i + 1} 关`, progress[key][i], String(i + 1).padStart(2, "0"))
    ).join("");
    return `<section class="achievement-group"><div class="achievement-group-heading"><h2>${games[key].name}</h2><span>${progress[key].filter(Boolean).length} / 3 关</span></div>
      <div class="achievement-items">${seals}${achievementItem(facilityBadges[key], `完成${games[key].name}全部三关`, progress[key].every(Boolean), "✦", true)}</div></section>`;
  });
  groups.push(`<section class="achievement-group grand-group"><div class="achievement-group-heading"><h2>基地总成就</h2><span>${completeFacilities} / 3 设施</span></div>
    <div class="achievement-items">${achievementItem("星屿重启", "修复全部三座设施", total === 9, "★", true)}</div></section>`);
  document.querySelector("#achievement-list").innerHTML = groups.join("");
}

function achievementItem(name, condition, unlocked, icon, special = false) {
  return `<div class="achievement-item ${unlocked ? "unlocked" : "locked"} ${special ? "badge-item" : ""}">
    <span class="achievement-emblem" aria-hidden="true">${icon}</span>
    <span class="achievement-copy"><strong>${name}</strong><small>${condition}</small></span>
    <span class="achievement-state">${unlocked ? "已获得" : "未解锁"}</span>
  </div>`;
}

function showMap() {
  overlay.hidden = true;
  currentGame = null;
  document.querySelector("#map-screen").hidden = false;
  document.querySelector("#game-screen").hidden = true;
  document.querySelector("#achievement-screen").hidden = true;
  updateProgress();
  window.scrollTo(0, 0);
}

function showAchievements() {
  overlay.hidden = true;
  achievementReturn = currentGame || "base";
  document.querySelector("#map-screen").hidden = true;
  document.querySelector("#game-screen").hidden = true;
  document.querySelector("#achievement-screen").hidden = false;
  renderAchievements();
  window.scrollTo(0, 0);
}

function openGame(key, requestedLevel) {
  if (!games[key]) return showMap();
  currentGame = key;
  level = requestedLevel ?? Math.max(0, progress[key].findIndex(done => !done));
  level = Math.min(level, 2);
  document.querySelector("#map-screen").hidden = true;
  document.querySelector("#game-screen").hidden = false;
  document.querySelector("#achievement-screen").hidden = true;
  document.querySelector("#game-kicker").textContent = `${games[key].name} · ${games[key].type}`;
  document.querySelector("#game-title").textContent = games[key].title;
  document.querySelector("#game-instruction").textContent = games[key].instruction;
  document.querySelector("#mission-title").textContent = games[key].name;
  document.querySelector("#game-tip").textContent = games[key].tip;
  startLevel();
  window.scrollTo(0, 0);
}

function startLevel() {
  moves = 0;
  won = false;
  overlay.hidden = true;
  document.querySelector("#game-counter").textContent = `第 ${level + 1} / 3 关`;
  if (currentGame === "rest") initSlide();
  if (currentGame === "garden") initPipe();
  if (currentGame === "signal") initFlow();
  renderLevels();
  render();
}

function renderLevels() {
  document.querySelector("#level-list").innerHTML = progress[currentGame].map((done, i) =>
    `<button type="button" data-level="${i}" class="${i === level ? "active" : ""}" ${i === level ? 'aria-current="step"' : ""}><span>任务 ${String(i + 1).padStart(2, "0")}</span><span>${done ? "完成" : i === level ? "进行中" : "未完成"}</span></button>`
  ).join("");
}

function render() {
  document.querySelector("#move-count").textContent = `操作 ${moves} 次`;
  if (currentGame === "rest") renderSlide();
  if (currentGame === "garden") renderPipe();
  if (currentGame === "signal") renderFlow();
}

function adjacent(a, b, size) {
  return Math.abs(Math.floor(a / size) - Math.floor(b / size)) +
    Math.abs(a % size - b % size) === 1;
}

function initSlide() {
  slide = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  const target = [1, 7, 13][level];
  let seed = 41 + level * 79;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let last = -1;
  for (let i = 0; i < [1, 18, 38][level]; i++) {
    const blank = slide.indexOf(0);
    const options = slide.map((_, index) => index).filter(index => adjacent(index, blank, 3) && index !== last);
    const next = options[Math.floor(random() * options.length)];
    [slide[blank], slide[next]] = [slide[next], slide[blank]];
    last = blank;
  }
  // Avoid an accidentally trivial late-stage random walk.
  if (level > 0 && slide.reduce((sum, value, index) => sum + (value && value !== index + 1 ? 1 : 0), 0) < target / 2) {
    initSlideRetry(target);
  }
}

function initSlideRetry(target) {
  slide = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let blank = 8;
  for (let i = 0; i < target; i++) {
    const next = [7, 4, 3, 0, 1, 2, 5, 8, 7, 6, 3, 4, 5][i];
    if (adjacent(blank, next, 3)) {
      [slide[blank], slide[next]] = [slide[next], slide[blank]];
      blank = next;
    }
  }
}

function renderSlide() {
  board.style.gridTemplateColumns = "repeat(3, 1fr)";
  board.innerHTML = slide.map((number, index) =>
    `<button type="button" class="slide-tile ${number ? "" : "empty"}" data-cell="${index}" ${number ? `aria-label="移动数字 ${number}"` : 'aria-label="空格" disabled'}>${number || ""}</button>`
  ).join("");
}

function moveSlide(index) {
  const blank = slide.indexOf(0);
  if (!adjacent(index, blank, 3)) return;
  [slide[blank], slide[index]] = [slide[index], slide[blank]];
  moves++;
  render();
  if (slide.every((value, i) => value === (i + 1) % 9)) complete();
}

function pipeDirection(a, b) {
  if (b === a - 4) return 0;
  if (b === a + 1) return 1;
  if (b === a + 4) return 2;
  return 3;
}

function initPipe() {
  pipe = Array(16).fill(null);
  const path = pipePaths[level];
  path.forEach((cell, i) => {
    const ports = [];
    if (i > 0) ports.push(pipeDirection(cell, path[i - 1]));
    if (i < path.length - 1) ports.push(pipeDirection(cell, path[i + 1]));
    const turns = (i + level) % 3 + 1;
    pipe[cell] = { ports: ports.map(dir => (dir + turns) % 4), endpoint: i === 0 ? "source" : i === path.length - 1 ? "target" : "" };
  });
}

function renderPipe() {
  board.style.gridTemplateColumns = "repeat(4, 1fr)";
  board.innerHTML = pipe.map((tile, index) => {
    if (!tile) return '<div class="pipe-empty" aria-hidden="true"></div>';
    return `<button type="button" class="pipe-tile ${tile.endpoint}" data-cell="${index}" aria-label="旋转管道 ${index + 1}">
      ${tile.ports.map(dir => `<i class="pipe-arm ${"nesw"[dir]}" aria-hidden="true"></i>`).join("")}
      <i class="pipe-hub" aria-hidden="true"></i>
      ${tile.endpoint ? `<span class="endpoint-mark">${tile.endpoint === "source" ? "起" : "终"}</span>` : ""}
    </button>`;
  }).join("");
}

function pipeConnected() {
  const start = pipePaths[level][0];
  const finish = pipePaths[level].at(-1);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cell = queue.shift();
    if (cell === finish) return true;
    for (const dir of pipe[cell].ports) {
      const next = cell + directions[dir];
      if (next < 0 || next >= 16 || !adjacent(cell, next, 4) || !pipe[next] ||
          !pipe[next].ports.includes((dir + 2) % 4) || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

function movePipe(index) {
  if (!pipe[index]) return;
  pipe[index].ports = pipe[index].ports.map(dir => (dir + 1) % 4);
  moves++;
  render();
  if (pipeConnected()) complete();
}

function initFlow() {
  flow = flowLevels[level].pairs.map(([start]) => [start]);
  selected = null;
}

function renderFlow() {
  const { size, pairs } = flowLevels[level];
  board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  const occupied = new Map();
  flow.forEach((path, pair) => path.forEach(cell => occupied.set(cell, pair)));
  board.innerHTML = Array.from({ length: size * size }, (_, cell) => {
    const endpoint = pairs.findIndex(pair => pair.includes(cell));
    const trace = occupied.get(cell);
    const owner = endpoint >= 0 ? endpoint : trace;
    return `<button type="button" class="flow-cell ${endpoint >= 0 ? "endpoint" : ""} ${trace !== undefined ? "traced" : ""} ${selected === owner && endpoint === pairs[owner]?.[0] ? "selected" : ""}" data-cell="${cell}" style="${owner !== undefined ? `--trace:${colors[owner]}` : ""}" aria-label="${endpoint >= 0 ? `${letters[endpoint]} 端点` : trace !== undefined ? `${letters[trace]} 线路` : "空格"}">${endpoint >= 0 ? letters[endpoint] : ""}</button>`;
  }).join("");
  const lines = flow.map((path, pair) => path.length > 1 ?
    `<polyline points="${path.map(cell => `${cell % size * 100 + 50},${Math.floor(cell / size) * 100 + 50}`).join(" ")}" fill="none" stroke="${colors[pair]}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` : ""
  ).join("");
  board.insertAdjacentHTML("beforeend", `<svg class="flow-lines" viewBox="0 0 ${size * 100} ${size * 100}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`);
}

function moveFlow(cell) {
  const { size, pairs } = flowLevels[level];
  const endpoint = pairs.findIndex(pair => pair.includes(cell));
  if (endpoint >= 0 && cell === pairs[endpoint][0]) {
    selected = endpoint;
    flow[endpoint] = [cell];
    moves++;
    render();
    return;
  }
  if (selected === null) return;
  const path = flow[selected];
  const previous = path.at(-1);
  const inPath = path.indexOf(cell);
  if (inPath >= 0) {
    if (inPath < path.length - 1) {
      flow[selected] = path.slice(0, inPath + 1);
      moves++;
      render();
    }
    return;
  }
  if (!adjacent(previous, cell, size) || flow.some((other, i) => i !== selected && other.includes(cell))) return;
  if (endpoint >= 0 && endpoint !== selected) return;
  if (path.includes(pairs[selected][1])) return;
  path.push(cell);
  moves++;
  render();
  if (flow.every((other, i) => other.includes(pairs[i][1]))) complete();
}

function complete() {
  if (won) return;
  won = true;
  const firstClear = !progress[currentGame][level];
  progress[currentGame][level] = true;
  saveProgress();
  updateProgress();
  renderLevels();
  document.querySelector("#complete-title").textContent = `任务 ${String(level + 1).padStart(2, "0")} 完成`;
  document.querySelector("#complete-detail").textContent = level === 2 ? games[currentGame].done : "这处设施又恢复了一点生机。";
  const rewards = firstClear ? [achievementNames[currentGame][level]] : [];
  if (firstClear && progress[currentGame].every(Boolean)) rewards.push(facilityBadges[currentGame]);
  if (firstClear && Object.values(progress).every(levels => levels.every(Boolean))) rewards.push("星屿重启");
  document.querySelector("#earned-achievements").innerHTML = rewards.length
    ? `<p>新成就解锁</p>${rewards.map(name => `<span>✦ ${name}</span>`).join("")}`
    : '<p>再次完成任务</p>';
  document.querySelector("#complete-next").textContent = level === 2 ? "返回基地" : "下一关";
  overlay.hidden = false;
  document.querySelector("#complete-next").focus();
}

function navigate() {
  const key = location.hash.slice(1);
  if (key === "achievements") showAchievements();
  else if (games[key]) openGame(key);
  else showMap();
}

document.querySelectorAll("[data-game]").forEach(button => button.addEventListener("click", () => {
  const key = button.dataset.game;
  if (location.hash === `#${key}`) openGame(key);
  else location.hash = key;
}));
document.querySelector("#back-button").addEventListener("click", () => { location.hash = "base"; });
document.querySelector("[data-show-achievements]").addEventListener("click", () => {
  if (location.hash !== "#achievements") location.hash = "achievements";
  else showAchievements();
});
document.querySelector("[data-back-from-achievements]").addEventListener("click", () => {
  location.hash = achievementReturn;
});
document.querySelector("#restart-button").addEventListener("click", startLevel);
document.querySelector("#complete-back").addEventListener("click", () => { location.hash = "base"; });
document.querySelector("#complete-next").addEventListener("click", () => {
  if (level === 2) location.hash = "base";
  else { level++; startLevel(); }
});
document.querySelector("#level-list").addEventListener("click", event => {
  const button = event.target.closest("[data-level]");
  if (!button) return;
  level = Number(button.dataset.level);
  startLevel();
});
board.addEventListener("click", event => {
  if (won) return;
  const button = event.target.closest("[data-cell]");
  if (!button) return;
  const cell = Number(button.dataset.cell);
  if (currentGame === "rest") moveSlide(cell);
  if (currentGame === "garden") movePipe(cell);
  if (currentGame === "signal") moveFlow(cell);
});
document.addEventListener("keydown", event => {
  if (currentGame !== "rest" || won || overlay.hidden === false) return;
  const blank = slide.indexOf(0);
  const offsets = { ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1 };
  if (!(event.key in offsets)) return;
  event.preventDefault();
  const next = blank + offsets[event.key];
  if (next >= 0 && next < 9) moveSlide(next);
});
window.addEventListener("hashchange", navigate);
navigate();
