import './style.css';
import { icon } from './icons';
import {
  MAX_DISKS,
  MIN_DISKS,
  createGame,
  formatTime,
  minimumMoves,
  moveDisk,
  parseProgress,
  recordWin,
  selectPeg,
  solveMoves,
  topDisk,
  undoLastMove,
  type GameState,
  type Move,
  type Peg,
} from './engine';

const SAVE_KEY = 'joke-bear-hanoi-progress-v1';
const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) throw new Error('缺少应用挂载节点');
const app: HTMLDivElement = appElement;

let diskCount = MIN_DISKS;
let game: GameState = createGame(diskCount);
let history: Move[] = [];
let autoIndex = 0;
let autoTimer: number | undefined;
let autoRunning = false;
let clockTimer: number | undefined;
let toastTimer: number | undefined;

function elapsedSeconds(): number {
  if (game.won) return Math.floor(game.elapsedMs / 1000);
  if (game.startedAtMs === null) return 0;
  return Math.floor((Date.now() - game.startedAtMs) / 1000);
}

function loadProgress() {
  try {
    return parseProgress(localStorage.getItem(SAVE_KEY));
  } catch {
    return { best: {} };
  }
}

function saveProgress(progress: ReturnType<typeof loadProgress>): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage may be unavailable; gameplay still works.
  }
}

function renderShell(): void {
  app.innerHTML = `
    <div class="paper-shell">
      <header class="topbar">
        <a class="brand" href="./" aria-label="汉诺塔首页">
          <span class="brand-mark">${icon('disc')}</span>
          <span class="brand-copy">
            <strong>汉诺塔</strong>
            <small>JOKE BEAR'S QUIET TOWER</small>
          </span>
        </a>
        <div class="disk-controls" aria-label="圆盘数量选择">
          <button class="round-button" type="button" data-action="disk-minus" aria-label="减少一层">${icon('chevronLeft')}</button>
          <span class="disk-label"><strong id="disk-count">${diskCount}</strong> 层</span>
          <button class="round-button" type="button" data-action="disk-plus" aria-label="增加一层">${icon('chevronRight')}</button>
        </div>
      </header>

      <main class="layout">
        <section class="game-card" aria-labelledby="game-title">
          <div class="game-heading">
            <div>
              <p class="eyebrow">小熊的圆盘花园</p>
              <h1 id="game-title">把圆盘轻轻搬到右边</h1>
              <p class="lede">先点有圆盘的柱子，再点要放下的柱子。大圆盘不能压在小圆盘上，键盘可按 1、2、3 选择柱子。</p>
            </div>
            <div class="stat-strip" aria-label="本局数据">
              <div class="stat"><span>${icon('steps')} 步数</span><strong id="stat-moves">0</strong></div>
              <div class="stat"><span>${icon('spark')} 最少</span><strong id="stat-min">${minimumMoves(diskCount)}</strong></div>
              <div class="stat"><span>${icon('timer')} 计时</span><strong id="stat-time">00:00</strong></div>
            </div>
          </div>

          <div class="tower-board" id="tower-board" aria-label="汉诺塔棋盘">
            ${[0, 1, 2].map(index => `
              <button type="button" class="peg" data-peg="${index}" aria-label="柱子 ${index + 1}">
                <span class="peg-key">${index + 1}</span>
                <span class="peg-rod" aria-hidden="true"></span>
                <span class="peg-base" aria-hidden="true"></span>
                <span class="disk-stack" aria-hidden="true"></span>
              </button>
            `).join('')}
          </div>

          <div id="message" class="message" role="status" aria-live="polite">选择一根柱子，拿起最上面的圆盘。</div>

          <div class="action-row">
            <button class="secondary-button" type="button" data-action="undo">${icon('undo')} 撤销一步</button>
            <button class="secondary-button" type="button" data-action="reset">${icon('reset')} 重新开始</button>
            <button class="primary-button" type="button" data-action="auto">${icon('play')} 自动演示</button>
          </div>
        </section>

        <aside class="bear-aside" aria-label="小熊陪伴">
          <div class="bear-card">
            <div class="bear-halo"></div>
            <img class="bear-image" src="./characters/classic.webp" alt="Joke Bear 小熊" width="320" height="320" />
            <span class="tape tape-one" aria-hidden="true"></span>
            <span class="tape tape-two" aria-hidden="true"></span>
          </div>
          <div class="bear-side-copy">
            <p class="speech-kicker">小熊说</p>
            <p id="bear-bubble" class="bear-bubble">大圆盘喜欢待在下面。我们一层一层来，不用着急。</p>
            <div class="mini-progress">
              <span class="mini-progress-top"><span>当前最佳</span><strong id="best-text">尚无记录</strong></span>
              <div class="progress-track" role="progressbar" aria-label="完成比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span id="progress-fill"></span>
              </div>
            </div>
            <div class="best-note">${icon('info')}<span>撤销会回退一步；自动演示会按最少步数完成当前层数。</span></div>
          </div>
        </aside>
      </main>

      <footer class="footer">
        <span>Joke Bear 的安静小游戏</span>
        <span class="footer-dot" aria-hidden="true"></span>
        <span>最佳成绩保存在本机</span>
      </footer>
    </div>
    <div id="win-root"></div>
    <div id="toast" class="toast" role="status"></div>
    <div id="live" class="sr-only" aria-live="polite"></div>
  `;
  app.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown);
  renderGame();
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const pegButton = target.closest<HTMLButtonElement>('[data-peg]');
  if (pegButton) {
    handlePeg(Number(pegButton.dataset.peg) as Peg);
    return;
  }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'reset') resetGame();
  if (action === 'undo') undoMove();
  if (action === 'auto') toggleAuto();
  if (action === 'disk-minus') changeDisks(-1);
  if (action === 'disk-plus') changeDisks(1);
  if (action === 'overlay-close') closeOverlay();
  if (action === 'overlay-replay') {
    closeOverlay();
    resetGame();
  }
  if (action === 'overlay-more') {
    closeOverlay();
    changeDisks(1);
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (['1', '2', '3'].includes(event.key)) {
    event.preventDefault();
    handlePeg((Number(event.key) - 1) as Peg);
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    resetGame();
  }
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undoMove();
  }
}

