# AI Film Studio OS - 生成物与源码边界规范

在 AI 影视制作的工作流中，项目会产生大量的临时和最终的多媒体生成物（如 TTS 音频、关键帧图片、渲染视频等）以及编译出的 Prompt 文件。为了保持 Git 历史干净，避免版本库无限膨胀，特制定本规范。

## 1. 源码与配置（应提交至 Git）

此类文件定义了视频项目的结构、意图和素材引用，是项目的“工程蓝图”，必须进行版本控制：

- **项目主配置**：`project.json` (定义 timeline 结构、场景、角色、道具清单)
- **镜头规格书**：`shots/*.json` (各分镜的 duration、action beats、dialogue、voiceover)
- **资产描述文件**：`characters/*.json`, `props/*.json`, `scenes/*.json`, `styles/*.json`
- **剧本原文**：`docs/script.txt` 或 `docs/*.md`
- **人工设计素材**（不可再生）：
  - 核心角色/道具的参考图片（存放在 `assets/reference/` 目录中）
  - 手工绘制的关键帧（若有）

## 2. 生成物与临时产物（禁止提交至 Git）

此类文件可由系统脚本根据源码与配置自动生成，或属于大容量媒体资源，不应进入版本控制：

- **编译后的 Prompt 包**：`prompts/**/*.json` (由 `build-prompts.js` 生成)
- **生成的语音/配音**：`assets/audio/**/*.mp3` 或 `assets/audio/**/*.wav` (由 `gen-tts.js` 生成)
- **图片/视频渲染与 Take**：`assets/renders/**/*` (如关键帧、视频片段版本 takes)
- **成片导出产物**：`exports/**/*` (最终合成的视频 mp4/mov、字幕 srt 等)
- **运行报告与检查日志**：`reports/*.report.json`
- **Remotion 临时数据**：`render/public/` 下生成的临时音频与视频片段

## 3. 已跟踪生成物的清理指引

若误将生成物提交到了 Git，可以在项目根目录运行审计脚本进行检查：

```bash
node tools/scripts/audit-generated-files.js
```

如需在不删除本地文件的前提下，将它们从 Git 跟踪中移除，可以使用以下命令：

```bash
# 移除单个文件
git rm --cached <文件路径>

# 移除指定生成的目录
git rm -r --cached projects/observer/prompts/
git rm -r --cached projects/observer/assets/audio/
```

移除后执行 `git commit` 提交此项清理，后续 Git 将自动根据 `.gitignore` 规则忽略这些路径。
