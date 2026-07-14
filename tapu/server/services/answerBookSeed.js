import { resultToObjects } from './tokens.js';

const DECK_ID = 'seed-answer-book-mindful-deck';
const TOKEN_ID = 'seed-answer-book-demo-token';
const DEMO_TOKEN = '2a7c9f0e4b6d41f3a8e5c1d9b0f62473';

const seedCards = [
  { sort: 1, answer: "先把刀放下，哪怕那只是一句想回怼的话。", response: "你现在想赢，但更需要从这场小型战争里撤出来。胜利有时只是少说一句。", action: "闭嘴三次呼吸，再决定要不要发送。", tag: "克制" },
  { sort: 2, answer: "这不是命运的暗示，只是你太累了。", response: "很多重大预感，其实是睡眠不足穿了件斗篷。先别审判人生。", action: "喝水，放下手机十分钟。", tag: "休息" },
  { sort: 3, answer: "答案暂时缺席，但你可以先出席。", response: "不确定不会因为你盯着它就立刻变清楚。你可以先做下一件具体的小事。", action: "写下三分钟内能完成的一步。", tag: "行动" },
  { sort: 4, answer: "不要把焦虑误认为洞察。", response: "脑子很会制造预告片，而且剪得特别吓人。现实通常没有那么配合它。", action: "看看周围五个真实物体。", tag: "回到现实" },
  { sort: 5, answer: "你不是没有选择，你是不想承担选择后的自己。", response: "这很正常。选择的重量不在选项里，在你愿不愿意陪它走一段。", action: "选一个较小版本先试一天。", tag: "决策" },
  { sort: 6, answer: "今天不适合做人生总结。", response: "情绪低的时候写年终报告，容易把一场雨误判成气候变化。", action: "把问题推迟到明天上午。", tag: "延后" },
  { sort: 7, answer: "先不要解释，先感受。", response: "有些解释只是给情绪穿西装。它看起来体面，但还是站不稳。", action: "把手放在胸口，感觉呼吸起伏。", tag: "身体" },
  { sort: 8, answer: "这件事需要边界，不需要演讲。", response: "你说得越多，对方越容易抓住细节绕开重点。短句有时更慈悲。", action: "写一句“不方便”作为草稿。", tag: "边界" },
  { sort: 9, answer: "你可以温柔，但不用开门。", response: "善意不是无限营业的店。今天可以打烊。", action: "把一个请求改成明天回复。", tag: "自保" },
  { sort: 10, answer: "如果你一直想证明，先问问谁在审判。", response: "也许没人坐在法官席上，只是你把过去的声音请回来了。", action: "写下“我现在不需要被判定”。", tag: "自我接纳" },
  { sort: 11, answer: "慢一点，事情还没开始爆炸。", response: "你感到紧急，不代表世界真的拉响警报。先确认事实，再处理想象。", action: "列出三个已发生事实。", tag: "稳定" },
  { sort: 12, answer: "不要用别人的沉默填满自己的剧情。", response: "没回复可能有一百种原因，你的大脑偏偏选了最伤人的那一种。", action: "等二十分钟再看消息。", tag: "关系" },
  { sort: 13, answer: "你可以想念，但不用投降。", response: "想念不是指令，它只是一个经过身体的天气。让它经过。", action: "吸气数四下，呼气数六下。", tag: "想念" },
  { sort: 14, answer: "答案在你的胃里，不在群聊里。", response: "你已经问了很多人，因为你不想听见自己那个安静的判断。", action: "闭眼问自己：我其实怕什么？", tag: "自知" },
  { sort: 15, answer: "先别优化人生，先整理桌面。", response: "大问题有时需要一个小入口。桌面变清楚，脑子会少一点噪声。", action: "清掉眼前三样杂物。", tag: "整理" },
  { sort: 16, answer: "你不需要马上变好，先别继续变乱。", response: "今天的目标可以很低：不追加伤害，不扩大误会，不把自己扔进风里。", action: "做一件能停止损耗的小事。", tag: "止损" },
  { sort: 17, answer: "这不是结束，是系统提示你换个姿势。", response: "旧方法已经用到发烫。不是你失败，是工具该休息了。", action: "换一个地方坐五分钟。", tag: "调整" },
  { sort: 18, answer: "不要向一个关闭的门朗诵长诗。", response: "有些人现在听不见。你可以保留表达，但不必继续撞门。", action: "把想说的话写给自己。", tag: "放下" },
  { sort: 19, answer: "你已经很努力了，虽然表情像在逃税。", response: "身体比你诚实，它早就知道你撑太久了。", action: "放松下巴和肩膀。", tag: "松弛" },
  { sort: 20, answer: "先活过今天，再讨论意义。", response: "意义不是每天都准时上班。今天先照顾生命体本身。", action: "吃点热的东西。", tag: "生存" },
  { sort: 21, answer: "这件事需要清单，不需要恐慌。", response: "恐慌很有气势，但项目管理能力通常一般。把它拆小。", action: "写下第一步、第二步、第三步。", tag: "拆解" },
  { sort: 22, answer: "你可以拒绝，不必附赠论文。", response: "解释太多会让拒绝看起来像还在谈判。", action: "练习一句：“这次我不参加。”", tag: "拒绝" },
  { sort: 23, answer: "别急着原谅，先确认伤口不是还在流血。", response: "过早大度有时只是怕麻烦。真正的宽和不会要求你消失。", action: "给自己一个未处理标签。", tag: "修复" },
  { sort: 24, answer: "今天适合少量勇敢。", response: "不用一口气成为新的人。往前一点点，就已经不是原地。", action: "发出一条必要消息。", tag: "勇气" },
  { sort: 25, answer: "这不是天意，是提醒你看说明书。", response: "有些问题不神秘，只是信息不足。补信息比补脑洞更有效。", action: "查一个关键事实。", tag: "信息" },
  { sort: 26, answer: "你现在需要的是证据，不是气氛。", response: "气氛会渲染，证据会落地。先看可验证的东西。", action: "把“感觉”改写成“事实”。", tag: "判断" },
  { sort: 27, answer: "不要把一次尴尬升级成身份危机。", response: "你只是说错一句话，不是整个人被系统删除。", action: "轻轻笑一下，继续做事。", tag: "宽容" },
  { sort: 28, answer: "保持神秘可以，但别神秘到自己也不知道。", response: "模糊有时很美，有时只是逃避换了个柔光滤镜。", action: "写下你真正想要的结果。", tag: "清晰" },
  { sort: 29, answer: "这份关系需要呼吸孔。", response: "靠太近会缺氧，靠太远会失温。先留一点空间。", action: "今天不追问最后一个问题。", tag: "空间" },
  { sort: 30, answer: "你可以重新开始，不用宣布。", response: "真正的改变通常很安静，像把杯子放回原位。", action: "做一个新的小动作。", tag: "重启" },
  { sort: 31, answer: "别把“我愿意”说成“我应该”。", response: "语言会暴露能量来源。愿意有光，应该有账单。", action: "把一句“应该”改成“我选择”。", tag: "选择" },
  { sort: 32, answer: "你的不安需要被听见，不需要被任命为总经理。", response: "情绪可以参会，但不要让它独自决策。", action: "给不安命名，然后继续呼吸。", tag: "情绪" },
  { sort: 33, answer: "先不要追答案，追一下早餐。", response: "空腹时的哲学很容易变得阴森。", action: "先吃东西，再回来问。", tag: "照顾" },
  { sort: 34, answer: "你不是反复，你是在确认疼痛有没有变轻。", response: "有些回头不是软弱，是身体在检查安全。", action: "问自己：这次我学到了什么？", tag: "复盘" },
  { sort: 35, answer: "可以离开，但别用燃烧的方式。", response: "离开不一定要制造烟雾。安静地走，也很有力量。", action: "列出离开的低损耗步骤。", tag: "离开" },
  { sort: 36, answer: "这句话先不要发，它现在太有才华了。", response: "有些精彩回复适合留在草稿箱，作为个人文学成就。", action: "保存草稿，二十分钟后重看。", tag: "冷却" },
  { sort: 37, answer: "你不必把所有门都打开给同一个人看。", response: "亲密也需要房间分区。不是隐瞒，是保留自己。", action: "想一个你想保留的边界。", tag: "私密" },
  { sort: 38, answer: "答案可能很普通：睡觉。", response: "人类经常把低电量误会成灵魂危机。", action: "今天早点睡。", tag: "睡眠" },
  { sort: 39, answer: "不要把别人的速度当成你的倒计时。", response: "有人快，是他的节奏；你慢，不代表你迟到。", action: "关掉一个比较入口。", tag: "比较" },
  { sort: 40, answer: "你可以承认想要，这不丢人。", response: "想要会让人暴露，也会让人活着。别把愿望伪装成无所谓。", action: "写下“我想要”。", tag: "愿望" },
  { sort: 41, answer: "今天适合把自己从戏里领出来。", response: "你已经演了好几集内心独白，但对方可能还没开机。", action: "做一次身体扫描。", tag: "抽离" },
  { sort: 42, answer: "别急着给痛苦找高级解释。", response: "有时疼就是疼，不需要被包装成成长。", action: "对自己说：这确实不好受。", tag: "承认" },
  { sort: 43, answer: "你不是没有灵感，你是被噪声占座了。", response: "灵感需要一张空椅子。先让杂音离场。", action: "静音十分钟。", tag: "创造" },
  { sort: 44, answer: "这件事可以问，但不要审讯。", response: "好奇和控制只有一步之遥。语气会决定门开不开。", action: "把质问改成询问。", tag: "沟通" },
  { sort: 45, answer: "不要把“还没发生”当成“已经完了”。", response: "你的脑子提前参加了葬礼，现实还在路上。", action: "写下最小可挽回动作。", tag: "希望" },
  { sort: 46, answer: "你可以脆弱，但不用现场直播。", response: "找一个安全的人，而不是找最大音量的地方。", action: "选一个真正可信的人说。", tag: "倾诉" },
  { sort: 47, answer: "这不是失败，是一份过于清楚的反馈。", response: "反馈不温柔，但它有用。先别急着恨它。", action: "写下一个可调整点。", tag: "反馈" },
  { sort: 48, answer: "你的身体已经投票了。", response: "头脑还在辩论，身体已经悄悄把票塞进箱子。", action: "注意胃、肩、喉咙的反应。", tag: "身体智慧" },
  { sort: 49, answer: "先把问题放小，放到今天能拿得动。", response: "太大的问题会把人压成哲学摆件。", action: "只回答“今天怎么办”。", tag: "当天" },
  { sort: 50, answer: "你不需要表现得很懂事。", response: "懂事有时只是把需求打包寄往无人区。", action: "说出一个具体需要。", tag: "需要" },
  { sort: 51, answer: "这件事正在提醒你：别再自动续费旧模式。", response: "旧反应很熟，但熟不等于有效。", action: "做一个和平时不同的小选择。", tag: "模式" },
  { sort: 52, answer: "别让羞耻替你写结论。", response: "羞耻喜欢用红笔批改整个人生，它没有这个权限。", action: "写下事实，不写人格评价。", tag: "羞耻" },
  { sort: 53, answer: "你可以等，但别把自己暂停。", response: "等待不是把生活挂起。你仍然可以吃饭、走路、发光。", action: "做一件和等待无关的事。", tag: "等待" },
  { sort: 54, answer: "这个答案不在更用力里。", response: "有些门不是推开的，是等你退半步才看见把手。", action: "后退一步，重新看问题。", tag: "退后" },
  { sort: 55, answer: "今天不要和凌晨的自己签合同。", response: "深夜版本的你很有感染力，但风险评估一般。", action: "明早再决定。", tag: "夜晚" },
  { sort: 56, answer: "你已经知道哪里不对，只是在等它变得体面。", response: "不舒服不一定需要证据链完整。它本身就是信息。", action: "标记一个“不对劲”。", tag: "直觉" },
  { sort: 57, answer: "别把温柔用在消耗你的人身上直到透支。", response: "温柔不是无限流量套餐。", action: "今天少回复一次。", tag: "能量" },
  { sort: 58, answer: "先别寻找意义，先寻找出口。", response: "被困住时，出口比解释重要。", action: "找到一个能让你离开现场的方法。", tag: "出口" },
  { sort: 59, answer: "你不必在所有人面前完整。", response: "有些完整只适合私下慢慢拼。", action: "允许自己今天只完成一半。", tag: "不完整" },
  { sort: 60, answer: "这次别急着救场。", response: "不是每个沉默都需要你跳进去铺地毯。", action: "让空气空十秒。", tag: "沉默" },
  { sort: 61, answer: "你可以相信，但要保留收据。", response: "信任不是闭眼跳楼，它也可以带着观察。", action: "写下一个你会观察的信号。", tag: "信任" },
  { sort: 62, answer: "问题没有那么玄，它只是需要你诚实。", response: "诚实通常比智慧更难，因为它没法装饰。", action: "回答：我真正想避免什么？", tag: "诚实" },
  { sort: 63, answer: "不要把一次拖延判成道德败坏。", response: "你可能只是害怕开始后发现自己在乎。", action: "打开文件，不要求继续。", tag: "开始" },
  { sort: 64, answer: "今天适合轻轻赢一次。", response: "不需要惊天动地，赢回一点秩序就很好。", action: "完成一个两分钟任务。", tag: "小胜" },
  { sort: 65, answer: "如果你想逃，先看看你在逃什么。", response: "逃跑有时是智慧，有时是旧习惯穿上运动鞋。", action: "写下逃离对象。", tag: "面对" },
  { sort: 66, answer: "这个关系需要真话，不需要测试题。", response: "试探会让答案变形。真话虽然笨一点，但比较清楚。", action: "用陈述句说感受。", tag: "真话" },
  { sort: 67, answer: "你不需要把每种情绪都合理化。", response: "人不是审批系统。感受可以先存在，再慢慢理解。", action: "说：我允许这个感受出现。", tag: "允许" },
  { sort: 68, answer: "先照顾那个最小的自己。", response: "现在紧绷的部分，可能只是想被安抚，而不是被教育。", action: "抱住手臂，慢慢呼气。", tag: "安抚" },
  { sort: 69, answer: "这个答案可能是：不要再问这个人。", response: "有些地方不会给水，你一直敲门只会更渴。", action: "换一个支持来源。", tag: "支持" },
  { sort: 70, answer: "不要把清醒误会成冷漠。", response: "看清楚之后减少投入，不是变坏，是回收自己。", action: "撤回一个多余承诺。", tag: "清醒" },
  { sort: 71, answer: "你可以喜欢不确定。至少试试看。", response: "不确定不是敌人，它只是还没完成自我介绍。", action: "给未知留一个名字。", tag: "未知" },
  { sort: 72, answer: "先让呼吸进来，答案晚点再说。", response: "身体缺氧时，任何答案都会看起来像威胁。", action: "深吸气，长呼气，重复五轮。", tag: "呼吸" },
  { sort: 73, answer: "这个计划需要现实，不需要热血剪辑。", response: "热血很好，但预算、时间和体力也要在场。", action: "写下三个限制条件。", tag: "计划" },
  { sort: 74, answer: "不必把自己训练成没有需求的人。", response: "没有需求不是成熟，是消失得比较安静。", action: "说出一个可被满足的小需求。", tag: "需求" },
  { sort: 75, answer: "今天的答案是：别再偷看伤口。", response: "反复确认只会让它重新开始。给愈合一点隐私。", action: "暂停查看一个入口。", tag: "愈合" },
  { sort: 76, answer: "你不需要立刻回应所有敲门声。", response: "有些敲门只是世界的手指无聊。", action: "关闭通知半小时。", tag: "专注" },
  { sort: 77, answer: "这件事可以认真，但不用悲壮。", response: "悲壮会消耗氧气。认真可以更轻一点。", action: "把任务拆成普通步骤。", tag: "轻" },
  { sort: 78, answer: "不要用幻想里的结局惩罚现在的自己。", response: "未来还没来，你已经替它收了很多利息。", action: "回到今天的一个可控动作。", tag: "当下" },
  { sort: 79, answer: "你可以道歉，但不要连自尊一起打包。", response: "道歉是修复行为，不是注销自己。", action: "写一句只为行为负责的道歉。", tag: "道歉" },
  { sort: 80, answer: "这次请相信缓慢。", response: "快速答案很刺激，但缓慢答案通常比较耐用。", action: "把决定延长一个自然周期。", tag: "缓慢" },
  { sort: 81, answer: "别把“我怕”翻译成“我不行”。", response: "害怕只是身体在认真，不是能力鉴定书。", action: "对害怕点头，然后做一点点。", tag: "害怕" },
  { sort: 82, answer: "你不需要更狠，你需要更准。", response: "狠容易伤到自己。准才会真正改变局面。", action: "找到一个关键点。", tag: "精准" },
  { sort: 83, answer: "今天适合低调地保护快乐。", response: "快乐太早公开，有时会被意见吹冷。先自己暖一会儿。", action: "暂时不分享一个好消息。", tag: "快乐" },
  { sort: 84, answer: "如果一直打不开，也许不是钥匙问题。", response: "有些门本来就不属于你。别把手磨破了才承认。", action: "允许一个方向结束。", tag: "结束" },
  { sort: 85, answer: "你可以把期待调低，不是把爱调低。", response: "期待是设置，爱是能力。两者不必绑在一起。", action: "调整一个具体期待。", tag: "期待" },
  { sort: 86, answer: "这件事请交给白天版本的你。", response: "白天的你有窗户、咖啡和较少的末日感。", action: "把问题写下，明早处理。", tag: "明天" },
  { sort: 87, answer: "不要急着成为答案，先成为自己人。", response: "你老想解决别人，却忘了站在自己这边。", action: "问：我现在站在哪一边？", tag: "自己" },
  { sort: 88, answer: "这份难过不是退步。", response: "人会在同一个地方难过很多次，每一次都可能更懂一点。", action: "给难过留三分钟。", tag: "难过" },
  { sort: 89, answer: "你可以换一种问法。", response: "好问题不会逼供，它会开窗。", action: "把“为什么这样”改成“我需要什么”。", tag: "提问" },
  { sort: 90, answer: "今天别和想象中的敌人开会。", response: "它们出席率很高，但没有一个能签字。", action: "只处理真实出现的人和事。", tag: "真实" },
  { sort: 91, answer: "这个答案需要一段路。", response: "走路会让脑子从审讯室搬到街上。", action: "出门走十分钟。", tag: "行走" },
  { sort: 92, answer: "你可以不解释自己的恢复速度。", response: "伤口不是绩效项目。没有人有资格催你结案。", action: "删除一个“我应该好了”的念头。", tag: "恢复" },
  { sort: 93, answer: "别把空白塞满。", response: "空白不是失败，是系统给你留的缓冲区。", action: "什么都不做两分钟。", tag: "空白" },
  { sort: 94, answer: "这件事不需要更多脑内彩排。", response: "你已经排练到演员疲惫、观众缺席。该上场或散场了。", action: "选择一个真实动作。", tag: "执行" },
  { sort: 95, answer: "可以承认你嫉妒，这说明你还想要。", response: "嫉妒不是罪证，它是愿望的烟雾报警器。", action: "写下别人拥有的东西里，你真正想要什么。", tag: "嫉妒" },
  { sort: 96, answer: "答案不是“算了”，是“我先回来”。", response: "放下不是假装没事，而是把注意力从伤口边缘带回身体。", action: "感受脚底压在地上的重量。", tag: "回来" },
  { sort: 97, answer: "今天少一点表演，多一点生活。", response: "你不需要把每个瞬间都处理成可展示版本。", action: "做一件不发给任何人看的事。", tag: "生活" },
  { sort: 98, answer: "你可以保留希望，但别让希望替现实签字。", response: "希望负责照亮，现实负责铺路。两者都需要。", action: "写下一个希望和一个现实动作。", tag: "希望" },
  { sort: 99, answer: "这个问题先放在窗边。", response: "有些答案需要风吹一会儿，硬挤出来只会皱。", action: "离开屏幕，看远处一分钟。", tag: "暂放" },
  { sort: 100, answer: "碰到这里，说明你还在找路。很好。", response: "找路的人不一定迷失，也可能只是还没有接受旧地图过期。", action: "把今天的下一步说出来。", tag: "路" },
];

