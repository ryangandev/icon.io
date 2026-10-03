# Zumpo / Icon.io Cloud 交接

交接日期：2026-10-03，America/Los_Angeles。
本地聊天标题：盘点 Icon.io 项目状态。
聊天 ID：`01a0fb53-c0ab-7af1-becf-90bbea4a4123`。
本文件根据本次聊天记录、当前 Git 状态和实际存在的设计产物整理。

## 接手位置

品牌名已确定为 **Zumpo**，视觉方向已确定为 **Paper Pop**。
Figma 的完整流程设计这一轮已完成，共 82 个页面和状态画板、19 类共享组件，另有 review guide。
**当前在等待用户逐页 review，尚未获批进入实现。**
下一步应接收用户设计反馈，继续修改 Figma；用户 review 通过后，才进入代码中的品牌和 UI 重构。
部署、单人模式和新增游戏仍是后续议题。

这次聊天没有修改现有应用源码、游戏规则、依赖或部署配置，也没有 commit、push、PR 或线上部署。
交接开始时仓库干净，位于 `main`，与 `origin/main` 一致。
本次整理新建了本交接文档和文件清单，尚未提交，单独从 GitHub 克隆仓库不会获得这两个新文件或本地设计产物。

## 用户已经确认的决定

| 项目         | 已确认内容                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------ |
| 产品方向     | 保留自己玩、朋友联机、轻量竞技三种体验，长期发展为容易开始、短局、容易分享的网页小游戏平台 |
| 命名         | Zumpo，拼写中的字母是 m；短、抽象、顺口、容易记忆和口头分享                                |
| 中文译名     | 暂时不用决定                                                                               |
| 视觉         | 原来的 Paper Pop；语音转写中的 Paper Top 指这套                                            |
| 另外两套设计 | Club Circuit，语音转写中的 Flop Circuit，以及 Pocket Studio，保留在旁边的 Archive section  |
| 设计工具     | 用连接的 Figma 账号直接做，不要用 Python 生成设计替代 Figma                                |
| 设计范围     | 两款现有游戏的完整用户流程、页面、关键状态和共用组件                                       |
| 共享组件     | 放入 Shared pieces                                                                         |
| 顺序         | 先 Figma，用户逐页 review，再 implementation                                               |
| 部署         | 暂缓决定；先希望免费测试，有真实需求后再付费升级；没有选定提供商                           |
| Vercel 偏好  | 用户排除全部 Vercel；后来讨论过静态前端单独放 Vercel，这不等于选定该方案                   |
| 旧报告的作用 | 可以提供功能事实，不要让旧报告里的产品、品牌或视觉建议决定新版方向                         |

“单人”是未来方向，没有确认必须离线运行、PWA，或每一款游戏必须支持全部模式。
“短局”是产品方向，也不代表已经批准修改现有游戏时长。
具体落地文案、域名和商标可用性尚未确认。
初步命名探索出现过 Zunpo、Bopzu、Zomli、Lomzi，最终以用户选择的 **Zumpo** 为准。

## 这次聊天已经完成什么

1. 盘点仓库架构、两款游戏、通用房间层、工程检查、实际双人体验和线上入口。
2. 研究过 Render、Railway、EC2、全部 Vercel，以及静态前端和 Socket 后端分开的方式。
3. 重新讨论产品定位，并按用户要求保留单人、社交、轻竞技的长期方向。
4. 探索短品牌词，确认 Zumpo。
5. 制作本地 HTML 视觉探索，然后通过连接的 Figma 账号制作可编辑的 Paper Pop 首页、你画我猜和扫雷概念稿。
6. 在同一个 Figma 文件下面制作 Club Circuit 和 Pocket Studio，各三页，供对比。
7. 用户选 Paper Pop 后，将另外两套连同各自的组件区移到 Archive，扩展 Shared pieces。
8. 根据实际规则补齐平台、两个大厅、两个游戏状态、移动端主要流程和 review guide。
9. 做原生结构检查、所有页面的导出图检查，修正布局、角色、扫雷规则表达和移动端 tabs 状态。
10. 保存最终原生导出、画板和组件 ID 清单、QA 联系表、编辑脚本，以及用户确认决定的 Agent Wiki 原始来源。
11. 本次交接回查了完整聊天，保存历史检查证据，整理所有实际文件路径，并生成可移交的离线资料包。

## 当前代码库事实

仓库：`/Users/zhihenggan/Documents/GitHub/icon.io`。
远程：`https://github.com/ryangandev/icon.io.git`。
交接基线：`main` / `origin/main`，HEAD `a63bd2d990dbf6f1404ce44c8a6eac185fc0faf0`。
最后已有提交是合并 Minesweeper 的 PR #25，日期 2026-07-26。
这个提交以及依赖现代化、房间层提取和第二款游戏实现，属于开始本次聊天前的已有工作，不应归为这次 Figma 工作的新提交。

前端是 React 19、TypeScript 7、Vite 8、Ant Design 6、React Router、Socket.IO client。
后端是 Node.js、TypeScript 7、Express 5、Socket.IO，Node 要求 `>=20`。
没有数据库，没有业务 HTTP API，房间、身份、分数、棋盘和计时器都存在服务器进程内存中。
服务器重启会丢失房间，目前按单实例理解；水平扩容需要额外设计状态和游戏执行归属。
仅填用户名即可参与，没有账户、登录密码或跨设备身份。
身份凭证在每个 tab 的 `sessionStorage`，刷新恢复同一个席位。

