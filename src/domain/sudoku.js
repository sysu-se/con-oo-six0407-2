const SIZE = 9;
const BOX = 3;

function cloneGrid(g) {
	return g.map((row) => row.slice());
}

function assertGuess(move) {
	if (move == null || typeof move !== 'object') {
		throw new TypeError('guess: need an object with row, col, value');
	}
	const { row, col, value } = move;
	const okIndex = (n) => Number.isInteger(n) && n >= 0 && n < SIZE;
	if (!okIndex(row) || !okIndex(col) || !Number.isInteger(value) || value < 0 || value > 9) {
		throw new TypeError('guess: row/col 要在 0～8，value 要是 0～9 的整数（0 表示空格）');
	}
}

/**
 * 扫一遍盘面，找出违反数独规则的格子。
 * 返回的字符串还是老样子：`"列,行"`，和 `board[row][col]` 对上就行；0 当空，跳过。
 */
export function conflictKeysForGrid(board) {
	const seen = new Set();
	const keys = [];

	const mark = (col, row) => {
		const key = `${col},${row}`;
		if (seen.has(key)) return;
		seen.add(key);
		keys.push(key);
	};

	for (let row = 0; row < SIZE; row++) {
		for (let col = 0; col < SIZE; col++) {
			const value = board[row][col];
			if (!value) continue;

			for (let i = 0; i < SIZE; i++) {
				if (i !== col && board[row][i] === value) mark(col, row);
				if (i !== row && board[i][col] === value) mark(col, row);
			}

			const boxRow = Math.floor(row / BOX) * BOX;
			const boxCol = Math.floor(col / BOX) * BOX;
			for (let r = boxRow; r < boxRow + BOX; r++) {
				for (let c = boxCol; c < boxCol + BOX; c++) {
					if (r !== row && c !== col && board[r][c] === value) {
						mark(col, row);
					}
				}
			}
		}
	}

	return keys;
}

function isValidGrid(grid) {
	if (!Array.isArray(grid) || grid.length !== SIZE) return false;
	for (const row of grid) {
		if (!Array.isArray(row) || row.length !== SIZE) return false;
		for (const cell of row) {
			if (typeof cell !== 'number') return false;
		}
	}
	return true;
}

/**
 * 新建一局里的「棋盘对象」：内部数组不往外漏，想改只能通过 guess，
 * 这样 Undo用的克隆才不会和 UI 指到同一块内存。
 */
export function createSudoku(initialGrid) {
	if (!isValidGrid(initialGrid)) {
		throw new TypeError('createSudoku: 需要 9×9、全是数字的二维数组');
	}

	let grid = cloneGrid(initialGrid);

	return {
		getGrid() {
			return cloneGrid(grid);
		},

		guess(move) {
			assertGuess(move);
			grid[move.row][move.col] = move.value;
		},

		clone() {
			return createSudoku(grid);
		},

		toJSON() {
			return { grid: cloneGrid(grid) };
		},

		toString() {
			return grid
				.map((row) => row.map((n) => (n === 0 ? '.' : String(n))).join(' '))
				.join('\n');
		},

		getConflictKeys() {
			return conflictKeysForGrid(grid);
		},
	};
}

export function createSudokuFromJSON(json) {
	if (!json || !isValidGrid(json.grid)) {
		throw new TypeError('createSudokuFromJSON: JSON 里缺合法的 grid');
	}
	return createSudoku(json.grid);
}
