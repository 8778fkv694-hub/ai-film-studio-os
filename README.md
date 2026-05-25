# AI Film Studio OS（AI 影视工作室操作系统）

> **"像写代码一样做电影"**
>
> 这是一个专为长片（Long-form）设计的 AI 影视制作流水线。它把感性的创作过程拆解为理性的工程步骤：**Spec（标准） > Prompt Package（提示词任务包） > Keyframe（关键帧） > Animatic（配音分镜预演）**。通过严格的静态检查（Lint），在真正烧钱生成视频之前，就把逻辑冲突、穿帮风险、预算越界给“Debug”掉。
>
> 当前项目优先支持低成本工作流：不强依赖图片或视频 API。你可以把编译出的提示词复制到网页版图片/视频工具，手动生成画面后回填到项目，再用 TTS 和播放器做“配音版静态分镜漫画”Demo。

---

## 🚀 快速启动 (Quick Start)

### 0. 环境准备
确保已安装 Node.js (v18+)。
```bash
cd ai-film-studio-os
npm --prefix tools install  # 安装核心工具依赖
npm --prefix ui install     # 安装 Web UI 依赖
```

项目现在支持多项目目录。默认会读取 `projects.json` 里的 `activeProjectId`，例如当前活动项目是 `projects/observer/`。所有核心脚本都支持显式覆盖：
```bash
node tools/scripts/validate.js --project-dir projects/observer
node tools/scripts/validate.js --project-id observer
```

### 1. 剧本与分镜 (Script to Shots)
先把你的自然语言剧本放入活动项目的 `docs/script.txt`，然后用工具自动拆解为分镜草稿。
```bash
# 智能拆解：识别场景、角色、道具，生成 JSON 草稿
node tools/scripts/script-split.js docs/script.txt
```
*提示：默认产物在活动项目的 `shots_draft/`，请人工确认后移动到 `shots/` 目录正式生效。*

#### 长镜头自动拆分：
针对时长超过大模型建议长度（例如 12s）的长分镜，可以运行工具自动将其拆分为若干时长合理的短镜头，并自动更新时间线 (timeline) 和连续性状态链 (continuity state)：
```bash
# 1. 预演拆分计划 (Dry Run)，只输出方案不修改文件
node tools/scripts/split-long-shots.js --max-duration 12

# 2. 实际应用拆分 (Apply)，更新 timeline 并将原文件备份至 shots_archived/
node tools/scripts/split-long-shots.js --apply --max-duration 12
```

### 2. 静态检查 & 一键健康检查 (Pre-flight & Health Checks) 🛡️ **(最重要的一步)**
在生成任何东西之前，先跑一遍“安检”。这能帮你省下巨额的废片学费。

#### 基础单项检查：
```bash
# 1. 结构校验：检查活动项目 JSON 格式是否符合 Schema
node tools/scripts/validate.js

# 2. 逻辑 Lint：检查连续性、禁忌词、资源缺失、Budget 越界
node tools/scripts/lint.js
```

#### 一键健康检查 (集成校验、提示词编译及前端构建)：
你可以使用统一的健康检查工具确保项目随时处于可生产状态，无断链风险。
```bash
# 1. 一键完整健康检查 (包括 Remotion 和 UI 的打包测试，适合交付或提交前运行)
node cli/index.js check-all

# 2. 快速健康检查 (只运行 JSON 校验、Lint 与 Prompt 编译，适合日常频繁检查)
node cli/index.js check-all --quick
```
*必须所有检查通过才能放心继续生成！*

### 3. 编译图片分镜任务包 (Image Prompt Packages)
不接图片 API，先把每个镜头编译成可复制到网页工具的标准提示词包。
```bash
# 产物：prompts/image/*.image.json、exports/storyboard.csv、exports/storyboard.md
node tools/scripts/build-image-prompts.js
```

把外部工具生成并选中的关键帧放回：
```txt
assets/renders/S001/keyframes/frame_01.jpg
assets/renders/S001/keyframes/frame_02.jpg
assets/renders/S001/keyframes/frame_03.jpg
```
也可以在 Web UI 的“配音分镜”页直接点击“上传画面”回填关键帧。

### 4. 系统设置 (Online AI Settings)
如果需要在线大模型辅助优化提示词，可以在 Web UI 的“系统设置”里配置 DeepSeek、OpenAI 或其他 OpenAI-compatible API。
```txt
.local/ai-settings.json
```
API Key 只保存在本地 `.local/` 目录，并已加入 `.gitignore`。默认工作流仍然是“上传图片优先”，不依赖图片或视频 API。

