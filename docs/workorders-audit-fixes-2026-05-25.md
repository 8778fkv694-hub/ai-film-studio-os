# A-K 工单与终端审计修复记录

更新日期：2026-05-25

## 1. 本次审计范围

本次审计覆盖：

1. 新增本地工作区终端
2. 工单 A：一键健康检查 `check-all`
3. 工单 B：Take 审片与版本管理
4. 工单 C：Shot Detail 镜头工作台
5. 工单 D：长镜头自动拆分
6. 工单 E：资产库与引用预览
7. 工单 F：连续性状态机增强
8. 工单 G：Prompt 质量评估
9. 工单 H：字幕时间轴与导出
10. 工单 I：导出预设
11. 工单 J：生成物与源码边界清理
12. 工单 K：README 生产流程

当前阶段策略：先完善本地生产闭环。图片/视频生成 API、Provider、浏览器自动化仍然保留为后续扩展方向，本阶段验收不依赖它们。

## 2. 终端审计与修复

### 发现的问题

1. 后端使用 `child_process.spawn` 普通管道，不是真 PTY。
2. 外部 CLI 会检测到 `stdin` 不是 terminal，出现 `Warning: Input is not a terminal (fd=0)`。
3. 后端忽略 resize，导致全屏 ASCII / TUI 输出按错误列宽渲染。
4. 前端手动回显输入，和 shell 自身回显会互相干扰。
5. dev server 热更新后可能保留旧 session，导致 `resize is not a function`。

### 已修复

1. `ui/app/api/terminal/route.ts`
   - 改为使用 `node-pty`。
   - 增加 `runtime = 'nodejs'`。
   - 支持真实 `resize(cols, rows)`。
   - 增加旧 session 检测，发现非 PTY session 自动清理。
   - 保留输出 buffer 和 SSE 推送。
2. `ui/components/FloatingTerminal.tsx`
   - 输入改为原样透传给 PTY。
   - 移除前端手动行缓冲和手动回显。
   - 增加 fit 后同步 resize。
   - ResizeObserver 增加防抖，避免频繁 resize。

### 验收结果

1. `npm --prefix ui run build`：通过。
2. `POST /api/terminal resize`：返回成功。
3. `localhost:9527` dev server 已重启并恢复可用。

## 3. 工单 A：一键健康检查

### 发现的问题

1. `tools/scripts/check-all.js` 使用 `shell: true`。
2. Remotion typecheck 使用 `npx tsc`，在网络或包环境异常时可能卡住。

### 已修复

1. `tools/scripts/check-all.js`
   - Node 脚本统一使用 `process.execPath`。
   - TypeScript 检查改为使用本地 `render/node_modules/.bin/tsc`。
   - `spawnSync` 改为 `shell: false`。

### 验收结果

1. `node tools/scripts/check-all.js --quick`：通过。
2. `node tools/scripts/check-all.js`：通过。
3. `projects/observer/reports/check-all.report.json` 已生成。

## 4. 工单 B：Take 审片与版本管理

### 发现的问题

1. `tools/scripts/import-take.js` 使用 `execSync` shell 字符串调用 ffmpeg。
2. `tools/scripts/manage-renders.js` 会写入 0 字节 mp4/jpg 假文件，UI 和合成会误判素材存在。

### 已修复

1. `tools/scripts/import-take.js`
   - ffmpeg 改为 `execFileSync('ffmpeg', args)`。
   - 输入视频路径统一解析为绝对路径。
   - 增加 shot id 校验。
   - 不支持的视频扩展名直接失败。
2. `tools/scripts/manage-renders.js`
   - 不再创建 0 字节视频和图片。
   - 改为登记 pending manual take。
   - 实际素材由 UI 上传或 `import-take.js` 导入。
3. `schema/render_history.schema.json`
   - `seed` 允许为 `null`，适配人工 pending take。

### 验收结果

1. `node --check tools/scripts/import-take.js`：通过。
2. `node --check tools/scripts/manage-renders.js`：通过。
3. `npm --prefix ui run build`：通过。

## 5. 工单 C：Shot Detail 镜头工作台

### 审计结果

1. `ui/components/ShotDetailPanel.tsx` 已存在。
2. `ui/app/api/shots/[shot]/route.ts` 已存在。
3. `ui/app/api/shots/[shot]/validate/route.ts` 已存在。
4. `ui/app/api/shots/[shot]/prompts/route.ts` 已存在。
5. Take API 已存在。

### 当前状态

基础工作台能力已落地，UI 构建通过。后续可继续优化交互密度和 Prompt 复制体验。

