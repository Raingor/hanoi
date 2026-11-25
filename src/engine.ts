export type Peg = 0 | 1 | 2;
export type Tower = number[][];

export interface GameState {
  diskCount: number;
  pegs: Tower;
  moves: number;
  selectedPeg: Peg | null;
  startedAtMs: number | null;
  elapsedMs: number;
  won: boolean;
}

export interface Move {
  disk: number;
  from: Peg;
  to: Peg;
}

export interface BestRecord {
  moves: number;
  seconds: number;
  diskCount: number;
  at: string;
}

export interface HanoiProgress {
  best: Record<string, BestRecord>;
}

export const MIN_DISKS = 3;
export const MAX_DISKS = 8;
export const PEG_COUNT = 3;

export function minimumMoves(diskCount: number): number {
  validateDiskCount(diskCount);
  return 2 ** diskCount - 1;
}

export function validateDiskCount(diskCount: number): number {
  const count = Math.floor(diskCount);
  if (!Number.isFinite(count)) return MIN_DISKS;
  return Math.max(MIN_DISKS, Math.min(MAX_DISKS, count));
}

export function createGame(diskCount = MIN_DISKS): GameState {
  const count = validateDiskCount(diskCount);
  return {
    diskCount: count,
    pegs: [
      Array.from({ length: count }, (_, index) => count - index),
      [],
      [],
    ],
    moves: 0,
    selectedPeg: null,
    startedAtMs: null,
    elapsedMs: 0,
    won: false,
  };
}

export function cloneGame(game: GameState): GameState {
  return {
    ...game,
    pegs: game.pegs.map(peg => [...peg]),
  };
}

export function topDisk(game: GameState, peg: Peg): number | null {
  const stack = game.pegs[peg];
  return stack.length ? stack[stack.length - 1] : null;
}

export function canMove(game: GameState, from: Peg, to: Peg): boolean {
  if (from === to || game.won) return false;
  const moving = topDisk(game, from);
  if (moving === null) return false;
  const target = topDisk(game, to);
  return target === null || moving < target;
}

export function moveDisk(game: GameState, from: Peg, to: Peg, now = Date.now()): GameState {
  if (!canMove(game, from, to)) return cloneGame(game);
  const next = cloneGame(game);
  const disk = next.pegs[from].pop();
  if (disk === undefined) return next;
  next.pegs[to].push(disk);
  next.moves += 1;
  next.selectedPeg = null;
  next.startedAtMs = next.startedAtMs ?? now;
  if (isWin(next)) {
    next.won = true;
    next.elapsedMs = next.startedAtMs === null ? 0 : now - next.startedAtMs;
  }
  return next;
}

export function selectPeg(game: GameState, peg: Peg): { game: GameState; action: 'select' | 'move' | 'invalid' | 'deselect' } {
  const next = cloneGame(game);
  if (next.won) return { game: next, action: 'invalid' };
  if (next.selectedPeg === null) {
    if (!next.pegs[peg].length) return { game: next, action: 'invalid' };
    next.selectedPeg = peg;
    return { game: next, action: 'select' };
  }
  if (next.selectedPeg === peg) {
    next.selectedPeg = null;
    return { game: next, action: 'deselect' };
  }
  const from = next.selectedPeg;
  if (!canMove(next, from, peg)) return { game: next, action: 'invalid' };
  return { game: moveDisk(next, from, peg), action: 'move' };
}

export function isWin(game: GameState): boolean {
  return game.pegs[2].length === game.diskCount;
}

export function solveMoves(diskCount: number, from: Peg = 0, to: Peg = 2): Move[] {
  const count = validateDiskCount(diskCount);
  const spare = (3 - from - to) as Peg;
  const result: Move[] = [];
  const walk = (countLeft: number, start: Peg, target: Peg, rest: Peg) => {
    if (countLeft <= 0) return;
    walk(countLeft - 1, start, rest, target);
    result.push({ disk: countLeft, from: start, to: target });
    walk(countLeft - 1, rest, target, start);
  };
  walk(count, from, to, spare);
  return result;
}

export function moveAt(game: GameState, sequenceIndex: number): Move | null {
  const sequence = solveMoves(game.diskCount);
  return sequence[sequenceIndex] ?? null;
}

export function gameAfterMoves(diskCount: number, moves: number): GameState {
  let game = createGame(diskCount);
  const sequence = solveMoves(diskCount);
  const count = Math.max(0, Math.min(sequence.length, Math.floor(moves)));
  for (let index = 0; index < count; index += 1) {
    game = moveDisk(game, sequence[index].from, sequence[index].to, index + 1);
  }
  return game;
}

export function undoLastMove(game: GameState, history: Move[]): { game: GameState; history: Move[]; undone: Move | null } {
  const last = history.at(-1);
  if (!last || game.won) return { game: cloneGame(game), history: [...history], undone: null };
  const next = cloneGame(game);
  const disk = next.pegs[last.to].pop();
  if (disk === undefined) return { game: cloneGame(game), history: [...history], undone: null };
  next.pegs[last.from].push(disk);
  next.moves = Math.max(0, next.moves - 1);
  next.won = false;
  return {
    game: next,
    history: history.slice(0, -1),
    undone: { disk, from: last.from, to: last.to },
  };
}

export function parseProgress(raw: string | null): HanoiProgress {
  if (!raw) return { best: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<HanoiProgress>;
    if (!parsed || typeof parsed !== 'object' || !parsed.best || typeof parsed.best !== 'object') return { best: {} };
    const best: Record<string, BestRecord> = {};
    for (const [key, value] of Object.entries(parsed.best)) {
      const record = value as Partial<BestRecord>;
      if (
        Number.isFinite(record?.moves) &&
        Number.isFinite(record?.seconds) &&
        Number.isFinite(record?.diskCount)
      ) {
        best[key] = {
          moves: Math.max(1, Math.floor(record.moves as number)),
          seconds: Math.max(0, Math.floor(record.seconds as number)),
          diskCount: validateDiskCount(record.diskCount as number),
          at: typeof record.at === 'string' ? record.at : '',
        };
      }
    }
    return { best };
  } catch {
    return { best: {} };
  }
}

function isBetter(candidate: Omit<BestRecord, 'at'>, previous: BestRecord | undefined): boolean {
  if (!previous) return true;
  if (candidate.moves !== previous.moves) return candidate.moves < previous.moves;
  return candidate.seconds < previous.seconds;
}

export function recordWin(
  progress: HanoiProgress,
  diskCount: number,
  moves: number,
  seconds: number,
  now = new Date(),
): HanoiProgress {
  const count = validateDiskCount(diskCount);
  const key = String(count);
  const candidate = { moves, seconds, diskCount: count };
  const previous = progress.best[key];
  if (!isBetter(candidate, previous)) return progress;
  return {
    best: {
      ...progress.best,
      [key]: { ...candidate, at: now.toISOString() },
    },
  };
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
