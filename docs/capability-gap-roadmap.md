# AI Film Studio OS 能力缺口与补强路线图

更新日期：2026-05-25

## 1. 项目目标

AI Film Studio OS 的目标不是单纯生成一段视频，而是构建一套本地可控、可审查、可回滚、可复现的 AI 影视生产流水线。

核心链路应覆盖：

1. 剧本输入与结构化拆分
2. 场景、角色、道具、镜头规格管理
3. 连续性状态检查
4. 图片 Prompt 与视频 Prompt 编译
5. 关键帧、TTS、视频片段生成
6. Take 审片、修复、版本管理
7. Animatic / 成片合成与导出
8. 多项目管理与项目归档

当前项目已经具备基础骨架，但还缺少若干“从能跑到能稳定生产”的能力。

## 2. 当前已有基础

已具备的能力：

- 多项目目录结构：`projects/<id>/...`
- active project 入口：`projects.json`
- JSON Schema 校验：project / shot / scene / character / prop / state
- 基础 Lint：引用检查、预算检查、部分连续性检查
- 剧本拆分骨架：`script-split.js`
- Prompt 编译：图片 Prompt、视频 Prompt、最终 Prompt 包
- TTS 音频生成
- Remotion 数据准备与视频合成基础
- Next.js UI 基础面板
- 项目导入、导出、激活、删除等 API
- 当前 `observer` 项目的镜头、角色、道具、Prompt 包已补齐到可校验状态

## 3. 最高优先级缺口

### P2. 人工订阅生成服务辅助（Provider 预留）

当前阶段优先使用已有订阅服务和人工生成流程。图片/视频生成 API、Provider 抽象、浏览器自动化都保留为后续扩展路线。

本阶段实际生成可以由人工在外部订阅服务中完成，系统先提供足够顺手的辅助能力：Prompt 交付、结果回收、审片入库和版本追踪。

需要补：

- 生成交付包：按镜头导出图片 Prompt、视频 Prompt、参考图、参数建议和命名规则
- 一键复制 Prompt：UI 内直接复制适合外部平台粘贴的 Prompt
- 结果回收入库：把下载的视频/图片拖入或上传到对应镜头 take
- 命名与溯源：自动识别 `S001_take03` 这类文件名并绑定镜头
- 手工错误记录：风格偏移、人物崩坏、运动失败、下载失败等

验收标准：

- 在没有外部生成 API 的情况下，也能把人工生成结果稳定回收到项目里
- 每个生成结果都能追溯到镜头、Prompt hash、平台和人工备注
- 成片合成只依赖本地已入库的 take，不依赖外部平台在线状态

### P0. 本地项目健康检查与质量门

外部生成可以人工完成，但本地项目必须始终可靠。优先要把校验、Lint、Prompt 编译、Remotion 准备、类型检查和 UI 构建固化成一键检查，避免人工生成前后出现断链。

需要补：

- 一键 `check-all`：串联 validate、lint、prompt build、render prepare、typecheck、UI build
- 检查报告：输出当前 active project、错误、警告和生成文件摘要
- 失败即停：前置结构错误时不继续生成后续产物
- 可选快速模式：只跑 validate / lint / prompt build
- 文档化：README 中明确生产前后应该跑哪些检查

验收标准：

- 一条命令能判断项目是否处于可继续生产状态
- Prompt 和 Remotion manifest 能跟 active project 保持同步
- 检查失败时能明确指出断在哪一步

### P0. Take 审片与版本管理

当前已有 render history / fixup 的基础，但缺少完整审片闭环。

需要补：

- 每个镜头支持多个 Take
- Take 标签：`approved`、`rejected`、`bad_hands`、`lighting_mismatch`、`motion_bad`、`needs_fixup`
- 当前选中 Take：一个镜头只能有一个 active take
- 审片备注：人工记录问题和修改建议
- Take 对比视图：关键帧、视频、Prompt、模型参数并排比较

验收标准：

- 成片合成只使用 approved 或 active take
- 每个 take 能追溯到对应 prompt hash、模型、seed 和成本
- 可以从 UI 标记、切换、删除、归档 take

## 4. 生产质量缺口

### P1. 长镜头自动拆分

当前 `observer` 项目所有镜头都超过 cheap 模式建议时长。长镜头会降低生成稳定性。

需要补：

- 自动识别超过阈值的镜头
- 根据 action beats / voiceover 自动拆成子镜头
- 继承 scene、character、prop、continuity
- 自动更新 timeline
- 保留原镜头到子镜头的映射

验收标准：

- `S002` 这类 21 秒镜头可以自动拆成 `S002A`、`S002B`
- 拆分后 validate / lint / prompt build 全部通过
- voiceover 和字幕不会丢失

### P1. 连续性状态机增强

当前 state 检查偏基础，还不能真正防穿帮。

需要补：

- 角色状态：服装、位置、姿态、是否出镜
- 道具状态：位置、是否出现、是否被使用、是否损坏
- 场景状态：门、灯光、设备运行、安全标识
- 状态差异报告：指出上一镜头和下一镜头冲突
- 自动生成 `state_out`，下一镜头默认引用上一镜头输出

验收标准：

- Lint 可以发现角色凭空出现、道具位置跳变、场景状态前后矛盾
- Prompt 编译时自动注入 continuity summary

### P1. 资产引用管理

现在引用检查已经增强，但还缺资产库层面的管理能力。

需要补：

- 参考图资产库：角色、场景、道具、风格、镜头截图分类
- 上传后自动生成 manifest
- 资产去重：hash 相同不重复保存
- 缺失资产修复建议：指出应该补哪张图、放到哪个目录
- 缩略图和预览图生成