| 路径，均相对于上述仓库根目录                 | 用途                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `README.md`                                  | 运行和合并部署入口                                                        |
| `docs/ANALYSIS.md`                           | 2026 年 7 月的历史架构和功能分析，部分“无漏洞/所有问题已修复”等状态已过时 |
| `docs/DRAW-AND-GUESS.md`                     | 你画我猜规则和实现索引                                                    |
| `docs/MINESWEEPER.md`                        | 多人扫雷规则、计分和概率计算说明                                          |
| `front/src/app.tsx`                          | 路由和页面门禁                                                            |
| `front/src/providers/socket-provider.tsx`    | Socket 连接、身份和生产地址选择                                           |
| `front/src/components/require-socket.tsx`    | 首次连接等待及重连 UI，初始超时为 10 秒                                   |
| `front/src/pages/lobbies/`                   | 两款游戏大厅                                                              |
| `front/src/pages/rooms/`                     | 两款游戏房间                                                              |
| `front/src/components/whiteboard-canvas.tsx` | 实际画布、笔画和鼠标交互                                                  |
| `back/app.ts`、`back/server.ts`              | 可测试的服务器工厂和启动入口                                              |
| `back/libs/rooms/`                           | 注册表、座位、房主、聊天、大厅、加入/离开/重同步                          |
| `back/socket/draw-and-guess/`                | 你画我猜模块和服务器权威游戏时钟                                          |
| `back/socket/minesweeper/`                   | 多人扫雷模块、棋盘、概率和计分                                            |
| `shared/wire-types.d.ts`                     | 两端共用的事件与数据类型                                                  |
| `.github/workflows/ci.yml`                   | 仓库检查                                                                  |

已有路由包含 `/`、`/Landing`、`/Gamehub`、两个游戏各自的 `/Lobby` 和 `/Room/:roomId`，以及不存在页面。
公共房间层使用 `room:`、`lobby:`、`chat:`、`game:start`；游戏事件分别使用 `dg:` 和 `ms:`。
保留服务器权威、输入验证、速率限制、私密数据投影及重连身份的原则。

仓库缺少 `AGENTS.md` 和 `docs/README.md`，之前只提出以后按用户约定补齐，本次没有创建它们。
用户在聊天里提供的通用 AGENTS 指令仍需遵守，包括不用 em dash、不自动加 agent co-author、不手改自动生成文件，以及修 bug 先尽可能用真实用户流程复现。

### 已做的运行检查及其边界

初始盘点使用 Node `v24.13.0`、npm `11.20.0`。
lint、两端 typecheck、format:check 通过。
独立 `npm test` 成功退出 0：后端 14 文件 / 197 测试，前端 5 文件 / 36 测试，总计 233。
独立 `npm run build` 成功退出 0，生成合并生产构建。
**不要写成根命令 `npm run verify` 完整成功。**
该命令第一次受本机沙箱端口限制，出现联机测试超时，随后被停止，退出 143；换到允许监听本机端口的环境后，独立测试通过。
本次交接只复核已有证据，没有再次跑测试。
历史命令和结果保存在资料包 `evidence/icon-io-session-check-evidence.json`。

浏览器实际进行过双人 Draw & Guess，从名字、建房到选词、绘画同步、猜中、轮换和结束；刷新保留分数正常。
多人 Minesweeper 实测过开局、共享棋盘、锁定选择、风险计分和刷新问题，不应扩大为本次完成全部长期压力/手机/E2E 验收。
当前 Figma 设计已检查，并不表示上述现有应用问题已修好。

### 初始盘点发现而尚未修复的问题

| 问题                   | 证据和接手方向                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 扫雷刷新状态恢复不完整 | 双人浏览器观察到已选格或 reveal 阶段刷新后，提示重新选格/不恢复结算；检查 `front/src/pages/rooms/minesweeper-room.tsx:48`、`:76`、`back/socket/minesweeper/state.ts:74`、`shared/wire-types.d.ts`；快照没有明确 reveal phase，自己的选格只存本地，身份到达顺序也需 E2E 排查；服务器会拒绝无效操作，但 UI 仍误导；不要向其他玩家泄漏选格来修复 |
| 手机布局和绘画         | 现有窄屏侧栏/聊天出现横向溢出；画布用鼠标事件，触控支持待做；Figma 手机稿只是后续目标                                                                                                                                                                                                                                                         |
| 一个人无法试玩         | 两款真实游戏都要求至少两人；用户独自看作品集时可能卡在等待房间；单人/演示/机器人具体方案未选                                                                                                                                                                                                                                                  |
| 依赖安全提示           | 当时后端生产依赖 audit 有 engine.io 高危 1、qs 中危 1；前端生产依赖 0；root、前端完整依赖、后端完整依赖各有独立 JSON；记录是扫描快照，修复前重新核实，不是已升级                                                                                                                                                                              |
| 资源和构建警告         | JS 主包 1,024.82 kB，gzip 329.79 kB；两张 drawing 素材约 968.06 kB 和 1,425.50 kB；构建出现大于 500 kB 的 chunk 警告；拆包与素材优化待做                                                                                                                                                                                                      |
| 旧公开入口             | 盘点时 `https://icon.ryiscrispy.com/` 的 DNS 无法解析，curl 退出 6；未修 DNS、未恢复部署；本次没有重新验证该域名                                                                                                                                                                                                                              |
| 免费后端唤醒           | 当前连接超时 10 秒，短于讨论过的免费服务冷启动时间；连接提示、重试和恢复需在选定部署方案后实现                                                                                                                                                                                                                                                |

