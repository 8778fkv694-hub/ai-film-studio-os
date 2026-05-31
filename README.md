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

### 4.1 当前不接入 ComfyUI

当前版本不接入 ComfyUI。系统不要求本地 GPU、模型权重、Python 推理环境或 ComfyUI 节点工作流。

推荐继续使用“编译 Prompt -> 外部/Agent 生成 -> 上传或导入回填 -> 审片 -> 合成”的轻量流程。现存本地设置只用于在线文本模型，例如提示词优化和连续性辅助检查。

### 4.2 推荐工作流：AI Agent 辅助生图 (最轻量与高质)

为了确保轻量化与零本地系统负载，本系统推荐使用 **AI Agent 辅助生图** 的设计与开发工作流：
1. **对话式触发**：在与 AI Agent 对话开发时，直接命令 Agent 使用其内置的高质量图像生成工具。
2. **免配置与零负载**：无需在本地配置任何复杂的 Python 推理环境或占用 CPU/GPU/内存资源。
3. **自动回填**：生成后由 Agent 自动将高清图片保存至对应镜头的关键帧路径（如 `projects/<id>/assets/renders/<shot_id>/keyframes/frame_01.png`）。
4. **即时预览**：刷新 Web 页面即可直接预览已回填的精美画面。

### 5. 提示词质量评估 (Prompt Quality Scoring) 🎯
在开始投递提示词前，运行评估脚本对编译出的提示词进行质量打分：
```bash
# 扫描 prompts/*.prompt.json 并分析，输出报告至 reports/prompt-score.report.json
node tools/scripts/score-prompts.js
```
*提示：它会检查是否缺失角色/道具/场景、是否缺失镜头运动词、提示词是否过长或过短、以及是否存在语义冲突词（如 day 与 night 同时出现）。*

### 6. 连续性状态审计 (Continuity State Chain Audit) 🔗
检查全片剧情推进中的角色服装、道具状态、场景布光在镜头间是否连贯：
```bash
# 1. 检查是否存在状态穿帮
node tools/scripts/build-state-chain.js

# 2. 应用并自动校准/重写 OUT 状态文件，使下一镜头能自动继承上一镜头的状态
node tools/scripts/build-state-chain.js --apply
```

### 7. 导入人工生成结果 (Import Render Take) 🎬
从外部网页工具生成并下载视频片段后，使用 Take 工具一键导入并版本化管理：
```bash
# 导入视频作为 take 并自动计算 prompt 哈希，提取尾帧作为下一镜头的 context_ref 关键帧
node tools/scripts/import-take.js S001 my_runway_video.mp4 --platform "Runway Gen-3" --notes "第一版特写测试"
```
*你也可以在 Web UI 的「Takes 审片」选项卡中直接上传视频、查看所有 Take、进行五星打分与 Approve 标记。*

### 8. 字幕编译与全片合成 (Subtitles & Video Composition) 🎞️
项目音视频就绪后，编译时间轴字幕并一键合成最终成片：
```bash
# 1. 自动根据 dialogue/voiceover 与镜头时长编译 SRT/VTT/JSON 字幕
node tools/scripts/build-subtitles.js

# 2. 一键合成 MP4 并支持选择分辨率预设及字幕烧录
# 支持预设：default_1080p (16:9), vertical_1080x1920 (9:16 竖屏), square_1080 (1:1 方屏)
node tools/scripts/compose-video.js --preset vertical_1080x1920 --subtitles
```
*合成的成片会自动输出并留存在项目的 `exports/` 目录中。*

### 9. 启动 Web 可视化看板 (Start UI Board) 💻
```bash
# 1. 生成占位 TTS 语音 (使用 Edge TTS)
node tools/scripts/gen-tts.js

# 2. 启动 Next.js 前端开发服务器
npm --prefix ui run dev
```
*打开浏览器访问 http://localhost:9527，即可在可视化面板中完成分镜编辑、AI 润色、Prompt 一键复制、Takes 审片、资产库管理与 MP4 一键自定义预设导出。*

---

## 📂 核心资产与报告目录

| 目录 | 说明 | 核心作用 |
| :--- | :--- | :--- |
| `projects/<id>/project.json` | **全片总控** | 定义时间轴 (Timeline)、全局风格、激活项目入口 |
| `projects/<id>/shots/` | **分镜卡 JSON** | 存放各镜头的时长、动作描述 (beats)、对白旁白、资源引用 |
| `projects/<id>/scenes/` | **场景库** | 定义环境保留要素 (Set elements) 与禁忌词 (Forbidden) |
| `projects/<id>/characters/` | **角色库** | 声明发型服装 (Must keep) 规范与参考图 |
| `projects/<id>/states/` | **状态机** | 存放各个镜头的 OUT 状态，用于进行连续性判定 |
| `projects/<id>/assets/renders/` | **Take 库** | 存放人工回填的关键帧 (`keyframes/`) 及视频版本 (`takes/`) |
| `projects/<id>/reports/` | **审计报告** | `check-all.report.json`、`asset-index.json`、`prompt-score.report.json`、`state-chain.report.json` |
| `projects/<id>/exports/` | **导出交付件** | 输出视频成片、SRT/VTT 字幕文件及分镜说明表 |


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
