# 物理空间调度系统（Spatial Blocking System）实施计划

> 状态：**设计稿，未动代码**。日期：2026-06-05。分支：`fix/script-split-and-video-versions`。
>
> 目标：用一张「俯视调度 + 摄影机」的结构化数据，把 3D 空间规则（谁站哪、朝哪、谁前谁后、机位高低、镜头焦段、运动轨迹）**一次定死**，再自动派生成喂给 AI 的精确提示词与首帧，并在生成前做空间自检（越轴 / 30° / 瞬移）。

> **架构红线（不可违反）**：**不引入任何数据库**。blocking 严格沿用本项目现有的「源 JSON → 编译出字段化产物」两层文件模型（详见 §9）。理由：本项目「像写代码一样做电影」，靠 git diff / 回滚 / review / 重编译运作；数据库会破坏可 diff 性、可移植性与「编译」语义，对当前规模是负担非收益。（注：根目录 `mydatabase.db` 为 0 字节误建残留，无任何代码引用，应删除并加入 `.gitignore`。）

---

## 0. 为什么做（痛点）

当前空间信息散落在 `scene.anchors[].note`、`shot.prompt.positive`、`shot.action.beats` 等纯文字字段里，互相不感知。模型收到的是一团形容词，不知道人物的确切方位与前后关系，导致：

- 跨镜头空间漂移（角色左右乱跳、机位忽正忽俯、布景左右互换）；
- 纠错只能堆更多形容词，越堆越乱；
- 视频首帧（`conditioning_keyframes`）本身空间就飘，视频模型在错误起点上运动，更飘。

搜索现状：`tools/scripts/*` 中 `position|coord|blocking|layout` 几乎无结构化字段（仅自然语言 note）。

---

## 1. 专业对标（不重新发明）

本方案直接采用两款成熟专业软件的方法论与字段集：

| 来源 | 借鉴的方法 |
|---|---|
| **Shot Designer**（Hollywood Camera Work / Per Holmes） | ①「摄影机俯视图 + 镜头表 + 故事板」**三视图必须联动、同源**；② 运动用 `walk_to` / `track_to` 等**命令词**而非自由路径；③ 智能摄影机：挪动角色，屏幕布局自动重算；④ 内置 Set Designer（场景平面复用） |
| **FrameForge** | 摄影机标准字段集：**height / focal length(lens) / angle of view / tilt / roll / depth of field**；**Overhead Blueprint** 显示机位与**视锥可见范围**；自动报告**画面内可见角色** |

参考链接见文末。

### 关键认知：AI 不是真镜头

真镜头遵守几何光学，投影确定可计算；生成模型是「理解 / 联想」，**不严格遵守几何**。因此：

- **几何能算的照搬**：高度、机位角、视锥、可见性、越轴 —— 纯几何，按 FrameForge 算法计算。
- **AI 不遵守几何的翻译成措辞**：焦段、景深、横滚 —— 不做像素级投影，而是翻成 prompt 语言。
- **不要追投影精度**：灰模图是「强烈建议」，不是像素契约。约束力最强的是**首帧图**，故主力走「blocking → 图片 prompt → 空间正确的关键帧 → 当视频首帧」。

---

## 2. 核心架构：一个数据源，三种产物（三视图法则）

```
shot.blocking { floorplan, camera, entities, motion, axis_lock }
        │
        ├─（几何引擎）──────────────────────────────────────────
        │
        ├─ ① 俯视调度 SVG + 视锥        →  你 / Lint           （= Blueprint）
        ├─ ② camera-view 灰模图          →  视频 AI（首帧脚手架）（= Storyboard）
        ├─ ③ 空间从句 + 运动文字 + 规格  →  视频 AI（prompt）/ 你（= Shot List）
        └─ ④ 可见性过滤 (视锥内实体)     →  只把画框内的东西写进 prompt
```

三者**同源联动**：改一处，三种产物全部重算。这正是 Shot Designer 的核心法则。

---

## 3. 数据模型（schema 扩展，全部 optional，向后兼容）

