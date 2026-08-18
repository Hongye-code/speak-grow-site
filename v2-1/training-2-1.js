/*
  讲清楚 2.1 的轻量训练升级。
  这份脚本只扩充题库，并让“本轮目标”进入报告与本地记录；不接入模型、账号或网络服务。
*/
(() => {
  const extraTopicFactories = {
    interview: {
      situations: [
        "接手一个没有明确交接的项目", "在资源不足时推进关键交付", "和不同部门对齐优先级",
        "处理一次重要客户的不满", "发现项目风险却需要继续推进", "在没有管理权限时影响同事",
        "面对突然变化的业务目标", "需要在数据不足时作出判断", "从熟悉岗位转到陌生领域", "争取一次更大职责或晋升机会"
      ],
      focuses: [
        "你如何先判断真正的问题", "你如何说明自己的取舍", "你做了什么来推动局面", "你如何让相关的人愿意配合",
        "你如何把风险说得具体而不过度", "你用什么证据证明自己的判断", "你如何安排第一步行动", "你如何处理过程中出现的分歧",
        "最后带来了什么可观察的结果", "如果重来一次，你会优先改哪一步"
      ],
      build(situation, focus) { return `请讲一次你${situation}的经历：${focus}？`; }
    },
    speech: {
      situations: [
        "AI 已经进入多数日常工作", "团队每个人都很忙却看不到结果", "信息越来越多而判断越来越少",
        "职业选择不再只有一条标准路径", "协作需要跨越专业和立场", "公开表达变成很多人的日常任务",
        "效率工具不断增加", "长期目标总被短期事务打断", "个人品牌和真实能力经常被混为一谈", "变化速度快过了经验积累"
      ],
      focuses: [
        "你认为真正的问题是什么", "最容易被忽略的代价是什么", "为什么常见做法没有解决核心矛盾", "一个具体场景会怎样说明你的观点",
        "听众最该先改变哪一个看法", "你会如何反驳一个看似合理的反对意见", "这件事对个人与团队分别意味着什么", "你会用什么对比让结论更清楚",
        "一项可马上开始的行动是什么", "你希望听众最后带走哪一句判断"
      ],
      build(situation, focus) { return `请围绕“${situation}”做一次 3 分钟分享：${focus}？`; }
    },
    subject: {
      situations: [
        "当你需要拒绝一个不合理请求时", "当关系里出现误解却不想逃避时", "当你想开始一件事又觉得还没准备好时",
        "当工作和生活都被临时消息打断时", "当你发现自己在比较里失去节奏时", "当你需要向家人解释一个重要选择时",
        "当你对一段关系需要重新划边界时", "当你在陌生环境里重新开始时", "当你要给自己留出真正的休息时间时", "当你需要承认并修正一个错误时"
      ],
      focuses: [
        "你最想先说清楚的一句话是什么", "你会如何描述自己的真实感受", "什么具体经历让你形成这个判断", "你希望对方理解的边界是什么",
        "你会如何把模糊感受变成一个可行动的决定", "最容易被误解的地方在哪里", "你会如何表达不同意见而不攻击对方", "什么细节能让这个故事更可信",
        "你会如何把结论收束成一句话", "下一步你愿意先做一个什么动作"
      ],
      build(situation, focus) { return `请谈谈“${situation}”：${focus}？`; }
    }
  };

  const goalDefinitions = {
    interview: [
      { label: "先把结论说出来", pattern: /我的判断|我能带来|我适合|先说结论|核心是/, tip: "开头先用“我的判断是……”落一句结论。" },
      { label: "用一个项目证明价值", pattern: /项目|案例|客户|用户|数据|当时|结果/, tip: "用“比如有一次……”讲一个具体项目。" },
      { label: "在被追问时仍说清判断", pattern: /因为|所以|依据|取舍|风险|优先/, tip: "补一句“我这样判断的依据是……”。" },
      { label: "有边界地表达期待", pattern: /我希望|我需要|我建议|可以|不适合|前提/, tip: "清楚说出你的前提、期待或可接受范围。" },
      { label: "结尾落到岗位贡献", pattern: /贡献|价值|结果|帮助|推进|带来/, tip: "最后回到“我能为这个岗位带来什么”。" }
    ],
    speech: [
      { label: "在 15 秒内给听众结论", pattern: /我的判断|结论是|关键是|问题不在于|先说/, tip: "开头先给一句能被复述的判断。" },
      { label: "把复杂观点讲成结构", pattern: /第一|第二|第三|首先|其次|一方面|另一方面/, tip: "用两到三个层次收住观点，不急着堆信息。" },
      { label: "用对比说清核心差异", pattern: /不是|而是|与其|不如|相比|反而/, tip: "加入一组“不是……而是……”的对比。" },
      { label: "给观点一个真实落点", pattern: /比如|例如|一次|项目|用户|数据|当时/, tip: "用一个真实场景或前后对比承接观点。" },
      { label: "结尾留下行动邀请", pattern: /所以|现在可以|下一步|从今天|不妨|先/, tip: "最后给听众一个今天就能做的动作。" }
    ],
    subject: [
      { label: "先给出一个清晰观点", pattern: /我认为|我的判断|我发现|我想说|关键是/, tip: "先说“我的判断是……”，再解释原因。" },
      { label: "用一个具体例子支撑", pattern: /比如|例如|一次|当时|那天|后来/, tip: "用一个具体片段替代抽象感受。" },
      { label: "表达不同意见也不含糊", pattern: /我不同意|我不太认同|我更倾向|我希望|我需要/, tip: "用“我更倾向于……”明确说出你的立场。" },
      { label: "把模糊感受说成行动", pattern: /我会|我决定|下一步|先|停止|开始/, tip: "把感受落成一个你愿意做的动作。" },
      { label: "让结尾更有行动感", pattern: /所以|下一步|从今天|可以先|我会/, tip: "最后用一句可执行的话收束。" }
    ]
  };

  function expandedTopicsFor(mode) {
    const factory = extraTopicFactories[mode];
    return factory.situations.flatMap((situation) => factory.focuses.map((focus) => factory.build(situation, focus)));
  }

  Object.keys(modeProfiles).forEach((mode) => {
    const profile = modeProfiles[mode];
    const additions = expandedTopicsFor(mode);
    if (additions.length !== 100 || new Set(additions).size !== 100) throw new Error(`${mode} 的 2.1 新题库没有生成 100 道唯一题目。`);
    profile.topics.push(...additions);
    profile.goals = goalDefinitions[mode].map((item) => item.label);
  });

  state.goal = modeProfiles[state.mode].goals[0];

  function currentGoalDefinition() {
    return goalDefinitions[state.mode].find((item) => item.label === state.goal) || goalDefinitions[state.mode][0];
  }

  function reviewGoal(text) {
    const definition = currentGoalDefinition();
    const signalCount = (text.match(new RegExp(definition.pattern.source, "g")) || []).length;
    const met = signalCount > 0;
    return {
      label: definition.label,
      met,
      message: met
        ? `已在原稿中识别到与“${definition.label}”有关的文字信号。下一轮只要把这一处说得更具体即可。`
        : `这轮还没有看到“${definition.label}”的明显文字信号。${definition.tip}`,
      tip: definition.tip
    };
  }

  const baseRenderReport = renderReport;
  renderReport = function render2Point1Report() {
    baseRenderReport();
    const review = reviewGoal(state.report?.text || "");
    state.report.goalReview = review;
    $("#goalReview").innerHTML = `
      <div class="goal-review-head"><span>本轮目标核对</span><strong>${escapeHTML(review.met ? "已出现信号" : "下一轮带上")}</strong></div>
      <h2>${escapeHTML(review.label)}</h2>
      <p>${escapeHTML(review.message)}</p>
      <small>仅根据本轮文字中的可见表达信号判断，不是能力评分。</small>`;
    $("#goalReview").classList.toggle("met", review.met);
  };

  $("#saveSession").addEventListener("click", () => {
    if (!state.report?.goalReview) return;
    const sessions = JSON.parse(localStorage.getItem("speakGrowSessions") || "[]");
    if (!sessions.length) return;
    sessions[0].goal = state.report.goalReview.label;
    sessions[0].goalMet = state.report.goalReview.met;
    localStorage.setItem("speakGrowSessions", JSON.stringify(sessions.slice(0, 30)));
  });

  const baseRenderHistory = renderHistory;
  renderHistory = function render2Point1History() {
    baseRenderHistory();
    const sessions = JSON.parse(localStorage.getItem("speakGrowSessions") || "[]");
    $$(".history-item").forEach((item, index) => {
      const session = sessions[index];
      if (!session?.goal || item.querySelector(".history-goal")) return;
      item.querySelector("p").insertAdjacentHTML("beforeend", `<br><span class="history-goal">本轮目标：${escapeHTML(session.goal)}${session.goalMet ? " · 已出现信号" : " · 下次继续练"}</span>`);
    });
  };

  const favoriteStorageKey = "speakGrowFavoriteTopics";

  function readFavorites() {
    try {
      const favorites = JSON.parse(localStorage.getItem(favoriteStorageKey) || "[]");
      return Array.isArray(favorites) ? favorites : [];
    } catch (error) {
      return [];
    }
  }

  function favoriteId(mode, topic) {
    return `${mode}::${topic}`;
  }

  function refreshFavoriteButton() {
    const button = $("#favoriteTopic");
    const topic = $("#topicInput").value.trim();
    const saved = readFavorites().some((item) => item.id === favoriteId(state.mode, topic));
    button.textContent = saved ? "已收藏" : "收藏这道题";
    button.classList.toggle("active", saved);
    button.setAttribute("aria-pressed", String(saved));
  }

  function toggleFavorite() {
    const topic = $("#topicInput").value.trim();
    if (!topic) { showToast("先写下一道想练的题，再收藏。"); return; }
    const id = favoriteId(state.mode, topic);
    const favorites = readFavorites();
    const existingIndex = favorites.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      favorites.splice(existingIndex, 1);
      localStorage.setItem(favoriteStorageKey, JSON.stringify(favorites));
      showToast("已从常练题中移除。");
    } else {
      favorites.unshift({ id, mode: state.mode, topic, goal: state.goal, savedAt: Date.now() });
      localStorage.setItem(favoriteStorageKey, JSON.stringify(favorites.slice(0, 30)));
      showToast("已收藏。下次可从“我的常练题”继续练。");
    }
    refreshFavoriteButton();
  }

  function renderFavorites() {
    const favorites = readFavorites();
    $("#favoriteList").innerHTML = favorites.length ? favorites.map((item) => `
      <article class="history-item">
        <div><h3>${escapeHTML(item.topic || "未命名主题")}</h3><p>${escapeHTML(modeProfiles[item.mode]?.label || "主题表达")}<br><span class="history-goal">表达目标：${escapeHTML(item.goal || "先给出一个清晰观点")}</span></p></div>
        <div class="favorite-item-actions"><button class="open-favorite" type="button" data-open-favorite="${escapeHTML(item.id)}">带回练习</button><button class="remove-favorite" type="button" data-remove-favorite="${escapeHTML(item.id)}">移除</button></div>
      </article>`).join("") : '<div class="history-empty">还没有常练题。遇到值得再说一遍的题，点“收藏这道题”即可。</div>';
  }

  function showMenuDestination(screenId, beforeShow) {
    if (beforeShow) beforeShow();
    $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === screenId));
    $("#quickMenuPanel").hidden = true;
    $("#quickMenuToggle").setAttribute("aria-expanded", "false");
    window.requestAnimationFrame(() => $("#" + screenId).scrollIntoView({ behavior: "auto", block: "start" }));
  }

  if (!screens.includes("favoritesScreen")) screens.push("favoritesScreen");
  $("#favoriteTopic").addEventListener("click", toggleFavorite);
  $("#topicInput").addEventListener("input", refreshFavoriteButton);
  $("#randomTopic").addEventListener("click", () => window.setTimeout(refreshFavoriteButton, 2050));
  $$(".mode-option").forEach((button) => button.addEventListener("click", () => window.setTimeout(refreshFavoriteButton, 0)));
  $("#openPracticeChoices").addEventListener("click", () => {
    showMenuDestination("setupScreen");
    window.requestAnimationFrame(() => $("#practiceChoices").scrollIntoView({ behavior: "smooth", block: "start" }));
  });
  $("#openHistory").addEventListener("click", () => showMenuDestination("historyScreen", renderHistory));
  $("#openFavorites").addEventListener("click", () => showMenuDestination("favoritesScreen", renderFavorites));
  $("#favoriteList").addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-favorite]");
    const removeButton = event.target.closest("[data-remove-favorite]");
    const id = (openButton || removeButton)?.dataset.openFavorite || (openButton || removeButton)?.dataset.removeFavorite;
    if (!id) return;
    const favorites = readFavorites();
    const favorite = favorites.find((item) => item.id === id);
    if (removeButton) {
      localStorage.setItem(favoriteStorageKey, JSON.stringify(favorites.filter((item) => item.id !== id)));
      renderFavorites();
      return;
    }
    if (!favorite) return;
    state.mode = modeProfiles[favorite.mode] ? favorite.mode : "subject";
    state.goal = modeProfiles[state.mode].goals.includes(favorite.goal) ? favorite.goal : modeProfiles[state.mode].goals[0];
    $("#topicInput").value = favorite.topic;
    renderSetup();
    refreshFavoriteButton();
    showScreen("setupScreen");
    showToast("已带回常练题，可以直接开始。");
  });

  renderSetup();
  refreshFavoriteButton();
})();