function renderGame(focusPeg?: Peg): void {
  stopClock();
  renderPegs();
  renderStats();
  updateBear();
  updateControls();
  document.querySelector<HTMLElement>('#disk-count')!.textContent = String(diskCount);
  if (!game.won) startClock();
  if (focusPeg !== undefined) {
    document.querySelector<HTMLButtonElement>(`[data-peg="${focusPeg}"]`)?.focus({ preventScroll: true });
  }
}

function renderPegs(): void {
  document.querySelectorAll<HTMLButtonElement>('.peg').forEach(button => {
    const peg = Number(button.dataset.peg) as Peg;
    const stack = game.pegs[peg];
    const selected = game.selectedPeg === peg;
    const movableTop = game.selectedPeg !== null ? movableDiskWidth(game.selectedPeg) : null;
    button.classList.toggle('selected', selected);
    button.classList.toggle('drop-target', game.selectedPeg !== null && movableTop !== null && isLegalTarget(peg));
    button.setAttribute(
      'aria-label',
      `柱子 ${peg + 1}${selected ? '，已选中' : ''}${stack.length ? `，从下到上 ${stack.join('、')}` : '，空的'}`,
    );
    const stackElement = button.querySelector<HTMLElement>('.disk-stack')!;
    stackElement.innerHTML = stack.map((disk, index) => `
      <span class="disk disk-${disk}${selected && index === stack.length - 1 ? ' lifted' : ''}" style="--disk-width:${diskWidth(disk)}%" aria-hidden="true">
        <i></i>
      </span>
    `).join('');
    const key = button.querySelector<HTMLElement>('.peg-key')!;
    key.classList.toggle('active', selected);
  });
}

function diskWidth(disk: number): number {
  return 24 + ((disk - 1) / Math.max(1, diskCount - 1)) * 64;
}

function movableDiskWidth(from: Peg): number | null {
  const disk = topDisk(game, from);
  return disk === null ? null : diskWidth(disk);
}

function isLegalTarget(peg: Peg): boolean {
  if (game.selectedPeg === null || game.selectedPeg === peg) return false;
  const moving = topDisk(game, game.selectedPeg);
  const target = topDisk(game, peg);
  return moving !== null && (target === null || moving < target);
}

