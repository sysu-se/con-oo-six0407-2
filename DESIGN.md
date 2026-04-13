## 作业第三节的两个问题

**Svelte 的响应式怎么和领域对象协作？**  
领域对象本身不会「通知」界面。协作是靠中间一层 store：领域改完，适配层用 `writable.set` / `derived` 把新数据推出去；组件用 `$userGrid` 这类语法订阅，所以能刷新。本仓库还是 **Svelte 3**，没有上 runes。

**View 怎么消费 `Sudoku` / `Game`？**  
不直接 new 给组件。组件主要消费 **`@sudoku/stores/grid` 里的适配对象**；那里内部持有一个 `Game`，对外暴露 `subscribe` 和 `set` / `undo` / `redo` 等方法，相当于自定义 store + 一点命令 API。

---

## A. 领域对象如何被消费（对应作业「十、A」）

### 1. View 层直接消费的是什么？

不是裸的 `Game` 或 `Sudoku`，而是 **store / adapter**：`grid`、`userGrid`、`invalidCells`，以及 `canUndo` / `canRedo`。工厂 `createSudoku`、`createGame` 放在 `src/domain/`，给测试和适配层共用。

### 2. View 层拿到的数据是什么？

- **`grid`**：本局初始题，用来判断哪些格不能动、分享编码等。
- **`userGrid`**：当前玩家盘面，来自领域 `getGrid()` 的快照。
- **`invalidCells`**：冲突格列表，用 `conflictKeysForGrid` 算，规则集中在领域。
- **胜负相关**：`stores/game.js` 里仍根据 `$userGrid` 和冲突判断是否赢。
- **`won`**：没有单独叫这个名字的 store，语义上包含在上述 derived 逻辑里。
- **`canUndo` / `canRedo`**：和领域 `canUndo()` / `canRedo()` 对齐，管按钮灰不灰。

### 3. 用户操作如何进入领域对象？

- 填数或擦掉：`Keyboard` → `userGrid.set` → 内部 `domainGame.guess({ row, col, value })` → `syncUserGridFromDomain`。
- 提示：`userGrid.applyHint`里先扣提示次数，再解一版当前盘，最后同样走一次 `guess`，历史上算一步。
- 撤销 / 重做：`userGrid.undo` / `redo` → `Game.undo` / `redo` → 再同步 store。
- 新开局或解码：`grid.generate` / `decodeSencode` 更新初始题；`grid` 的 `subscribe` 里会重新 `createGame` + `createSudoku`，历史清零。

### 4. 领域对象变化后，Svelte 为什么会更新？

因为 **Svelte 只在你 `set` 了新的 store 值（或 derived 依赖变了）时才叫醒订阅者**。领域内部改数组不会触发这个。所以我们在每次 `guess` / `undo` / `redo` / 换题后，都会 `getGrid()` 拿一份**新引用**的二维数组，再 `userGridWritable.set(...)`。`canUndo` / `canRedo` 也在同一处更新，避免在模板里直接调领域方法却得不到刷新。

---

## B. 响应式机制（对应作业「十、B」）

1. **主要靠什么？**  
   **`writable` + `derived`**，组件里用 **`$store`**。没怎么靠顶层 `$:` 去拼盘面，冲突和胜负更多交给 `derived` 去跟 `$userGrid` 走。

2. **哪些是响应式交给 UI 的？**  
   当前格子的数字、冲突列表、撤销/重做是否可用、初始题面，以及项目里本来就有的计时器、光标、候选数等 store。

3. **哪些还藏在领域对象里？**  
   `Game` 的两条历史栈（存整盘 `Sudoku` 克隆）、`Sudoku` 内部那份 9×9。外面只能 `getGrid()` 拿拷贝，防止 UI 和 Undo 共用同一块可变数组。