### 3.1 `shot.schema.json` 新增 `blocking`

```jsonc
"blocking": {
  "grid": "5x5",                       // 或 "continuous"（0–100 归一化）
  "floorplan_ref": "scene",            // 复用 scene.floorplan（见 3.2），可省略

  "camera": {                          // ← FrameForge 标准字段集
    "x": 50, "y": 90,                  // 俯视坐标
    "height": "eye_level",             // low | eye_level | high | overhead
    "tilt": 0,                         // 俯仰角，正=仰拍 负=俯拍
    "roll": 0,                         // 横滚（荷兰角）
    "lens": "35mm",                    // 焦段，决定空间压缩
    "shot_size": "medium",             // wide | medium | close | ecu ...
    "dof": "normal"                    // shallow | normal | deep
  },

  "entities": [                        // 角色 / 道具的起始站位
    {
      "ref": "characters/charA_v1.json",   // 或 "prop:mirror"
      "x": 40, "y": 50,
      "facing": "S",                   // 8 方位罗盘 N/NE/.../NW 或角度
      "gaze_target": "prop:mirror",    // 看向谁（视线匹配，比角度稳）
      "layer": "foreground"            // 可选；亦可由离机位距离自动算
    }
  ],

  "motion": [                          // ← Shot Designer 命令词，可选（视频用）
    { "who": "charA", "verb": "walk_to", "x": 50, "y": 35 },
    { "who": "charA", "verb": "turn_to", "target": "camera" },
    { "who": "camera", "verb": "track", "target": "charA" }
  ],

  "axis_lock": "A-mirror"              // 180° 轴线，跨镜头校验用
}
```

命令词词汇表（起步集）：`walk_to` / `turn_to` / `track`（机位跟随）/ `push_in` / `pull_out` / `pan_to` / `hold`。

### 3.2 `scene.schema.json` 新增 `floorplan`（固定布景，shot 复用）

```jsonc
"floorplan": {
  "grid": "5x5",
  "fixtures": [
    { "id": "fridge", "x": 10, "y": 30, "label": "red fridge" },
    { "id": "table",  "x": 50, "y": 50, "label": "wooden table" },
    { "id": "window", "x": 90, "y": 20, "label": "rainy window" }
  ]
}
```

让「冰箱在左、桌子居中、雨窗在右」从 note 升级为坐标，每镜复用，不必重画。

---

## 4. 几何引擎：`tools/scripts/shared/blocking.js`（新模块）

纯函数，无副作用。输入 blocking（+ 解析后的 scene floorplan），输出四种产物所需的中间结果。

### 4.1 `computeVisibility(blocking)` — 可见性过滤（FrameForge 自动报告）
- 由 `camera.{x,y,facing,lens,shot_size}` 算出视锥（FOV 扇形 + 近远裁剪）。
- 返回 `{ visible: [...], offscreen: [...] }`。
- 用途：**只把 `visible` 的实体写进 prompt**，杜绝 AI 画出画框外不该有的元素。

### 4.2 `projectToScreen(blocking)` — 俯视 → 画面投影
- 把每个 visible 实体投影到 16:9 画框，得到 `{ id, screenX(0–100), screenY, size, depthOrder }`。
- 自动判定：屏幕左/中/右、前景/中景/背景、谁遮挡谁、面向/背向镜头。
- 用途：生成「屏幕位置」措辞 + 灰模图。**只做到「中前景偏左」量级，不追像素精度。**

### 4.3 `toSpatialClause(blocking)` — 空间从句（英文）
> `Character A stands in the foreground-center-left, back to camera, looking at the mirror; the mirror is at mid-depth, upper-center of frame; camera is behind A at eye level, 35mm. Window is out of frame.`

### 4.4 `toMotionClause(blocking)` — 运动文字（视频用，由 motion 派生）
> `A walks from back-left to front-center, then turns to face camera; camera tracks A; medium shot held.`

