# AI Film Studio OS 补强实施工单

更新日期：2026-05-25

这份文档是给执行模型看的，不是路线图讨论稿。执行模型应按这里的工单逐项完成；涉及外部生成平台、Provider、浏览器自动化的能力保留为后续扩展点，当前阶段先完善本地生产闭环。

## 0. 执行范围与阶段策略

### 0.1 当前阶段优先级

当前阶段优先完善本地能力：

1. 项目健康检查
2. Prompt 交付与复制
3. 人工生成结果回收入库
4. Take 审片与 active take
5. 镜头工作台
6. 长镜头拆分
7. 字幕、合成、导出
8. 生成物与源码边界

图片生成 API、视频生成 API、Provider 抽象、浏览器自动提交外部平台都可以保留为后续路线。当前工单里如果遇到相关位置，应预留字段和扩展口，但本阶段验收不依赖这些能力。

用户已有无 API 的图片/视频生成订阅服务，实际生成可以先由人工完成。系统要做的是本地项目管理、Prompt 交付、结果回收、审片、合成、校验和导出。

### 0.2 工程约定

1. 当前项目入口是 `projects.json` 的 `activeProjectId`。
2. 当前 active project 示例是 `projects/observer`。
3. 所有脚本必须支持 active project。
4. 新脚本优先复用 `tools/scripts/shared/dirs.js`。
5. 命令行参数必须支持 `--project-id <id>` 和 `--project-dir <dir>`。
6. UI 读写项目文件时必须通过 `ui/lib/projects.ts`。
7. 后端 API 执行命令时使用 `execFile` 或 `execFileSync`。
8. 文件名、shot id、project id 必须校验，只允许 `[A-Za-z0-9_-]`。
9. JSON 文件写入时使用 `JSON.stringify(data, null, 2)`。
10. 每个工单完成后必须跑验收命令。

### 0.3 常用验收命令

```bash
node tools/scripts/validate.js
node tools/scripts/lint.js
node tools/scripts/build-image-prompts.js
node tools/scripts/build-prompts.js
npm --prefix render run prepare
cd render && ./node_modules/.bin/tsc --noEmit
npm --prefix ui run build
node cli/index.js status
node cli/index.js check
```

## 1. 工单 A：一键健康检查 `check-all`

### 目标

增加一条命令，自动检查当前 active project 是否处于可继续生产状态。

外部图片/视频生成由人工完成，但人工生成前后必须能一键确认项目没有断链。

### 要改的文件

1. 新增：`tools/scripts/check-all.js`
2. 修改：`cli/index.js`
3. 修改：`README.md`
4. 可选修改：`start.command`

### 实施步骤

1. 新建 `tools/scripts/check-all.js`。
2. 从 `tools/scripts/shared/dirs.js` 引入 `parseArgs`。
3. 解析参数：
   - `--project-id <id>`
   - `--project-dir <dir>`
   - `--quick`
4. 定义检查步骤数组。
5. quick 模式只跑：
   - `node tools/scripts/validate.js`
   - `node tools/scripts/lint.js`
   - `node tools/scripts/build-image-prompts.js`
   - `node tools/scripts/build-prompts.js`
6. full 模式继续跑：
   - `npm --prefix render run prepare`
   - `./node_modules/.bin/tsc --noEmit`，工作目录为 `render`
   - `npm --prefix ui run build`
7. 执行命令时使用 `spawnSync` 或 `execFileSync`，参数使用数组传入。
8. 每一步输出：
   - step name
   - command
   - status: `passed` / `failed`
   - duration_ms
9. 任一步失败时立即停止后续步骤。
10. 把报告写入 active project 的 `reports/check-all.report.json`。
11. 报告字段：
   - `project_dir`
   - `project_id`
   - `mode`
   - `started_at`
   - `finished_at`
   - `status`
   - `steps`