验收标准：

- UI 中可以看到每个角色/道具/场景关联的参考图
- Prompt 包引用的所有图片都能点击预览
- 删除资产时能提示影响哪些镜头

### P1. Shot Detail 页面

UI 目前有基础项目面板，但缺少真正的镜头工作台。

需要补：

- 单镜头详情页
- 显示 shot spec、scene、characters、props、state、prompt、renders、audio
- 在线编辑镜头 JSON
- 一键 validate 当前镜头
- 一键编译当前镜头 prompt
- 一键生成关键帧、视频、TTS

验收标准：

- 一个镜头从规格编辑到生成、审片、修复都能在同一页面完成
- JSON 编辑错误能即时提示

## 5. 工程稳定性缺口

### P1. 测试与 CI

当前主要靠手动命令验证，需要固定成自动回归。

需要补：

- CLI smoke tests
- validate / lint / prompt build fixtures
- UI API route tests
- Remotion prepare-data tests
- GitHub Actions 或本地 `check-all` 脚本

验收标准：

- 一条命令能跑完整健康检查
- PR 或提交前能发现 schema、lint、type、build 回归

### P1. 生成物与源码边界

当前部分生成物仍在 git 跟踪中，长期会污染版本库。

需要补：

- 清理已跟踪的音频、关键帧、导出视频等生成物
- 保留小型 fixture，真实生产资产按生成物策略归档
- 建立 `projects/<id>/exports`、`assets/renders`、`render/public` 的归档策略
- 增加项目打包导出命令

验收标准：

- git diff 不再因为重新生成音频、关键帧、manifest 而大面积变化
- 项目可以单独导出为 zip 或归档目录

### P2. 数据迁移机制

项目已经从根目录单项目转向 `projects/<id>` 多项目，需要正式迁移机制。

需要补：

- schema version
- project migration scripts
- migration report
- 向后兼容旧 `project.json`
- UI 中提示旧项目升级

验收标准：

- 老项目可以一键迁移为新多项目结构
- 迁移前后 validate / lint 结果一致或有明确差异报告

## 6. 创作效率缺口

### P2. 剧本理解与智能拆解

当前 script splitter 是骨架，还没有真正成为创作助手。

需要补：

- 从自然语言剧本提取场景、角色、道具、动作、旁白
- 自动建议镜头数量和时长
- 自动识别安全规范、禁止事项、重点信息
- 生成初版 scene / character / prop / shot draft
- 对草稿进行冲突检查和补全建议

验收标准：

- 输入一篇说明类脚本，可以自动生成可编辑的镜头草稿
- 草稿经过人工确认后能直接 promote 到正式 shots

### P2. Prompt 质量评估

当前能编译 Prompt，但缺少对 Prompt 质量的评估和优化。

需要补：

- Prompt 长度、冲突词、缺失主体、缺失动作检查
- 风格一致性评分
- 镜头语言完整性检查
- 负面词和禁止事项注入
- Prompt diff：显示修改前后差异

验收标准：

- 编译后能给每个 Prompt 一个质量状态
- 低质量 Prompt 能给出具体修复建议

### P2. 订阅成本与使用量管理

AI 视频生产成本不可忽略，当前缺少成本视图。

需要补：

- 每个订阅平台的套餐、额度、到期时间记录
- 每次生成记录使用平台、模型、时长、分辨率和大致额度消耗
- 项目级成本汇总
- 镜头级成本汇总
- 订阅到期和额度不足提醒

验收标准：

- Dashboard 能看到当前项目总成本
- 每个镜头能看到已生成多少次、用了哪个订阅渠道

## 7. 导出与交付缺口

### P2. 成片导出预设

当前 Remotion 能准备数据，但还缺交付级导出配置。

需要补：

- 分辨率预设：1080p、4K、竖屏、方屏
- 码率、帧率、封装格式配置
- 字幕烧录
- 水印、安全区
- 封面图导出
- 分镜表导出

验收标准：

- UI 可选择导出预设
- 导出产物包含视频、字幕、分镜表、项目 manifest

### P2. 字幕与旁白对齐

当前 TTS 和播放已有基础，但缺少字幕级时间轴。

需要补：

- 根据 voiceover / dialogue 生成字幕
- 字幕时间轴对齐音频
- 支持 SRT / VTT 导出
- Remotion 中可选择烧录字幕

验收标准：

- 每个镜头可生成字幕文件
- 成片导出时可选择是否烧录字幕

## 8. 建议实施顺序

第一阶段：生产闭环

1. 一键本地健康检查与质量门
2. Take 审片与 active take
3. Shot Detail 页面
4. Prompt 交付与结果回收辅助

第二阶段：质量控制

1. 长镜头自动拆分
2. 连续性状态机增强
3. 资产库与引用预览
4. Prompt 质量评估

第三阶段：工程固化

1. 一键 `check-all`
2. 测试与 CI
3. 清理生成物跟踪
4. 数据迁移机制

第四阶段：交付能力

1. 导出预设
2. 字幕时间轴
3. 成本报表
4. 项目归档包

## 9. 当前最该做的 5 件事

如果目标是尽快让项目进入可生产状态，建议优先做：

1. 建立一键本地健康检查，保证人工生成前后项目不断链
2. 增加 Take 审片系统，让生成结果可以被选择、标记和回滚
3. 做 Shot Detail 页面，把镜头规格、Prompt、素材、生成结果放到一个工作台
4. 增加长镜头自动拆分，降低 cheap 模式下的视频生成失败率
5. 清理生成物和源码边界，避免每次生成都污染 git diff
