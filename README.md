# AI Film Studio OS（AI 影视工作室操作系统）

目标：把“生成长片/短片”变成**像写代码一样**的工程流程：可审查、可复现、可回滚、可规模化。

你应该把它理解成一个“影视工作室的项目仓库 + 编译器/静态检查器（lint）”，在真正烧 token 生成之前先把冲突 Debug 掉。

---

## 🚀 快速启动 (How to Start)

### 1. 环境准备
确保已安装 Node.js (v18+)。
```bash
cd ai-film-studio
npm --prefix tools install
```

### 2. 标准工作流 (Workflow)

#### Step 1: 导入/拆解剧本 (Script to Drafts)
把你的剧本放入 `docs/script.txt`，然后运行分拆器。它会自动识别场景、角色，生成镜头草稿。
```bash
# 产物：shots_draft/*.json, reports/script.parse.json
node tools/scripts/script-split.js docs/script.txt
```
*提示：检查 `shots_draft/`，把满意的镜头移动到 `shots/` 目录正式生效。*

#### Step 2: 静态检查 (Debug before Generate)
在生成前，先过一遍“安检”。检查结构错误、资源缺失、逻辑冲突、禁忌词。
```bash
# 检查 Schema 结构与文件引用
node tools/scripts/validate.js

# 检查逻辑冲突、禁词、Budget 越界
node tools/scripts/lint.js
```
*必须看到 `validate: ok` 和 `lint: ok` 才能继续！*

#### Step 3: 编译提示词 (Compile Prompts)
把 JSON 镜头卡编译成模型能听懂的 Final Prompt，并自动进行资源预检（图片是否存在）。
```bash
# 产物：prompts/*.prompt.json, prompts/*.final.json
node tools/scripts/build-prompts.js
```

#### Step 4: 生成与记录 (Render & Track)
模拟（或对接真实 API）生成过程，自动记录版本历史、Seed、成本。
```bash
# 产物：renders/<shot_id>/takes/*, history.json
node tools/scripts/manage-renders.js S001
```

#### Step 5: 后期修复 (Fixups)
如果镜头有瑕疵（如多手指），提交修复工单而不是重跑全片。
```bash
# 1. 在 fixups/ 目录创建工单 JSON (参考 schema/fixup.schema.json)
# 2. 运行修复处理器
node tools/scripts/process-fixups.js
```

---

## 📂 Repo 结构说明
- `project.json`：**全片入口**（定义 Timeline、全局风格、Budget）。
- `schema/`：**“宪法”**（所有资产的 JSON Schema 定义）。
- `styles/`、`scenes/`、`characters/`、`props/`：**资产库**（标准 Spec）。
- `shots/`：**镜头卡**（分镜脚本，引用上述资产）。
- `states/`：**状态机**（记录镜头产生的状态，用于连续性检查）。
- `prompts/`：**编译产物**（中间态）。
- `renders/`：**成片与历史**（含 Takes 记录）。
- `fixups/`：**修补工单**。
- `tools/scripts/`：**核心引擎**（所有自动化脚本）。

---

## 核心理念（3 句话）
1) **Spec（标准） > Prompt（提示词） > Render（生成结果）**：先定标准，再编译提示词，最后生成。
2) **长片不靠一把梭**：按镜头拆分 + cheap pass 预演 + 局部 fixup，避免全量重生成。
3) **压自由度**：用 Scene Anchors（标准场景图）+ MustKeep（硬约束）+ State（连续性状态）减少模型自由发挥。

---

## 关键功能清单
- ✅ **Prompt 编译器**：Spec → Prompt JSON → Final Prompt（含 git 追溯）。
- ✅ **智能剧本分拆**：自然语言 → Shot 草稿（含冲突预警）。
- ✅ **State 连续性检查**：防止道具/服装/场景状态跨镜头穿帮。
- ✅ **强 Lint 规则**：禁词拦截、资源完整性校验、Budget 越界警告。
- ✅ **Render 版本管理**：自动记录 Takes、Seed、Cost。
- ✅ **Fixup 工单系统**：局部修复流程闭环。