12. 在 `cli/index.js` 增加命令：
   - `afsos check-all`
   - `afsos check-all --quick`
13. 在 `README.md` 增加使用说明。
14. 如果修改 `start.command`，菜单中增加“完整健康检查”。

### 验收标准

1. `node tools/scripts/check-all.js --quick` 成功。
2. `node tools/scripts/check-all.js` 成功。
3. `node cli/index.js check-all --quick` 成功。
4. `projects/observer/reports/check-all.report.json` 被生成。
5. 报告中能看到每个步骤的耗时和状态。

### 本工单边界

1. 本工单只实现本地检查与报告。
2. 外部生成平台提交能力作为后续 Provider / automation 工单。
3. 已有 reports 保留，新报告写入 `reports/check-all.report.json`。

## 2. 工单 B：Take 审片与版本管理

### 目标

让人工从外部订阅平台下载回来的图片/视频可以进入本地 take 系统，并且可以标记、选择、回滚。

### 当前问题

现在存在两套不统一的位置：

1. `tools/scripts/manage-renders.js` 写到 `renders/<shot_id>/history.json`
2. UI 视频上传写到 `assets/renders/<shot_id>/video/video_raw.mp4`

需要统一到 active project 下的 `assets/renders/<shot_id>/takes/`。

### 目标目录结构

```text
projects/<id>/assets/renders/<shot_id>/
  keyframes/
    frame_01.png
    frame_last.jpg
  takes/
    take_001/
      take.json
      video.mp4
      keyframe.png
    take_002/
      take.json
      video.mp4
  history.json
```

### `history.json` 建议结构

```json
{
  "shot_id": "S001",
  "active_take_id": "take_001",
  "takes": [
    {
      "take_id": "take_001",
      "created_at": "2026-05-25T00:00:00.000Z",
      "status": "imported",
      "source": "manual_external",
      "platform": "manual",
      "prompt_hash": "xxxxxxxx",
      "video_path": "assets/renders/S001/takes/take_001/video.mp4",
      "keyframe_path": "assets/renders/S001/takes/take_001/keyframe.png",
      "review": {
        "rating": null,
        "tags": [],
        "notes": "",
        "approved": false
      }
    }
  ]
}
```

### 要改的文件

1. 修改：`schema/render_history.schema.json`
2. 修改：`tools/scripts/manage-renders.js`
3. 新增：`tools/scripts/import-take.js`
4. 修改：`ui/app/api/assets/video/upload/route.ts`
5. 新增：`ui/app/api/takes/route.ts`
6. 新增：`ui/app/api/takes/[shot]/route.ts`
7. 修改：`ui/app/api/shots/route.ts`
8. 修改：`ui/components/tabs/PreviewTab.tsx`

### 实施步骤

1. 更新 `schema/render_history.schema.json`：
   - 增加 `active_take_id`
   - take 增加 `source`
   - take 增加 `platform`
   - take 增加 `video_path`
   - take 增加 `keyframe_path`
   - review 增加 `approved`
   - status enum 至少包含 `imported`、`approved`、`rejected`、`needs_fixup`
2. 新建 `tools/scripts/import-take.js`。
3. `import-take.js` 参数：
   - `<shot_id>`
   - `<file_path>`
   - `--platform <name>`，默认 `manual`
   - `--notes <text>`，可选
   - `--project-id`
   - `--project-dir`
4. `import-take.js` 行为：
   - 校验 shot id
   - 校验文件存在
   - 校验扩展名：`.mp4`、`.mov`、`.webm`
   - 创建下一个 take 目录，例如 `take_001`
   - 复制视频到 `takes/take_001/video.<ext>`
   - 读取对应 `prompts/<shot_id>.final.json` 并计算 hash
   - 更新 `assets/renders/<shot_id>/history.json`
   - 如果没有 active take，把新 take 设为 active
