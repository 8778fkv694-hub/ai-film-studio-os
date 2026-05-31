# AI Film Studio OS 优化工作文档

更新日期：2026-05-31

## 1. 优化目标

本轮优化围绕当前 5 天内的实际改动展开，目标不是增加新的生成模型接入，而是把项目整理成稳定、可检查、可回滚的本地制作流水线。

核心目标：

1. 降低本地运行负担，避免把大模型推理环境变成项目硬依赖。
2. 让镜头、提示词、素材、Take、字幕、导出都能被脚本检查。
3. 明确源码和生成物边界，减少无意义的 Git 噪音。
4. 加强上传、导入、终端和依赖审计的安全边界。
5. 保留人工外部生成和 AI Agent 辅助生成的低成本工作流。

## 2. 当前生成策略

当前版本不接入 ComfyUI。

ComfyUI 不作为当前产品能力、不作为验收路径，也不作为推荐部署方式。图片和视频生成继续采用低成本外部工作流：

1. 系统编译结构化 Prompt。
2. 用户或 AI Agent 将 Prompt 投递到外部网页工具。
3. 生成后的图片、视频再回填到项目目录。
4. 本系统负责资产入库、审片、Take 管理、字幕、合成和健康检查。

在线大模型 API 只用于轻量文本能力，例如提示词优化、脚本辅助和连续性检查。它不要求本地部署图像模型。

## 3. 优化后的主工作流

### 3.1 项目准备

活动项目通过 `projects.json` 和 `projects/<project_id>/project.json` 管理。项目内保留稳定的规格文件：

```txt
projects/<project_id>/project.json
projects/<project_id>/shots/*.json
projects/<project_id>/scenes/*.json
projects/<project_id>/characters/*.json
projects/<project_id>/props/*.json
projects/<project_id>/states/*.json
```

生成物和中间产物放在项目内部的产物目录：

```txt
projects/<project_id>/prompts/
projects/<project_id>/assets/audio/
projects/<project_id>/assets/renders/
projects/<project_id>/exports/
projects/<project_id>/reports/
```

这些目录默认按生成物处理，不应该和核心规格文件混在一起提交。

### 3.2 镜头拆分

长镜头通过 `tools/scripts/split-long-shots.js` 拆分为 A/B 子分镜。拆分后 timeline 指向子镜头，例如：

```txt
shots/S001A.json
shots/S001B.json
shots/S002A.json
shots/S002B.json
```

优化点：

1. 原长镜头进入 `shots_archived/`，保留回溯能力。
2. 子镜头继承场景、角色、道具、预算和基础 Prompt。
3. 子镜头按片段继承旁白或台词。
4. timeline 改为引用子镜头，避免播放和生成仍走父镜头。

后续仍需继续收敛的问题：

1. 子镜头之间的 `context_refs` 应统一指向相邻子镜头，而不是旧父镜头。
2. 拆分后应重新生成或迁移 `states/<shot_id>_OUT.json`。
3. 旧父镜头的 Prompt 产物应从当前活动工作流中清理，避免误投递。

### 3.3 Prompt 编译和质量控制

Prompt 不直接手写投递，而是由结构化镜头数据编译：

```bash
npm run build-prompts
npm run build-image-prompts
node tools/scripts/score-prompts.js
```

优化点：

1. 视频 Prompt 和图片 Prompt 分开生成。
2. 每个镜头都有可复制的正向、反向和结构化上下文。
3. 质量评分脚本检查提示词长度、镜头运动、角色道具引用和语义冲突。
4. Seedance 包可把 Prompt、对白和参考图整理为投递包。

推荐使用方式：

1. 先运行 `npm run check` 或 `npm run check:full`。
2. 再查看 `projects/<project_id>/reports/` 下的报告。
3. 只投递当前 timeline 中仍有效的子镜头 Prompt。

### 3.4 外部生成和回填

图片回填路径：

```txt
projects/<project_id>/assets/renders/<shot_id>/keyframes/frame_01.png
```

视频 Take 回填路径：

```txt
projects/<project_id>/assets/renders/<shot_id>/takes/<take_id>/video.mp4
projects/<project_id>/assets/renders/<shot_id>/takes/<take_id>/keyframe.jpg
projects/<project_id>/assets/renders/<shot_id>/history.json
```

优化点：

1. UI 支持关键帧上传和替换。
2. `import-take.js` 会导入外部视频、提取尾帧并登记 Take。
3. `manage-renders.js` 不再写入 0 字节假视频和假图片，避免播放器误判。
4. 播放器只把真实存在且非空的视频作为可播放素材。

### 3.5 TTS 和字幕

TTS 通过 `tools/scripts/gen-tts.js` 生成音频，支持旁白和台词：

```bash
npm run tts
```

字幕通过 `tools/scripts/build-subtitles.js` 输出：

```txt
projects/<project_id>/exports/subtitles.srt
projects/<project_id>/exports/subtitles.vtt
projects/<project_id>/exports/subtitles.json
```

