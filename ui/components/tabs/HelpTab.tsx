"use client";

import React from 'react';
import { 
  Keyboard, HelpCircle, Play, Sparkles, 
  Layers, Settings, Inbox, AlertTriangle, ShieldCheck, CheckCircle2,
  LayoutDashboard, FolderOpen, Scissors, MapPin, Users, Clapperboard, Wrench, BookOpen, AlertCircle
} from 'lucide-react';

export default function HelpTab() {
  const modules = [
    {
      id: 'dashboard',
      name: '📊 控制面板 (Dashboard)',
      icon: <LayoutDashboard className="text-blue-400" size={20} />,
      bgColor: 'from-blue-500/10 to-transparent',
      borderColor: 'border-blue-500/20',
      purpose: '全片概览与缺陷监控中心。作为项目的第一落脚点，提供整体进度的宏观透视。',
      features: [
        '全局资产统计：实时汇总当前项目下的分镜、草稿、场景、角色、道具及音频的物理数量。',
        '质量红线预警：自动收集并呈现来自静态 Lint 检查的最新缺陷报告，支持一键定位问题镜头。',
        '快捷忽略配置：支持在开发或测试阶段，对某些暂不处理的非关键缺陷进行“一键忽略”，精细调整告警噪音。'
      ],
      tip: '导出成片前，强烈建议先来控制面板确认“警告与错误”是否已经清理归零，或者在列表中进行合理忽略。'
    },
    {
      id: 'project',
      name: '⚙️ 项目管理 (Project)',
      icon: <FolderOpen className="text-indigo-400" size={20} />,
      bgColor: 'from-indigo-500/10 to-transparent',
      borderColor: 'border-indigo-500/20',
      purpose: '项目元配置与自动化待办事项中心。定义项目的基本工程属性和生命周期任务。',
      features: [
        '工程参数设置：可编辑项目名称、描述，指定默认画风参考图、默认帧率(FPS)和旁白默认语言等。',
        '待办进度任务链：系统根据现有的 JSON 依赖关系和本地文件缺失情况，动态生成待办工作清单（例如：提示您何时该生成 TTS 配音、何时还有草稿待审核）。',
        '归档打包导出：支持一键导出包含 timeline 与全部资产的标准化项目备份压缩包。'
      ],
      tip: '配合“待办进度任务链”进行分阶段创作，能帮您有条不紊地理清制作节奏，避免丢三落四。'
    },
    {
      id: 'script',
      name: '📝 剧本拆解 (Script)',
      icon: <Scissors className="text-pink-400" size={20} />,
      bgColor: 'from-pink-500/10 to-transparent',
      borderColor: 'border-pink-500/20',
      purpose: '文学剧本工程化的第一步。负责从纯文本中提炼结构化的镜头草稿。',
      features: [
        'AI 小说转剧本：支持将长篇小说文本，按照“小说 (fiction)”、“旁白讲解 (explainer)”或“纪录片 (documentary)”三种调性一键转译为标准剧本。',
        '剧本实时编辑：提供快捷的 Markdown 编辑器，方便创作者在本地精修剧本结构。',
        '镜头智能裂变：点击“拆解剧本”，系统通过算法自动按场景和动作断句，爆破切分为第一版的分镜卡草稿并归入暂存区。'
      ],
      tip: '智能拆解后生成的镜头默认存在“草稿箱”中，此时不会直接影响正式的 Timeline，需在后续的“分镜管理”或命令行中确认后方可激活。'
    },
    {
      id: 'scenes',
      name: '🎬 场景设定 (Scenes)',
      icon: <MapPin className="text-amber-400" size={20} />,
      bgColor: 'from-amber-500/10 to-transparent',
      borderColor: 'border-amber-500/20',
      purpose: '环境资产定义与画面穿帮哨兵。统一配置各个物理取景地点的逻辑约束。',
      features: [
        '光影风格联动：管理每个场景专属的风格描述文件（Style Ref Json），保证同一个场景提示词在生成时色彩的一致性。',
        '场景三要素：细致描述场景的“必须保留摆设元素（Set Elements）”和“布光基调（Lighting）”。',
        '禁忌词拦截 (Forbidden)：配置该环境绝对不应出现的穿帮元素。例如在“古代客栈”场景配置禁忌词 `phone` / `car`，凡是镜头提示词中意外触发这些词汇，Lint 会自动报错拦截。'
      ],
      tip: '场景锚点（Anchors）可以上传多张参考图片（如特定的屋顶、背景墙），用来辅助大模型渲染具有极高视觉连贯性的背景。'
    },
    {
      id: 'assets',
      name: '👥 角色与道具库 (Assets)',
      icon: <Users className="text-purple-400" size={20} />,
      bgColor: 'from-purple-500/10 to-transparent',
      borderColor: 'border-purple-500/20',
      purpose: '资产信息总库与物理缺失文件审计。核心目标是保障视觉连续性（Consistency）。',
      features: [
        '角色外貌约束：规范全片各个角色的发型、主要服装及配饰的描述词，并上传多角度角色参考图。',
        '道具规范列表：配置故事中核心道具的详细外观与保留标志。',
        '缺失资源审计 (Missing Refs)：全片中最重要的一项，自动审计在 `project.json` 或分镜配置中被引用了，但本地物理路径实际缺失的图片、视频或音频资产，指引创作者快速补齐。'
      ],
      tip: '物理缺失文件审计（Missing Refs）会给出极其精确的物理路径。利用这个功能，您可以一目了然地知道接下来该生成并上传哪些文件，绝不会出现漏发废片的情况。'
    },
    {
      id: 'shots',
      name: '🎞️ 分镜卡精修 (Shots)',
      icon: <Clapperboard className="text-rose-400" size={20} />,
      bgColor: 'from-rose-500/10 to-transparent',
      borderColor: 'border-rose-500/20',
      purpose: '故事板底层数据编辑器。用于打通镜头与镜头之间的详细逻辑衔接。',
      features: [
        '草稿/正式双线编辑：可在“正式分镜 (Final)”和“拆解草稿 (Draft)”之间快速切换。',
        '全方位分镜描述：支持编辑镜头基本属性（景别 scale、相机运动 camera motion、旁白/台词 dialogue、设定时长 duration_s、动作 beats）。',
        '一键晋升 Timeline：确认好草稿镜头后，点击“晋升正式”，系统会自动将其排入时间轴（timeline.json）并生成其所继承的初始状态。'
      ],
      tip: '在剧本大修时，可以通过长镜头自动拆分工具将超长分镜裂变，并在本页面中精修各自的动作 Beats，防止单个视频画面时长过长导致生成穿帮。'
    },
    {
      id: 'preview',
      name: '🍿 配音分镜预演 (Preview) *核心工作站*',
      icon: <Play className="text-emerald-400" size={20} />,
      bgColor: 'from-emerald-500/10 to-transparent',
      borderColor: 'border-emerald-500/20',
      purpose: '项目最重要的审片与合成工作流面板。在这里实现生图/生视频的“回填与终审”。',
      features: [
        '有声分镜播放器：自动合并各分镜的时长与生成的占位 TTS 配音，以 0 成本预览整部影片的叙事节奏和剪辑点。',
        '卡片墙与表格双视图：故事板卡片墙（Storyboard Wall）适合预览构图与排版；列表表格（Shot Table）适合高效批量修改或排序。',
        '多版本 Takes 与 AB 对比：支持为同一个分镜上传或匹配多个 Take（版本），通过“星级打分”与“通过 (Approve) / 拒绝 (Reject)”进行多版选优，并支持一键切换活动 Take 查看视觉变化。'
      ],
      tip: '此模块支持全套键盘流（J/K 定位、A/R 审批等）与极速回填（直接 Ctrl+V 粘贴剪贴板图片、或拖入文件）。是日常停留时间最长的黄金工作区。'
    },
    {
      id: 'tools',
      name: '🔨 自动化工具 (Tools)',
      icon: <Wrench className="text-cyan-400" size={20} />,
      bgColor: 'from-cyan-500/10 to-transparent',
      borderColor: 'border-cyan-500/20',
      purpose: '终端命令的前端化封装。一键触发所有的底层 Python/Node 自动化脚本。',
      features: [
        '流程一键调度：集成 Schema 结构校验、静态 Lint 逻辑检查、图片分镜提示词编译、视频 prompts 生成和 Edge TTS 语音批量合成。',
        '运行控制台日志：页面底部集成了实时的控制台输出窗口，完整呈现每个脚本运行的终端命令行和报错堆栈。',
        '一键生成配音：在您修改了分镜时长或台词（dialogue）后，点击“生成 TTS”，即可一键同步全片最新的配音音频。'
      ],
      tip: '在开始真正花钱渲染视频或进行关键帧绘画前，在这里跑一遍“结构校验”和“逻辑检查”能帮您规避 90% 以上的低级逻辑错误。'
    },
    {
      id: 'settings',
      name: '🔑 系统设置 (Settings)',
      icon: <Settings className="text-slate-400" size={20} />,
      bgColor: 'from-slate-500/10 to-transparent',
      borderColor: 'border-slate-500/20',
      purpose: '外网 AI 辅助大模型接口配置与创作偏好总控。',
      features: [
        '云端大模型集成：支持 DeepSeek、OpenAI 或任何 OpenAI-compatible 标准的本地/云端 API，用于智能文本润色。',
        '安全存储设计：您的 API Key 等机密凭证会物理保存在本地项目的 `.local/ai-settings.json` 中，绝不上报服务器，且默认已加入 git 忽略列表。',
        '创作精度倾向：允许精细配置剧本拆分倾向（创意/精准）、画面提示词丰富度等权重。'
      ],
      tip: '配置了 API 以后，在编辑分镜台词或者写动作 beats 时，可以点击“AI 润色”直接获得由大模型基于场景约束丰富出的专业图像 Prompt。'
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-left text-slate-300 font-sans">
      
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <HelpCircle className="text-blue-400" size={32} />
            使用帮助与工作流说明
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            欢迎来到 AI 影视工作室 (AI Film Studio OS)！我们致力于将电影的感性创作流程工程化，
            通过<strong>「像写代码一样做电影」</strong>的开发理念，帮助您以最低的成本与最高的质量管理影视制作生命周期。
          </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Grid: Keyboard shortcuts & Quick Interactive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Keybindings */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Keyboard Shortcuts */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
              <Keyboard className="text-blue-400" size={20} />
              键盘审片流 (Keyboard Navigation)
            </h3>
            <p className="text-xs text-slate-400">
              在「配音分镜」选项卡中，您可以使用全套快捷键实现“手不离键盘”的顺畅审片体验：
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono text-xs shadow min-w-[32px] text-center">J</kbd>
                  <span className="text-xs text-slate-300">选择并定位到<strong>下一个</strong>分镜</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono text-xs shadow min-w-[32px] text-center">K</kbd>
                  <span className="text-xs text-slate-300">选择并定位到<strong>上一个</strong>分镜</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono text-xs shadow min-w-[32px] text-center">A</kbd>
                  <span className="text-xs text-slate-300"><strong>通过 (Approve)</strong> 当前选中的 Take</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono text-xs shadow min-w-[32px] text-center">R</kbd>
                  <span className="text-xs text-slate-300"><strong>拒绝 (Reject)</strong> 当前选中的 Take</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <kbd className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono text-xs shadow">1-5</kbd>
                  <span className="text-xs text-slate-300">为选中的活动 Take 快速<strong>打星评分</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono text-xs shadow min-w-[32px] text-center">E</kbd>
                  <span className="text-xs text-slate-300">快速展开/折叠该镜头的<strong>版本面板</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono text-xs shadow min-w-[32px] text-center">S</kbd>
                  <span className="text-xs text-slate-300">展开/折叠 Prompt & 音频<strong>同步报警</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-blue-300 font-mono text-xs shadow min-w-[32px] text-center">L</kbd>
                  <span className="text-xs text-slate-300">展开/折叠该镜头的 <strong>Lint 检查日志</strong></span>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-3 text-xs text-blue-400 leading-relaxed">
              💡 <strong>提示</strong>：当您正在输入框中编辑讲解台词（VO）或修改镜头时长时，快捷键将自动挂起守卫，防止因打字导致误触发。
            </div>
          </div>

          {/* Card 2: Interactive Features */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
              <Sparkles className="text-purple-400" size={20} />
              高级交互与生片闭环
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg flex-shrink-0">
                  <Play size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-200">剪贴板 Ctrl+V / 拖拽极速回填</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    在外部网页生成工具中生成画面后，直接右键复制图片，回到本系统并选中对应卡片，按下 <kbd className="px-1 bg-slate-950 border border-slate-800 rounded text-slate-300 text-[10px]">Ctrl+V / Cmd+V</kbd> 即可直接完成关键帧上传。同样，支持直接拖拽图片/视频文件回填，系统会自动识别类别。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 bg-purple-600/10 text-purple-400 border border-purple-500/20 rounded-lg flex-shrink-0">
                  <Inbox size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-200">Watch Folder / 收件箱一键导入</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    支持批量操作。将外部生成的图片或视频文件，放入当前活动项目的 <code>inbox/</code> 目录下，并以镜头号开头命名（例如：<code>S001_v3.mp4</code>）。然后在头部点击<strong>「导入收件箱」</strong>，系统将自动化解析匹配并登记生成对应的新 take 记录。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-600/10 text-amber-400 border border-amber-500/20 rounded-lg flex-shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-200">静态检查 (Lint Guard) 环境感知</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    在卡片或表格中，镜头号旁会自动显示 <span className="text-red-400 font-bold">✗ 错误</span> 或 <span className="text-amber-400 font-bold">▲ 警告</span> 实时角标。悬停即可直接获悉具体的镜头穿帮隐患，点击角标直接展开查看 Lint 审计说明。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Specs and Directories */}
        <div className="space-y-6">
          
          {/* Card 3: Project directory structure */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
              <Layers className="text-indigo-400" size={20} />
              资产与项目结构说明
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              项目资源结构完全基于活动项目目录，不读写全局根路径，隔离性极佳。主要目录结构如下：
            </p>
            
            <div className="space-y-3 font-mono text-[11px] text-slate-300">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="text-blue-300 font-bold">📁 projects/&lt;project_id&gt;/</div>
                <div className="pl-3 text-slate-400">• <code>project.json</code> : 全片总控配置</div>
                <div className="pl-3 text-slate-400">• <code>shots/</code> : 各个镜头的详细 JSON 描述</div>
                <div className="pl-3 text-slate-400">• <code>scenes/</code> : 场景、禁忌词与约束库</div>
                <div className="pl-3 text-slate-400">• <code>characters/</code> : 角色服装规范与参考图</div>
                <div className="pl-3 text-slate-400">• <code>states/</code> : 存放镜头 OUT 状态机</div>
                <div className="pl-3 text-slate-400">• <code>inbox/</code> : 批量自动化导入收件箱</div>
                <div className="pl-3 text-slate-400">• <code>exports/</code> : 全片合成成片输出地</div>
              </div>
            </div>
          </div>

          {/* Card 4: Health check details */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
              <ShieldCheck className="text-emerald-400" size={20} />
              一键健康检查 (Check-All)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              在编译提示词包或一键合成视频前，务必保证项目通过了所有健康检查：
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <span>结构校验 (Validate JSON)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <span>连续性审查与禁忌检测 (Lint)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <span>系统提示词编译 (Project Context)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <span>画面提示词与视频提示词构建</span>
              </div>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3 text-xs text-emerald-400">
              💬 您可以在终端或「自动化」标签页中一键运行这些流程，系统会自动输出审计报告。
            </div>
          </div>

        </div>
      </div>

      {/* New Section: Core Modules Deep-Dive */}
      <div className="space-y-6">
        <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <BookOpen className="text-blue-400" size={24} />
          系统核心模块深度指南 (Core Modules)
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed max-w-4xl">
          AI Film Studio OS 划分为 9 大核心功能面板。了解这些模块的底层意图与功能细节，能帮助您更好地完成整个影视管线协作：
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <div 
              key={mod.id} 
              className={`bg-gradient-to-b ${mod.bgColor} bg-slate-900/40 border ${mod.borderColor} rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:scale-[1.01] transition-transform duration-200`}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                  {mod.icon}
                  <span className="text-base font-bold text-slate-100">{mod.name}</span>
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                  {mod.purpose}
                </p>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">核心功能细节：</span>
                  <ul className="space-y-1.5 pl-4 list-disc text-[11px] text-slate-400 leading-relaxed">
                    {mod.features.map((feat, i) => (
                      <li key={i}>{feat}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/60 bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 <strong className="text-slate-300">技巧：</strong>{mod.tip}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