function handlePeg(peg: Peg): void {
  if (autoRunning) stopAuto();
  const before = game.selectedPeg;
  const beforeMoves = game.moves;
  const result = selectPeg(game, peg);
  game = result.game;
  const message = document.querySelector('#message')!;
  if (result.action === 'select') {
    message.textContent = `拿起柱子 ${peg + 1} 最上面的圆盘。`;
    announce(`已选中柱子 ${peg + 1}。`);
  } else if (result.action === 'deselect') {
    message.textContent = '已放下手中的选择，可以重新挑一根柱子。';
    announce('已取消选择。');
  } else if (result.action === 'invalid') {
    const targetDisk = topDisk(game, peg);
    const moving = before === null ? null : topDisk(game, before);
    const reason = targetDisk !== null && moving !== null && moving > targetDisk
      ? '大圆盘不能压在小圆盘上。'
      : '这根柱子现在不能移动。';
    message.textContent = reason;
    message.classList.add('warn');
    window.setTimeout(() => message.classList.remove('warn'), 420);
    showToast(reason);
    announce(reason);
  } else if (result.action === 'move') {
    const disk = topDisk(game, peg);
    if (beforeMoves !== game.moves) {
      history.push({ disk: game.pegs[peg].at(-1) ?? disk ?? 0, from: before as Peg, to: peg });
      autoIndex += 1;
    }
    message.textContent = `圆盘已放到柱子 ${peg + 1}。`;
    announce(`移动完成，当前 ${game.moves} 步。`);
  }
  renderPegs();
  renderStats();
  updateBear();
  updateControls();
  if (game.won) finishGame();
}

function finishGame(): void {
  stopAuto();
  stopClock();
  const seconds = elapsedSeconds();
  const progress = loadProgress();
  const updated = recordWin(progress, diskCount, game.moves, seconds);
  saveProgress(updated);
  updateControls();
  renderPegs();
  renderStats();
  updateBear();
  showWin(seconds);
  announce(`完成汉诺塔，共 ${game.moves} 步。`);
}

function resetGame(): void {
  stopAuto();
  game = createGame(diskCount);
  history = [];
  autoIndex = 0;
  document.querySelector('#win-root')!.innerHTML = '';
  const message = document.querySelector('#message')!;
  message.textContent = '选择一根柱子，拿起最上面的圆盘。';
  renderGame();
  showToast('圆盘已回到左边第一根柱子。');
}

function undoMove(): void {
  if (autoRunning) stopAuto();
  const result = undoLastMove(game, history);
  if (!result.undone) {
    showToast('现在还没有可以撤销的一步。');
    return;
  }
  game = result.game;
  history = result.history;
  autoIndex = Math.max(0, autoIndex - 1);
  document.querySelector('#win-root')!.innerHTML = '';
  renderGame();
  showToast(`已撤销圆盘 ${result.undone.disk} 的移动。`);
  announce('已撤销一步。');
}

function changeDisks(delta: number): void {
  const next = Math.max(MIN_DISKS, Math.min(MAX_DISKS, diskCount + delta));
  if (next === diskCount) {
    showToast(delta > 0 ? '最多八层，先从这里慢慢练。' : '最少三层，刚刚好适合开始。');
    return;
  }
  diskCount = next;
  stopAuto();
  game = createGame(diskCount);
  history = [];
  autoIndex = 0;
  document.querySelector('#win-root')!.innerHTML = '';
  document.querySelector<HTMLElement>('#disk-count')!.textContent = String(diskCount);
  document.querySelector('#message')!.textContent = `现在是 ${diskCount} 层圆盘。先观察一下，再动手。`;
  renderGame();
}

function toggleAuto(): void {
  if (autoRunning) {
    stopAuto();
    showToast('自动演示已暂停。');
    return;
  }
  if (game.won) {
    showToast('已经完成了，可以重新开始再看一次。');
    return;
  }
  autoRunning = true;
  const button = document.querySelector<HTMLButtonElement>('[data-action="auto"]')!;
  button.innerHTML = `${icon('pause')} 暂停演示`;
  button.classList.add('running');
  document.querySelector('#message')!.textContent = '小熊正在按最少步数慢慢演示。';
  autoTimer = window.setInterval(() => {
    const sequence = solveMoves(diskCount);
    const move = sequence[autoIndex];
    if (!move || game.won) {
      stopAuto();
      return;
    }
    game = moveDisk(game, move.from, move.to);
    history.push(move);
    autoIndex += 1;
    renderPegs();
    renderStats();
    updateBear();
    announce(`自动演示第 ${game.moves} 步。`);
    if (game.won) finishGame();
  }, 430);
}

function stopAuto(): void {
  if (autoTimer !== undefined) window.clearInterval(autoTimer);
  autoTimer = undefined;
  autoRunning = false;
  const button = document.querySelector<HTMLButtonElement>('[data-action="auto"]');
  if (button) {
    button.innerHTML = `${icon('play')} 自动演示`;
    button.classList.remove('running');
  }
}

function startClock(): void {
  clockTimer = window.setInterval(renderStats, 250);
}

function stopClock(): void {
  if (clockTimer !== undefined) window.clearInterval(clockTimer);
  clockTimer = undefined;
}