上述问题是已有发现和后续待办，本次没有发 GitHub issue 或提交修复。

## 实际游戏规则，设计和实现不得无意改掉

两款游戏均 2-8 人。
房间名最长 40，座位 2-8，默认 8；可选房间密码最长 20；用户名 trim 后非空、最长 18。
大厅要展示可加入、密码房、满员、对局中的状态。
新玩家不能中途加入正在进行的游戏；已有席位的断线恢复是另一条路径。
掉线保留席位、分数和房主 30 秒，主动离开立即生效，房主可转移，空房删除。

### Draw & Guess

房间轮数 1-4，默认 2。
每轮每位玩家轮流绘画，服务器推进阶段。
画者 15 秒从 3 个私密词语选择一个，超时自动取第一个。
绘画 90 秒，逐步提供最多约三分之一字母的提示，所有人猜中可提前结束。
review 10 秒，公布词语。
猜中者获得基础 50 加最多 100 的时间奖励，画者获得该猜中分数的 0.4 倍。
同一人每个 turn 只能得分一次，猜中后输入锁定，画者不能猜。
画者在绘画阶段断线保留当前 turn 10 秒，过期跳过；选词阶段画者断开时会跳过。
笔刷 4、10、18、28，支持颜色、undo、clear。
共享画布位图 **798 × 598**，设计应保持约 4:3，坐标缩放和触控需在代码中真实实现。

### 多人 Minesweeper

这是同一棋盘上的**同时选格**玩法，每回合点击一个隐藏格即不可逆提交。
没有轮流出手、另一个“Lock my pick”确认按钮，也没有传统 flag 操作。
每回合选择 15 秒，全部选好可提前 resolve，公布结果 4 秒，再开始下一回合。
在揭晓前只能看到谁已提交，不能看到别人选哪格；风险也不在选择前直接展示给玩家。
服务器以本回合开始时的公开棋盘计算每格真实风险，并在全部计分后揭开棋盘。

```text
手动安全格：round((10 + 90 × risk) / sharedWith)
踩雷：-round(20 + 100 × (1 - risk))，惩罚不分摊
超时：服务器选已知最安全格，并放弃基础 10 分
```

20% 风险单人选安全格是 +28，踩雷 -100，两人同选安全格每人 +14。
踩雷不会淘汰玩家或直接结束游戏，负分允许存在。
Small 为 9×9 / 10 雷，Medium 为 16×16 / 40 雷且默认，Large 为 30×16 / 99 雷。
棋盘全部 resolved 或人数不足两人时结束；房主重新开始会重置分数并生成新棋盘。
没有首击安全和保证完全可推导的棋盘要求。
Figma 棋盘和积分是分别说明不同状态的样例，不是一场连续比赛的完整账本。

## Figma 的当前交付