5. 修改 `ui/app/api/assets/video/upload/route.ts`：
   - 上传视频后从 legacy single video 写法升级为 take 写法
   - 改为创建新 take
   - 返回 `take_id`、`videoUrl`、`history`
6. 新增 `GET /api/takes?shot_id=S001`：
   - 返回该镜头 history
7. 新增 `POST /api/takes/[shot]`：
   - body 支持 `{ take_id, action }`
   - action 支持 `approve`、`reject`、`set_active`、`update_review`
8. 修改 `ui/app/api/shots/route.ts`：
   - 每个 shot 返回 `_takes`
   - 返回 `_active_take`
   - `_video_url` 优先使用 active take 的视频
9. 修改 `PreviewTab.tsx`：
   - 每个镜头显示 take 数量
   - 显示 active take
   - 增加 approve / reject / set active 按钮
   - 视频上传后刷新 take 列表
10. 保持旧目录兼容：
   - 如果 `assets/renders/<shot_id>/video/video_raw.mp4` 存在，但没有 history，可以显示为 legacy video
   - legacy 文件保持兼容和保留

### 验收标准

1. 上传一个视频后，生成 `assets/renders/S001/takes/take_001/video.*`。
2. 生成或更新 `assets/renders/S001/history.json`。
3. UI 能看到 take。
4. UI 能把 take 标记为 approved。
5. UI 能切换 active take。
6. `/api/shots` 返回的 `_video_url` 指向 active take。
7. `npm --prefix ui run build` 通过。

### 本工单边界

1. 本工单只做本地 take 导入、审片和选择。
2. 外部视频生成提交能力留给后续 Provider / automation 工单。
3. 旧视频目录保持兼容，take 系统写入 active project。

## 3. 工单 C：Shot Detail 镜头工作台

### 目标

让用户在一个页面里完成单个镜头的查看、编辑、Prompt 复制、素材查看、take 审片和本地操作。

### 要改的文件

1. 修改：`ui/components/tabs/ShotsTab.tsx`
2. 可选新增：`ui/components/ShotDetailPanel.tsx`
3. 可选新增：`ui/components/ShotPromptPanel.tsx`
4. 可选新增：`ui/components/TakeReviewPanel.tsx`
5. 可选新增：`ui/app/api/shots/[shot]/route.ts`
6. 可选新增：`ui/app/api/shots/[shot]/validate/route.ts`
7. 可选新增：`ui/app/api/shots/[shot]/prompts/route.ts`

### 页面必须包含的区域

1. 基础信息：
   - `shot_id`
   - `duration_s`
   - `scene_ref`
   - `cam_setup_ref`
   - budget tier
2. 文本内容：
   - action beats
   - dialogue
   - voiceover
3. 资源引用：
   - characters
   - props
   - context_refs
   - keyframes
4. Prompt：
   - image prompt
   - video prompt
   - negative prompt
   - motion
   - 一键复制按钮
5. Take：
   - active take 视频
   - take 列表
   - approve / reject / set active / notes
6. 本地操作：
   - 保存 shot
   - validate 当前镜头
   - build prompts
   - 上传关键帧
   - 上传视频 take

### 实施步骤

1. 把 `ShotsTab.tsx` 中右侧编辑区域拆成独立组件，避免单文件继续膨胀。
2. 新增 `ShotDetailPanel`，props：
   - `shot`
   - `viewMode`
   - `onSave`
   - `onReload`
3. 先使用普通表单和 textarea，复杂 JSON 编辑器留作后续增强。
4. 对数组字段使用每行一个值：
   - action beats：textarea 每行一个 beat
   - context refs：textarea 每行一个路径
5. 保存时转换回 JSON 数组。
6. 新增 prompt 显示区：
   - 从 `_video_prompt` 读取视频 Prompt
   - 从 `prompts/image/<shot_id>.image.json` 增加 API 读取图片 Prompt
7. 新增复制按钮：
   - 复制 positive prompt
   - 复制 negative prompt
   - 复制 video prompt