### 4.5 `toLensClause(camera)` — 焦段/景深/横滚 翻译层
- `35mm` → "natural spatial perspective"
- `85mm` + `shallow` → "compressed background, subject isolated with shallow depth of field"
- `roll: 15` → "slight dutch angle"
- `tilt < 0` → "high angle looking down"（俯拍）

### 4.6 `renderBlueprintSVG(blocking)` — 俯视调度图（给你 / Lint）
- 网格底图、实体圆点 + 朝向箭头、摄影机视锥扇形、轴线虚线。
- 技术栈与现有 `assets/scenes/*/anchor_*.svg` 一致。

### 4.7 `renderGrayboxSVG(blocking)` — camera-view 灰模图（给 AI 当首帧脚手架）
- 16:9 画框内的色块/剪影，按 `projectToScreen` 结果摆放，标注实体名。
- **相机空间**，模型可当首帧种子 / 布局参考；俯视图绝不喂 AI。

---

## 5. 接入现有流水线

| 文件 | 改动 |
|---|---|
| `schema/shot.schema.json` | 加 `blocking`（optional） |
| `schema/scene.schema.json` | 加 `floorplan`（optional） |
| `tools/scripts/shared/blocking.js` | **新建**：几何引擎 + 三种产物渲染 |
| `tools/scripts/build-image-prompts.js` | 调 `toSpatialClause` + `toLensClause`，注入 shotPrompt；按 `computeVisibility` 过滤场景元素；可选输出灰模图到 `assets/renders/<shot>/blocking_*.svg` |
| `tools/scripts/build-prompts.js` / `build-seedance-packs.js` | 注入 `toMotionClause`；灰模图作为「脚手架首帧」放入 pack references（真关键帧存在时优先用真帧） |
| `tools/scripts/lint.js` | 新规则（见 §6） |
| `ui/components/ShotDetailPanel.tsx` | 可视化拖拽编辑器（阶段 3） |

视频首帧通道已存在：`build-seedance-packs.js` 已复制 `conditioning_keyframes` 为首帧并生成上传指引表。本方案只需保证该首帧空间正确，并在缺真帧时提供灰模脚手架。

---

## 6. Lint 新规则（生成前自检，专业「场记」职责）

1. **越轴检测（180° 规则）**：相邻镜头共享 `axis_lock` 时，若摄影机跨到轴线另一侧 → 红字警告「角色屏幕左右会翻转」。
2. **30° 规则**：相邻两镜机位夹角 < 30° 且景别相近 → 警告「可能跳切」。
3. **瞬移检测**：同一实体相邻镜头位置突变且无 `motion` 交代走位 → 警告。
4. **视线目标存在性**：`gaze_target` 指向的实体必须存在于本镜 entities 或为 camera。
5. **可见性一致性**：prompt 里点名的实体应在视锥内（防止描述画框外元素）。

---

## 7. 分阶段实施（按 ROI）