[打开 review guide](https://www.figma.com/design/pd5Hgp7zbT2cMqQNan35uY?node-id=9-14702)。
文件 key：`pd5Hgp7zbT2cMqQNan35uY`。
文件当前名称：`Zumpo · Paper Pop flows`。
Page ID：`0:1`；guide frame：`9:14702`。
文件名从最初的 Paper Pop，经过 Visual Directions，最后改为上述名称，仍是同一个文件。

| 区域                                 | ID                     | 已完成内容                                                      |
| ------------------------------------ | ---------------------- | --------------------------------------------------------------- |
| 00 / Review guide & flow map         | section `9:14700`      | guide、review 顺序、真实规则和新增 UX 的说明                    |
| 01 / Platform & shared flows         | section `9:431`        | P01-P14，共 14 个桌面页面/状态                                  |
| 02 / Draw & Guess / complete flow    | section `9:866`        | DL01-DL11、D01-D15，共 26 个桌面页面/状态                       |
| 03 / Minesweeper / complete flow     | section `9:2526`       | ML01-ML10、M01-M16，共 26 个桌面页面/状态                       |
| 04 / Mobile / 390px flow adaptations | section `9:10060`      | MO01-MO16，共 16 个主要移动端适配                               |
| Shared pieces                        | section `9:198`        | 19 类 native component families，位于右侧 x=6800                |
| Archive                              | section `9:197`        | Club Circuit、Pocket Studio，以及其局部组件区，移到左侧 x=-7500 |
| 原始 Paper Pop 参考                  | `3:53`、`3:54`、`3:55` | 最早的首页、绘画、扫雷概念，留在上方供对照                      |

全部 82 个流程画板之外还有 review guide 和原始概念稿，所以不要把 82 理解为全文件的所有节点或全部历史画板数量。
桌面宽度 1440，手机宽度 390。
详细每页名称、ID、导出文件映射见附录和 `paper-pop-flows/design-state.json`、`export-manifest.json`。

### Shared pieces 的 19 类组件

| 组件                                                                 | Figma ID  |
| -------------------------------------------------------------------- | --------- |
| Zumpo/Button                                                         | `4:24`    |
| Zumpo/Avatar                                                         | `4:34`    |
| Zumpo/Wordmark                                                       | `4:36`    |
| Zumpo/Header                                                         | `4:39`    |
| Zumpo/Mine cell                                                      | `4:52`    |
| Zumpo/Input，Default / Focus / Error / Disabled                      | `9:223`   |
| Zumpo/Notice，Info / Success / Error / Pending                       | `9:240`   |
| Zumpo/Room row，Open / Private / Full / Playing                      | `9:289`   |
| Zumpo/Scoreboard                                                     | `9:320`   |
| Zumpo/Chat                                                           | `9:334`   |
| Zumpo/Drawing toolbar                                                | `9:355`   |
| Zumpo/Mine feedback，Hidden / Selected / Safe / Mine / Shared / Auto | `9:386`   |
| Zumpo/Modal                                                          | `9:400`   |
| Zumpo/Countdown                                                      | `9:404`   |
| Zumpo/Word choice                                                    | `9:408`   |
| Zumpo/Board selector menu                                            | `9:427`   |
| Zumpo/Seat selector menu                                             | `9:15831` |
| Zumpo/Round selector menu                                            | `9:15842` |
| Zumpo/Mobile tabs，View=Board / Players / Chat                       | `9:16089` |

之前 Shared pieces 是 frame `3:56`，之后转换为 section `9:198`，旧 ID 不应继续使用。
Archive 保留 Club 的 `11:109`-`11:113`，Pocket 的 `11:155`-`11:159`，没有删除这两套方案。
清理了 8 个确认由中途失败脚本产生的孤立节点：`9:2956`、`9:2971`、`9:2972`、`9:3288`、`9:3289`、`9:3297`、`9:3298`、`9:3299`。
清理不涉及正式画板或 Archive。

### Paper Pop 的视觉底座

颜色：cream `#FAF7EF`、paper `#FFFDF8`、ink `#282B25`、muted `#616458`、line `#DEDED0`。
强调色：coral `#FE7859`、lime `#D3E87B`、blue `#AAC8E9`、peach `#F4D7C8`、sand `#EEECCF`、white `#FFFFFF`、green `#467B60`。
字体：Nunito Sans Black，DM Sans Regular / Medium / Bold。
字号/行高：Brand 40/44、Hero 76/78、Title 36/42、Heading 24/30、Body 16/25、Label 14/20、Small 12/18、Number 18/24。
primitive collection `3:2`，semantic collection `3:3`。
现有 tokens 和组件绑定是后续实现的依据，后续设计修改优先从 Shared pieces 和 tokens 入手。
没有成功新增额外的扫雷数字颜色 variables，不要从未完成的脚本推断它们已存在。

### 具体做过的设计修正和验证

- 修正输入框、提示条、积分区、聊天区、词语选择的 fill sizing 和 native auto layout。
- 扫雷反馈改为紧凑直接格子 variants，普通打开格和本回合选中/揭晓格区分清楚。
- 修正示意棋盘邻接数字，隐藏格不提前显示雷或他人选择。
- 揭晓时显示 Maya、Ryan、Leo、You 的选择标签和安全、踩雷、多人分享、超时自动选择结果。
- 修正 M05 倒计时、M06 过渡状态、等待房间默认 Medium 信息和过少玩家结束信息。
- 画者离开后不继续显示该玩家正在绘画；只有一位玩家时不保留虚构聊天和不存在的玩家。
- 保持桌面和手机画布约 4:3；Large 手机棋盘为 44px cells 的横向滚动 viewport。
- 调整主页大字号、Games / How to play 导航和 P13 session popover 的位置。
- 修正手机 MO15 / MO16 分别选中 Players / Chat 的状态。
- 修正或移除错误的示例 prototype 跳转，公共找房入口经过名字 gate。

原生结构审计记录：82 个画板，0 text/component bounds 问题，0 raster image fills。
之前记录约 4,446 个 text nodes、2,812 个 instances、7,507 个 bound fills 和 237 个带 reaction 的节点。
最后少量 tabs 属性和 popover 位置修正后又看过最终导出；这些计数是本轮检查记录，不是 Cloud 接手后自动保证永远不变。
所有 82 个画板通过 native PNG 联系表检查，重要修正状态又以完整分辨率复查。
这是**可编辑设计和部分导航 prototype**，不是可运行游戏，也没有完成每个控制的真实交互和全部连续 E2E 原型验证。
16 个移动稿覆盖主要流程，没有把 66 个桌面状态逐一再画成 66 个手机版本。

专门的最终结算面板、离开确认、房间分享弹窗、手机 tabs 和 rules view 是新增呈现建议，已在画板外 review notes 中标明。
用户尚未逐一批准这些 UX。
早期 HTML 和概念稿曾出现 solo 入口、独立 lock 按钮等探索表达；后来的完整流程稿按实际多人规则纠正，不要照早期探索稿实现错误规则。

## 文件和修改位置清单

全部确切绝对路径、文件大小、hash、来源类别和资料包相对路径见 [ZUMPO-ARTIFACT-INVENTORY.json](ZUMPO-ARTIFACT-INVENTORY.json)。
清单区分应用原有文件、此次生成的构建文件、设计产物、临时脚本、历史导出和本次交接新增文件。

### 仓库内

- 本次新建：`/Users/zhihenggan/Documents/GitHub/icon.io/docs/ZUMPO-CLOUD-HANDOFF.md`。
- 本次新建：`/Users/zhihenggan/Documents/GitHub/icon.io/docs/ZUMPO-ARTIFACT-INVENTORY.json`。
- 初始审计运行构建生成/覆盖：`/Users/zhihenggan/Documents/GitHub/icon.io/back/build/`，包含编译后端和 `public/` 前端产物，属于 ignored 可再生构建，不是手改源码，未放入 Cloud 包。
- 原有 `front/`、`back/` 源码、`shared/`、package manifests/locks、已有 README 和游戏 docs 没有修改。
- 没有创建新分支、Git 提交、PR，也没有 push、部署或修改域名。

### 最终设计产物的原始位置

根目录：`/Users/zhihenggan/.codex/visualizations/2026/10/02/01a0fb53-c0ab-7af1-becf-90bbea4a4123`。
以下路径均在这个根目录下，文件清单给出每一项完整绝对路径。

| 相对路径                                                                              | 内容 / 是否作为最新依据                                                                  |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `zumpo-visual-directions.html`                                                        | 三套早期可切换的本地视觉探索，不是生产前端，不是实际游戏规则来源                         |
| `figma-comparison/design-state.json`                                                  | 三方案比较阶段的历史节点和 tokens 记录，当前流程 ID 请用后面的 ledger                    |
| `figma-comparison/club-home.png`、`club-draw-guess.png`、`club-minesweeper.png`       | Club 三页原生导出                                                                        |
| `figma-comparison/studio-home.png`、`studio-draw-guess.png`、`studio-minesweeper.png` | Pocket 三页原生导出                                                                      |
| `paper-pop-flows/README.md`                                                           | 最终设计说明                                                                             |
| `paper-pop-flows/design-state.json`                                                   | 当前 canonical 节点/section/组件/画板清单                                                |
| `paper-pop-flows/export-manifest.json`                                                | 原始 PNG 映射，含本机绝对路径；包中另给 portable manifest                                |
| `paper-pop-flows/exports/`                                                            | P01-P14、DL01-DL11、D01-D15、ML01-ML10、M01-M16、MO01-MO16 和 review-guide，共 83 个 PNG |
| `paper-pop-flows/qa/`                                                                 | desktop-01 到 desktop-08、mobile-1、mobile-2、overview，共 11 个 QA 联系表 PNG           |
| `paper-pop-flows/figma-review.jpg`                                                    | Figma 编辑器操作截图，选中状态的粉色间距叠层不属于产品图形                               |
| `paper-pop-flows/screens.zip`                                                         | 最终 83 个原生 PNG 的 ZIP，与 Downloads 中 flows (2).zip 相同                            |
| `paper-pop-flows/first-qa-export.zip`                                                 | 旧 QA 快照，不能代替最新设计                                                             |
| `paper-pop-flows/source/`                                                             | 保存下来的原生 Figma 编辑/检查脚本，见下文限制                                           |

### 临时脚本、审计和早期记录

临时脚本原目录：`/private/tmp/zumpo-flows/`。
其中有 `common.js`、`shared.js`、`platform.js`、`draw.js`、`mines.js`、`mobile.js`、`review.js`、`repairs-fragment.js`、`extra.js`、`fix-layout.js`、`audit.js`、`audit-bounds.js`、`audit-detailed.js`、`final-audit.js`、`polish.js`、`polish-boards.js`、`ledger.js`、`cleanup.js`、`server.cjs`、`qa-exports.cjs`、`confirmed-decisions.md`。
18 个 `.js` 的持久副本在上述 `paper-pop-flows/source/`，临时目录版本和持久副本可能不是同一阶段，包内保留两者并给 hash。
`server.cjs` 是本地 Figma source viewer / 截图保存辅助服务，曾监听 127.0.0.1:4319，已经停止，不是游戏后端。
`qa-exports.cjs` 用 Node/Sharp 整理 native 导出和联系表，含本地 runtime/Downloads 路径，不能直接假定在 Cloud 可运行。

初始真实游戏截图：`/private/tmp/icon-io-audit/gamehub.jpg`、`/private/tmp/icon-io-audit/minesweeper.jpg`。
初始依赖扫描：`/private/tmp/icon-io-root-audit.json`、`icon-io-front-audit.json`、`icon-io-back-audit.json`、`icon-io-front-prod-audit.json`、`icon-io-back-prod-audit.json`。
早期 foundations 和概念脚本、组件结果、comparison 脚本、icons helper、状态 JSON，以及 `icon-io-*.md` 决策记录，全部原始路径列在机器清单，现存版本复制进资料包 `history/` 或 `evidence/`。
另有历史 comparison PNG 解压目录 `/private/tmp/zumpo-comparison-export/`，与正式 comparison 输出重复，列入清单但不重复打包。

Downloads 中实际生成过五个 ZIP，均保留、未修改或删除：

| 原始绝对路径                                                  | 内容 / 状态                                               |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| `/Users/zhihenggan/Downloads/Zumpo · Paper Pop.zip`           | 6 张 comparison PNG 的较早导出，不是三张原始 Paper Pop 页 |
| `/Users/zhihenggan/Downloads/Zumpo · Paper Pop (1).zip`       | 6 张 comparison PNG 的较后导出                            |
| `/Users/zhihenggan/Downloads/Zumpo · Paper Pop flows.zip`     | 83 张流程 PNG 的初版                                      |
| `/Users/zhihenggan/Downloads/Zumpo · Paper Pop flows (1).zip` | 中间 polish 版                                            |
| `/Users/zhihenggan/Downloads/Zumpo · Paper Pop flows (2).zip` | 最终 83 张版本，当前 canonical 本地复制为 screens.zip     |

资料包直接包含最新 PNG，不重复塞这些历史 ZIP 和相同图片副本；机器清单记录保留位置和未打包原因。
临时路径可能日后被系统清理，Cloud 应依赖随附资料包中的相对路径。

### Agent Wiki 的外部写入

本次按照用户 AGENTS 的 capture 约定保存了 7 份原始来源，没有更改全局 memory、既有 wiki 结论或其他项目文件。
目录是 `/Users/zhihenggan/Documents/obsidian vault/Agent Wiki/sources/conversations/`。

| 文件名                        | 记录内容                                                                    |
| ----------------------------- | --------------------------------------------------------------------------- |
| `534c35833d288d9af33656de.md` | 全部 Vercel 排除、合并部署评估约束                                          |
| `6e8f43b7c13263db5e1de2cf.md` | 免费先行、有需求后付费                                                      |
| `b4f80b7090077bae82917477.md` | 部署暂缓，先定位/名字/视觉，不受旧报告锚定                                  |
| `5b323bc724258b26df873d62.md` | 长期保留单人、联机、轻竞技                                                  |
| `9878d45cea9d6e03a03e43d8.md` | 短抽象品牌词偏好                                                            |
| `40908353070ea21a95afe365.md` | Zumpo 拼写和 Figma 探索                                                     |
| `a4d0d7a0026dca6cb24289a9.md` | 最新 Paper Pop、Archive、Shared pieces 和 review-before-implementation 决定 |

这些是按当时状态捕获的原始来源，所以较早来源里的“尚未选名字/风格”已被后续用户决定更新。
以本交接的当前决定表和最后一份来源为准，不要把历史开放项当作当前仍未决定。
Python 只用于官方 wiki capture CLI，设计制作本身用 Figma 原生节点，没有用 Python 生成设计。

## 部署讨论的结论和未决定项

现有 repo 已支持**前后端代码分目录、生产部署合并为一个常驻 Node 服务**。
Vite 输出到 `back/build/public`，Express production 提供静态文件和 SPA 回退，同一个 HTTP server 承载 Socket.IO。
不需要先重写 Next.js，EC2 也不是硬性要求。
常驻 Node 服务中的 Express / Socket.IO 与临时 serverless 函数的运行模型不同。

在同一服务部署的价值主要是同源、少跨域配置、版本同步、发布和回滚简单。
它不会自动让游戏消息明显更快，因为页面加载后是浏览器直接连接 Socket 后端。
延迟仍主要来自服务地区、网络和负载；静态前端分离的主要好处是首页/CDN独立可用。
如果后端免费实例休眠，前端分离仍不能让多人游戏绕过后端唤醒。

此前建议一度是先合并 Render Free 试用；进一步了解作品集首页体验后，又讨论过拆静态前端。
**这是讨论演变，没有用户最终选型，更没有实际部署。**
用户后来明确把部署讨论放到后面。

当时查过的官方页面包括 [Render Free](https://render.com/docs/free)、[Render WebSocket](https://render.com/docs/websocket)、[Railway networking](https://docs.railway.com/networking/public-networking/specs-and-limits)、[Railway pricing](https://docs.railway.com/pricing)、[Vercel WebSocket](https://vercel.com/docs/functions/websockets)。
聊天中记录过 Render 15 分钟无入站流量/已有 WebSocket 消息后休眠、唤醒可能约一分钟；不是对局玩到第 15 分钟就自动断。
聊天中也记录过 Render $7/月、Railway Hobby 最低 $5/月、Vercel WebSocket beta 和函数连接时长限制。
这些是当时查阅后的历史评估信息，不是本次交接重新确认的现价/当前限制，恢复部署评估时必须重新查官方政策。
不要把 Vercel 功能、免费额度或 beta 状态作为永久事实，也不要把用户排除全部 Vercel理解为所有项目永远禁止静态 Vercel。

若后续决定拆前端：`front/src/providers/socket-provider.tsx:54` 目前 production 强制同源，忽略 `VITE_SOCKET_URL`，需明确支持后端 origin。
同时检查 CORS、静态构建位置、SPA deep links 和 cold-start UI。
合并部署仍需确认 build/start/PORT、HTTPS/WebSocket、health/readiness 和重启期间的用户反馈。
单实例内存房间限制仍存在，不能通过简单添加 Socket.IO Redis 广播就假定解决游戏状态和计时归属。
本次未修改这些配置、没有付费、没有注册域名或新建云服务。

## Cloud 怎么继续

1. 解压资料包，先读 `START-HERE.md` 和本文件。
2. 核对 Git 基线和当前 checkout，再读真实游戏规则与相关源代码。
3. 打开 canonical Figma guide，先看 00，再看 01-04 和 Shared pieces；没有 Figma 权限时先看包中的 PNG 和 portable manifest。
4. 保持“等待用户 review”的状态，把用户反馈落实到现有 Paper Pop 文件；不要默认从聊天转移就获得了 implementation 批准。
5. 修改优先从 Shared pieces、variant 和 tokens 入手，保持 Archive 和原始参考；补齐用户指出的缺页或状态。
6. 改后重新检查文字/组件边界、角色、真实计分、倒计时、隐藏信息、画布比例、手机可用性和有效跳转，保存新导出和节点记录。
7. 用户 review 通过后，再制定品牌/UI 重构的具体范围，保留可复用的游戏模块与权威规则；不必为改 UI 强制迁移 Next.js。
8. 真正修 bug 时先复现上述真实 E2E 情境，尤其是 identity handshake、刷新在 pick/reveal 时刻、画者断线、私人房间和 mobile touch。
9. 后续按用户决定推进单人试玩、新游戏和免费部署，再核查官方政策；不要自动发布、收费或 push。

仍未完成：用户 review、按反馈调整、真正 Zumpo UI 和源码重命名、扫雷状态恢复修复、手机触控、性能/依赖修复、完整交互 prototype、单人模式、新游戏、域名/商标核查、公开部署和上线验收。
这些不是已经承诺必须全部在下一轮做完的一个大包，当前先完成设计 review。

### Figma 接手的技术注意事项

本机曾验证连接的 Ryan Gan Figma 账号可编辑该文件，但权限、浏览器会话和本机路径不会自动转到 Cloud。
Figma MCP 在本次聊天中达到额度限制，后续通过 Chrome 中 Community 的 Scripter 插件，用普通可见 UI 执行官方 Figma Plugin API 完成原生编辑。
没有使用私有接口或购买升级。
Cloud 若有可用 Figma connector，先加载所需 `figma-use`、`figma-generate-design`、`figma-generate-library` 等 skill，再按当前权限使用。
若只能访问导出图，不要把 PNG 导入成整张图片并宣称恢复了 editable 原生设计；原始 Figma 文件仍是设计来源。

旧浏览器 tab IDs 和本地 JS 变量都不可靠，应重新发现当前文档/插件状态。
本地 source viewer 4319 和旧游戏 preview 3100 在本次交接检查时都没有监听，不能作为 Cloud 预览入口。
启动产品请用仓库正常命令，而不是 source viewer。

历史脚本不是 idempotent migration，包含旧阶段硬编码节点、变更后的组件结构和会产生新节点的创建操作。
**不要直接依次重跑整个 source 目录。**
`polish.js` 在 variables 阶段卡住，后续棋盘修正由 `polish-boards.js` 完成；不能认为 polish.js 全部应用成功。
`final-audit.js` 名称虽叫 audit，也包含修改操作，不是纯读取。
临时 `audit.js` 最后是清理脚本，持久 `source/audit.js` 可能是较早版本。
当前 Mine feedback 已没有某些旧 helper 假设的嵌套 `Cell`，执行前核对当前组件结构。

Scripter 的 Monaco `.fill()` 曾不能可靠更新 editor model，应通过可见编辑器粘贴，Run 后检查实际返回。
插件 API 没有 `figma.createAutoLayout`，用 frame.layoutMode 等正式属性。
不要直接移动 nested instance 子节点；在 master 上设置响应式 auto layout。
切换 Mobile tabs variant 时 `swapComponent` 可能保留旧 properties，应明确 `setProperties({View:'Players'})` 或 `Chat`。
插件长输出曾不显示，用一次 compact JSON 输出；脚本失败后可能留下孤立节点，清理前确认是自己创建的中间节点。

### 正常启动和验证命令

在仓库根目录：

```sh
npm ci
npm run install:all
npm run verify
```

开发分别使用 `npm --prefix back run watch` 和 `npm --prefix front run dev`，默认后端 3000、前端 3001。
合并生产构建使用根目录 `npm run build`，再在 back 下 `npm run start:prod`。
`back` 的 build 会先清空 build/，所以必须先构建后端再构建前端，`build:deploy` 已处理正确顺序。
主要环境变量是 PORT、NODE_ENV、CORS_ORIGIN、开发期 VITE_SOCKET_URL 和规则文档里的服务器时长。
无需生产秘钥才能在本地玩当前两款游戏，但不要把浏览器中的临时 session token 或本机配置当作可转移配置。

## 本次交接新增产物

完整资料包目录：`/Users/zhihenggan/.codex/visualizations/2026/10/02/01a0fb53-c0ab-7af1-becf-90bbea4a4123/zumpo-cloud-handoff/`。
压缩包：`/Users/zhihenggan/.codex/visualizations/2026/10/02/01a0fb53-c0ab-7af1-becf-90bbea4a4123/zumpo-cloud-handoff.zip`。
包内有 START-HERE、handoff、artifact inventory、portable PNG manifest、最新 83 张 PNG、11 张 QA 联系表、6 张 archived comparison PNG、HTML 探索、脚本、审计快照、7 份确认来源和既有仓库文档快照。
这些可直接传给 Cloud，包内相对路径不依赖 `/Users/zhihenggan`。
源码本身从 GitHub 取，资料包没有包含 node_modules、浏览器 profile、账户凭证或整个 Agent Wiki。

本次还新建 `/private/tmp/zumpo-session-summary-evidence.json`、`/private/tmp/icon-io-session-check-evidence.json` 和 `/private/tmp/create-zumpo-cloud-handoff.cjs`，用于这份交接的可核对记录和打包。
包内 `bundle-files.json` 列出所附文件和 hashes，用于传输完整性检查。

## 附录：每个流程画板的索引

下表根据最终 export manifest 和节点 ledger 自动整理。
导出 PNG 在包内 `design/paper-pop-flows/exports/<编号>.png`。
这些页面名是设计中的原始标签，不表示新增 UX 已获用户批准。

| 编号         | 页面 / 状态                                        | Figma node ID |
| ------------ | -------------------------------------------------- | ------------- |
| P01          | Public home                                        | `9:433`       |
| P02          | Choose your name                                   | `9:479`       |
| P03          | Name validation                                    | `9:512`       |
| P04          | Games hub                                          | `9:545`       |
| P05          | Connecting                                         | `9:583`       |
| P06          | Connection failed                                  | `9:604`       |
| P07          | Reconnecting                                       | `9:630`       |
| P08          | Reconnection expired                               | `9:704`       |
| P09          | Room not found                                     | `9:727`       |
| P10          | Page not found                                     | `9:748`       |
| P11          | Leave room confirmation                            | `9:769`       |
| P12          | Invite friends                                     | `9:792`       |
| P13          | Session menu                                       | `9:823`       |
| P14          | How to play                                        | `9:16004`     |
| DL01         | Room list · open, private, full and playing states | `9:868`       |
| DL02         | No available rooms                                 | `9:943`       |
| DL03         | Room list loading                                  | `9:978`       |
| DL04         | Create room · game-specific settings               | `9:1014`      |
| DL05         | Create room · inline validation                    | `9:1067`      |
| DL06         | Create room · pending request                      | `9:1120`      |
| DL07         | Password-protected room                            | `9:1176`      |
| DL08         | Password rejected · retry                          | `9:1209`      |
| DL09         | Room became unavailable                            | `9:1245`      |
| D01          | Host · waiting for a second player                 | `9:1271`      |
| D02          | Host · ready to start                              | `9:1351`      |
| D03          | Guest · waiting for host                           | `9:1431`      |
| D04          | Drawer · choose one of 3 words                     | `9:1509`      |
| D05          | Guesser · waiting for word selection               | `9:1597`      |
| D06          | Drawer · drawing & tools                           | `9:1675`      |
| D07          | Guesser · live canvas & hint                       | `9:1777`      |
| D08          | Correct guess · input locked                       | `9:1863`      |
| D09          | Word reveal & turn review                          | `9:1949`      |
| D10          | Drawer connection interrupted                      | `9:2033`      |
| D11          | Drawer departed · turn skipped                     | `9:2114`      |
| D12          | Word selection timeout · auto choice               | `9:2195`      |
| D13          | Final scores · host can replay                     | `9:2281`      |
| D14          | Final scores · guest waits for host                | `9:2364`      |
| D15          | Not enough players · game ended                    | `9:2448`      |
| DL10         | Create room · seats menu open                      | `9:15843`     |
| DL11         | Create room · rounds menu open                     | `9:15898`     |
| ML01         | Room list · open, private, full and playing states | `9:2528`      |
| ML02         | No available rooms                                 | `9:2603`      |
| ML03         | Room list loading                                  | `9:2638`      |
| ML04         | Create room · game-specific settings               | `9:2674`      |
| ML05         | Create room · inline validation                    | `9:2727`      |
| ML06         | Create room · pending request                      | `9:2780`      |
| ML07         | Password-protected room                            | `9:2836`      |
| ML08         | Password rejected · retry                          | `9:2869`      |
| ML09         | Room became unavailable                            | `9:2905`      |
| M01          | Host · waiting for second player                   | `9:3002`      |
| M02          | Host · ready to start                              | `9:3089`      |
| M03          | Guest · waiting for host                           | `9:3176`      |
| M04          | Small board · simultaneous picks                   | `9:3303`      |
| M05          | Your pick is locked                                | `9:3720`      |
| M06          | Everyone locked · reveal imminent                  | `9:4137`      |
| M07          | Safe pick · score gained                           | `9:4554`      |
| M08          | Mine hit · score lost                              | `9:4975`      |
| M09          | Same safe cell · reward split                      | `9:5396`      |
| M10          | Timeout · safest cell auto-picked                  | `9:5817`      |
| M11          | Next round · updated board                         | `9:6238`      |
| M12          | Medium board · 16 × 16                             | `9:6655`      |
| M13          | Large board · 30 × 16                              | `9:7779`      |
| M14          | Final scores · host replay                         | `9:9799`      |
| M15          | Final scores · guest waits                         | `9:9886`      |
| M16          | Too few players · game ended                       | `9:9973`      |
| ML10         | Create room · board menu open                      | `9:15951`     |
| MO01         | Home                                               | `9:10062`     |
| MO02         | Name gate                                          | `9:10098`     |
| MO03         | Games hub                                          | `9:10122`     |
| MO04         | Room list                                          | `9:10156`     |
| MO05         | Create room                                        | `9:10193`     |
| MO06         | Room password                                      | `9:10237`     |
| MO07         | Drawer · choose a word                             | `9:10261`     |
| MO08         | Drawer · live canvas                               | `9:10300`     |
| MO09         | Guesser · canvas & guess input                     | `9:10340`     |
| MO10         | Draw reveal                                        | `9:10377`     |
| MO11         | Mines · pick                                       | `9:10412`     |
| MO12         | Mines · locked                                     | `9:10773`     |
| MO13         | Mines · result                                     | `9:11134`     |
| MO14         | Large board · horizontal pan                       | `9:11498`     |
| MO15         | Room · players tab                                 | `9:13463`     |
| MO16         | Room · chat tab                                    | `9:13517`     |
| review-guide | Review guide                                       | `9:14702`     |