function renderStats(): void {
  const moves = document.querySelector('#stat-moves');
  const min = document.querySelector('#stat-min');
  const time = document.querySelector('#stat-time');
  if (moves) moves.textContent = String(game.moves);
  if (min) min.textContent = String(minimumMoves(diskCount));
  if (time) time.textContent = formatTime(elapsedSeconds());
  const progress = Math.round((game.pegs[2].length / diskCount) * 100);
  const fill = document.querySelector<HTMLElement>('#progress-fill');
  const track = document.querySelector('.progress-track');
  if (fill) fill.style.width = `${progress}%`;
  if (track) track.setAttribute('aria-valuenow', String(progress));
}

function updateControls(): void {
  const minus = document.querySelector<HTMLButtonElement>('[data-action="disk-minus"]');
  const plus = document.querySelector<HTMLButtonElement>('[data-action="disk-plus"]');
  const undo = document.querySelector<HTMLButtonElement>('[data-action="undo"]');
  const auto = document.querySelector<HTMLButtonElement>('[data-action="auto"]');
  if (minus) minus.disabled = diskCount <= MIN_DISKS;
  if (plus) plus.disabled = diskCount >= MAX_DISKS;
  if (undo) undo.disabled = history.length === 0;
  if (auto) auto.disabled = game.won;
  const best = loadProgress().best[String(diskCount)];
  const bestText = document.querySelector('#best-text');
  if (bestText) bestText.textContent = best ? `${best.moves} 步 · ${formatTime(best.seconds)}` : '尚无记录';
}

function updateBear(): void {
  const bubble = document.querySelector('#bear-bubble');
  if (!bubble) return;
  if (game.won) {
    bubble.textContent = '圆盘都排好了。你看，它们像一座安静的小山。';
  } else if (game.selectedPeg !== null) {
    bubble.textContent = '现在要找一根能接住它的柱子。记住，小的要留在上面。';
  } else if (game.moves > minimumMoves(diskCount)) {
    bubble.textContent = '步数多了一点也没关系。慢下来，先把最小的圆盘腾出来。';
  } else if (game.moves > 0) {
    bubble.textContent = '很好，就这样一层一层换位置。小熊在旁边给你数着。';
  } else {
    bubble.textContent = '大圆盘喜欢待在下面。我们一层一层来，不用着急。';
  }
}

function showWin(seconds: number): void {
  const root = document.querySelector<HTMLDivElement>('#win-root')!;
  const perfect = game.moves === minimumMoves(diskCount);
  const best = loadProgress().best[String(diskCount)];
  root.innerHTML = `
    <div class="win-overlay">
      <section class="win-card" role="dialog" aria-modal="true" aria-labelledby="win-title">
        <button class="win-close" type="button" data-action="overlay-close" aria-label="关闭成绩卡">${icon('close')}</button>
        <div class="win-badge">${icon('disc')}</div>
        <p class="eyebrow">THE TOWER IS COMPLETE</p>
        <h2 id="win-title">${perfect ? '完美的最少步数' : '圆盘排好啦'}</h2>
        <p class="win-copy">${perfect ? '每一步都刚刚好。小熊想把这座塔收进今天的回忆里。' : '虽然不是最少步数，但你已经让整座塔稳稳落好。下一次可以更轻巧。'}</p>
        <div class="win-grid">
          <div><span>完成步数</span><strong>${game.moves}</strong></div>
          <div><span>最少步数</span><strong>${minimumMoves(diskCount)}</strong></div>
          <div><span>完成时间</span><strong>${formatTime(seconds)}</strong></div>
        </div>
        <div class="win-best">${icon('spark')} 本层最佳：${best ? `${best.moves} 步，${formatTime(best.seconds)}` : '刚刚记录'}</div>
        <div class="win-actions">
          ${diskCount < MAX_DISKS ? `<button class="primary-button" type="button" data-action="overlay-more">挑战 ${diskCount + 1} 层</button>` : ''}
          <button class="secondary-button" type="button" data-action="overlay-replay">${icon('reset')} 再玩一次</button>
        </div>
      </section>
    </div>
  `;
  root.querySelector<HTMLButtonElement>('.win-actions button')?.focus();
}

function closeOverlay(): void {
  document.querySelector('#win-root')!.innerHTML = '';
  document.querySelector<HTMLButtonElement>('.peg')?.focus({ preventScroll: true });
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  const toast = document.querySelector<HTMLDivElement>('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function announce(message: string): void {
  const live = document.querySelector('#live');
  if (live) live.textContent = message;
}

renderShell();
