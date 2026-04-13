import { createSudoku, createSudokuFromJSON } from './sudoku.js';

/**
 * 一局棋：心里只认一个「当前的」Sudoku。
 * 撤销 / 重做不跟 React 抢戏，就是两摞快照——每步之前整盘 clone进 past，
 * 点撤销就把现在这盘扔进 future，再从 past 顶拿一盘贴回来。新棋一下，future 清空。
 */
export function createGame({ sudoku }) {
	let current = sudoku.clone();
	const past = [];
	const future = [];

	const snapshot = () => current.clone();

	return {
		getSudoku() {
			return current;
		},

		guess(move) {
			past.push(snapshot());
			future.length = 0;
			current.guess(move);
		},

		undo() {
			if (past.length === 0) return;
			future.push(snapshot());
			current = past.pop();
		},

		redo() {
			if (future.length === 0) return;
			past.push(snapshot());
			current = future.pop();
		},

		canUndo() {
			return past.length > 0;
		},

		canRedo() {
			return future.length > 0;
		},

		toJSON() {
			return { sudoku: current.toJSON() };
		},
	};
}

export function createGameFromJSON(data) {
	if (!data?.sudoku) {
		throw new TypeError('createGameFromJSON: 数据里没有 sudoku');
	}
	return createGame({ sudoku: createSudokuFromJSON(data.sudoku) });
}
