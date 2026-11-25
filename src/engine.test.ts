import { describe, expect, it } from 'vitest';
import {
  MAX_DISKS,
  MIN_DISKS,
  canMove,
  cloneGame,
  createGame,
  formatTime,
  gameAfterMoves,
  isWin,
  minimumMoves,
  moveDisk,
  parseProgress,
  recordWin,
  selectPeg,
  solveMoves,
  undoLastMove,
  validateDiskCount,
} from './engine';

describe('hanoi rules', () => {
  it('creates a valid tower with the largest disk at the bottom', () => {
    const game = createGame(5);
    expect(game.pegs).toEqual([[5, 4, 3, 2, 1], [], []]);
    expect(game.moves).toBe(0);
    expect(isWin(game)).toBe(false);
  });

  it('clamps disk count to the supported three-to-eight range', () => {
    expect(validateDiskCount(1)).toBe(MIN_DISKS);
    expect(validateDiskCount(9)).toBe(MAX_DISKS);
    expect(validateDiskCount(4.8)).toBe(4);
    expect(validateDiskCount(Number.NaN)).toBe(MIN_DISKS);
  });

  it('computes minimum moves as two to the n minus one', () => {
    expect(minimumMoves(3)).toBe(7);
    expect(minimumMoves(4)).toBe(15);
    expect(minimumMoves(8)).toBe(255);
  });

  it('rejects placing a larger disk on a smaller disk', () => {
    let game = createGame(3);
    game = moveDisk(game, 0, 1);
    game = moveDisk(game, 0, 2);
    expect(canMove(game, 0, 2)).toBe(false);
    game = moveDisk(game, 0, 1);
    expect(canMove(game, 0, 1)).toBe(false);
  });

  it('moves only the top disk and increments the counter once', () => {
    let game = createGame(4);
    const before = game.pegs[0].length;
    game = moveDisk(game, 0, 2);
    expect(game.pegs[0].length).toBe(before - 1);
    expect(game.pegs[2]).toEqual([1]);
    expect(game.moves).toBe(1);
    const copy = cloneGame(game);
    expect(copy.pegs).toEqual(game.pegs);
    expect(copy.pegs).not.toBe(game.pegs);
  });

  it('selects, deselects, and reports invalid empty-peg selections', () => {
    let game = createGame(3);
    const empty = selectPeg(game, 1);
    expect(empty.action).toBe('invalid');
    const selected = selectPeg(game, 0);
    expect(selected.action).toBe('select');
    expect(selected.game.selectedPeg).toBe(0);
    const deselected = selectPeg(selected.game, 0);
    expect(deselected.action).toBe('deselect');
    const moved = selectPeg(selectPeg(game, 0).game, 1);
    expect(moved.action).toBe('move');
    expect(moved.game.moves).toBe(1);
  });

  it('generates the exact minimum solution and wins in that many moves', () => {
    const sequence = solveMoves(4);
    expect(sequence).toHaveLength(15);
    let game = createGame(4);
    sequence.forEach(move => {
      game = moveDisk(game, move.from, move.to);
    });
    expect(game.moves).toBe(15);
    expect(isWin(game)).toBe(true);
    expect(game.won).toBe(true);
    expect(game.pegs[2]).toEqual([4, 3, 2, 1]);
  });

  it('undoes a move without changing disk order illegally', () => {
    let game = createGame(3);
    const first = solveMoves(3)[0];
    game = moveDisk(game, first.from, first.to);
    const result = undoLastMove(game, [first]);
    expect(result.undone).toEqual(first);
    expect(result.game.moves).toBe(0);
    expect(result.game.pegs[0]).toEqual([3, 2, 1]);
    expect(result.history).toHaveLength(0);
  });

  it('reconstructs an intermediate game after a prefix of the solution', () => {
    const partial = gameAfterMoves(3, 3);
    expect(partial.moves).toBe(3);
    expect(partial.pegs.flat().sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(isWin(partial)).toBe(false);
  });

  it('parses saved best records safely', () => {
    expect(parseProgress(null).best).toEqual({});
    expect(parseProgress('bad json').best).toEqual({});
    const progress = parseProgress(JSON.stringify({ best: { '3': { moves: 7, seconds: 42, diskCount: 3 } } }));
    expect(progress.best['3'].seconds).toBe(42);
  });

  it('keeps the best result by moves before time', () => {
    let progress = recordWin({ best: {} }, 3, 9, 20, new Date('2026-01-01'));
    progress = recordWin(progress, 3, 7, 30, new Date('2026-01-02'));
    expect(progress.best['3'].moves).toBe(7);
    const slower = recordWin(progress, 3, 9, 5);
    expect(slower.best['3'].moves).toBe(7);
  });

  it('formats elapsed time in stable minute and second fields', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(75)).toBe('01:15');
    expect(formatTime(-9)).toBe('00:00');
  });
});
