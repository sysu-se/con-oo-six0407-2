## HW 问题收集

列举在HW 1、HW1.1过程里，你所遇到的2\~3个通过自己学习已经解决的问题，和2\~3个尚未解决的问题与挑战

### 已解决

1. 啥是”标量derived store“ 有啥作用？
   1. **上下文**：Coding Agent 说：”UI 的棋盘、输入、Undo/Redo、胜利判断、分享编码全部直接读取领域对象公开接口；允许保留少量标量 derived store，但不再生成板级 view model。“ 
   2. **解决手段**：直接询问 CA + 对照 `DESIGN.md` 的 store 说明（尤其是 `writable + derived + $store` 那一段）。
   3. **结论**：标量 derived store 指的是像 `canUndo` / `canRedo` 这种“单个值状态”。它不承载整盘棋盘数据，而是把领域对象里的状态映射成 UI 能直接消费的布尔值，减少组件里重复计算，也保证按钮启用/禁用能随 `set` 同步更新。

2. 领域对象和 Svelte 响应式到底怎么协作？
   1. **上下文**：一开始我以为把 `Sudoku` 内部数组改掉，界面就会自己刷新；后来发现不是这样。
   2. **解决手段**：阅读 `DESIGN.md` + 对照 `src/domain/sudoku.js`、`src/domain/game.js`、`stores/grid.js` 的调用链。
   3. **结论**：领域对象不负责“通知 UI”，UI 刷新靠 store 的 `set/update`。所以每次 `guess/undo/redo` 后都要从领域拿 `getGrid()` 新快照并 `set`，只改对象内部字段不会触发 Svelte 更新。

3. `sameArea` 到底干什么？（这个问题已解决）
   1. **上下文**：`src/components/Board/index.svelte` 里有：

      ```javascript
      sameArea={$settings.highlightCells && !isSelected($cursor, x, y) && isSameArea($cursor, x, y)}
      ```

   2. **解决手段**：阅读 `isSameArea` 实现（同文件内函数）和 `Cell.svelte` 的样式绑定。
   3. **结论**：`sameArea` 用于“同区域高亮”。当开启 `highlightCells` 时，会高亮与当前光标格子**同行、同列或同一 3x3 宫**的其他格子；用于辅助定位，不影响数独规则计算。

### 未解决

1. `src/node_modules/@sudoku/*` 下的业务代码改动边界还不够清晰
   1. **上下文**：本次实现里涉及较多 `@sudoku/stores` 和 `@sudoku/game` 相关代码，但它们位于 `src/node_modules` 目录，看起来像依赖包又被纳入项目源码。
   2. **尝试解决手段**：通过阅读现有导入关系和运行测试确认“可工作”，但还没完全厘清课程仓库里这层目录设计（哪些应视为可维护源码、哪些应视为第三方产物）。
   3. **当前挑战**：担心后续重构时误改“应冻结”代码，或遗漏真正的单一入口。

2. 领域层冲突检测和 UI 层高亮策略的职责边界还想再收敛
   1. **上下文**：目前领域层有 `conflictKeysForGrid`（规则正确性），UI 层有 `sameArea/sameNumber/conflictingNumber`（显示策略），二者协作能跑通。
   2. **尝试解决手段**：已在 `DESIGN.md` 里把规则与展示分层写清，并按现有测试通过实现。
   3. **当前挑战**：如果后续要扩展“提示等级/候选冲突可视化”等功能，边界如何保持稳定（例如是否把更多可视化辅助信息也下沉到领域层）还没有最终方案。