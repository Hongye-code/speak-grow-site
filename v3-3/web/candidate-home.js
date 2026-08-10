import config from "./candidate-config.js";

const $ = (selector) => document.querySelector(selector);
const profileTracks = { interview: "workplace", workplace: "workplace", improv: "workplace", smalltalk: "workplace", speech: "ideas", topic: "ideas" };
const routes = {
  workplace: [
    { code: "CAREER", icon: "◎", name: "职场面试", detail: "常规面试、自信专训", profile: "interview", topic: "我需要用一个项目案例说明结果、判断和证据。", module: "interview" },
    { code: "DEFAULT", icon: "↗", name: "协作推进", detail: "边界、优先级、下一步", profile: "workplace", topic: "我需要和同事对齐边界、优先级，并确认下一步。" },
    { code: "REPORT", icon: "→", name: "汇报故事", detail: "目标、主线、数据解释", profile: "workplace", topic: "我需要向领导汇报本周结果，并推动一个明确决定。" },
    { code: "SOCIAL", icon: "◌", name: "职场闲聊", detail: "破冰、倾听、自然回应", profile: "smalltalk", topic: "" }
  ],
  ideas: [
    { code: "IDEA", icon: "✦", name: "深度演讲", detail: "判断、证据、结尾", profile: "speech", topic: "我想讲清一个判断，并用一个例子证明它为什么重要。" },
    { code: "CLARITY", icon: "□", name: "主题表达", detail: "抽象、具体、收束", profile: "topic", topic: "我想把一个复杂概念换成身边场景，并用一句话收束。" }
  ]
};

export function mountCandidateHome({ selectProfile, setTopic, showAllProfiles, openInterview }) {
  const root = $("#candidateHome");
  if (!root) return { syncWithProfile: () => {} };

  root.dataset.variant = config.variant;
  document.title = config.browserTitle;
  document.querySelector('meta[name="description"]').setAttribute("content", config.description);
  $("#candidateEyebrow").textContent = config.eyebrow;
  $("#candidateTitle").textContent = config.title;
  $("#candidateDescription").textContent = config.description;
  $("#candidateGo").textContent = config.actionLabel;
  $("#candidateIntentWrap").hidden = !config.collectIntent;
  $("#workplaceTrackDescription").textContent = "面试、讲故事、闲聊、自信专训";
  $("#ideasTrackDescription").textContent = "深度演讲、主题表达";

  let selectedTrack = config.defaultTrack;
  let selectedItem = config.defaultItem || 0;
  let allProfilesVisible = false;
  const cards = [...root.querySelectorAll("[data-track]")];
  const route = $("#candidateRoute");
  const profileIndex = $(".candidate-profile-index");
  const profileTitle = $("#candidateProfilesTitle");

  function current() { return routes[selectedTrack][selectedItem]; }
  function renderRouteGrid() {
    allProfilesVisible = false;
    profileIndex.dataset.track = selectedTrack;
    profileTitle.textContent = selectedTrack === "workplace" ? "职场开口：选择一件当前要练的事" : "讲清想法：选择一件要说透的事";
    const grid = $("#modeGrid");
    grid.replaceChildren(...routes[selectedTrack].map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.mode = item.profile;
      button.classList.toggle("active", index === selectedItem);
      const code = document.createElement("span");
      code.textContent = `${String(index + 1).padStart(2, "0")} / ${item.code}`;
      const icon = document.createElement("i");
      icon.className = "mode-icon";
      icon.textContent = item.icon;
      icon.setAttribute("aria-hidden", "true");
      const name = document.createElement("strong");
      name.textContent = item.name;
      const detail = document.createElement("small");
      detail.textContent = item.detail;
      button.append(code, icon, name, detail);
      button.addEventListener("click", () => {
        selectedItem = index;
        selectProfile(item.profile);
        selectedItem = index;
        setTopic(item.topic);
        if (item.module === "interview") openInterview();
        renderRouteGrid();
      });
      return button;
    }));
    $("#candidateAllProfiles").textContent = "查看全部练习";
    $("#candidateAllProfiles").setAttribute("aria-expanded", "false");
  }
  function render() {
    cards.forEach((card) => {
      const active = card.dataset.track === selectedTrack;
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", String(active));
    });
    const lastRewrite = config.showLastRewrite ? (() => { try { return localStorage.getItem("speak-last-rewrite"); } catch { return ""; } })() : "";
    route.textContent = lastRewrite ? `上次你决定加强：“${lastRewrite}”` : `${config.routes[selectedTrack]} 即兴表达与本地录音可在“查看全部练习”中进入。`;
    if (!allProfilesVisible) renderRouteGrid();
  }
  function choose(track) {
    selectedTrack = track;
    selectedItem = 0;
    selectProfile(routes[track][0].profile);
    allProfilesVisible = false;
    render();
  }

  cards.forEach((card) => card.addEventListener("click", () => choose(card.dataset.track)));
  $("#candidateAllProfiles").addEventListener("click", () => {
    if (!allProfilesVisible) {
      showAllProfiles();
      allProfilesVisible = true;
      delete profileIndex.dataset.track;
      profileTitle.textContent = "全部原有练习";
      $("#candidateAllProfiles").textContent = "回到当前方向";
      $("#candidateAllProfiles").setAttribute("aria-expanded", "true");
      profileIndex.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    allProfilesVisible = false;
    render();
  });
  $("#candidateGo").addEventListener("click", () => {
    const item = current();
    selectProfile(item.profile);
    const intent = $("#candidateIntent").value.trim();
    setTopic(intent || item.topic);
    if (item.module === "interview") {
      openInterview();
      return;
    }
    if (config.startImmediately) {
      $("#startButton").click();
      return;
    }
    $("#topic").focus();
    $("#topic").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  selectProfile(current().profile);
  render();

  return {
    syncWithProfile(profileId) {
      if (allProfilesVisible) return;
      selectedTrack = profileTracks[profileId] || selectedTrack;
      const match = routes[selectedTrack].findIndex((item) => item.profile === profileId);
      selectedItem = match >= 0 ? match : 0;
      render();
    }
  };
}