8. 新增当前镜头 validate 按钮：
   - API 可以先简单调用全局 `validate.js`
   - 后续再优化成只校验单镜头
9. 新增当前镜头 build prompts 按钮：
   - 可以先调用全局 `build-image-prompts.js` 和 `build-prompts.js`
   - 完成后刷新当前 shot
10. 接入工单 B 的 take API。

### 验收标准

1. 打开 Shots tab，可以选择一个镜头并看到完整详情。
2. 可以编辑 action beats 并保存。
3. 可以复制图片和视频 Prompt。
4. 可以上传视频并看到 take。
5. 可以 approve 一个 take。
6. `npm --prefix ui run build` 通过。

### 本工单边界

1. 本工单聚焦镜头工作台、本地 Prompt 复制、上传和审片。
2. 外部生成 API 保留为后续扩展，不纳入本工单验收。
3. 右侧详情、Prompt、Take 审片应拆成组件，避免继续堆在 `ShotsTab.tsx` 一个文件里。

## 4. 工单 D：长镜头自动拆分

### 目标

把超过建议时长的镜头拆成更适合图片转视频生成的短镜头，降低人工生成失败率。

### 背景

当前 `observer` 的镜头时长是 15、21、17、15、19 秒。对于 cheap 模式和很多外部视频工具来说偏长。

### 要改的文件

1. 新增：`tools/scripts/split-long-shots.js`
2. 修改：`schema/shot.schema.json`，增加可选字段
3. 修改：`tools/scripts/lint.js`
4. 修改：`README.md`

### 新增字段建议

在 shot 中允许：

```json
{
  "parent_shot_id": "S002",
  "segment_index": 1,
  "segment_count": 3,
  "split_reason": "duration_s > 12"
}
```

### 实施步骤

1. 新建 `tools/scripts/split-long-shots.js`。
2. 引入 `parseArgs`。
3. 支持参数：
   - `--max-duration 12`
   - `--dry-run`
   - `--apply`
   - `--project-id`
   - `--project-dir`
4. 读取 `project.json` timeline。
5. 找出 `duration_s > maxDuration` 的镜头。
6. 对每个长镜头读取 `shots/<shot_id>.json`。
7. 拆分策略：
   - 优先按 `action.beats` 拆
   - 如果 beats 数量不足，按 voiceover 句号、逗号拆
   - 如果还是不足，按时长平均拆
8. 新 shot id 命名：
   - `S002A`
   - `S002B`
   - `S002C`
9. 每个子镜头继承：
   - `scene_ref`
   - `cam_setup_ref`
   - `characters`
   - `props`
   - `context_refs`
   - `budget`
   - `prompt.negative`
10. 每个子镜头更新：
   - `shot_id`
   - `duration_s`
   - `action.beats`
   - `voiceover.text`
   - `parent_shot_id`
   - `segment_index`
   - `segment_count`
11. continuity 处理：
   - 第一个子镜头继承原 `state_in_ref`
   - 中间子镜头的 `state_in_ref` 指向上一子镜头 `states/<shot_id>_OUT.json`
   - 最后一个子镜头继承原镜头的主要 `state_changes`
12. dry-run 模式只输出计划，不写文件。
13. apply 模式：
   - 写入新 shot 文件
   - 更新 `project.json` timeline
   - 原 shot 文件保留，移动到 `shots_archived/<shot_id>.json` 或保留并从 timeline 移除
14. 生成报告：
   - `reports/split-long-shots.report.json`
15. 修改 `lint.js`：
   - 对超过阈值的镜头给 warning
   - 如果存在 `parent_shot_id`，避免重复提示父镜头

### 验收标准

1. `node tools/scripts/split-long-shots.js --dry-run --max-duration 12` 能输出拆分计划。
2. `--apply` 后 timeline 使用子镜头。
3. `node tools/scripts/validate.js` 通过。
4. `node tools/scripts/lint.js` 通过或只剩合理 warning。
5. `node tools/scripts/build-image-prompts.js` 通过。
6. `node tools/scripts/build-prompts.js` 通过。

