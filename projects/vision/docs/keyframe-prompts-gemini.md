# 《看得见的水》— 第一帧参考图提示词(Gemini 出图用)

> 用途:为 9 个镜头各生成 **第一帧关键图(keyframe)**,16:9。
> 模型建议:Gemini 图像(Imagen / Nano Banana)。英文提示词出图效果最好,中文要点供你理解和微调。
> 风格定调:**极简科技 · 写实**——未来升级版的滤芯装配车间;物理空间几乎空旷、没有任何屏幕;所有数据信息只在 XR 全息层里;暖调;无赛博朋克霓虹。
> 说明:AGV / 机器人等自动化设备**不禁止出现**,可作为背景自然存在,只是**不刻意强调**(别让它们抢戏或成为画面主体)。

---

## 0. 全局设定(每张图都建议带上 / 用于保持一致)

把下面这段「STYLE + WORLD」作为每个镜头提示词的统一前缀,保证 9 张图风格、场景、人物一致。

**STYLE / WORLD (prepend to every shot):**
```
Photorealistic cinematic film still, 16:9 horizontal, 8K, sharp focus, professional industrial photography lighting, soft even near-shadowless light.
Mood: serene, precise, minimalist, high-end industrial future, with a warm undertone.
Setting: a modern suspended-ceiling cleanroom factory (有吊顶的无尘车间) producing membrane elements (膜元件生产). Recognizable DNA: a polished glossy grey epoxy floor with painted yellow safety boundary lines, vertical brushed stainless steel cleanroom wall panels (不锈钢墙板), a flat white cleanroom suspended ceiling (有吊顶的无尘车间吊顶) with flush-mounted LED panel lights, and clean rectangular pillars. Realistic production machinery: a membrane-element Winding Station / roll-winding machine (卷膜机 / 卷制工位) winding flat membrane sheets onto a white central core tube, an End-cap Assembly & Potting station (端盖组装 / 灌胶工位) with stainless steel fixtures, and a Flux Testing (通量测试) workbench with water lines and high-end spiral-wound RO membrane elements.
Hard rule: the PHYSICAL space contains the realistic cleanroom setup with stainless steel wall panels and a suspended ceiling, with absolutely NO physical control panels or display monitors. ALL data and information appear ONLY as a holographic XR layer floating in the air.
XR layer design language: thin-stroke line icons, monospaced numerals for data, colors used as status meaning only — primary blue #4a8eff, normal green #22c55e, warning amber #f59e0b, alarm red #ef4444. The physical world stays realistic (brushed stainless steel, grey epoxy, white membrane sheets, white core tubes); color highlights appear inside the XR layer.
```

**统一规避项 (Negative / avoid，每张都适用):**
```
no physical display screens, no wall monitors, no control panels, no video wall, no cyberpunk neon, no bulky VR headset, no cluttered background, no spilled liquid, no dirt, no cartoon, no blur, no distorted faces or hands, no extra fingers, no text overlay, no captions, no watermark, no logo, no dark lighting.
```

**人物锁定(跨镜保持一致):**
- **王巡检 / 点检员(inspector)**:约 50 岁中国女性,沉稳;蓝色无尘服,头发完全收进蓝色无尘帽,轻薄面罩;戴**极简轻量 XR 眼镜(细框、近乎隐形,不是笨重 VR 头盔)**。
- **新人 / 学徒(newbie)**:约 20 岁中国年轻人,专注好奇;蓝色无尘服 + 白手套 + XR 眼镜。
- **老师傅(master)**:**以柔和蓝色全息分身出现**(半透明,上半身 + 一双卷制膜片、控制张力的手,发光动作残影,不是实体人)。在 S003B 告警处被"呼出"到现场,在 S004A 作教学示范。
- **膜元件(membrane element)**:被卷绕到白色中心管上的平板膜片,以及成品**卷式反渗透膜元件**(spiral-wound RO membrane element with a blue protective wrap and a white central core tube);跨镜保持一致。