function upsert(db, table, id, insertSql, params, updateSql, updateParams) {
  const existing = resultToObjects(db.exec(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [id]));
  if (existing.length > 0) {
    db.run(updateSql, updateParams);
  } else {
    db.run(insertSql, params);
  }
}

function ensureCard(db, card) {
  const id = `seed-answer-book-card-${String(card.sort).padStart(3, '0')}`;
  upsert(
    db,
    'answer_book_cards',
    id,
    `INSERT INTO answer_book_cards
     (id, deck_id, answer, response, action, tag, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, DECK_ID, card.answer, card.response, card.action, card.tag, 'active', card.sort],
    `UPDATE answer_book_cards
     SET deck_id = ?, answer = ?, response = ?, action = ?, tag = ?, status = ?, sort_order = ?
     WHERE id = ?`,
    [DECK_ID, card.answer, card.response, card.action, card.tag, 'active', card.sort, id]
  );
}

export function ensureAnswerBookSeed(db) {
  upsert(
    db,
    'answer_book_decks',
    DECK_ID,
    `INSERT INTO answer_book_decks
     (id, name, subtitle, description, tone_notes, theme_color, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      DECK_ID,
      '答案之书',
      '碰一下，把自己从脑内会议里请出来。',
      '一组清醒、克制、带一点反差感的正念答案。它不替用户决定未来，只把用户带回当下。',
      '温柔但不甜，清醒但不冷，有一点黑色幽默，最后落回身体、呼吸、行动和关系。',
      '#2f6f5e',
      'active',
    ],
    `UPDATE answer_book_decks
     SET name = ?, subtitle = ?, description = ?, tone_notes = ?, theme_color = ?, status = ?
     WHERE id = ?`,
    [
      '答案之书',
      '碰一下，把自己从脑内会议里请出来。',
      '一组清醒、克制、带一点反差感的正念答案。它不替用户决定未来，只把用户带回当下。',
      '温柔但不甜，清醒但不冷，有一点黑色幽默，最后落回身体、呼吸、行动和关系。',
      '#2f6f5e',
      'active',
      DECK_ID,
    ]
  );

  seedCards.forEach(card => ensureCard(db, card));

  upsert(
    db,
    'answer_book_tokens',
    TOKEN_ID,
    `INSERT INTO answer_book_tokens
     (id, deck_id, token, label, status)
     VALUES (?, ?, ?, ?, ?)`,
    [TOKEN_ID, DECK_ID, DEMO_TOKEN, '答案之书演示 NFC', 'active'],
    `UPDATE answer_book_tokens
     SET deck_id = ?, token = ?, label = ?, status = ?
     WHERE id = ?`,
    [DECK_ID, DEMO_TOKEN, '答案之书演示 NFC', 'active', TOKEN_ID]
  );
}

export const ANSWER_BOOK_DEMO_TOKEN = DEMO_TOKEN;