### 本工单边界

1. 原镜头需要备份或归档。
2. 原始音频、视频、关键帧保持保留。
3. 拆分脚本默认 dry-run，写入需要显式 `--apply`。

## 5. 工单 E：资产库与引用预览

### 目标

让角色、道具、场景、参考图可以在 UI 中被查看、预览、发现缺失引用。

### 要改的文件

1. 修改：`ui/components/tabs/AssetsTab.tsx`
2. 新增：`ui/app/api/assets/library/route.ts`
3. 新增：`tools/scripts/build-asset-index.js`
4. 修改：`tools/scripts/lint.js`

### 资产索引结构

生成到：

```text
projects/<id>/reports/asset-index.json
```

建议结构：

```json
{
  "generated_at": "2026-05-25T00:00:00.000Z",
  "characters": [],
  "props": [],
  "scenes": [],
  "reference_images": [],
  "missing_refs": []
}
```

### 实施步骤

1. 新建 `tools/scripts/build-asset-index.js`。
2. 扫描：
   - `characters/*.json`
   - `props/*.json`
   - `scenes/*.json`
   - `assets/reference/**/*`
   - `assets/renders/*/keyframes/*`
3. 从 shot 中收集引用：
   - `characters[].ref`
   - `props[].ref`
   - `context_refs[]`
   - `scene_ref`
4. 检查引用是否存在。
5. 输出 asset-index report。
6. 修改 `AssetsTab.tsx`：
   - 显示角色列表
   - 显示道具列表
   - 显示场景列表
   - 显示参考图缩略图
   - 显示 missing refs
7. 新增 API `GET /api/assets/library`：
   - 如果 `asset-index.json` 存在，读取它
   - 如果不存在，返回空结构
8. 修改 `lint.js`：
   - 复用或同步 asset-index 的 missing refs 逻辑

### 验收标准

1. `node tools/scripts/build-asset-index.js` 生成报告。
2. UI Assets tab 能显示角色、道具、场景和参考图。
3. 缺失引用能显示在 UI 中。
4. `npm --prefix ui run build` 通过。

## 6. 工单 F：连续性状态机增强

### 目标

让系统能发现穿帮问题，例如角色凭空出现、道具位置跳变、洁净车间状态不连续。

### 要改的文件

1. 修改：`schema/state.schema.json`
2. 修改：`schema/shot.schema.json`
3. 修改：`tools/scripts/lint.js`
4. 新增：`tools/scripts/build-state-chain.js`

### 实施步骤

1. 检查现有 `states/S001_OUT.json` 到 `S005_OUT.json`。
2. 明确 state 结构包含：
   - `characters`
   - `props`
   - `scene`
3. 新建 `build-state-chain.js`。
4. 按 timeline 顺序读取 shots。
5. 对每个 shot：
   - 读取 `continuity.state_in_ref`
   - 读取上一镜头 state_out
   - 应用 `continuity.state_changes`
   - 生成预期 state_out
6. 如果实际 state 文件存在，比较实际与预期。
7. 报告差异：
   - missing_state
   - unexpected_character_change
   - unexpected_prop_location_change
   - scene_state_conflict
8. 输出：
   - `reports/state-chain.report.json`
9. 修改 `lint.js`：
   - state 文件缺失为 ERROR
   - 明显穿帮为 WARN 或 ERROR

### 验收标准

1. `node tools/scripts/build-state-chain.js` 能生成报告。
2. `node tools/scripts/lint.js` 能输出 continuity 问题。
3. 正常项目不会误报大量错误。
4. Prompt 编译不受影响。

## 7. 工单 G：Prompt 质量评估

### 目标