### 5. 配音分镜漫画预演 (Voiced Storyboard Comic)
不用生成视频，先生成对白，在网页里看“静态图片 + 配音 + 镜头时长”的分镜漫画。
```bash
# 1. 生成对白：根据 shot.dialogue 生成 .mp3 (使用 Edge TTS)
node tools/scripts/gen-tts.js

# 2. 启动看板：进入 Web UI 界面
cd ui
npm install
npm run dev
```
*打开浏览器 (http://localhost:9527)，点击 Preview，体验带配音的静态分镜漫画。*

### 6. 编译视频提示词 (Compile Video Prompts)
把人类可读的 Specs 编译成模型可读的 Final Prompts。
```bash
# 产物：prompts/*.final.json (自动注入参考图路径、Git 版本号)
node tools/scripts/build-prompts.js
```

### 7. 生成与追踪 (Render & Track)
对接模型生成视频（目前为 Mock），并自动记录版本历史。
```bash
# 自动记录 Seed、Cost、Prompt Hash 到 history.json
node tools/scripts/manage-renders.js S001
```

### 8. 后期修复 (Fixups)
发现手指坏了？不要重跑全片，提一个修复工单。
```bash
# 1. 在 fixups/ 创建工单 (参考 schema/fixup.schema.json)
# 2. 运行修复
node tools/scripts/process-fixups.js
```

---

## 📂 核心资产结构

| 目录 | 说明 | 核心作用 |
| :--- | :--- | :--- |
| `projects/<id>/project.json` | **全片总控** | 定义时间轴 (Timeline)、全局风格、预算策略 |
| `projects/<id>/shots/` | **镜头卡** | 每个镜头一个 JSON，定义时长、动作、对白、运镜 |
| `projects/<id>/scenes/` | **场景库** | 定义 Anchors (标准参考图)、禁忌词 (Forbidden) |
| `projects/<id>/characters/` | **角色库** | 定义外貌特征、服装 MustKeep、参考图 |
| `projects/<id>/states/` | **状态机** | 记录剧情推进产生的状态变更 (如：道具已碎、门已开) |
| `projects/<id>/assets/renders/` | **回填关键帧** | 存放外部网页工具生成后选中的镜头图片 |
| `projects/<id>/exports/` | **交付表** | 输出 storyboard CSV/Markdown，方便复制到外部工具 |
| `ui/` | **Web 看板** | 可视化时间轴、Animatic 播放器 |
| `tools/` | **引擎室** | 所有的自动化脚本 (Lint, Compiler, TTS) |

---

## ✨ 核心特性详解

### 1. State 连续性状态机 (Consistency)
> *“上个镜头手里拿着枪，下个镜头枪必须还在，不能消失。”*
- **机制**：每个 Shot 引用上一镜头的 `state.json`。
- **Lint**：如果你在 JSON 里写了“放下枪”，状态机会更新；如果下一镜头没接上，Lint 会报错。

### 2. 强 Lint 规则 (Quality Gate)
> *“别在古装剧里出现 iPhone。”*
- **Forbidden Check**：如果 Scene 定义了 `forbidden: ["phone"]`，任何 Prompt 里出现 phone 都会被拦截。
- **Budget Check**：如果 Shot 标记为 `tier: "cheap"`，Lint 会禁止你开启 `max_regen > 1` 或使用昂贵参数。

### 3. 配音分镜漫画播放器 (0 Cost Preview)
> *“在烧钱之前，先听听节奏对不对。”*
- **Web UI**：自动读取 JSON 里的 `duration_s` 和 `dialogue`。
- **TTS**：集成 Edge TTS，自动生成占位配音。
- **关键帧**：优先读取 `assets/renders/<shot_id>/keyframes/` 下的手动回填图片。
- **效果**：外部生成的静态画面变成“配音版分镜漫画”，极低成本验证叙事节奏。

---

## 🛠️ 下一步计划 (Roadmap)
- [ ] **低成本分镜闭环**：完善图片分镜任务包、关键帧回填、配音预演。
- [ ] **对接真实模型**：将 Mock 替换为 Luma/Runway/Replicate 真实 API。
- [ ] **LLM 剧本理解**：用 LLM 替换正则，实现更精准的剧本 -> 镜头拆解。
- [ ] **自动剪辑**：集成 FFmpeg，把生成的片段自动拼成一条长视频。