> Gemini 一致性建议:先生成 S001,满意后把它作为**参考图**喂给后续镜头("keep the same room, same woman, same style as the reference"),人物和场景会更稳。

---

## 镜头 1 · S001(12s)— 开场:戴上 XR,世界显形

**中文要点**:宽镜头确立膜元件生产洁净车间;点检员王巡检在**卷制工位**戴上极简 XR 眼镜;卷膜机与正卷绕到白色中心管上的膜片被全息显形(卷制张力、层数)。
**English prompt:**
```
[STYLE/WORLD]. Wide establishing shot of the modern suspended-ceiling membrane-element production cleanroom. A calm Chinese female inspector (~50, blue cleanroom suit, hair fully under a blue cap) stands near the membrane-element Winding Station (卷膜机 / 卷制工位) where flat membrane sheets are wound onto a white central core tube, and puts on a pair of thin, lightweight, near-invisible XR glasses. As she does, faint holographic blue (#4a8eff) data softly bloom in the air around the winding machine, showing winding-tension and layer-count readouts. In the background, the walls are vertical brushed stainless steel panels, and the ceiling is a flat white suspended ceiling with flush-mounted LED panel lights. Eye-level, slow and quiet.
```

---

## 镜头 2 · S002A(11s)— 点检:清单化作地面光路

**中文要点**:点检任务清单在 XR 里变成地面一条发光引导光路,顺着真实的黄色导引带延伸,把她引向**卷制工位**;沿途浮起极简细描边任务标记(绿=已完成,橙=当前)。
**English prompt:**
```
[STYLE/WORLD]. Medium tracking shot following the same Chinese female inspector walking through the membrane-element production cleanroom. An XR holographic guide path glows on the grey epoxy floor, running along the painted yellow safety boundary lines and leading toward the membrane Winding Station (卷制工位). Floating thin-stroke line task-markers hover beside her: green (#22c55e) for completed inspections, amber (#f59e0b) for the current winding check. The physical factory floor stays realistic and screen-free.
```

---

## 镜头 3 · S002B(11s)— 点检:数据环 + 趋势 + 通过

**中文要点**:近景,**卷制工位**前浮起一圈全息数据环,等宽字体显示卷制参数(卷制张力 / 胶量 / 同心度);**卷制张力**趋势条亮起琥珀色、连日缓慢上行;她抬手轻点确认通过。
**English prompt:**
```
[STYLE/WORLD]. Close-up with shallow depth of field. A floating holographic data ring hovers in front of the membrane Winding Station (卷制工位), showing parameters (winding tension, adhesive bead, concentricity) in monospaced numerals, primary blue (#4a8eff). One amber (#f59e0b) history trend bar for winding tension slowly creeping upward over days. The inspector's blue-suited hand rises to tap-confirm the item on the XR display.
```

---

## 镜头 4 · S003A(12s)— 监控:全车间数据显现

**中文要点**:高角度俯视,切到监控视角;整间车间被空间锚定的实时数据节点点亮,各工位旁浮起小幅摄像头画面窗口与实时数据;整体平稳绿色,物理空间依旧安静极简。
**English prompt:**
```
[STYLE/WORLD]. High-angle downward shot of the whole membrane-element production workshop. The entire space is overlaid with spatially-anchored XR real-time data nodes and small floating camera-feed windows beside each station (Winding, Assembly and potting, Flux testing). Calm green (#22c55e) status everywhere, monospaced data, thin-stroke icons. The physical workspace stays realistic, showing the white pillars, yellow floor lines, and stainless steel machinery. Elegant overview.
```

---

## 镜头 5 · S003B(12s)— 监控:告警变红 + 呼出老师傅分身