- **阶段 0（MVP，最高 ROI）✅ 已完成（2026-06-05）**：`shot.blocking` / `scene.floorplan` schema（单帧静态，含 camera 全字段）+ `tools/scripts/shared/blocking.js`（`compileBlocking`：可见性过滤 / 屏幕投影 / 空间从句 / 焦段翻译 / 运动从句）+ 注入 `build-image-prompts.js`（新增产物字段 `image_prompt_space` / `image_prompt_camera` / `visible_entities` / `blocking_warnings`，并拼入 `image_prompt_final`）。向后兼容（旧 shot 无 blocking → 字段为空）；`check-all --quick` 全绿。验证：镜头跨轴时屏幕左右与「面向/背对镜头」随几何正确翻转；焦段/景深/俯仰/可见性过滤均生效。**未做图、未做 UI、运动从句已实现但图片阶段不注入。**
- **阶段 1 ✅ 已完成（2026-06-05）**：`blocking.js` 加几何工具（`sideOfLine`/`angleAtPivot`/`dist`）+ `renderBlueprintSVG`（俯视调度图，给人/Lint，绝不喂 AI）；新建 `tools/scripts/build-blocking-diagrams.js`（遍历带 blocking 的 shot → `assets/renders/<shot>/blocking.svg`，无 blocking 跳过）；`lint.js` 新增 5 条空间规则：① gaze_target 存在性 ② 全员出框 ③ 180° 越轴 ④ 30° 跳切 ⑤ 瞬移。验证：故意构造越轴+瞬移+无效 gaze 触发全部告警；有效配置无误报；清洁 lint 与 `check-all --quick` 全绿。`build-blocking-diagrams.js` 暂为独立命令（不入 check-all，避免每次检查写 SVG 污染 git）。
- **阶段 2 ✅ 已完成（2026-06-05）**：`blocking.js` 加 `renderGrayboxSVG`（camera-view 16:9 灰模，可见实体按 screenX/景深 摆位与缩放，rule-of-thirds，水印 GRAY-BOX SCAFFOLD）；`build-blocking-diagrams.js` 同时输出 `blocking_grayframe.svg`；`build-prompts.js` 注入 `space + camera + motion` 到 `video_prompt`，新增 `spatial_blocking` 字段（space/camera/motion/visible_entities/warnings/grayframe），并在**无真关键帧时**把灰模图作 `kind:"blocking_scaffold"` 脚手架塞进 `reference_images`。验证：S005 注入 blocking+motion → 视频 prompt 含运动从句、灰模生成、seedance pack 自动收录脚手架（`references/blocking_scaffold_graybox.svg` + 上传指引表）；旧数据 `spatial_blocking=null` 无脚手架；`check-all --quick` 全绿。
- **阶段 3 ✅ 已完成（2026-06-05）**：新增 `ui/components/BlockingEditor.tsx`（俯视可拖拽画布：实体彩点+朝向箭头+摄影机视锥；右侧相机/实体/gaze/axis 控件；「刷新预览」拉空间从句+灰模图）；新增 `ui/app/api/blocking/preview/route.ts`（**复用同一 node 引擎** `tools/scripts/shared/blocking.js`，单一真相）；`ShotDetailPanel.tsx` 加「空间调度」tab；`api/shots` 白名单加 `blocking`（保存往返不丢字段）。验证：`tsc --noEmit` 全项目 **0 错误**；`check-all --quick` 全绿。
  - ⚠️ **遗留（非本功能引入）**：完整 `next build` 因 `ui/lib/shot-sequence.ts`（master 既有，本分支 commit 5d81179 增改）用 `execFile('node',[path.join(rootDir,'tools/scripts',script)])`，Turbopack 文件追踪无法在构建期解析 `rootDir` 而报 9 个 `Module not found <dynamic>`。该问题在引入本功能前已存在（`check-all --quick` 跳过 UI 打包故未暴露）；已用 stub 实验证实与 blocking 代码无关。建议单独修（优先 `next.config` 的 outputFileTracing 配置，而非改业务代码）。

---

## 7.5 空间自由度三档（2026-06-05 增补）

`blocking.mode`（`lock`/`guide`/`off`，缺省 `guide`）控制空间规范**如何注入提示词**——给编辑者「锁死 / 建议 / 放飞」三种自由度：

| 模式 | 注入 AI 的内容 | 灰模脚手架 |
|---|---|---|
| `lock` 锁定 | `Spatial layout (follow exactly): …` | 是 |
| `guide` 建议（默认） | `Suggested spatial layout (adjust freely…): …` | 是 |
| `off` 自由 | 不注入任何空间约束（AI 自由补全） | 否 |

- 引擎 `compileBlocking` 返回 `mode` + `inject.{space,camera,motion,scaffold}`（按 mode 塑形）；原始 `*Clause` 仍保留给编辑器始终显示几何。
- `build-image-prompts.js` / `build-prompts.js` 改用 `inject.*`，并按 `inject.scaffold` 门控脚手架首帧；新增 **`--spatial lock|guide|off`** 全局覆盖（一键出「锁定版/自由版」整片，覆盖逐镜设置）。
- 产物新增 `blocking_mode`（图）/`spatial_blocking.mode`+`.injected`（视频）。
- UI：`BlockingEditor` 顶部三档切换 + 预览区显示「实际注入 AI」文本或「自由模式不注入」提示。
- 验证：node 引擎三档 + override 正确；`--spatial` 编译通过；API 三档返回正确 injected/mode；UI 档位切换/持久正常；`tsc` 0 错；`check-all --quick` 全绿；向后兼容（无 blocking → 字段空/null）。