Prompt 不只是能生成，还要能判断是否缺主体、缺动作、冲突、太长或太短。

### 要改的文件

1. 新增：`tools/scripts/score-prompts.js`
2. 修改：`tools/scripts/build-image-prompts.js`
3. 修改：`tools/scripts/build-prompts.js`
4. 修改：`ui/components/tabs/PreviewTab.tsx`

### 评分规则

每个 Prompt 输出：

```json
{
  "score": 82,
  "status": "ok",
  "issues": [
    {
      "severity": "warn",
      "code": "PROMPT_TOO_LONG",
      "message": "Prompt 超过建议长度"
    }
  ]
}
```

### 最少要检查的问题

1. 缺少主体。
2. 缺少动作。
3. 缺少场景。
4. 缺少镜头运动。
5. Prompt 过长。
6. Prompt 过短。
7. negative prompt 为空。
8. context refs 缺失。
9. 同一 Prompt 同时出现互相冲突词，例如 day/night。

### 实施步骤

1. 新建 `score-prompts.js`。
2. 扫描：
   - `prompts/image/*.image.json`
   - `prompts/*.prompt.json`
   - `prompts/*.final.json`
3. 对每个文件输出评分。
4. 写入：
   - `reports/prompt-score.report.json`
5. 修改 prompt 编译脚本：
   - 编译完成后可以附加 `meta.quality`
   - 或者保持独立报告，不强制改 prompt 文件
6. 修改 UI：
   - Preview tab 或 Shot Detail 中显示 score
   - warn/error 用颜色标识

### 验收标准

1. `node tools/scripts/score-prompts.js` 生成报告。
2. 低质量 Prompt 有明确 issue code。
3. UI 能显示每个镜头 Prompt 分数。
4. 原有 build-prompts 仍通过。

## 8. 工单 H：字幕时间轴与导出

### 目标

从 shot 的 dialogue / voiceover 生成 SRT / VTT 字幕，并支持 Remotion 或 ffmpeg 烧录。

### 要改的文件

1. 新增：`tools/scripts/build-subtitles.js`
2. 修改：`tools/scripts/compose-video.js`
3. 修改：`ui/components/tabs/PreviewTab.tsx`
4. 修改：`ui/app/api/export/video/route.ts`

### 输出位置

```text
projects/<id>/exports/subtitles.srt
projects/<id>/exports/subtitles.vtt
projects/<id>/exports/subtitles.json
```

### 实施步骤

1. 新建 `build-subtitles.js`。
2. 按 project timeline 读取 shots。
3. 计算每个镜头开始时间：
   - 第一个从 0 开始
   - 后续累加 `duration_s`
4. 文本来源优先级：
   - `dialogue.text`
   - `voiceover.text`
   - 没有文本则跳过
5. 生成 SRT 时间格式：`00:00:00,000 --> 00:00:05,000`
6. 生成 VTT 时间格式：`00:00:00.000 --> 00:00:05.000`
7. 生成 JSON 方便 UI 预览。
8. 修改导出 API：
   - 支持 `withSubtitles: true`
   - 如果 subtitles 不存在，先调用 build-subtitles
9. 修改 Preview UI：
   - 增加“生成字幕”按钮
   - 显示字幕文件路径

### 验收标准

1. `node tools/scripts/build-subtitles.js` 生成 srt、vtt、json。
2. 字幕时间总长与 project timeline 一致。
3. UI 可以触发字幕生成。
4. 带字幕导出不破坏无字幕导出。

## 9. 工单 I：导出预设

### 目标

把成片导出变成可配置功能，支持常见交付格式。

### 要改的文件

1. 修改：`tools/scripts/compose-video.js`
2. 修改：`ui/app/api/export/video/route.ts`
3. 修改：`ui/components/tabs/PreviewTab.tsx`
4. 新增：`projects/<id>/settings/export-presets.json`，由 UI 自动创建

### 预设

至少支持：

