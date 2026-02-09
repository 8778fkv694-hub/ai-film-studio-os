# AI Film Studio Repo (Skeleton)

目标：把“做视频”像写代码一样工程化：可版本化、可 lint、可回滚、可复现。

## 目录
- `schema/`：JSON Schema（定义 shots/scenes/characters/props 的标准）
- `styles/`：全片风格规范（色调、镜头语言、禁忌项）
- `scenes/`：场景规范（anchors + must_keep + cam_setups）
- `characters/`：角色规范（身份合约 + 参考图占位）
- `props/`：道具规范（贯穿物件/可变范围）
- `shots/`：每个镜头一个 JSON（只写引用 + override）
- `states/`：每镜头输出 state（连续性接口）
- `prompts/`：prompt 模板
- `renders/`：输出（takes/best）
- `fixups/`：修复工单（inpaint/replace 等）
- `reports/`：lint/QA 报告
- `tools/`：脚本（validate/lint/build）

## 最小工作流
1) 写 `styles/`、`scenes/`、`characters/`、`props/`
2) 写 `shots/`（引用上述 spec）
3) `tools/scripts/validate.js` 校验 schema
4) `tools/scripts/lint.js` 输出 ERROR/WARN（连续性冲突、场景冲突、接口不匹配）
5) 通过后再去“烧 token”生成视频

## 快速开始
```bash
cd ai-film-studio
node tools/scripts/validate.js
node tools/scripts/lint.js
```