优化点：

1. 旁白和台词可以分别选择音色。
2. 音频生成后可回写镜头时长。
3. 播放器和导出脚本可以共用同一套镜头时长数据。

### 3.6 审片和版本管理

Take 记录集中写入：

```txt
projects/<project_id>/assets/renders/<shot_id>/history.json
```

优化点：

1. 每个 Take 记录来源、平台、prompt hash、路径、时长和审片状态。
2. 当前活动 Take 由 `active_take_id` 指定。
3. UI 可以查看 Take 历史并切换活动版本。
4. 合成脚本优先使用活动 Take 的视频，否则回退关键帧和音频。

## 4. 安全和稳定性优化

### 4.1 本地终端

新增本地工作区终端后，已按安全边界处理：

1. 后端使用 `node-pty` 提供真实 PTY。
2. 支持 resize，避免 TUI 输出错位。
3. 终端 API 默认关闭，必须设置 `AFSOS_ENABLE_TERMINAL=1`。
4. 只允许 localhost 访问，减少误暴露风险。

### 4.2 ZIP 导入

项目导入由直接解压改为白名单导入：

1. 限制必须是 ZIP。
2. 检查 ZIP magic bytes。
3. 限制上传体积和条目数量。
4. 拒绝绝对路径、反斜杠、盘符、`..` 和越界路径。
5. 只允许项目资源目录和 `project.json`。
6. 不再导入 `tools/`，避免项目包覆盖可执行脚本。

后续应继续补充：

1. 累计解压后总大小限制。
2. 单文件类型白名单。
3. 导入前备份和回滚。

### 4.3 SVG 上传

图片上传范围收窄到：

```txt
jpg
jpeg
png
webp
```

不再允许 SVG 作为关键帧或参考图上传，避免脚本型 SVG 带来的浏览器执行风险。

### 4.4 依赖审计

已发现 `npm run check:full` 的依赖审计仍存在假绿风险。后续优化方向：

1. 不再在审计脚本中静默抑制漏洞。
2. 根目录和 UI 子包分别执行 `npm audit`。
3. 修正 lockfile 中仍指向旧版本的 `picomatch` 和 `postcss`。
4. 让 `check:full` 只在真实审计通过时返回成功。

## 5. ComfyUI 不接入说明

当前决策：ComfyUI 不接入。

原因：

1. 本项目当前目标是轻量化制作 OS，不是本地图像模型推理平台。
2. ComfyUI 会引入 GPU、显存、模型权重、Python 环境和工作流节点维护成本。
3. 当前用户工作流已经通过外部生成工具和 AI Agent 回填满足需求。
4. 本地 ComfyUI 接口存在额外网络访问和 SSRF 风险，需要单独安全设计。

因此文档、验收和推荐流程统一改为：

```txt
编译 Prompt -> 外部/Agent 生成 -> 上传或 import-take 回填 -> 审片 -> 合成
```

后续代码清理建议：

1. 移除或隐藏设置页中的 ComfyUI 配置块。
2. 移除 `ui/app/api/comfy/*`。
3. 移除 `ui/lib/comfy.ts`。
4. 移除镜头页中的 ComfyUI 生成按钮。
5. 保留通用上传、替换和 Take 登记能力。

## 6. 当前验收命令

常用快速检查：

```bash
npm run check
```

完整检查：

```bash
npm run check:full
```

独立安全审计建议：

```bash
npm audit --registry=https://registry.npmjs.org
npm --prefix ui audit --workspaces=false --registry=https://registry.npmjs.org
npm --prefix tools audit --workspaces=false --registry=https://registry.npmjs.org
```

格式和空白检查：

```bash
git diff --check
```

## 7. 后续优化清单

优先级 P1：

1. 修复 UI layout 保存污染 `shots/*.json` 的问题，只保存白名单字段。
2. 修复根目录和 UI lockfile 里的 `picomatch`、`postcss` 审计问题。
3. 拆分后自动更新子镜头 `context_refs`，避免继续指向旧父镜头素材。
4. 清理旧父镜头 Prompt 产物，确保只投递活动 timeline。

优先级 P2：

1. 移除 ComfyUI 残留 UI 和 API。
2. ZIP 导入增加累计解压大小限制。
3. 对项目导入增加预检查报告和回滚。
4. `lint` 对 WARN/INFO 增加可配置失败阈值。
5. 自动生成或迁移拆分后子镜头的状态 OUT 文件。

## 8. 交付标准

一次优化只有同时满足以下条件，才算完成：

1. `npm run check:full` 通过。
2. 根目录、UI、tools 的 `npm audit` 都通过或有明确可追踪的例外说明。
3. `git diff --check` 通过。
4. README 和工作文档描述的流程与实际 UI 一致。
5. 当前活动项目的 timeline、Prompt、素材引用和状态报告没有明显断链。
