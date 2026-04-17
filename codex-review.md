# con-oo-six0407-2 - Review

## Review 结论

当前实现已经把领域对象接进了主要 Svelte 流程：开局会创建 `Game`，棋盘渲染读取领域导出的当前局面，输入与 Undo/Redo 也都经过 adapter 再落到 domain。问题主要不在“有没有接入”，而在“接入后的领域边界是否足够强”：`Game` 仍暴露可变 `Sudoku`，`Sudoku` 也没有建模 givens/只读格，导致关键业务规则仍然散落在 store/UI 层，OOP 和 OOD 都还有明显缺口。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | good |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. Game 暴露了可变的 Sudoku，历史边界可以被绕过

- 严重程度：core
- 位置：src/domain/game.js:16-18; src/domain/sudoku.js:86-89
- 原因：`getSudoku()` 直接返回当前 `Sudoku` 实例，而该实例仍带有可写的 `guess()`。任何调用方只要拿到这个对象，就能绕过 `Game.guess()` 直接改盘面，`past/future` 不会同步更新，`Game` 也就无法真正成为面向 UI 的唯一操作入口。

### 2. 领域对象没有建模 givens/只读格，核心数独规则落在 UI 层

- 严重程度：core
- 位置：src/domain/sudoku.js:74-89; src/node_modules/@sudoku/stores/keyboard.js:6-10
- 原因：`Sudoku` 只保存“当前 grid”，`guess()` 对任意坐标都可写，并不知道哪些格子是题面给定值。固定数字不可修改这一核心业务约束，是靠 Svelte 侧根据原始 `grid` 禁用键盘来保证的，而不是由领域对象自身保证；这意味着 domain 脱离界面后无法独立维护业务规则。

### 3. 无效输入会先污染历史，再由 Sudoku 抛异常

- 严重程度：major
- 位置：src/domain/game.js:20-23; src/domain/sudoku.js:8-17
- 原因：`Game.guess()` 先把当前局面压入 `past`、清空 `future`，然后才调用 `Sudoku.guess()` 做参数校验。若传入非法 move，棋盘虽然没改，但撤销栈和重做栈已经被改写，导致对象状态与实际落子结果不一致。

### 4. Game 的序列化没有覆盖自己的核心职责

- 严重程度：major
- 位置：src/domain/game.js:46-56
- 原因：`Game` 的核心职责包含 history，但 `toJSON()` / `createGameFromJSON()` 只保存和恢复当前 `sudoku`，完全丢掉 `past/future`。恢复后的对象与原对象不等价，`canUndo()` / `canRedo()` 以及 redo 链都会丢失。

### 5. 视图适配层绕过 Sudoku 实例，直接调用领域辅助函数做校验

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:118; src/domain/sudoku.js:105-106
- 原因：`Sudoku` 已经提供了 `getConflictKeys()`，但 store 仍直接对 `$userGrid` 调用 `conflictKeysForGrid()`。这样一来，校验能力并不是通过对象边界被消费，而是再次退化成“外部工具函数 + 原始数据”，削弱了 OOP 封装和 adapter 的设计价值。

### 6. 顶层手动订阅缺少清理，不符合常见 Svelte 用法

- 严重程度：minor
- 位置：src/App.svelte:12-17
- 原因：`gameWon.subscribe(...)` 写在组件实例脚本顶层且没有释放订阅。当前 `App` 大概率只挂载一次，所以风险不大，但从 Svelte 架构惯例看，更稳妥的做法是结合 `onDestroy` 清理，或直接通过 `$gameWon` / reactive statement 消费。

## 优点

### 1. 通过防御性拷贝隔离了内部棋盘状态

- 位置：src/domain/sudoku.js:79-96
- 原因：构造时复制输入，`getGrid()`、`clone()`、`toJSON()` 也都返回新二维数组，避免 UI、历史栈和内部 `grid` 共享引用。这对 Undo/Redo 正确性和 Svelte 引用级刷新都很有帮助。

### 2. 采用了符合题目推荐方向的 store adapter

- 位置：src/node_modules/@sudoku/stores/grid.js:56-72
- 原因：`grid` 变化时重建 `Game`，之后每次领域对象变更都通过 `getGrid()` 产出新数组并写入 writable，同时同步 `canUndo/canRedo`。这说明实现者理解了 Svelte 3 对引用变化的依赖，也确实把领域对象桥接到了 store。

### 3. 主要交互已经通过领域适配层完成

- 位置：src/components/Controls/Keyboard.svelte:10-25; src/components/Controls/ActionBar/Actions.svelte:13-32
- 原因：数字输入、擦除、提示、Undo、Redo 都是调用 `userGrid` 的方法，而 `userGrid` 再转发到 `domainGame.guess()/undo()/redo()`；组件本身没有直接去改二维数组，符合“View 真正消费领域对象”的要求。

### 4. 界面渲染的当前局面来自领域导出的响应式状态

- 位置：src/components/Board/index.svelte:40-51
- 原因：`Board` 直接遍历 `$userGrid` 渲染当前盘面，只把 `$grid` 用于区分 givens 与用户输入及若干显示语义，基本达到了作业要求里“UI 中看到的 grid 来自领域对象或其导出的响应式视图状态”。

## 补充说明

- 本次结论仅基于静态阅读 `作业要求.md`、`src/domain/*` 及其关联的 Svelte/store 接入代码得出；按要求没有运行 tests，也没有做浏览器内交互验证。
- 关于“开始一局游戏、界面渲染、用户输入、Undo/Redo、界面自动更新”是否接入领域对象的判断，来自对 `src/node_modules/@sudoku/stores/grid.js`、`src/node_modules/@sudoku/game.js`、`src/components/Controls/*`、`src/components/Board/index.svelte`、`src/App.svelte` 的静态调用链分析。
- 本次审查没有扩展到无关目录；像 `timer`、`modal`、`solver`、`candidates` 等模块只在与领域接线直接相关时做了最小范围参考，因此对这些模块本身的完整正确性不作结论。