1. `default_1080p`
   - width: 1920
   - height: 1080
   - fps: 24
   - format: mp4
2. `vertical_1080x1920`
   - width: 1080
   - height: 1920
   - fps: 24
   - format: mp4
3. `square_1080`
   - width: 1080
   - height: 1080
   - fps: 24
   - format: mp4

### 实施步骤

1. 让 `compose-video.js` 支持参数：
   - `--preset default_1080p`
   - `--with-subtitles`
   - `--output <path>`
2. 如果 settings 不存在，使用默认 presets。
3. API `export/video` 接受：
   - preset
   - withSubtitles
4. UI 导出弹窗增加：
   - preset 下拉
   - with subtitles checkbox
5. 导出完成后返回：
   - output path
   - duration
   - preset
   - subtitles path

### 验收标准

1. 默认 1080p 导出成功。
2. 竖屏预设不会报错。
3. UI 能选择预设。
4. 导出结果写入 `projects/<id>/exports/`。

## 10. 工单 J：生成物与源码边界清理

### 目标

避免每次生成音频、关键帧、视频、manifest 后污染 git diff。

### 要改的文件

1. 修改：`.gitignore`
2. 新增：`docs/generated-assets-policy.md`
3. 可选新增：`tools/scripts/audit-generated-files.js`

### 实施步骤

1. 检查当前已跟踪生成物：
   - `git ls-files render/public`
   - `git ls-files 'projects/*/exports/*.mp4'`
   - `git ls-files 'projects/*/assets/renders/**'`
2. 脚本只报告文件状态，清理动作由用户单独确认。
3. 写文档说明哪些目录是源码，哪些是生成物。
4. 新建 `audit-generated-files.js`：
   - 只报告，不删除
   - 输出已跟踪生成物列表
5. 如果用户明确要求清理，再使用 `git rm --cached`。

### 验收标准

1. 文档清楚说明生成物策略。
2. audit 脚本能列出已跟踪生成物。
3. 不删除用户素材。

## 11. 工单 K：README 生产流程重写

### 目标

让 README 清楚描述现在的真实工作流：本地管理 + 人工外部生成 + 回收入库 + 审片 + 合成。

### 要改的文件

1. 修改：`README.md`
2. 可选修改：`TODO.md`

### README 必须包含

1. 项目目标。
2. 多项目结构说明。
3. active project 说明。
4. 完整生产流程：
   - 写剧本
   - 拆分镜头
   - validate / lint
   - 编译 Prompt
   - 人工去外部订阅服务生成图片/视频
   - 上传回本地 take
   - 审片 approve
   - 生成 TTS
   - 合成导出
5. 常用命令。
6. 当前阶段以人工订阅服务为主、Provider/API 作为后续扩展的说明。

### 验收标准

1. 新用户只看 README 就能跑通基础流程。
2. README 说明图片/视频 API 是可选后续扩展。
3. 命令全部能在当前项目执行。

## 12. 推荐执行顺序

给执行模型的推荐顺序：

1. 工单 A：一键健康检查 `check-all`
2. 工单 J：生成物与源码边界清理
3. 工单 B：Take 审片与版本管理
4. 工单 C：Shot Detail 镜头工作台
5. 工单 D：长镜头自动拆分
6. 工单 H：字幕时间轴与导出
7. 工单 I：导出预设
8. 工单 E：资产库与引用预览
9. 工单 G：Prompt 质量评估
10. 工单 F：连续性状态机增强
11. 工单 K：README 生产流程重写

原因：先保证项目能被检查和回滚，再建设审片工作台，然后提升生成质量和交付能力。

## 13. 每次完成一个工单后的固定回复格式

执行模型完成任意工单后，必须按这个格式回复：

```text
已完成工单：<工单名>

改动文件：
- <file>

实现内容：
- <point>

验收命令：
- <command>: passed/failed

剩余问题：
- <issue or none>
```
