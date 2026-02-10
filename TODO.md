# TODO (AI Film Studio OS)

> 目标：构建可规模化、可审查、可回滚的 AI 影视制作流水线。
> 原则：先补齐逻辑链条（Schema/Spec/Lint），再接入生成模型（避免 Token 浪费）。

## ✅ P0 — 核心骨架（已完成）
- [x] **Repo Structure**: 建立符合工程标准的目录结构 (`schema/`, `shots/`, `tools/` 等)。
- [x] **Spec & Schema**: 完成 Scene, Character, Prop, Shot, Project 的 JSON Schema 定义。
- [x] **Validation**: 实现 `validate.js`，确保所有 JSON 符合 Schema。
- [x] **Linting (Basic)**: 实现 `lint.js`，检查基础引用完整性 (Scene/Cam 引用是否存在)。
- [x] **Project Entry**: 实现 `project.json` 全片入口与 Timeline 定义。
- [x] **Prompt Compiler (v1)**: 实现 `build-prompts.js`，将 Spec 编译为结构化 Prompt。
- [x] **Script Splitter (Skeleton)**: 实现 `script-split.js`，自然语言剧本分段骨架。

---

## 🚧 P1 — 逻辑闭环（正在进行）
> 重点：打通“连续性”与“资源完整性”的检查逻辑。

### 1. State 连续性状态机（解决“穿帮”问题）
- [x] **Schema 定义**: `schema/state.schema.json`
  - 定义镜头输出状态：`characters.{id}.{pose,outfit}`, `props.{id}.{location,state}`, `scene.{light,door_status}`。
- [x] **Shot 字段增强**: 在 `shot.schema.json` 中完善 `continuity` 字段。
  - `state_in_ref`: 引用上一镜头的 `state.json`。
  - `state_changes`: 定义本镜头产生的状态变更。
- [x] **Lint 规则升级**:
  - 检查 `state_in_ref` 文件是否存在。
  - (进阶) 检查关键道具是否“凭空消失”或“瞬间移动”。(已实现基础引用检查)

### 2. Prompt 编译增强（资源预检）
- [x] **引用完整性检查**: 
  - `build-prompts.js` 需检查所有 `references.images` (Anchors, Character Refs) 路径是否真实存在。
  - 缺失资源时抛出 ERROR/WARN。 (已实现：Missing assets log WARN & meta.validation record)
- [x] **Traceability**: 
  - `final.json` 中注入 version/commit hash，确保生成结果可从源码复现。 (已实现：meta.git_commit)

### 3. 剧本要素提取（智能化准备）
- [x] **Extractor 接口**: 升级 `script-split.js`，预留 LLM 调用接口。 (已实现 Mock Extractor class)
- [x] **Draft 生成**: 
  - 输入：剧本段落 (`docs/script.txt`)。
  - 输出：`shots_draft/*.json` (包含 `scene_hint`, `action_beats`, `characters`, `props`)。
- [x] **冲突预警**: 
  - 自动检测文本中的“白天/黑夜”冲突。(已实现: Conflict Warning Log)

---

## 📅 P2 — 生产力工具（待排期）
> 重点：版本管理与成本控制，从“能跑”变成“好用”。

### 1. 强 Lint 规则库 (Quality Gate)
- [x] **Forbidden Check**: Prompt 中是否包含 Scene Spec 定义的 `forbidden` 词汇？(Severity: ERROR)。(已实现)
- [x] **Budget Check**: 检查 `cheap` 模式下是否包含昂贵的运镜或过多角色。(已实现)
- [x] **Consistency**: 同一 Scene 下，不同 Shot 是否引用了相同的 Anchors？(已实现：检查 shot.references 是否遗漏 scene.anchors)

### 2. Render 版本管理 (Asset Management)
- [x] **Takes 记录**: `renders/<shot_id>/takes.json` (实际上实现了 `history.json` + `manage-renders.js`)。
  - 记录：`take_id`, `prompt_hash`, `seed`, `model_version`, `cost`, `status` (pass/fail)。
- [ ] **Review 标记**: 允许人工给 Take 打标签 (`bad_hands`, `lighting_mismatch`, `approved`)。

### 3. Fixups 工单系统 (Post-Production)
- [x] **Fixup Schema**: 定义修复任务 (`inpaint`, `upscale`, `face_restore`)。 (已实现)
- [x] **Workflow**: `shot.json` -> 生成 -> 发现瑕疵 -> 提交 `fixups/*.json` -> 执行修复 -> 更新 `takes.json`。 (已实现 process-fixups.js)

---

## 📂 P3 — 高级特性（未来规划）
- [ ] **Nano Banana 集成**: 自动生成 Scene Anchors 并入库。
- [ ] **Audio 驱动**: 在 Timeline 中集成音频轨道，生成 Beat Sheet。
- [ ] **Web UI**: 简单的本地看板，可视化查看 Timeline 和 Lint 结果。
