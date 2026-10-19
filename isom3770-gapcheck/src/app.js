/* ISOM 3770 · pre-exam gap-check — standalone app */
(() => {
  'use strict';

  const BANK = window.__BANK__ || [];
  const BY_ID = new Map(BANK.map((q) => [q.id, q]));
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
  const APP_VERSION = '1.0.0';
  const REVIEW_HREF = '../ISOM3770_review.html';
  const ACTIVE_KEY = 'isom3770-gapcheck.v1.active';
  const HISTORY_KEY = 'isom3770-gapcheck.v1.history';
  const THEME_KEY = 'isom3770-gapcheck.v1.theme';

  const SECTIONS = [];
  {
    const seen = new Map();
    for (const q of BANK) {
      if (!seen.has(q.section)) {
        seen.set(q.section, {
          id: q.section,
          name: q.sectionName,
          ids: [],
        });
      }
      seen.get(q.section).ids.push(q.id);
    }
    SECTIONS.push(...seen.values());
    SECTIONS.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  }

  const TYPE_META = {
    Concept: { zh: '概念理解', tone: 'blue' },
    Calculation: { zh: '公式计算', tone: 'amber' },
    Model: { zh: '模型构建', tone: 'teal' },
    Scenario: { zh: '情境应用', tone: 'violet' },
    Case: { zh: '案例分析', tone: 'teal' },
  };

  const state = {
    screen: 'setup',
    attempt: null,
    report: null,
    filter: 'all',
    setupCount: 100,
    setupMode: 'balanced',
    history: [],
  };

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function pct(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function uid() {
    try {
      if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (_) { /* ignore */ }
    return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    const two = (n) => String(n).padStart(2, '0');
    return hours ? `${hours}:${two(minutes)}:${two(rest)}` : `${two(minutes)}:${two(rest)}`;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function toast(message, kind = '') {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.className = `toast ${kind}`.trim();
    element.hidden = false;
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => { element.hidden = true; }, 3200);
  }

  function typeLabel(type) {
    return TYPE_META[type] ? TYPE_META[type].zh : type;
  }

  function difficultyLabel(level) {
    return level >= 3 ? '进阶' : level === 1 ? '基础' : '标准';
  }

  function priorityBadge(priority) {
    const label = { high: '高', mid: '中', low: '低', none: '—' }[priority] || '—';
    return `<span class="priority ${priority}">${label}</span>`;
  }

  function statusLabel(status) {
    return { correct: '正确', wrong: '答错', unknown: '不知道', unanswered: '未答' }[status] || status;
  }

  function statusBadge(status) {
    return `<span class="status-badge ${status}">${statusLabel(status)}</span>`;
  }

  function reviewTip(row) {
    if (row.status === 'correct') return '保持。用 30 秒复述本题考点，并说明其他选项为什么错。';
    if (row.status === 'unknown') return `先回看 ${row.code} ${row.topicTitle} 的定义/公式，再重做本题；不要靠排除法猜。`;
    if (row.type === 'Concept') return `回看 ${row.code} 的概念表述，比较正确项与你的选择的差别，写出误判原因。`;
    if (row.type === 'Calculation') return '重写公式与变量，检查单位、百分数和小数点；再做一个同型变式。';
    if (row.type === 'Model') return '先写变量、目标函数和约束，再对照本题的建模陷阱。';
    return `把本题情境映射到 ${row.code} 的决策规则，写出“为什么”，而不是只记答案。`;
  }

  function problemBadge(problem) {
    const cls = problem === '已掌握' ? 'low' : problem === '知识空白' ? 'mid' : problem === '空白 + 错误' ? 'high' : 'high';
    return `<span class="priority ${cls}">${esc(problem)}</span>`;
  }

  function reviewHref(section) {
    return `${REVIEW_HREF}${section ? `#sec-${encodeURIComponent(section.toLowerCase())}` : ''}`;
  }

  function modeLabel(config) {
    if (!config) return '模考';
    if (config.mode === 'weak') return '薄弱优先';
    if (config.mode === 'retry') return '错题重练';
    if (config.mode === 'section') return `只练 ${config.section || ''}`.trim();
    return '均衡覆盖';
  }

  function isAnswered(attempt, id) {
    const value = attempt.answers[id];
    return Number.isInteger(value) && value >= 0 && value <= 4;
  }

  function answeredCount(attempt) {
    return attempt.questionIds.filter((id) => isAnswered(attempt, id)).length;
  }

  function unknownCount(attempt) {
    return attempt.questionIds.filter((id) => attempt.answers[id] === 4).length;
  }

  function flaggedCount(attempt) {
    return attempt.questionIds.filter((id) => !!attempt.flags[id]).length;
  }

  /* ------------------------------------------------------------------ */
  /* sampling                                                            */
  /* ------------------------------------------------------------------ */

  function seededRandom(seed) {
    let value = (Number(seed) || 1) >>> 0;
    return () => {
      value |= 0;
      value = (value + 0x6D2B79F5) | 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, seed) {
    const result = items.slice();
    const random = seededRandom(seed);
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  function allocate(total, items, weightFor, capFor) {
    const rows = items.map((item) => ({
      item,
      add: 0,
      cap: Math.max(0, capFor(item)),
      frac: 0,
    }));
    const weights = rows.map((row) => Math.max(0, Number(weightFor(row.item)) || 0));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    let used = 0;
    rows.forEach((row, index) => {
      const exact = weightTotal > 0 ? (total * weights[index]) / weightTotal : total / rows.length;
      row.frac = exact - Math.floor(exact);
      row.add = Math.min(Math.floor(exact), row.cap);
      used += row.add;
    });
    let left = Math.max(0, total - used);
    rows.sort((a, b) => b.frac - a.frac || b.cap - a.cap);
    let guard = 0;
    while (left > 0 && guard++ < 500) {
      let progress = false;
      for (const row of rows) {
        if (left > 0 && row.add < row.cap) {
          row.add += 1;
          left -= 1;
          progress = true;
        }
      }
      if (!progress) break;
    }
    return new Map(rows.map((row) => [row.item.id, row.add]));
  }

  function sampleQuestionIds(count, mode, seed) {
    const total = BANK.length;
    const wanted = clamp(count, 1, total);
    if (wanted >= total) return shuffle(BANK.map((q) => q.id), seed);
    if (wanted < SECTIONS.length) return shuffle(BANK.map((q) => q.id), seed).slice(0, wanted);

    const previous = state.history[0];
    const gapBySection = new Map();
    if (previous && Array.isArray(previous.sections)) {
      for (const section of previous.sections) gapBySection.set(section.id, Number(section.gapRate) || 0);
    }
    const weightFor = (section) => {
      if (mode !== 'weak') return section.ids.length;
      return 1 + 2.6 * (gapBySection.get(section.id) || 0);
    };
    const capFor = (section) => Math.max(0, section.ids.length - 1);
    const extra = wanted - SECTIONS.length;
    const quotas = allocate(extra, SECTIONS, weightFor, capFor);

    const selected = [];
    SECTIONS.forEach((section, index) => {
      const take = 1 + (quotas.get(section.id) || 0);
      const shuffled = shuffle(section.ids, seed + index * 7919);
      selected.push(...shuffled.slice(0, Math.min(take, shuffled.length)));
    });
    return shuffle(selected, seed + 104729);
  }

  /* ------------------------------------------------------------------ */
  /* analysis                                                            */
  /* ------------------------------------------------------------------ */

  function analyze(attempt) {
    const rows = attempt.questionIds.map((id, index) => {
      const question = BY_ID.get(id);
      const raw = attempt.answers[id];
      const selected = Number.isInteger(raw) && raw >= 0 && raw <= 4 ? raw : null;
      let status = 'unanswered';
      if (selected !== null) {
        status = selected === 4 ? 'unknown' : selected === question.answer ? 'correct' : 'wrong';
      }
      return {
        ...question,
        examIndex: index,
        selected,
        status,
      };
    });

    const total = rows.length;
    const correct = rows.filter((row) => row.status === 'correct').length;
    const wrong = rows.filter((row) => row.status === 'wrong').length;
    const unknown = rows.filter((row) => row.status === 'unknown').length;
    const unanswered = rows.filter((row) => row.status === 'unanswered').length;
    const accuracy = total ? correct / total : 0;
    const effectiveAccuracy = correct + wrong ? correct / (correct + wrong) : 0;
    const gapCount = wrong + unknown;

    const group = (predicate) => {
      const items = rows.filter(predicate);
      const c = items.filter((row) => row.status === 'correct').length;
      const w = items.filter((row) => row.status === 'wrong').length;
      const u = items.filter((row) => row.status === 'unknown').length;
      return { n: items.length, correct: c, wrong: w, unknown: u, gap: w + u, gapRate: items.length ? (w + u) / items.length : 0 };
    };

    const sections = SECTIONS
      .filter((section) => rows.some((row) => row.section === section.id))
      .map((section) => {
        const stats = group((row) => row.section === section.id);
        return { id: section.id, name: section.name, ...stats, priority: priorityFor(stats.gapRate, stats.gap, stats.n) };
      })
      .sort((a, b) => b.gapRate - a.gapRate || b.gap - a.gap || a.id.localeCompare(b.id));

    const types = Object.keys(TYPE_META)
      .map((type) => ({ type, ...group((row) => row.type === type) }))
      .filter((item) => item.n > 0)
      .sort((a, b) => b.gapRate - a.gapRate || b.gap - a.gap);

    const topicMap = new Map();
    for (const row of rows) {
      if (!topicMap.has(row.topic)) {
        topicMap.set(row.topic, {
          code: row.code,
          title: row.topicTitle,
          topic: row.topic,
          section: row.section,
          sectionName: row.sectionName,
          category: row.category,
          ids: [],
          rows: [],
        });
      }
      const topic = topicMap.get(row.topic);
      topic.ids.push(row.id);
      topic.rows.push(row);
    }

    const topics = Array.from(topicMap.values()).map((topic) => {
      const c = topic.rows.filter((row) => row.status === 'correct').length;
      const w = topic.rows.filter((row) => row.status === 'wrong').length;
      const u = topic.rows.filter((row) => row.status === 'unknown').length;
      const gap = w + u;
      const conceptWrong = topic.rows.filter((row) => row.status === 'wrong' && row.type === 'Concept').length;
      const appliedWrong = topic.rows.filter((row) => row.status === 'wrong' && row.type !== 'Concept').length;
      let problem = '已掌握';
      if (gap > 0 && u > 0 && w === 0) problem = '知识空白';
      else if (gap > 0 && w > 0 && u === 0) problem = conceptWrong > 0 && appliedWrong === 0 ? '理解错误' : '应用不足';
      else if (gap > 0) problem = '空白 + 错误';
      return {
        code: topic.code,
        title: topic.title,
        topic: topic.topic,
        section: topic.section,
        sectionName: topic.sectionName,
        category: topic.category,
        n: topic.rows.length,
        correct: c,
        wrong: w,
        unknown: u,
        gap,
        gapRate: topic.rows.length ? gap / topic.rows.length : 0,
        conceptWrong,
        appliedWrong,
        problem,
        ids: topic.ids,
      };
    }).sort((a, b) => b.gapRate - a.gapRate || b.gap - a.gap || a.code.localeCompare(b.code));

    const gaps = topics.filter((topic) => topic.gap > 0);
    const strengths = topics
      .filter((topic) => topic.gap === 0 && topic.n >= 1)
      .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code))
      .slice(0, 8);

    const classification = {
      knowledge: unknown,
      understanding: rows.filter((row) => row.status === 'wrong' && row.type === 'Concept').length,
      application: rows.filter((row) => row.status === 'wrong' && row.type !== 'Concept').length,
    };

    const recommendations = gaps.slice(0, 8).map((topic) => {
      let action;
      if (topic.problem === '知识空白') {
        action = `先回看 ${topic.code} 的定义/公式，用自己的话复述，再做 2 道同知识点题。`;
      } else if (topic.problem === '理解错误') {
        action = `对比正确概念与干扰项，写出“为什么错”，再回看 ${topic.code} 的易错点。`;
      } else if (topic.problem === '应用不足') {
        action = `重做 ${topic.code} 的公式/建模步骤：先写变量和公式，再代入，检查单位与边界。`;
      } else {
        action = `先补 ${topic.code} 的定义，再做 2 道变式题；把错因写回复习页对应框。`;
      }
      return {
        code: topic.code,
        title: topic.title,
        section: topic.section,
        sectionName: topic.sectionName,
        problem: topic.problem,
        gap: topic.gap,
        unknown: topic.unknown,
        wrong: topic.wrong,
        n: topic.n,
        action,
        minutes: Math.min(30, 8 + topic.gap * 4 + (topic.n >= 3 ? 4 : 0)),
        ids: topic.ids,
      };
    });

    let band;
    if (accuracy >= 0.9) band = { key: 'good', label: '状态稳', note: '整体掌握较好，把剩余漏洞逐个清掉即可。' };
    else if (accuracy >= 0.8) band = { key: 'good', label: '基本稳', note: '基础扎实，但仍有可被命题人抓住的漏洞。' };
    else if (accuracy >= 0.7) band = { key: 'mid', label: '有明确漏洞', note: '按 Session 优先级补漏，比继续刷整套更有效。' };
    else if (accuracy >= 0.6) band = { key: 'mid', label: '风险较高', note: '先补高优先级章节，再重做错题与不知道的题。' };
    else band = { key: 'bad', label: '需要系统补漏', note: '建议先按知识点清单复习，再开始下一组模考。' };

    let headline;
    if (total && unknown === total) headline = '全部题目都标记为「不知道」：这是一次诚实的基线诊断，先按下面的优先级补知识点。';
    else if (total && unknown / total >= 0.35) headline = '知识空白较多：先把标为 E 的题对应知识点补上，再追求正确率。';
    else if (total && wrong / total >= 0.25) headline = '主要问题不是空白，而是理解或应用偏差：重点复盘错题为什么错。';
    else if (accuracy >= 0.85) headline = '整体掌握较好：把剩余漏洞逐个清掉即可。';
    else headline = '整体有基础，但漏洞集中在少数章节：按优先级补漏。';

    const previous = state.history.find((entry) => entry.id !== attempt.id);
    const comparison = previous ? {
      accuracy: previous.accuracy,
      delta: (accuracy - previous.accuracy) * 100,
      total: previous.total,
      submittedAt: previous.submittedAt,
    } : null;

    return {
      attemptId: attempt.id,
      config: attempt.config,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      durationSec: attempt.submittedAt
        ? Math.max(0, Math.round((Date.parse(attempt.submittedAt) - Date.parse(attempt.startedAt)) / 1000))
        : 0,
      total, correct, wrong, unknown, unanswered, gapCount,
      accuracy, effectiveAccuracy,
      band, headline, classification, sections, types, topics, gaps, strengths, recommendations,
      rows, comparison,
    };
  }

  function priorityFor(gapRate, gap, n) {
    if (!gap) return 'none';
    if (n < 3) return 'mid';
    if (gapRate >= 0.5) return 'high';
    if (gapRate >= 0.25) return 'mid';
    return 'low';
  }

  /* ------------------------------------------------------------------ */
  /* persistence                                                         */
  /* ------------------------------------------------------------------ */

  function persistAttempt() {
    if (!state.attempt) return;
    if (!writeJson(ACTIVE_KEY, state.attempt)) {
      toast('本机存储空间不足，当前进度可能无法自动保存。', 'bad');
    }
  }

  function loadActive() {
    const value = readJson(ACTIVE_KEY, null);
    if (!value || !Array.isArray(value.questionIds) || !value.questionIds.length) return null;
    if (!value.questionIds.every((id) => BY_ID.has(id))) return null;
    if (!value.answers || typeof value.answers !== 'object') value.answers = {};
    if (!value.flags || typeof value.flags !== 'object') value.flags = {};
    value.current = clamp(value.current, 0, value.questionIds.length - 1);
    if (!value.config) value.config = { mode: 'balanced', requestedCount: value.questionIds.length, label: '模考' };
    return value;
  }

  function pushHistory(report) {
    const entry = {
      id: report.attemptId,
      submittedAt: report.submittedAt,
      mode: report.config ? report.config.mode : 'balanced',
      requestedCount: report.config ? report.config.requestedCount : report.total,
      total: report.total,
      correct: report.correct,
      wrong: report.wrong,
      unknown: report.unknown,
      accuracy: report.accuracy,
      effectiveAccuracy: report.effectiveAccuracy,
      topGap: report.gaps[0] ? {
        code: report.gaps[0].code,
        title: report.gaps[0].title,
        section: report.gaps[0].section,
        problem: report.gaps[0].problem,
        gapRate: report.gaps[0].gapRate,
      } : null,
      sections: report.sections.map((section) => ({
        id: section.id,
        name: section.name,
        n: section.n,
        gap: section.gap,
        gapRate: section.gapRate,
      })),
    };
    state.history = [entry, ...state.history.filter((item) => item.id !== entry.id)].slice(0, 10);
    writeJson(HISTORY_KEY, state.history);
  }

  /* ------------------------------------------------------------------ */
  /* starting attempts                                                   */
  /* ------------------------------------------------------------------ */

  function startAttempt(options) {
    const seed = Math.floor(Math.random() * 2147483647) + 1;
    const requestedCount = Math.round(clamp(options.requestedCount || options.ids?.length || 100, 1, BANK.length));
    let ids;
    if (options.ids && options.ids.length) ids = shuffle(options.ids, seed);
    else ids = sampleQuestionIds(requestedCount, options.mode || 'balanced', seed);
    if (!ids.length) {
      toast('没有可抽取的题目。', 'bad');
      return;
    }
    const label = options.label || (options.mode === 'weak' ? '薄弱优先' : options.mode === 'section' ? `只练 ${options.section}` : '均衡覆盖');
    state.attempt = {
      id: uid(),
      createdAt: nowIso(),
      startedAt: nowIso(),
      config: {
        mode: options.mode || 'balanced',
        requestedCount: ids.length,
        baseCount: options.baseCount || requestedCount,
        section: options.section || null,
        label,
        seed,
      },
      questionIds: ids,
      answers: {},
      flags: {},
      current: 0,
      submitted: false,
      submittedAt: null,
    };
    state.screen = 'exam';
    state.report = null;
    state.filter = 'all';
    persistAttempt();
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function newBalancedAttempt() {
    const count = state.setupCount;
    const mode = state.setupMode === 'weak' && state.history.length ? 'weak' : 'balanced';
    startAttempt({ requestedCount: count, mode, baseCount: count });
  }

  function restartSame() {
    const report = state.report;
    if (!report) return newBalancedAttempt();
    const config = report.config || {};
    if (config.mode === 'section' && config.section) {
      const section = SECTIONS.find((item) => item.id === config.section);
      if (section) {
        const ids = shuffle(section.ids, Date.now()).slice(0, Math.min(10, section.ids.length));
        startAttempt({ ids, mode: 'section', section: section.id, requestedCount: ids.length, baseCount: config.baseCount || 10, label: `只练 ${section.id} · ${section.name}` });
        return;
      }
    }
    const count = config.mode === 'retry' ? (config.baseCount || 20) : (config.requestedCount || state.setupCount);
    const mode = config.mode === 'weak' && state.history.length ? 'weak' : 'balanced';
    startAttempt({ requestedCount: count, mode, baseCount: count });
  }

  function practiceSection(sectionId) {
    const section = SECTIONS.find((item) => item.id === sectionId);
    if (!section) return;
    const seed = Date.now();
    const ids = shuffle(section.ids, seed).slice(0, Math.min(10, section.ids.length));
    startAttempt({
      ids,
      mode: 'section',
      section: section.id,
      requestedCount: ids.length,
      baseCount: state.report?.config?.baseCount || state.setupCount,
      label: `只练 ${section.id} · ${section.name}`,
    });
  }

  function practiceTopic(topicCode) {
    const ids = BANK.filter((question) => question.topic === topicCode).map((question) => question.id);
    if (!ids.length) return;
    startAttempt({
      ids,
      mode: 'section',
      section: BY_ID.get(ids[0]).section,
      requestedCount: ids.length,
      baseCount: state.report?.config?.baseCount || state.setupCount,
      label: `知识点 ${topicCode}`,
    });
  }

  function retryGaps() {
    if (!state.report) return;
    const ids = state.report.rows
      .filter((row) => row.status === 'wrong' || row.status === 'unknown')
      .map((row) => row.id);
    if (!ids.length) {
      toast('这次没有错题或「不知道」，不需要重练。', 'good');
      return;
    }
    startAttempt({
      ids,
      mode: 'retry',
      requestedCount: ids.length,
      baseCount: state.report.config?.baseCount || state.report.total,
      label: `错题重练 · ${ids.length} 题`,
    });
  }

  /* ------------------------------------------------------------------ */
  /* render: setup                                                       */
  /* ------------------------------------------------------------------ */

  function themeIcon() {
    return document.documentElement.dataset.theme === 'dark' ? '☀' : '☾';
  }

  function renderSetup() {
    const active = state.attempt;
    const history = state.history;
    const hasHistory = history.length > 0;
    const count = clamp(state.setupCount, 10, 100);
    state.setupCount = count;
    const mode = state.setupMode === 'weak' && !hasHistory ? 'balanced' : state.setupMode;
    state.setupMode = mode;
    const estimated = Math.max(8, Math.round(count * 1.35));
    const activeBanner = active && !active.submitted
      ? `<div class="resume-banner">
          <div><b>上次还有一份未完成的作答</b><p>已答 ${answeredCount(active)} / ${active.questionIds.length} 题 · ${formatDate(active.startedAt)} · 进度保存在本机</p></div>
          <div class="btn-row"><button class="btn primary sm" id="resumeBtn">继续作答</button><button class="btn sm" id="discardBtn">放弃并重新开始</button></div>
        </div>`
      : active && active.submitted
        ? `<div class="resume-banner">
            <div><b>上次诊断已生成</b><p>${active.questionIds.length} 题 · ${formatDate(active.submittedAt)} · 可查看报告或开始新一组</p></div>
            <div class="btn-row"><button class="btn primary sm" id="viewReportBtn">查看上次诊断</button></div>
          </div>`
        : '';

    const historyHtml = history.length
      ? history.slice(0, 6).map((item) => `
          <div class="history-row">
            <div class="h-top"><b>${esc(formatDate(item.submittedAt))}</b> <span class="h-date">· ${esc(item.mode === 'retry' ? '错题重练' : item.mode === 'weak' ? '薄弱优先' : '均衡覆盖')} · ${item.total} 题</span></div>
            <div><b>${Math.round(item.accuracy * 100)}%</b> <span class="muted">正确</span> · ${item.unknown} 不知道</div>
            <div class="muted">${item.topGap ? `最弱：${esc(item.topGap.code)} ${esc(item.topGap.title)}` : '全部正确'}</div>
          </div>`).join('')
      : `<div class="history-empty">还没有诊断记录。完成第一组后，这里会保留最近 10 次的成绩和最弱 Session，用于「薄弱优先」出题。</div>`;

    const covered = SECTIONS.map((section) => `<span class="scope-chip">${esc(section.id)} ${esc(section.name)}</span>`).join('');

    $('#app').innerHTML = `
      <header class="site-head">
        <a class="brand" href="./" aria-label="ISOM 3770 gap check">
          <span class="brand-mark">37</span>
          <span class="brand-text"><b>ISOM 3770 · Midterm</b><span>Pre-exam gap check</span></span>
        </a>
        <div class="head-tools">
          <a class="btn sm" href="${reviewHref()}" target="_blank" rel="noopener">复习页 ↗</a>
          <button class="icon-btn" type="button" data-theme-toggle aria-label="切换深浅色">${themeIcon()}</button>
        </div>
      </header>
      <main class="shell setup" id="main">
        ${activeBanner}
        <section class="hero">
          <div class="hero-main">
            <div class="eyebrow">ISOM 3770 · Global Supply Chain Management</div>
            <h1>考前<em>查缺补漏</em><br>一次诚实的诊断</h1>
            <p class="lead">从 ${BANK.length} 道英文单选题中按你的选择抽题。不确定就选 <b>E「不知道」</b>，不要猜；交卷后按 Session、题型和知识点定位漏洞，并给出下一步复习顺序。</p>
            <div class="hero-badges">
              <span class="badge blue">A–E 单选 · E = 不知道</span>
              <span class="badge">English questions</span>
              <span class="badge teal">交卷后统一公布答案</span>
              <span class="badge">自动保存 · 可断点继续</span>
              <span class="badge amber">导出诊断 JSON</span>
            </div>
            <div class="btn-row">
              <button class="btn primary lg" id="heroStart">开始 ${count} 题诊断 <span aria-hidden="true">→</span></button>
              <a class="btn" href="${reviewHref()}" target="_blank" rel="noopener">先看复习页</a>
            </div>
          </div>
          <aside class="hero-side" aria-label="题库概况">
            <div class="mini-card"><div class="big">${BANK.length}<small>题</small></div><h3>题库覆盖</h3><p>12 个 Session · 69 个知识点 · 5 种题型；按上一版复习范围排除 S13、Gravity Model 与独立 Z/Loss 表。</p></div>
            <div class="mini-card"><div class="big">20<small>MC × 4.5</small></div><h3>真实考试形式</h3><p>期中为 20 道选择题 + 1 道长题（10 分）。本工具用于查缺补漏，不是原卷。</p></div>
            <div class="mini-card"><div class="big">0<small>外部依赖</small></div><h3>离线可用</h3><p>不调用 API；答题进度和诊断历史只保存在当前浏览器。</p></div>
          </aside>
        </section>

        <div class="setup-grid">
          <section class="card config-card" aria-labelledby="configTitle">
            <div class="eyebrow">Exam setup</div>
            <h2 id="configTitle">设置这次诊断</h2>
            <p class="sub">题量由你决定；默认 100 题覆盖全部题库。题量越少，越适合考前快速定位。</p>

            <div class="field">
              <div class="field-label"><span class="lab">题目数量</span><span class="hint">10–100 题</span></div>
              <div class="count-row">
                <div class="presets" id="presets">
                  ${[20, 40, 60, 80, 100].map((value) => `<button type="button" class="preset ${value === count ? 'on' : ''}" data-count="${value}">${value}</button>`).join('')}
                </div>
                <label class="count-box"><span class="count-prefix">自定义</span><input id="countInput" type="number" min="10" max="100" step="1" value="${count}" inputmode="numeric" aria-label="自定义题目数量"><span>题</span></label>
              </div>
            </div>

            <div class="field">
              <div class="field-label"><span class="lab">出题方式</span><span class="hint">${hasHistory ? `参考最近 ${history.length} 次诊断` : '完成一次后解锁薄弱优先'}</span></div>
              <div class="mode-list" role="radiogroup" aria-label="出题方式">
                <label class="mode-option ${mode === 'balanced' ? 'on' : ''}" data-mode="balanced">
                  <input type="radio" name="mode" value="balanced" ${mode === 'balanced' ? 'checked' : ''}>
                  <span class="mode-dot" aria-hidden="true"></span>
                  <span><b>均衡覆盖</b><small>按各 Session 题量比例抽取，尽量覆盖全范围。</small></span>
                </label>
                <label class="mode-option ${mode === 'weak' ? 'on' : ''} ${hasHistory ? '' : 'disabled'}" data-mode="weak">
                  <input type="radio" name="mode" value="weak" ${mode === 'weak' ? 'checked' : ''} ${hasHistory ? '' : 'disabled'}>
                  <span class="mode-dot" aria-hidden="true"></span>
                  <span><b>薄弱优先</b><small>${hasHistory ? '按上次各 Session 的漏洞率加权，弱项多出题。' : '完成一次诊断后可用。'}</small></span>
                </label>
              </div>
            </div>

            <div class="config-summary">
              <span>本次抽取 <b>${count}</b> 题</span>
              <span>·</span>
              <span>${count >= SECTIONS.length ? '覆盖全部 12 个 Session' : '随机覆盖部分 Session'}</span>
              <span>·</span>
              <span>预计 <b>${estimated}</b> 分钟</span>
            </div>

            <div class="start-row">
              <button class="btn primary lg" id="startBtn">开始 ${count} 题诊断</button>
              <span class="note">${active && !active.submitted ? '开始新一组会覆盖上面未完成的作答。' : '交卷前不显示答案；所有题目（含 E）作答后才能交卷。'}</span>
            </div>
          </section>

          <aside class="card how-card" aria-labelledby="howTitle">
            <div class="eyebrow teal">How it works</div>
            <h2 id="howTitle" style="font-size:19px;margin-top:5px">怎么用才有效</h2>
            <ol class="how-list">
              <li><b>不要猜。</b>不会就选 E。只有区分「不知道」和「答错」，诊断才能分清知识空白、理解错误和应用不足。</li>
              <li><b>一次做完。</b>题号可以跳转，进度自动保存；中途关掉浏览器也能继续。</li>
              <li><b>先看诊断，再重练。</b>交卷后按高优先级 Session 补漏，再用「错题重练」验证，而不是立刻刷下一套。</li>
            </ol>
            <div class="rule-callout"><b>交卷条件：</b>所有题都必须有选择。E 也是有效作答，但会计入「不知道」，不会伪装成错误。</div>
            <div class="history-card" style="padding:16px 0 0;margin-top:4px;box-shadow:none;border:0;background:transparent">
              <div class="card-head" style="margin-bottom:8px"><h3 style="font-size:13px">最近诊断</h3>${history.length ? '<button class="btn ghost sm" id="clearHistory">清空</button>' : ''}</div>
              <div class="history-list">${historyHtml}</div>
            </div>
          </aside>
        </div>

        <section class="card scope-card" aria-labelledby="scopeTitle">
          <div class="card-head" style="margin-bottom:0">
            <div><div class="eyebrow">Scope</div><h2 id="scopeTitle" style="font-size:18px;margin-top:3px">这次考什么 / 不考什么</h2></div>
            <span class="badge">按上一版复习范围</span>
          </div>
          <div class="scope-grid">
            <div class="scope-col"><h3>Covered</h3><div class="scope-chips">${covered}</div></div>
            <div class="scope-col"><h3>Excluded</h3><div class="scope-chips"><span class="scope-chip off">S13 考试形式说明</span><span class="scope-chip off">Gravity Model</span><span class="scope-chip off">独立 Z &amp; Loss Function 表</span></div><p class="small muted" style="margin-top:8px">S13 只说明考试形式，不进入题库；Gravity Model 与独立 Z/Loss 表按复习范围排除。Newsvendor 的临界比与 z 值计算仍可能考。</p></div>
          </div>
        </section>

        <footer class="small muted" style="padding:22px 2px 0;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <span>ISOM 3770 · Pre-exam gap check · v${APP_VERSION}</span>
          <span>答案与解析基于课程复习材料；本页不替代课堂讲解。</span>
        </footer>
      </main>`;

    bindSetupEvents();
  }

  function bindSetupEvents() {
    const start = () => {
      if (state.attempt && !state.attempt.submitted) {
        openDialog({
          title: '覆盖未完成的作答？',
          body: `<p>当前有一份未完成作答（已答 ${answeredCount(state.attempt)} / ${state.attempt.questionIds.length} 题）。开始新一组会覆盖它，但已交卷的诊断历史不受影响。</p>`,
          actions: [
            { label: '取消', kind: '' },
            { label: '覆盖并开始', kind: 'primary', onClick: newBalancedAttempt },
          ],
        });
        return;
      }
      newBalancedAttempt();
    };

    $('#heroStart')?.addEventListener('click', start);
    $('#startBtn')?.addEventListener('click', start);

    $('#countInput')?.addEventListener('input', (event) => {
      if (event.target.value === '') return;
      const value = Math.round(clamp(event.target.value, 10, 100));
      state.setupCount = value;
      $$('#presets .preset').forEach((button) => {
        button.classList.toggle('on', Number(button.dataset.count) === value);
      });
      const summary = $('.config-summary');
      if (summary) {
        const estimated = Math.max(8, Math.round(value * 1.35));
        summary.innerHTML = `<span>本次抽取 <b>${value}</b> 题</span><span>·</span><span>${value >= SECTIONS.length ? '覆盖全部 12 个 Session' : '随机覆盖部分 Session'}</span><span>·</span><span>预计 <b>${estimated}</b> 分钟</span>`;
      }
      const startButton = $('#startBtn');
      if (startButton) startButton.textContent = `开始 ${value} 题诊断`;
      const heroButton = $('#heroStart');
      if (heroButton) heroButton.innerHTML = `开始 ${value} 题诊断 <span aria-hidden="true">→</span>`;
    });

    $('#countInput')?.addEventListener('blur', (event) => {
      const value = Math.round(clamp(event.target.value || state.setupCount, 10, 100));
      event.target.value = String(value);
      state.setupCount = value;
    });

    $$('#presets .preset').forEach((button) => {
      button.addEventListener('click', () => {
        const value = Number(button.dataset.count);
        state.setupCount = value;
        const input = $('#countInput');
        if (input) input.value = String(value);
        $$('#presets .preset').forEach((item) => item.classList.toggle('on', item === button));
        const summary = $('.config-summary');
        if (summary) {
          const estimated = Math.max(8, Math.round(value * 1.35));
          summary.innerHTML = `<span>本次抽取 <b>${value}</b> 题</span><span>·</span><span>${value >= SECTIONS.length ? '覆盖全部 12 个 Session' : '随机覆盖部分 Session'}</span><span>·</span><span>预计 <b>${estimated}</b> 分钟</span>`;
        }
        const startButton = $('#startBtn');
        if (startButton) startButton.textContent = `开始 ${value} 题诊断`;
        const heroButton = $('#heroStart');
        if (heroButton) heroButton.innerHTML = `开始 ${value} 题诊断 <span aria-hidden="true">→</span>`;
      });
    });

    $$('.mode-option').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.classList.contains('disabled')) return;
        state.setupMode = button.dataset.mode;
        $$('.mode-option').forEach((item) => item.classList.toggle('on', item === button));
      });
    });

    $('#resumeBtn')?.addEventListener('click', () => {
      if (!state.attempt) return;
      state.screen = state.attempt.submitted ? 'report' : 'exam';
      if (state.attempt.submitted) state.report = analyze(state.attempt);
      render();
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    $('#viewReportBtn')?.addEventListener('click', () => {
      if (!state.attempt) return;
      state.report = analyze(state.attempt);
      state.screen = 'report';
      render();
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    $('#discardBtn')?.addEventListener('click', () => {
      openDialog({
        title: '放弃未完成的作答？',
        body: '<p>当前进度会被清除，且不能恢复。已交卷的诊断历史不受影响。</p>',
        actions: [
          { label: '取消', kind: '' },
          { label: '清除并重新开始', kind: 'danger', onClick: () => {
            state.attempt = null;
            try { localStorage.removeItem(ACTIVE_KEY); } catch (_) { /* ignore */ }
            newBalancedAttempt();
          } },
        ],
      });
    });

    $('#clearHistory')?.addEventListener('click', () => {
      openDialog({
        title: '清空诊断历史？',
        body: '<p>会删除最近 10 次的成绩与 Session 漏洞记录；当前未完成作答不受影响。清空后「薄弱优先」暂时不可用。</p>',
        actions: [
          { label: '取消', kind: '' },
          { label: '清空历史', kind: 'danger', onClick: () => {
            state.history = [];
            try { localStorage.removeItem(HISTORY_KEY); } catch (_) { /* ignore */ }
            renderSetup();
            toast('诊断历史已清空。', 'good');
          } },
        ],
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* render: exam                                                        */
  /* ------------------------------------------------------------------ */

  function renderExam() {
    const attempt = state.attempt;
    if (!attempt) { state.screen = 'setup'; render(); return; }
    $('#app').innerHTML = `
      <header class="exam-head">
        <div class="exam-head-inner">
          <div class="exam-title"><span class="dot" aria-hidden="true"></span>ISOM 3770 · 查缺补漏</div>
          <div class="exam-progress">
            <div class="progress-track" aria-hidden="true"><i id="headBar"></i></div>
            <span class="progress-label" id="headProgressText">0 / ${attempt.questionIds.length} 已答</span>
          </div>
          <span class="timer" id="timer" aria-label="已用时间">00:00</span>
          <button class="btn sm" id="exitBtn" type="button">退出</button>
          <button class="btn primary sm" id="submitTop" type="button" disabled>交卷</button>
        </div>
      </header>
      <main class="exam-layout" id="main">
        <section class="card q-card" aria-labelledby="qtext">
          <div class="q-meta" id="qmeta"></div>
          <h1 class="q-text" id="qtext" tabindex="-1"></h1>
          <div class="options" id="options" role="radiogroup" aria-labelledby="qtext"></div>
          <div class="q-actions">
            <div class="left">
              <button class="btn sm" id="prevBtn" type="button">← 上一题</button>
              <button class="btn sm" id="nextBtn" type="button">下一题 →</button>
            </div>
            <div class="right">
              <button class="btn sm flag-btn" id="flagBtn" type="button">标记</button>
              <button class="btn sm ghost" id="firstUnanswered" type="button">跳到未答</button>
            </div>
          </div>
          <div class="keyhint"><span><span class="kbd">A</span>–<span class="kbd">E</span> 选择</span><span><span class="kbd">←</span><span class="kbd">→</span> 翻题</span><span><span class="kbd">F</span> 标记</span></div>
        </section>
        <aside class="side" aria-label="答题卡">
          <div class="card side-card">
            <h3>进度</h3>
            <div class="side-stats">
              <div class="side-stat blue"><b id="pAnswered">0</b><span>已答</span></div>
              <div class="side-stat amber"><b id="pUnknown">0</b><span>不知道</span></div>
              <div class="side-stat"><b id="pFlagged">0</b><span>标记</span></div>
            </div>
            <button class="btn primary side-submit" id="submitSide" type="button" disabled>交卷并诊断</button>
            <div class="side-note" id="sideNote">所有题目（含 E）作答后才能交卷。</div>
          </div>
          <div class="card side-card palette-card">
            <details class="palette-wrap" id="paletteWrap" open>
              <summary><span class="side-title">题号导航</span></summary>
              <div class="palette" id="palette" role="navigation" aria-label="题号"></div>
              <div class="palette-legend"><span><i class="a"></i>已答</span><span><i class="u"></i>不知道</span><span><i class="f"></i>标记</span><span><i></i>未答</span></div>
            </details>
          </div>
          <button class="btn ghost side-exit" id="exitSide" type="button">保存并退出</button>
        </aside>
      </main>
      <div id="live" class="sr-only" aria-live="polite"></div>`;

    bindExamEvents();
    const paletteWrap = $('#paletteWrap');
    if (paletteWrap && window.matchMedia('(max-width: 860px)').matches) paletteWrap.open = false;
    renderQuestion();
    updateTimer();
  }

  function bindExamEvents() {
    $('#prevBtn')?.addEventListener('click', () => moveQuestion(-1));
    $('#nextBtn')?.addEventListener('click', () => moveQuestion(1));
    $('#flagBtn')?.addEventListener('click', toggleFlag);
    $('#firstUnanswered')?.addEventListener('click', jumpToFirstUnanswered);
    $('#submitTop')?.addEventListener('click', requestSubmit);
    $('#submitSide')?.addEventListener('click', requestSubmit);
    $('#exitBtn')?.addEventListener('click', requestExit);
    $('#exitSide')?.addEventListener('click', requestExit);
    $('#palette')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-jump]');
      if (!button) return;
      jumpTo(Number(button.dataset.jump));
    });
  }

  function currentQuestion() {
    if (!state.attempt) return null;
    const id = state.attempt.questionIds[state.attempt.current];
    return BY_ID.get(id) || null;
  }

  function renderQuestion() {
    const attempt = state.attempt;
    const question = currentQuestion();
    if (!attempt || !question) return;
    const index = attempt.current;
    const total = attempt.questionIds.length;
    const meta = $('#qmeta');
    if (meta) {
      meta.innerHTML = `
        <span class="chip primary">Q ${index + 1} / ${total}</span>
        <span class="chip">${esc(question.section)} · ${esc(question.sectionName)}</span>
        <span class="chip">${esc(question.code)} ${esc(question.topicTitle)}</span>
        <span class="chip amber">${esc(question.type)} · ${esc(typeLabel(question.type))}</span>
        <span class="chip">${esc(difficultyLabel(question.difficulty))}</span>`;
    }
    const text = $('#qtext');
    if (text) text.textContent = question.question;
    const options = $('#options');
    if (options) {
      options.replaceChildren();
      const choices = question.options.concat(["不知道 / I don't know"]);
      choices.forEach((choice, choiceIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'option' + (choiceIndex === 4 ? ' dontknow' : '');
        button.dataset.opt = String(choiceIndex);
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', String(attempt.answers[question.id] === choiceIndex));
        const letter = document.createElement('span');
        letter.className = 'letter';
        letter.textContent = LETTERS[choiceIndex];
        const content = document.createElement('span');
        content.className = 'opt-text';
        const textSpan = document.createElement('span');
        textSpan.textContent = choice;
        content.append(textSpan);
        if (choiceIndex === 4) {
          const note = document.createElement('span');
          note.className = 'opt-note';
          note.textContent = '不确定时请选此项；用于识别知识空白，不要盲猜。';
          content.append(note);
        }
        button.append(letter, content);
        button.addEventListener('click', () => selectOption(choiceIndex));
        options.append(button);
      });
    }
    const prev = $('#prevBtn');
    const next = $('#nextBtn');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === total - 1;
    const flag = $('#flagBtn');
    if (flag) {
      flag.classList.toggle('on', !!attempt.flags[question.id]);
      flag.textContent = attempt.flags[question.id] ? '已标记' : '标记';
    }
    paintOptions();
    paintPalette();
    paintProgress();
  }

  function paintOptions() {
    const attempt = state.attempt;
    const question = currentQuestion();
    if (!attempt || !question) return;
    $$('#options [data-opt]').forEach((button) => {
      const selected = attempt.answers[question.id] === Number(button.dataset.opt);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
  }

  function paintPalette() {
    const attempt = state.attempt;
    const palette = $('#palette');
    if (!attempt || !palette) return;
    const fragment = document.createDocumentFragment();
    attempt.questionIds.forEach((id, index) => {
      const question = BY_ID.get(id);
      const answer = attempt.answers[id];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pnum';
      if (Number.isInteger(answer)) button.classList.add(answer === 4 ? 'unknown' : 'answered');
      if (attempt.flags[id]) button.classList.add('flagged');
      if (index === attempt.current) button.classList.add('current');
      button.textContent = String(index + 1);
      button.dataset.jump = String(index);
      button.title = `${index + 1}. ${question.section} · ${question.code} ${question.topicTitle}`;
      button.setAttribute('aria-label', `第 ${index + 1} 题，${question.section}，${Number.isInteger(answer) ? (answer === 4 ? '不知道' : '已答') : '未答'}${attempt.flags[id] ? '，已标记' : ''}`);
      fragment.append(button);
    });
    palette.replaceChildren(fragment);
  }

  function paintProgress() {
    const attempt = state.attempt;
    if (!attempt) return;
    const total = attempt.questionIds.length;
    const answered = answeredCount(attempt);
    const unknown = unknownCount(attempt);
    const flagged = flaggedCount(attempt);
    const setText = (selector, value) => { const element = $(selector); if (element) element.textContent = String(value); };
    setText('#pAnswered', answered);
    setText('#pUnknown', unknown);
    setText('#pFlagged', flagged);
    setText('#headProgressText', `${answered} / ${total} 已答`);
    const bar = $('#headBar');
    if (bar) bar.style.width = `${total ? (answered / total) * 100 : 0}%`;
    const disabled = answered !== total;
    ['#submitTop', '#submitSide'].forEach((selector) => {
      const button = $(selector);
      if (button) button.disabled = disabled;
    });
    const side = $('#submitSide');
    if (side) side.textContent = disabled ? `还差 ${total - answered} 题` : '交卷并诊断';
    const note = $('#sideNote');
    if (note) note.textContent = disabled ? '所有题目（含 E）作答后才能交卷。' : '已全部作答，可以交卷。';
    const first = $('#firstUnanswered');
    if (first) {
      const hasUnanswered = attempt.questionIds.some((id) => !isAnswered(attempt, id));
      first.disabled = !hasUnanswered;
      first.textContent = hasUnanswered ? '跳到未答' : '已全部作答';
    }
  }

  function selectOption(choiceIndex) {
    const attempt = state.attempt;
    const question = currentQuestion();
    if (!attempt || !question || attempt.submitted) return;
    attempt.answers[question.id] = choiceIndex;
    persistAttempt();
    paintOptions();
    paintPalette();
    paintProgress();
    const live = $('#live');
    if (live) live.textContent = `第 ${attempt.current + 1} 题已选择 ${LETTERS[choiceIndex]}${choiceIndex === 4 ? '，不知道' : ''}。`;
  }

  function moveQuestion(delta) {
    const attempt = state.attempt;
    if (!attempt) return;
    const next = attempt.current + delta;
    if (next < 0 || next >= attempt.questionIds.length) return;
    jumpTo(next);
  }

  function jumpTo(index) {
    const attempt = state.attempt;
    if (!attempt) return;
    attempt.current = clamp(index, 0, attempt.questionIds.length - 1);
    persistAttempt();
    renderQuestion();
    const text = $('#qtext');
    if (text) text.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function jumpToFirstUnanswered() {
    const attempt = state.attempt;
    if (!attempt) return;
    const index = attempt.questionIds.findIndex((id) => !isAnswered(attempt, id));
    if (index < 0) {
      toast('所有题目都已作答。', 'good');
      return;
    }
    jumpTo(index);
  }

  function toggleFlag() {
    const attempt = state.attempt;
    const question = currentQuestion();
    if (!attempt || !question) return;
    if (attempt.flags[question.id]) delete attempt.flags[question.id];
    else attempt.flags[question.id] = true;
    persistAttempt();
    renderQuestion();
  }

  function requestExit() {
    openDialog({
      title: '保存并退出？',
      body: `<p>当前进度会保存在本机，下次打开可从「继续作答」恢复。已答 ${answeredCount(state.attempt)} / ${state.attempt.questionIds.length} 题。</p>`,
      actions: [
        { label: '继续作答', kind: '' },
        { label: '保存并退出', kind: 'primary', onClick: () => {
          persistAttempt();
          state.screen = 'setup';
          render();
          window.scrollTo({ top: 0, behavior: 'auto' });
        } },
      ],
    });
  }

  function requestSubmit() {
    const attempt = state.attempt;
    if (!attempt) return;
    const total = attempt.questionIds.length;
    const answered = answeredCount(attempt);
    const unknown = unknownCount(attempt);
    const flagged = flaggedCount(attempt);
    if (answered < total) {
      const first = attempt.questionIds.findIndex((id) => !isAnswered(attempt, id));
      openDialog({
        title: `还有 ${total - answered} 题未作答`,
        body: `<p>交卷前必须给每道题一个选择。不会的题请选 <b>E「不知道」</b>，不要留空，也不要猜。</p>`,
        actions: [
          { label: '继续作答', kind: '' },
          { label: '跳到第一道未答', kind: 'primary', onClick: () => jumpTo(first) },
        ],
      });
      return;
    }
    openDialog({
      title: '确认交卷？',
      body: `<p>交卷后会立即显示答案、逐题解析和知识漏洞诊断，且本次作答不能再修改。</p>
        <div class="dialog-stats">
          <span class="badge blue">${total} 题</span>
          <span class="badge amber">${unknown} 题不知道</span>
          <span class="badge">${flagged} 题标记</span>
        </div>`,
      actions: [
        { label: '再检查一下', kind: '' },
        { label: '确认交卷并诊断', kind: 'primary', onClick: submitAttempt },
      ],
    });
  }

  function submitAttempt() {
    const attempt = state.attempt;
    if (!attempt) return;
    if (answeredCount(attempt) !== attempt.questionIds.length) {
      toast('还有题目未作答。', 'bad');
      return;
    }
    attempt.submitted = true;
    attempt.submittedAt = nowIso();
    const report = analyze(attempt);
    state.report = report;
    pushHistory(report);
    persistAttempt();
    state.screen = 'report';
    state.filter = 'all';
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function updateTimer() {
    const timer = $('#timer');
    if (!timer || !state.attempt) return;
    if (state.attempt.submitted) {
      timer.textContent = formatDuration(Math.max(0, (Date.parse(state.attempt.submittedAt) - Date.parse(state.attempt.startedAt)) / 1000));
      return;
    }
    timer.textContent = formatDuration((Date.now() - Date.parse(state.attempt.startedAt)) / 1000);
  }

  /* ------------------------------------------------------------------ */
  /* render: report                                                      */
  /* ------------------------------------------------------------------ */

  function renderReport() {
    const attempt = state.attempt;
    let report = state.report;
    if (!report && attempt) report = analyze(attempt);
    if (!report) { state.screen = 'setup'; render(); return; }
    state.report = report;

    const accuracyPct = Math.round(report.accuracy * 1000) / 10;
    const comparison = report.comparison;
    const deltaClass = comparison ? (comparison.delta >= 0 ? 'teal' : 'red') : '';
    const deltaText = comparison
      ? `较上次 ${comparison.delta >= 0 ? '+' : ''}${comparison.delta.toFixed(1)} pp`
      : '首次诊断';
    const submitted = formatDate(report.submittedAt);

    const sectionRows = report.sections.map((section) => `
      <tr>
        <td><b>${esc(section.id)}</b> · ${esc(section.name)}</td>
        <td class="num">${section.n}</td>
        <td class="num">${section.correct}</td>
        <td class="num">${section.wrong}</td>
        <td class="num">${section.unknown}</td>
        <td><div class="bar-cell"><div class="mini-track"><i style="width:${Math.round(section.gapRate * 100)}%"></i></div><span>${Math.round(section.gapRate * 100)}%</span></div></td>
        <td>${priorityBadge(section.priority)}</td>
        <td><button class="btn sm" type="button" data-practice-section="${esc(section.id)}" title="只练 ${esc(section.id)} · 10 题" aria-label="只练 ${esc(section.id)}">练</button></td>
      </tr>`).join('');

    const typeRows = report.types.map((type) => `
      <tr>
        <td><b>${esc(typeLabel(type.type))}</b> <span class="muted small">${esc(type.type)}</span></td>
        <td class="num">${type.n}</td>
        <td class="num">${type.correct}</td>
        <td class="num">${type.wrong}</td>
        <td class="num">${type.unknown}</td>
        <td><div class="bar-cell"><div class="mini-track"><i style="width:${Math.round(type.gapRate * 100)}%"></i></div><span>${Math.round(type.gapRate * 100)}%</span></div></td>
      </tr>`).join('');

    const topicRows = report.topics.map((topic) => `
      <tr>
        <td><b>${esc(topic.code)}</b><br><span class="muted small">${esc(topic.title)}</span></td>
        <td>${esc(topic.section)}</td>
        <td class="num">${topic.n}</td>
        <td class="num">${topic.correct}</td>
        <td class="num">${topic.wrong}</td>
        <td class="num">${topic.unknown}</td>
        <td>${problemBadge(topic.problem)}</td>
        <td><a class="section-link" href="${reviewHref(topic.section)}" target="_blank" rel="noopener">复习</a>${topic.gap ? ` <button class="btn sm ghost" type="button" data-practice-topic="${esc(topic.topic)}">练</button>` : ''}</td>
      </tr>`).join('');

    const gapCards = report.gaps.length ? report.gaps.slice(0, 8).map((gap) => `
      <div class="gap-card ${gap.gapRate >= 0.5 ? '' : gap.gapRate >= 0.25 ? 'med' : 'low'}">
        <div class="gap-top"><b><span class="gap-code">${esc(gap.code)}</span>${esc(gap.title)}</b>${problemBadge(gap.problem)}</div>
        <p>${esc(gap.sectionName)} · ${gap.n} 题中 ${gap.gap} 个漏洞（答错 ${gap.wrong} / 不知道 ${gap.unknown}）</p>
        <div class="gap-act"><b>下一步：</b>${esc(gap.problem === '知识空白' ? `先回看 ${gap.code} 的定义/公式，再用自己的话复述；随后做 2 道同知识点题。` : gap.problem === '理解错误' ? `对比正确概念与干扰项，写出「为什么错」；回到 ${gap.code} 的易错点。` : gap.problem === '应用不足' ? `重做 ${gap.code} 的公式/建模步骤：先写变量与公式，再代入，检查单位和边界。` : `先补 ${gap.code} 的定义，再做 2 道变式题；把错因写回复习页对应框。`)}</div>
        <button class="btn sm" type="button" data-practice-topic="${esc(gap.topic)}">练这些题</button>
      </div>`).join('') : '<div class="empty-state">本次没有识别到知识漏洞。可以换一组题，或进入复习页看易错点。</div>';

    const strengths = report.strengths.length
      ? report.strengths.map((topic) => `<span class="strength-chip">${esc(topic.code)} ${esc(topic.title)}</span>`).join('')
      : '<span class="muted small">本次没有达到「全对」的知识点；先按上面的优先级补漏。</span>';

    const defaultFilter = report.total >= 50 && report.gapCount > 0 ? 'gaps' : 'all';
    const reviewFilters = [
      ['all', `全部 ${report.total}`],
      ['gaps', `错题+不知道 ${report.gapCount}`],
      ['wrong', `答错 ${report.wrong}`],
      ['unknown', `不知道 ${report.unknown}`],
      ['flagged', `标记 ${flaggedCount(attempt)}`],
      ['correct', `正确 ${report.correct}`],
    ];

    $('#app').innerHTML = `
      <header class="site-head">
        <a class="brand" href="./" aria-label="返回设置">
          <span class="brand-mark">37</span>
          <span class="brand-text"><b>ISOM 3770 · Diagnostic</b><span>Knowledge gap report</span></span>
        </a>
        <div class="head-tools">
          <button class="btn sm" type="button" id="printBtn">打印 / PDF</button>
          <button class="icon-btn" type="button" data-theme-toggle aria-label="切换深浅色">${themeIcon()}</button>
        </div>
      </header>
      <main class="shell report" id="main">
        <section class="report-hero">
          <div class="report-hero-grid">
            <div>
              <div class="eyebrow">Diagnostic report · ${esc(submitted)}</div>
              <h1>考前知识漏洞诊断</h1>
              <p class="lead">${esc(report.headline)}</p>
              <div class="btn-row" style="margin-top:10px">
                <span class="band ${report.band.key}">${esc(report.band.label)}</span>
                <span class="badge ${deltaClass}">${esc(deltaText)}</span>
                <span class="badge">${esc(modeLabel(report.config))} · ${report.total} 题</span>
                <span class="badge">用时 ${formatDuration(report.durationSec)}</span>
              </div>
              <div class="report-actions">
                <button class="btn primary" type="button" id="exportBtn">导出诊断 JSON</button>
                <button class="btn" type="button" id="copyBtn">复制 JSON</button>
                <button class="btn" type="button" id="retryBtn" ${report.gapCount ? '' : 'disabled'}>重练错题与不知道</button>
                <button class="btn" type="button" id="restartBtn">再练一组</button>
                <button class="btn ghost" type="button" id="setupBtn">返回设置</button>
              </div>
            </div>
            <div>
              <div class="score-block"><span class="score-num">${accuracyPct}</span><span class="score-den">%</span></div>
              <div class="score-cap">全卷正确率 · ${report.correct} / ${report.total}</div>
              <div class="score-cap">有效正确率（不含不知道）· ${Math.round(report.effectiveAccuracy * 1000) / 10}%</div>
              <div class="band ${report.band.key}" style="margin-top:12px">${esc(report.band.note)}</div>
            </div>
          </div>
          <div class="stack" aria-label="答题结果分布">
            <i class="s-correct" style="width:${(report.correct / report.total) * 100}%"></i>
            <i class="s-wrong" style="width:${(report.wrong / report.total) * 100}%"></i>
            <i class="s-unknown" style="width:${(report.unknown / report.total) * 100}%"></i>
            <i class="s-unanswered" style="width:${(report.unanswered / report.total) * 100}%"></i>
          </div>
          <div class="stack-legend"><span><i style="background:var(--green)"></i>正确 ${report.correct}</span><span><i style="background:var(--red)"></i>答错 ${report.wrong}</span><span><i style="background:var(--amber)"></i>不知道 ${report.unknown}</span>${report.unanswered ? `<span><i style="background:var(--line-strong)"></i>未答 ${report.unanswered}</span>` : ''}</div>
        </section>

        <section class="stats-grid" aria-label="整体成绩">
          <div class="stat-card correct"><span>正确</span><b>${report.correct}</b><small>${pct(report.accuracy)} 全卷</small></div>
          <div class="stat-card wrong"><span>答错</span><b>${report.wrong}</b><small>理解或应用偏差</small></div>
          <div class="stat-card unknown"><span>不知道</span><b>${report.unknown}</b><small>主动标记的知识空白</small></div>
          <div class="stat-card rate"><span>有效正确率</span><b>${Math.round(report.effectiveAccuracy * 100)}%</b><small>排除 E 后：${report.correct}/${report.correct + report.wrong || 0}</small></div>
        </section>

        <div class="report-grid">
          <section class="card panel">
            <h2>一、把漏洞分成三类</h2>
            <p class="panel-sub">「不知道」按知识空白计；答错再按题型分为理解错误和应用不足。三者复习动作不同。</p>
            <div class="class-grid">
              <div class="class-card knowledge"><span>知识空白</span><b>${report.classification.knowledge}</b><small>选 E 的题：先补定义、公式和例子。</small></div>
              <div class="class-card understanding"><span>理解错误</span><b>${report.classification.understanding}</b><small>概念题答错：对比干扰项，复述正确表述。</small></div>
              <div class="class-card application"><span>应用不足</span><b>${report.classification.application}</b><small>计算/建模/情境/案例答错：重做步骤。</small></div>
            </div>
            <div class="divider"></div>
            <h2>二、章节诊断</h2>
            <p class="panel-sub">按漏洞率从高到低。题数少于 3 的章节最多标为中，避免小样本误导。</p>
            <div class="table-wrap">
              <table class="data compact">
                <thead><tr><th>Session</th><th class="num">题数</th><th class="num">正确</th><th class="num">答错</th><th class="num">不知道</th><th>漏洞率</th><th>优先级</th><th>练</th></tr></thead>
                <tbody>${sectionRows || '<tr><td colspan="8" class="empty-state">没有章节数据。</td></tr>'}</tbody>
              </table>
            </div>
            <div class="tip-box"><b>怎么读：</b>先看「高」优先级章节，再点该行的「练」做 10 题验证。不要只按章节题数排序——S6 题多不代表它最弱。</div>

            <div class="divider"></div>
            <h2>五、已经稳的部分</h2>
            <p class="panel-sub">这些知识点本次全对，可以暂时少花时间。</p>
            <div class="strength-list">${strengths}</div>
          </section>

          <aside class="card panel">
            <h2>三、题型诊断</h2>
            <p class="panel-sub">同一章节可能「概念会、计算不会」，这里看能力类型。</p>
            <div class="table-wrap">
              <table class="data" style="min-width:0">
                <thead><tr><th>题型</th><th class="num">题</th><th class="num">对</th><th class="num">错</th><th class="num">不知道</th><th>漏洞率</th></tr></thead>
                <tbody>${typeRows || '<tr><td colspan="6" class="empty-state">没有题型数据。</td></tr>'}</tbody>
              </table>
            </div>

            <div class="divider"></div>
            <h2>四、优先补漏</h2>
            <p class="panel-sub">按漏洞数量、不知道数量和章节优先级排序；建议从上往下做。</p>
            <div class="gap-list">${gapCards}</div>

          </aside>
        </div>

        <section class="card panel" style="margin-top:18px">
          <h2>六、知识点逐项诊断</h2>
          <p class="panel-sub">每个知识点对应复习页的一个知识框。点「复习」回到对应 Session，点「练」只做该知识点的题。</p>
          <div class="table-wrap">
            <table class="data" style="min-width:760px">
              <thead><tr><th>知识点</th><th>Session</th><th class="num">题数</th><th class="num">正确</th><th class="num">答错</th><th class="num">不知道</th><th>问题类型</th><th>动作</th></tr></thead>
              <tbody>${topicRows || '<tr><td colspan="8" class="empty-state">没有知识点数据。</td></tr>'}</tbody>
            </table>
          </div>
        </section>

        <section class="card review-panel">
          <div class="card-head" style="margin-bottom:0">
            <div><h2>七、逐题解析</h2><p class="panel-sub" style="margin-bottom:0">交卷后解锁。答错和「不知道」优先看；每道题都标了对应知识点。</p></div>
            <span class="badge">${report.total} 题</span>
          </div>
          <div class="review-tools">
            <div class="filters" id="reviewFilters">
              ${reviewFilters.map(([key, label]) => `<button class="filter ${key === defaultFilter ? 'on' : ''}" type="button" data-filter="${key}">${label}</button>`).join('')}
            </div>
            <span class="muted small">${defaultFilter === 'gaps' ? '默认显示错题与不知道；点「全部」看完整解析。' : '按 E 的题不会显示成“答错”，而是单独归为知识空白。'}</span>
          </div>
          <div class="review-list" id="reviewList"></div>
        </section>

        <footer class="small muted" style="padding:22px 2px 0;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <span>ISOM 3770 · Pre-exam gap check · v${APP_VERSION}</span>
          <span>导出的 JSON 包含答题明细、章节/题型/知识点诊断和复习建议。</span>
        </footer>
      </main>`;

    bindReportEvents();
    renderReview(defaultFilter);
  }

  function bindReportEvents() {
    $('#exportBtn')?.addEventListener('click', () => {
      const payload = buildExportPayload();
      if (!payload) return;
      downloadJson(payload);
    });
    $('#copyBtn')?.addEventListener('click', async () => {
      const payload = buildExportPayload();
      if (!payload) return;
      const text = JSON.stringify(payload, null, 2);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error('clipboard unavailable');
        }
        toast('诊断 JSON 已复制，可直接粘贴给聊天 AI。', 'good');
      } catch (_) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          toast('诊断 JSON 已复制。', 'good');
        } catch (error) {
          toast('复制失败，请用「导出诊断 JSON」下载文件。', 'bad');
        }
        textarea.remove();
      }
    });
    $('#retryBtn')?.addEventListener('click', retryGaps);
    $('#restartBtn')?.addEventListener('click', restartSame);
    $('#setupBtn')?.addEventListener('click', () => {
      state.screen = 'setup';
      render();
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    $('#printBtn')?.addEventListener('click', () => window.print());
    $('#reviewFilters')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      const filter = button.dataset.filter;
      state.filter = filter;
      $$('#reviewFilters .filter').forEach((item) => item.classList.toggle('on', item === button));
      renderReview(filter);
    });
  }

  function renderReview(filter) {
    const report = state.report;
    const attempt = state.attempt;
    const list = $('#reviewList');
    if (!report || !attempt || !list) return;
    const rows = report.rows.filter((row) => {
      if (filter === 'gaps') return row.status === 'wrong' || row.status === 'unknown';
      if (filter === 'wrong') return row.status === 'wrong';
      if (filter === 'unknown') return row.status === 'unknown';
      if (filter === 'correct') return row.status === 'correct';
      if (filter === 'flagged') return !!attempt.flags[row.id];
      return true;
    });

    if (!rows.length) {
      list.innerHTML = `<div class="empty-state">这个筛选下没有题目。</div>`;
      return;
    }

    list.innerHTML = rows.map((row) => {
      const selectedText = row.selected === null
        ? '未作答'
        : `<b>${LETTERS[row.selected]}.</b> ${esc(row.selected === 4 ? "不知道 / I don't know" : row.options[row.selected])}`;
      const options = row.options.map((option, index) => {
        const classes = ['review-opt'];
        if (index === row.answer) classes.push('correct');
        if (index === row.selected && index !== row.answer) classes.push('picked-wrong');
        return `<div class="${classes.join(' ')}"><span class="rl">${LETTERS[index]}.</span><span>${esc(option)}</span></div>`;
      }).join('');
      const unknownRow = row.selected === 4 && row.answer !== 4
        ? `<div class="review-opt picked-unknown"><span class="rl">E.</span><span>不知道 / I don't know（你的选择）</span></div>`
        : '';
      return `
        <article class="review-item ${row.status}">
          <div class="review-top">
            <span class="rid">#${row.id}</span>
            <span class="badge">${esc(row.section)} · ${esc(row.code)}</span>
            <span class="badge">${esc(row.type)}</span>
            <span class="badge">${esc(difficultyLabel(row.difficulty))}</span>
            ${statusBadge(row.status)}
          </div>
          <div class="review-q">${esc(row.question)}</div>
          <div class="review-opts">${options}${unknownRow}</div>
          <div class="review-explain"><b>正确答案：</b>${LETTERS[row.answer]}. ${esc(row.options[row.answer])}<br><b>你的选择：</b>${selectedText}<br><b>解析：</b>${esc(row.explain)}<br><b>重点复习建议：</b>${esc(reviewTip(row))}</div>
          <div class="review-meta"><span>${esc(row.sectionName)} · ${esc(row.code)} ${esc(row.topicTitle)}</span><a href="${reviewHref(row.section)}" target="_blank" rel="noopener">回复习页看这一节 ↗</a></div>
        </article>`;
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* export                                                              */
  /* ------------------------------------------------------------------ */

  function buildExportPayload() {
    const report = state.report;
    const attempt = state.attempt;
    if (!report || !attempt) return null;
    return {
      schemaVersion: 'isom3770.gapcheck.v1',
      app: {
        name: 'ISOM 3770 Pre-exam Gap Check',
        version: APP_VERSION,
        exportedAt: nowIso(),
        course: 'ISOM 3770 Global Supply Chain Management',
        scopeNote: 'Sessions 1–12; excludes S13, Gravity Model, and standalone Z & Loss Function table.',
      },
      exam: {
        attemptId: report.attemptId,
        config: report.config,
        startedAt: report.startedAt,
        submittedAt: report.submittedAt,
        durationSec: report.durationSec,
        total: report.total,
      },
      summary: {
        total: report.total,
        correct: report.correct,
        wrong: report.wrong,
        unknown: report.unknown,
        unanswered: report.unanswered,
        gapCount: report.gapCount,
        accuracy: round3(report.accuracy),
        accuracyPercent: round1(report.accuracy * 100),
        effectiveAccuracy: round3(report.effectiveAccuracy),
        effectiveAccuracyPercent: round1(report.effectiveAccuracy * 100),
        band: report.band,
        headline: report.headline,
        classification: report.classification,
      },
      sections: report.sections.map((section) => ({
        id: section.id,
        name: section.name,
        n: section.n,
        correct: section.correct,
        wrong: section.wrong,
        unknown: section.unknown,
        gap: section.gap,
        gapRate: round3(section.gapRate),
        gapRatePercent: round1(section.gapRate * 100),
        priority: section.priority,
      })),
      types: report.types.map((type) => ({
        type: type.type,
        label: typeLabel(type.type),
        n: type.n,
        correct: type.correct,
        wrong: type.wrong,
        unknown: type.unknown,
        gap: type.gap,
        gapRate: round3(type.gapRate),
        gapRatePercent: round1(type.gapRate * 100),
      })),
      topics: report.topics.map((topic) => ({
        code: topic.code,
        topic: topic.topic,
        title: topic.title,
        section: topic.section,
        sectionName: topic.sectionName,
        n: topic.n,
        correct: topic.correct,
        wrong: topic.wrong,
        unknown: topic.unknown,
        gap: topic.gap,
        gapRate: round3(topic.gapRate),
        gapRatePercent: round1(topic.gapRate * 100),
        problem: topic.problem,
        questionIds: topic.ids,
      })),
      recommendations: report.recommendations,
      strengths: report.strengths.map((topic) => ({ code: topic.code, title: topic.title, section: topic.section, n: topic.n })),
      comparison: report.comparison ? {
        ...report.comparison,
        deltaPoints: round1(report.comparison.delta),
      } : null,
      answers: report.rows.map((row) => ({
        id: row.id,
        section: row.section,
        sectionName: row.sectionName,
        topic: row.topic,
        code: row.code,
        topicTitle: row.topicTitle,
        category: row.category,
        type: row.type,
        difficulty: row.difficulty,
        question: row.question,
        options: row.options,
        selectedIndex: row.selected,
        selectedLetter: row.selected === null ? null : LETTERS[row.selected],
        selectedText: row.selected === null ? null : row.selected === 4 ? "不知道 / I don't know" : row.options[row.selected],
        correctIndex: row.answer,
        correctLetter: LETTERS[row.answer],
        correctText: row.options[row.answer],
        status: row.status,
        statusLabel: statusLabel(row.status),
        explanation: row.explain,
        reviewTip: reviewTip(row),
        flagged: !!attempt.flags[row.id],
      })),
    };
  }

  function round1(value) {
    return Math.round(Number(value) * 10) / 10;
  }

  function round3(value) {
    return Math.round(Number(value) * 1000) / 1000;
  }

  function downloadJson(payload) {
    const text = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `ISOM3770_gapcheck_${date}_${payload.summary.total}Q.json`;
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(`已导出 ${filename}，可上传到对话做进一步分析。`, 'good');
  }

  /* ------------------------------------------------------------------ */
  /* dialog + global events                                              */
  /* ------------------------------------------------------------------ */

  function openDialog({ title, body, actions }) {
    const dialog = $('#dialog');
    if (!dialog) return;
    if (dialog.open) dialog.close();
    dialog.innerHTML = `
      <div class="dialog-body"><h2>${esc(title)}</h2>${body}</div>
      <div class="dialog-actions"></div>`;
    const actionBar = $('.dialog-actions', dialog);
    (actions || [{ label: '知道了', kind: 'primary' }]).forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn ${action.kind || ''}`.trim();
      button.textContent = action.label;
      button.addEventListener('click', () => {
        if (action.onClick) action.onClick();
        if (action.close !== false) dialog.close();
      });
      actionBar.append(button);
    });
    dialog.showModal();
  }

  function closeDialog() {
    const dialog = $('#dialog');
    if (dialog?.open) dialog.close();
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* ignore */ }
    $$('[data-theme-toggle]').forEach((button) => { button.textContent = next === 'dark' ? '☀' : '☾'; });
  }

  function bindGlobalEvents() {
    $('#app').addEventListener('click', (event) => {
      const themeButton = event.target.closest('[data-theme-toggle]');
      if (themeButton) { toggleTheme(); return; }

      const sectionButton = event.target.closest('[data-practice-section]');
      if (sectionButton) { practiceSection(sectionButton.dataset.practiceSection); return; }

      const topicButton = event.target.closest('[data-practice-topic]');
      if (topicButton) { practiceTopic(topicButton.dataset.practiceTopic); return; }
    });

    document.addEventListener('keydown', (event) => {
      if (state.screen !== 'exam') return;
      if ($('#dialog')?.open) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = (event.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || event.target.isContentEditable) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveQuestion(-1); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); moveQuestion(1); return; }
      const letterIndex = LETTERS.indexOf(event.key.toUpperCase());
      if (letterIndex >= 0) { event.preventDefault(); selectOption(letterIndex); return; }
      if (['1', '2', '3', '4', '5'].includes(event.key)) { event.preventDefault(); selectOption(Number(event.key) - 1); return; }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFlag(); }
    });

    const dialog = $('#dialog');
    dialog.addEventListener('close', () => {
      if (!dialog.open) dialog.innerHTML = '';
    });
  }

  /* ------------------------------------------------------------------ */
  /* render + init                                                       */
  /* ------------------------------------------------------------------ */

  function render() {
    if (state.screen === 'setup') renderSetup();
    else if (state.screen === 'exam') renderExam();
    else renderReport();
  }

  function init() {
    try {
      const storedTheme = localStorage.getItem(THEME_KEY);
      if (storedTheme === 'dark' || storedTheme === 'light') document.documentElement.dataset.theme = storedTheme;
    } catch (_) { /* ignore */ }
    state.history = readJson(HISTORY_KEY, []);
    if (!Array.isArray(state.history)) state.history = [];
    state.history = state.history.filter((entry) => entry && entry.id && Number.isFinite(entry.total));

    const active = loadActive();
    if (active) {
      state.attempt = active;
      if (active.submitted) {
        state.report = analyze(active);
        state.screen = 'report';
      } else {
        state.screen = 'exam';
      }
    }

    bindGlobalEvents();
    render();
    window.setInterval(updateTimer, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