4. **如果绕过适配层、直接改 `getGrid()` 回来的数组会怎样？**  
   领域和栈里的快照对不上，`undo` 一按界面就乱；而且没走 `set`，Svelte 也可能根本不重画。所以约定就是：**改棋只走 store 提供的方法**。
 

---

## 作业第八节：Svelte 响应式


### 五个思考题

1. **为什么修改对象内部字段后，界面不一定自动更新？**  
   普通对象不会主动通知框架。Svelte 3 跟进的是**赋值**、`$:` 里读到的依赖、以及 **store 的 `set`/`update`** 这类通道。只改 `obj.x` 或领域内部数组的某个元素、却没让上述任何一条发生，编译器生成的更新逻辑就不会跑。

2. **为什么直接改二维数组元素，有时 Svelte 不会按预期刷新？**  
   经常是**外层引用没变**：还是同一个 `userGrid` 数组，只做了 `userGrid[y][x] = n`。组件或 store 若只盯着「`userGrid` 这个变量有没有被重新赋值」，就看不到这次变化；`writable.set` 若仍传入**同一个数组引用**，也可能让订阅方认为「值没变」。所以我们每次从领域 `getGrid()` 拷一盘新数组再 `set`，刻意换新引用。

3. **为什么 store 可以被 `$store` 消费？** `$foo` 本质是语法糖：在组件里帮你 `subscribe`，把最新值喂进模板，卸载时再取消订阅。数据要能推得动，仍得靠 **`set` / `update`**（或 `derived` 上游变化），不能指望在外面 mutate 完之后框架自动发现。

4. **为什么 `$:` 有时会更新，有时不会更新？**  
   `$:` 只收集它在**这一条语句里直接读到**的符号作依赖。漏读、或只改了深层属性而没触发外层重新赋值，语句就可能不重算。本项目棋盘主要靠 **store + `derived`**，很少用 `$:` 拼格子，所以这类坑少踩，但原理一样。

5. **为什么「间接依赖」可能导致 reactive statement 不触发？**  
   例如 `$:` 里只出现了 `a`，真正影响结果的量在 `b()` 内部才读到 `c`；若 `$:` 文本里**从未直接出现 `c`**，Svelte 不会把 `c` 登记为依赖，`c` 变了语句也不跑。修法要么让影响 UI 的量**显式出现在** `$:` / `derived` 的依赖里，要么像我们这样：**盘面放在 `writable` 里，每次操作用 `set` 推一整份新快照**，依赖链简单。

### 回答三个问题

| 要求 | 在本设计说明里的位置 |
|------|----------------------|
| 你的方案依赖了 Svelte 的什么机制 | **上文 B.1**（`writable`、`derived`、`$store`） |
| 你的 UI 为什么会更新 | **上文 A.4**（`set` 新引用、`derived` 依赖变） |
| 错误地直接 mutate 会怎样 | **上文 B.4** 与本节第 2点（领域与界面脱节、`set` 不触发） |

---

## C. 相对 HW1 改了什么、代价是什么（对应作业「十、C」）

**改了什么：**  
校验（冲突）收进 `src/domain`；历史交给 `Game` 用克隆管理；真实 UI 上的落子、提示、撤销、重做都走同一套领域入口，而不是测试里一套、界面里再改一遍数组。

**为什么 HW1 那种「能测但界面各写各的」不够：**  
作业要的是 View **真正消费**领域对象。若生产路径还在直接 mutate旧的 writable，Undo和规则就对不齐，也不满足「面向 UI 的游戏操作入口」这一条。

**Trade-off：**  
领域可单测、边界清楚；每步复制9×9 对数独来说完全可接受。以后若升 Svelte 5，**最稳的是 `src/domain`**；**最先可能要动的是** `stores/grid.js` 里和 store API 绑死的那一段。

---

## 附：`createGameStore`

`grid.js` 里导出 `createGameStore()`，返回 `{ grid, userGrid, invalidCells }`，和作业示例同名。实际跑的时候仍用**模块级单例**，免得不小心弄出两盘棋。