**中文要点**:卷制工位的**卷制张力**节点由琥珀转为红色告警;系统**呼出老师傅的全息分身**(半透明蓝色,上半身+手)到现场,凑近一起查看这处告警。
**English prompt:**
```
[STYLE/WORLD]. Medium shot at the membrane Winding Station (卷制工位). The winding-tension XR node shifts from amber to alarm red (#ef4444). A soft blue holographic avatar of an experienced master (老师傅分身) is summoned and materializes beside the station — clearly a translucent holographic presence, upper body and hands, not a solid person — leaning in to inspect the red alarm together.
```

---

## 镜头 6 · S004A(12s)— 学习:讲解 + 区域高亮 + 老师傅全息

**中文要点**:新人站在**卷制工位**前,分步语音讲解响起;讲到哪,对应区域(卷膜辊)就在空间里被 XR 高亮框点亮;老师傅**卷制膜片、控制张力**的手法以柔和蓝色全息分身示范。暖调。
**English prompt:**
```
[STYLE/WORLD]. Over-the-shoulder shot with slow rack focus. A young Chinese apprentice (~20, blue cleanroom suit, white gloves, XR glasses) stands at the membrane Winding Station holding flat membrane sheets and a white central core tube. XR ROI highlight frames light up the winding rollers. A soft blue holographic playback of a master's hands demonstrates the membrane-winding and tension-control motion. Warm tone.
```

---

## 镜头 7 · S004B(12s)— 学习:测验确认

**中文要点**:一张极简 XR 测验卡片浮现在新人面前;新人抬眼选出正确答案;一个绿色对勾确认通过,微微一笑。
**English prompt:**
```
[STYLE/WORLD]. Close-up with shallow depth of field. A minimalist floating XR quiz card hovers in front of the young apprentice, with clean thin-stroke options in primary blue (#4a8eff). The apprentice selects the correct answer and a green (#22c55e) check mark confirms it. A faint warm smile. Screen-free minimalist space.
```

---

## 镜头 8 · S005(12s)— 收束:亲手装配 + 水转清

**中文要点**:细节微距,新人戴白手套的双手在淡淡 XR 标注引导下,亲手装配完成一片滤芯;成品滤芯内部,水由浑浊缓缓转清、化作流动的光;XR 信息层渐渐褪去,物理车间回到安静明亮。暖调。
**English prompt:**
```
[STYLE/WORLD]. Detail insert macro shot. The Chinese apprentice's white-gloved hands install a high-end spiral-wound RO membrane filter element (featuring a blue protective wrap and a white central core tube) into a cylindrical test housing at the Flux Testing (通量测试) workbench, guided by faint thin-stroke XR annotation. Inside the transparent test pipe, water flows through the RO membrane, turning from cloudy to crystal clear, rendered as gentle flowing light. The XR information layer softly fades away. Warm, hopeful tone.
```

---

## 镜头 9 · S006(6s)— 落版

**中文要点**:极简洁净白背景;品牌标识 + 三个功能图标(点检 · 监控 · 学习)+ 膜 / 滤芯 / 净水机三个产品意象;预留标语排版空间。标语:「点检、监控、学习——让看不见的,被看见。」
**English prompt:**
```
Minimalist clean white brand end-card, 16:9, ample negative space, product-grade render, 8K. A refined logo lockup area, three thin-stroke function icons (inspection, monitoring, learning) and three subtle product motifs (membrane, filter element, water purifier) in primary blue (#4a8eff). Elegant empty space reserved for a tagline. Soft even lighting. No clutter.
```
**标语(中文,叠字幕用)**:点检、监控、学习——让看不见的,被看见。

---

## 用法小结

1. 每张图 = `[STYLE/WORLD 前缀]` + 该镜头的 English prompt;出图时附上「统一规避项」。
2. 想要人物/场景一致:先定 S001,再把它当**参考图**带进后面每一镜。
3. 满意的第一帧图请回存到 `projects/vision/assets/renders/<镜头号>/keyframes/frame_01.jpg`,之后我重编译就能接 img2vid 出片。