## 8. 验收标准

- 旧项目（无 `blocking` 字段）编译、lint、UI 全部照常通过（向后兼容）。
- 填了 blocking 的 shot：图片 prompt 中出现确定的方位/前后/焦段措辞，且不再点名画框外元素。
- 同一 blocking + 不同机位，空间从句中的「屏幕左右」随几何正确翻转。
- 制造一次越轴 / 30° / 瞬移，lint 能拦下。

---

## 9. 存储模型：两层文件，无数据库

**结论：blocking 不引入数据库，完全复用现有的「源 JSON → 编译产物」两层文件管线。**

### 9.1 现状（已核查）

- 无任何数据库依赖（`package.json` 无 sqlite / prisma / better-sqlite3 / pg / mongo），代码中无数据库连接。
- `mydatabase.db` 为 **0 字节误建残留**，无代码引用 → 删除并加入 `.gitignore`。
- 提示词**已字段化但存于文件**：

```
shots/S###.json                 ← 源（手写 / UI 编辑）
        │  build-image-prompts.js 编译
        ▼
prompts/image/S###.image.json   ← 产物（结构字段：image_prompt_master/scene/characters/props/shot/final、negative_prompt、reference_images[]、context_refs{} …）
```

### 9.2 blocking 照此模型落位

- **源**：`shots/S###.json` 新增 `blocking` 字段（见 §3.1），与 `prompt` / `characters` / `props` 平级，手写或 UI 编辑，纳入 git。
- **产物**：`build-image-prompts.js` 编译时，向 `prompts/image/S###.image.json` **新增并列字段**：

```
image_prompt_space     ← 空间从句（toSpatialClause）
image_prompt_camera    ← 焦段/景深/高度/横滚 翻译（toLensClause）
visible_entities[]     ← 视锥内可见实体（computeVisibility，供可见性过滤）
blocking_blueprint     ← 俯视图 SVG 路径（阶段 1）
blocking_grayframe     ← 灰模首帧 SVG 路径（阶段 2）
```

并把 `image_prompt_space` / `image_prompt_camera` 拼进 `image_prompt_final`。

### 9.3 为什么不上数据库

- 破坏 git diff / 回滚 / review（项目核心工作流，见近期 commit）。
- 破坏「产物可丢弃、可重编译」语义（产物 = 编译结果，非数据库记录）。
- 破坏可移植性，且需额外起服务；对当前规模是负担非收益。

---

## 附：术语对照

| 本方案 | 专业影视 |
|---|---|
| 俯视调度 SVG | 摄影机俯视图 / Overhead Blueprint |
| 灰模图 | 故事板 / 灰模预演（gray-box previs） |
| 空间从句 + 规格 | 镜头表（Shot List） |
| 运动命令词 | 场面调度（blocking）/ Walk To · Track To |
| gaze_target | 视线匹配（eyeline match） |
| 越轴 / 30° / 瞬移 lint | 场记连续性 / 180°·30° 规则 |
| 整体 | 前期预演（previs） |

## 参考

- Shot Designer — Hollywood Camera Work: https://www.hollywoodcamerawork.com/shot-designer.html
- No Film School — Shot Designer 评测: https://nofilmschool.com/2012/10/diagram-shotlist-and-pocket-block-with-the-shot-designer-app
- FrameForge Features & Benefits: https://www.storyboardsmarter.com/frameforge-features-and-benefits
- FrameForge 摄影机数据字段（Printed Storyboards）: https://www.frameforge.com/pages/printed-storyboards
- FrameForge 3D Studio — Wikipedia: https://en.wikipedia.org/wiki/FrameForge_3D_Studio
