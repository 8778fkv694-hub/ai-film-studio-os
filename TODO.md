# TODO (AI Film Studio OS)

> 原则：先补齐框架链条，避免在细节上消耗过多 token；需要时再逐条完善。

## P0 — 框架链条（骨架优先）
- [x] Repo skeleton + spec dirs + schema
- [x] validate.js / lint.js 基础可跑
- [x] project.json（全片入口 + timeline）
- [x] build-prompts.js（Spec -> Prompt JSON -> Final）
- [x] script-split.js（自然语言剧本分段骨架）

## P1 — 下一批“骨架补齐”（先占位，不深挖）
- [ ] State 连续性骨架：
  - [ ] schema/state.schema.json
  - [ ] states/<shot_id>.out.json 示例
  - [ ] shot.continuity.state_in_ref 使用说明
  - [ ] lint: state_in_ref 文件存在性检查（先做轻量）

- [ ] Prompt 编译增强（轻量）
  - [ ] 检查引用文件存在性（anchors/refs 路径是否存在）
  - [ ] compiled_from 写入更完整（版本号/commit hash 可选）

- [ ] 剧本分拆 -> 要素抽取（骨架）
  - [ ] 输出 shots_draft/*.json（仅草稿，需人工确认）
  - [ ] 输出冲突提示（最小集：服装/道具/昼夜）

## P2 — 细化（按需再做）
- [ ] 强 lint 规则：连续性、禁忌项分级（MUST/SHOULD/MAY）
- [ ] 版本与成本管理：renders/<shot_id>/takes.json + 失败标签
- [ ] fixups 工单系统 schema + 处理脚本
- [ ] 将“cheap pass -> final pass”做成可执行 pipeline

## Notes
- 任何需要外部模型/工具调用的步骤，先写成脚本接口与输出格式，再接具体模型。