## 6. 工单 D：长镜头自动拆分

### 审计结果

1. `tools/scripts/split-long-shots.js` 已存在。
2. `schema/shot.schema.json` 已支持 `parent_shot_id`、`segment_index`、`segment_count`、`split_reason`。

### 验收结果

1. `node --check tools/scripts/split-long-shots.js`：通过。
2. 当前 `observer` timeline 已是 9 个短镜头，总时长 70 秒。

## 7. 工单 E：资产库与引用预览

### 发现的问题

1. `tools/scripts/build-asset-index.js` 扫描 `assets/reference` 时路径拼接错误，会导致参考资产数量偏低。
2. `context_refs` 的 `.jpg` / `.png` 扩展名差异会被误报为缺失。
3. 后续镜头引用前序尚未生成的关键帧时，应该标记为 pending，而不是 missing。

### 已修复

1. 修正 `assets/reference` 扫描路径。
2. 增加图片扩展名 fallback。
3. 增加 `pending_refs`，用于记录等待前序镜头生成的 context refs。
4. `projects/observer/shots/S002.json` 到 `S006.json` 的 context refs 从 `.jpg` 修正为实际存在的 `.png`。

### 验收结果

1. `node tools/scripts/build-asset-index.js`：通过。
2. `missing_refs` 已清零。
3. `pending_refs` 还有 3 个：S007-S009 等待 S006-S008 生成关键帧。

## 8. 工单 F：连续性状态机增强

### 审计结果

1. `tools/scripts/build-state-chain.js` 已存在。
2. `tools/scripts/lint.js` 会调用 state chain 审计。

### 验收结果

1. `node --check tools/scripts/build-state-chain.js`：通过。
2. `node tools/scripts/lint.js`：通过。

## 9. 工单 G：Prompt 质量评估

### 审计结果

1. `tools/scripts/score-prompts.js` 已存在。
2. 当前能输出 `reports/prompt-score.report.json`。

### 验收结果

1. `node tools/scripts/score-prompts.js`：通过。
2. 当前主要提示是 Prompt 偏长，不影响健康检查通过。

## 10. 工单 H：字幕时间轴与导出

### 审计结果

1. `tools/scripts/build-subtitles.js` 已存在。
2. 能输出 SRT、VTT、JSON 字幕。

### 验收结果

1. `node tools/scripts/build-subtitles.js`：通过。
2. 已生成：
   - `projects/observer/exports/subtitles.srt`
   - `projects/observer/exports/subtitles.vtt`
   - `projects/observer/exports/subtitles.json`

## 11. 工单 I：导出预设

### 审计结果

1. 导出 API 和 Preview UI 已存在字幕相关入口。
2. 本次未大改导出预设逻辑，避免扩大范围。

### 后续建议

下一步可以继续检查 `tools/scripts/compose-video.js` 是否完整支持：

1. `--preset`
2. `--with-subtitles`
3. 竖屏 / 方屏 / 1080p 预设
4. 导出结果 manifest

## 12. 工单 J：生成物与源码边界清理

### 发现的问题

1. `tools/scripts/audit-generated-files.js` 使用 `execSync('git ls-files')` shell 字符串。
2. 输出的一次性 `git rm --cached <全部文件>` 命令可能过长，不适合直接复制执行。

### 已修复

1. 改为 `execFileSync('git', ['ls-files'])`。
2. 输出改为提示用户查看报告后逐项处理。
3. 增加 Remotion 生成物识别：
   - `render/public/data.json`
   - `render/src/manifest.ts`

### 验收结果

1. `node --check tools/scripts/audit-generated-files.js`：通过。
2. `node tools/scripts/audit-generated-files.js`：通过。
3. 当前报告显示仍有 2 个已跟踪生成物：`render/public/data.json`、`render/src/manifest.ts`。本次只报告，不自动移出 Git 跟踪。

## 13. 工单 K：README 生产流程

### 审计结果

1. README 已包含 `check-all` 使用说明。
2. 当前阶段以人工订阅服务生成 + 本地回收入库为主。
3. Provider/API 保留为后续扩展路线。

## 14. 当前项目健康状态

当前 active project：`projects/observer`

当前状态：

1. shots：9
2. scenes：5
3. characters：1
4. props：4
5. keyframes：5
6. total duration：70 秒
7. validate：passed
8. lint：passed
9. Dashboard issues：空

仍然 pending 的内容：

1. S006、S007、S008 的关键帧尚未生成，因此 S007-S009 的 context refs 处于 pending。
2. 当前只有 5 个关键帧，后续人工生成/上传 S006-S009 素材后 pending 会自然消失。
