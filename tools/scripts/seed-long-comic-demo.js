import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const DEMO_PROJECT_ID = 'red_mug_long_demo';
// 演示数据只写入标准项目目录，不污染仓库根（根目录单项目结构已废弃）
const ROOT = path.join(REPO_ROOT, 'projects', DEMO_PROJECT_ID);

function registerDemoProject() {
  const projectsFile = path.join(REPO_ROOT, 'projects.json');
  let data = { projects: [], activeProjectId: null };
  try {
    data = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
  } catch {}
  if (!data.projects.some(p => p.id === DEMO_PROJECT_ID)) {
    const now = new Date().toISOString();
    data.projects.push({
      id: DEMO_PROJECT_ID,
      name: '红杯（演示）',
      description: '低成本配音静态图片漫画演示：中文悬疑短篇。',
      createdAt: now,
      updatedAt: now
    });
    if (!data.activeProjectId) data.activeProjectId = DEMO_PROJECT_ID;
    fs.writeFileSync(projectsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  }
}

const story = [
  ['午夜的雨把旧公寓包成一只黑盒。林澈回家时，厨房灯自己亮着。', '我出门前，明明关了灯。'],
  ['桌上有一只红杯，杯沿还冒着热气。那不是他的杯子。', '谁来过我家？'],
  ['手机忽然亮起，屏幕上只有一行字：别喝。', '这是谁发的？'],
  ['门外传来电梯停靠的声音，可这栋楼的电梯上周就坏了。', '不可能。'],
  ['他走到猫眼前，走廊空着，灯却一盏一盏熄灭。', '有人在外面。'],
  ['红杯下面压着半张照片，照片里是十年前的厨房。', '这是我小时候的家？'],
  ['照片角落站着一个女人，脸被雨水一样的划痕抹掉。', '妈妈？'],
  ['林澈的记忆突然断开。母亲失踪那晚，也下着这样的雨。', '我不是都忘了吗？'],
  ['水槽开始滴水，滴声像秒针，把房间切得很窄。', '够了，别响了。'],
  ['红杯里浮起一枚钥匙，钥匙柄刻着五楼的门牌号。', '五零三？隔壁？'],
  ['他握住钥匙，杯子里的热气立刻变冷，像一口叹息。', '你想让我过去？'],
  ['走廊尽头的五零三，门缝里透出和厨房一样的暖光。', '有人吗？'],
  ['钥匙刚插进去，门自己开了。屋里摆着同样的桌，同样的红杯。', '这不是隔壁，这是我家。'],
  ['墙上贴着旧报纸，日期停在母亲失踪后的第二天。', '原来有人一直在这里。'],
  ['报纸下面露出一段铅笔字：如果他回来，别让他记起地下室。', '他是谁？是我吗？'],
  ['窗外闪电照亮房间，玻璃上倒映出另一个林澈站在身后。', '别回头。'],
  ['他还是回头了。身后没有人，只有柜门轻轻敞开。', '你到底要我看什么？'],
  ['柜子里塞满录像带，每一盘都贴着他的名字。', '林澈，一九九九。'],
  ['第一盘录像开始播放。画面里，小林澈坐在厨房桌边，母亲在哭。', '这是真的？'],
  ['录像里的母亲把红杯推给孩子，说了一句被噪声吞掉的话。', '她说了什么？'],
  ['电视雪花闪烁，噪声里慢慢挤出两个字：别信。', '别信谁？'],
  ['门外传来母亲的声音，很近，很轻，像隔着一层水。', '小澈，开门。'],
  ['林澈后退一步，钥匙在掌心发烫，像在替他做决定。', '你不是我妈。'],
  ['门把手缓慢转动，红杯突然裂开一道细缝。', '别进来。'],
  ['杯子碎裂，里面不是水，是一卷被泡软的照片底片。', '还有证据。'],
  ['底片对着灯，出现一扇地下室铁门，门上写着林家的姓。', '我们家没有地下室。'],
  ['地板传来空响。他蹲下敲击，桌脚旁有一块木板松了。', '就在这里。'],
  ['木板掀开，冷风从黑洞里爬出来，带着潮湿的铁锈味。', '我下去。'],
  ['楼梯很窄，墙面贴着儿童身高线，每一道都写着同一天日期。', '为什么都是同一天？'],
  ['地下室尽头有一台旧录音机，红色指示灯正在闪。', '它在录音？'],
  ['录音机播放出林澈自己的声音，比现在年轻，也更害怕。', '如果我忘了，就从红杯开始。'],
  ['他终于明白，线索不是别人留下的，是过去的自己。', '我把自己困住了。'],
  ['录音继续说：不要找母亲，先找那个替代你的人。', '替代我？'],
  ['地下室的镜子上蒙着布。布后传来指甲轻敲玻璃的声音。', '谁在里面？'],
  ['他掀开布，镜中人比他慢半秒抬头，嘴角却先笑了。', '你终于来了。'],
  ['镜中人说不出声音，但唇形清楚：把记忆还给我。', '你不是我。'],
  ['灯光熄灭又亮起，镜子外多了一只红杯，镜子里少了一个人。', '你出来了？'],
  ['厨房方向传来脚步声。每一步都和他的心跳重合。', '别靠近她。'],
  ['他冲上楼，看见母亲坐在桌边，和照片里一样年轻。', '妈？'],
  ['母亲抬眼，却先看向他身后，像看见真正的儿子。', '别听他说，小澈。'],
  ['另一个林澈站在门口，手里端着完整的红杯。', '你偷走了我的人生。'],
  ['两个人同时伸手，红杯在中间摇晃，杯中映出两段记忆。', '到底谁是真的？'],
  ['母亲终于开口：真的不是人，是愿意承担真相的那个。', '那真相是什么？'],
  ['她指向窗外。雨幕里，十年前的小男孩正把母亲锁进地下室。', '是我做的？'],
  ['林澈跪在地上，记忆像冷水灌进胸口。他曾经为了留住母亲，犯下不可逆的错。', '我不是故意的。'],
  ['另一个林澈没有靠近，只把红杯放回桌上。杯中热气像一条回家的路。', '现在轮到你记住。'],
  ['母亲的身影开始变淡。她没有责怪，只替他擦掉脸上的雨。', '别再逃了。'],
  ['天快亮时，厨房只剩一只空杯和一盘录音带。', '我会去自首。'],
  ['林澈推开门，走廊灯全部亮起，坏掉的电梯第一次响铃。', '这次，我不回头。'],
  ['雨停了。城市像刚被洗过，而红杯留在桌上，等下一个需要真相的人。', '故事，从这里结束。']
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(relPath, value) {
  const abs = path.join(ROOT, relPath);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function shotId(index) {
  return `S${String(index + 1).padStart(3, '0')}`;
}

function writeShot(index, voiceoverText, dialogueText) {
  const id = shotId(index);
  const prevState = index === 0 ? 'states/S000_INIT.json' : `states/${shotId(index - 1)}_OUT.json`;
  const nextHandoff = index < story.length - 1
    ? [`红杯仍是关键线索`, `雨夜公寓的压迫感延续到 ${shotId(index + 1)}`]
    : ['雨停，故事闭合'];

  writeJson(`shots/${id}.json`, {
    shot_id: id,
    duration_s: 12,
    scene_ref: 'scenes/kitchen_apartment_01.json',
    cam_setup_ref: `comic_panel_${String((index % 8) + 1).padStart(2, '0')}`,
    characters: [{ ref: 'characters/charA_v1.json' }],
    props: [{ ref: 'props/mug_red_v1.json', state: 'story_clue' }],
    action: {
      beats: [
        voiceoverText,
        dialogueText ? `林澈低声说：${dialogueText}` : '静默停顿，保留悬疑气口'
      ]
    },
    dialogue: {
      speaker: '林澈',
      text: dialogueText,
      voice_id: 'zh-CN-YunxiNeural'
    },
    voiceover: {
      speaker: '旁白',
      text: voiceoverText,
      voice_id: 'zh-CN-XiaoxiaoNeural'
    },
    continuity: {
      state_in_ref: prevState,
      state_changes: {
        characters: {
          charA_v1: {
            location: index < 28 ? 'apartment_kitchen_or_hallway' : 'hidden_basement_and_kitchen',
            pose: index % 3 === 0 ? 'listening' : index % 3 === 1 ? 'searching' : 'frozen'
          }
        },
        props: {
          mug_red_v1: {
            location: 'near_main_character',
            state: index < 24 ? 'warm_and_unexplained' : index < 46 ? 'broken_or_remembered' : 'empty'
          }
        },
        scene: {
          lighting: index < 48 ? 'rainy night, warm lamp, cold blue shadow' : 'early dawn after rain'
        }
      },
      handoff_to_next: nextHandoff
    },
    budget: { tier: 'cheap', max_regen: 1 },
    prompt: {
      positive: 'cinematic realistic suspense comic panel, stable young Chinese man identity, rainy old apartment, red mug as recurring clue, coherent low-cost storyboard frame',
      negative: 'no text artifacts, no logo, no watermark, no extra fingers, no face drift'
    }
  });

  writeJson(`states/${id}_OUT.json`, {
    shot_id: id,
    characters: {
      charA_v1: {
        outfit: 'white hoodie, dark pants',
        pose: index % 3 === 0 ? 'listening' : index % 3 === 1 ? 'searching' : 'standing tense',
        location: index < 28 ? 'old apartment' : 'basement and kitchen'
      }
    },
    props: {
      mug_red_v1: {
        location: 'near Lin Che',
        state: index < 24 ? 'warm' : index < 46 ? 'broken clue' : 'empty'
      }
    },
    scene: {
      lighting: index < 48 ? 'night rain with warm practical lamp' : 'soft dawn',
      weather: index < 48 ? 'rain' : 'after rain',
      time: index < 48 ? 'midnight' : 'dawn'
    }
  });
}

function copyKeyframe(index) {
  const targetId = shotId(index);
  const sourceId = shotId(index % 5);
  const source = path.join(ROOT, `assets/renders/${sourceId}/keyframes/frame_01.jpg`);
  const targetDir = path.join(ROOT, `assets/renders/${targetId}/keyframes`);
  const target = path.join(targetDir, 'frame_01.jpg');
  if (!fs.existsSync(source)) return;
  ensureDir(targetDir);
  if (path.resolve(source) !== path.resolve(target)) {
    fs.copyFileSync(source, target);
  }
}

function main() {
  registerDemoProject();
  story.forEach(([voiceoverText, dialogueText], index) => {
    writeShot(index, voiceoverText, dialogueText);
    copyKeyframe(index);
  });

  writeJson('project.json', {
    id: 'red_mug_long_demo',
    name: '红杯',
    description: '低成本配音静态图片漫画：约 10 分钟中文悬疑短篇，使用网页/上传图片回填关键帧，项目内负责编译提示词、配音和分镜预演。',
    default_style_ref: 'styles/cinematic_v1.json',
    defaults: {
      language: 'zh',
      fps: 24,
      budget: {
        cheap: { note: 'web image/video tools plus manual upload workflow' },
        final: { note: 'replace keyframes with selected external renders' }
      }
    },
    inventory: {
      scenes: ['scenes/kitchen_apartment_01.json'],
      characters: ['characters/charA_v1.json'],
      props: ['props/mug_red_v1.json']
    },
    timeline: story.map((_, index) => ({
      shot_id: shotId(index),
      shot_file: `shots/${shotId(index)}.json`,
      tier: 'cheap'
    }))
  });

  const novel = [
    '# 红杯',
    '',
    '午夜的雨把旧公寓包成一只黑盒。林澈回到家时，厨房灯自己亮着，桌上还放着一只不属于他的红杯。杯沿冒着热气，像刚有人离开。',
    '',
    '他先以为是自己记错了，可手机忽然亮起，陌生号码只发来两个字：别喝。门外同时传来电梯停靠的声音，而那部电梯明明已经坏了一周。',
    '',
    '红杯下面压着半张旧照片。照片里的厨房和现在一模一样，只是墙角站着一个脸被划掉的女人。林澈认出那是母亲失踪前的家，也认出自己曾经把那段记忆亲手埋掉。',
    '',
    '钥匙、录像带、地下室、镜子里的另一个自己，像一条被雨水泡软的线，把他带回十年前的夜晚。真相不是有人闯进了他的家，而是过去的他终于回来敲门。',
    '',
    '当母亲再次坐在厨房桌边，林澈才明白，真正可怕的不是鬼影，而是一个人为了活下去，愿意忘记自己做过什么。天亮时，他带着录音带走出公寓。雨停了，红杯仍留在桌上。'
  ].join('\n');

  ensureDir(path.join(ROOT, 'docs'));
  fs.writeFileSync(path.join(ROOT, 'docs/novel.md'), novel, 'utf-8');
  fs.writeFileSync(
    path.join(ROOT, 'docs/script.txt'),
    story.map(([voiceoverText, dialogueText], index) => `${shotId(index)}｜旁白：${voiceoverText}\n台词：${dialogueText}`).join('\n\n'),
    'utf-8'
  );

  console.log(`Seeded ${story.length} shots for a ${story.length * 12}s voiced comic demo.`);
}

main();
