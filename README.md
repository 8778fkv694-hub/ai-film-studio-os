# AI Film Studio OS（AI 影视工作室操作系统）

目标：把“生成长片/短片”变成**像写代码一样**的工程流程：可审查、可复现、可回滚、可规模化。

你应该把它理解成一个“影视工作室的项目仓库 + 编译器/静态检查器（lint）”，在真正烧 token 生成之前先把冲突 Debug 掉。

---

## 核心理念（3 句话）
1) **Spec（标准） > Prompt（提示词） > Render（生成结果）**：先定标准，再编译提示词，最后生成。
2) **长片不靠一把梭**：按镜头拆分 + cheap pass 预演 + 局部 fixup，避免全量重生成。
3) **压自由度**：用 Scene Anchors（标准场景图）+ MustKeep（硬约束）+ State（连续性状态）减少模型自由发挥。

---

## Repo 结构
- `schema/`：JSON Schema（定义 shots/scenes/characters/props/style 的标准）
- `styles/`：全片风格规范
- `scenes/`：场景规范（anchors + must_keep + cam_setups）
- `characters/`：角色规范（身份合约 + 参考图）
- `props/`：道具规范
- `shots/`：每个镜头一个 JSON（镜头卡；引用 spec + 少量 overrides）
- `states/`：每镜头输出的 state（连续性接口；镜头间“契约”）
- `prompts/`：编译前/编译后的 prompt JSON
- `renders/`：生成结果（takes/best）
- `fixups/`：修复工单（inpaint/replace/局部重做）
- `reports/`：lint/QA 报告
- `tools/`：工具脚本（validate/lint/build-prompts/script-split）

---

## 工作流（推荐：专业工作室流程）

### Gate 0：脚本/分镜“编译通过”（生成前）
1) 写/维护标准库：`styles/ scenes/ characters/ props/`
2) 写镜头卡：`shots/*.json`
3) 校验与静态检查：
   - `validate`：结构是否合规（schema）
   - `lint`：冲突/不可执行点（连续性、场景禁忌、机位引用等）

> 这一步解决你说的“像审代码一样 Debug 冲突”。

### Gate 1：Cheap Pass（低成本预演）
- 每个镜头先用低质量参数生成（低清/短时长/少迭代）
- 只检查：构图、走位、叙事是否成立

### Gate 2：Final + Fixups（高质量成片）
- 只有 cheap pass 通过的镜头才允许上 final 参数
- 出问题优先 fixup（局部修复/重做 1–2 秒），不整段重生成

---

## 关键功能要求（你提出的需求已固化）

### 1) Prompt 编译器（Spec → Prompt JSON → Final Prompt）
- 输入：`styles/scenes/characters/props/shots/states`
- 输出：
  - `prompts/<shot_id>.prompt.json`（结构化 PromptSpec，可审查/可 diff）
  - `prompts/<shot_id>.final.json`（最终喂给模型的字符串 + 引用清单）

**规则**：Prompt 必须可追溯（记录 compiled_from），确保复现。

### 2) 剧本分拆器（自然语言 → 分段 → 提取要素 → Shot 草稿）
- 输入：一段自然语言剧本（`docs/script.txt` 或命令行参数）
- 输出：
  - `reports/script.parse.json`：分段、角色、场景、道具、动作 beats
  - `shots_draft/*.json`（可选）：生成镜头卡草稿（需人工确认后移入 `shots/`）

**要求**：
- 必须产出“冲突提示”（比如同一角色服装在相邻段落冲突、同场景光线冲突、道具凭空出现）。
- 必须把不可执行点降级为建议：例如“拆镜头/降低相机运动/增加 anchors”。

### 3) 场景 Anchors（压自由度，解决场景变量爆炸）
- 每个 `scene.json` 至少 2–3 张 anchor：布局/动作区/细节区
- 镜头回到同一场景时：
  - 必须引用 anchors（硬约束）
  - 推荐引用“上一次该场景镜头的末尾帧”作为续写参考（更强约束）

---

## 快速开始
```bash
cd ai-film-studio
npm --prefix tools install

# Gate 0: 编译/静态检查（生成前必须过）
node tools/scripts/validate.js
node tools/scripts/lint.js

# 生成前：编译提示词（Spec -> prompts/*.json）
node tools/scripts/build-prompts.js

# 生成前：剧本分段（骨架）
node tools/scripts/script-split.js docs/script.txt
```

---

## 约定
- 任何可变更的风格/场景/角色/道具都必须写入 JSON Spec（可审查、可复用）。
- 任何生成结果必须记录：使用的 spec、prompt、参数、失败标签（像 commit message 一样）。
