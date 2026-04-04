(function () {
  const API = '/api';
  const STEP_LABELS = {
    theory: 'Теория',
    quiz: 'Квиз',
    lab: 'Лаба',
    results: 'Результат',
    fix: 'Разбор',
    'final-quiz': 'Финальный тест',
    summary: 'Итог'
  };
  const PANEL_ORDER = ['theory', 'quiz', 'lab', 'results', 'fix', 'final-quiz', 'summary'];

  let modules = [];
  let currentModule = null;
  let currentPanel = 'theory';
  let fileContents = {};
  let currentFile = null;
  let lastSubmitResult = null;

  function get(url) {
    return fetch(API + url).then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)));
  }
  function post(url, body) {
    return fetch(API + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.status === 204 ? {} : r.json());
  }

  function showStep(screenId) {
    document.querySelectorAll('#screen-catalog, #screen-module').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screenId);
    if (el) el.classList.add('active');
    document.getElementById('back-to-catalog').style.display = screenId === 'screen-module' ? 'block' : 'none';
  }

  function renderStepper(panel) {
    const stepper = document.getElementById('stepper');
    const idx = PANEL_ORDER.indexOf(panel);
    stepper.innerHTML = PANEL_ORDER.map((p, i) => {
      const done = i < idx || (i === idx && panel === 'summary');
      const current = i === idx;
      const cls = ['stepper-item', done && 'done', current && 'current'].filter(Boolean).join(' ');
      return '<span class="' + cls + '">' + escapeHtml(STEP_LABELS[p] || p) + '</span>';
    }).join('');
  }

  function showPanel(name) {
    currentPanel = name;
    if (currentModule) renderStepper(name);
    document.querySelectorAll('[id^="panel-"]').forEach(el => {
      el.classList.toggle('active', el.id === 'panel-' + name);
    });
    if (name === 'theory') renderTheory();
    if (name === 'quiz') renderCheckpointQuiz();
    if (name === 'lab') renderLab();
    if (name === 'results') renderResults();
    if (name === 'fix') renderFix();
    if (name === 'final-quiz') renderFinalQuiz();
    if (name === 'summary') {
      if (currentModule && currentModule.id) {
        get('/modules/' + currentModule.id).then(m => { currentModule = m; renderSummary(); }).catch(() => renderSummary());
      } else {
        renderSummary();
      }
    }
    if (currentModule && currentModule.id) {
      post('/modules/' + currentModule.id + '/progress', { last_step: name }).catch(() => {});
    }
  }

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function getProgress() {
    return (currentModule && currentModule.progress) || {};
  }

  function renderCatalog() {
    const list = document.getElementById('module-list');
    list.innerHTML = '';
    modules.forEach(m => {
      const prog = m.progress || 'not_started';
      const attempts = m.attempt_count != null ? m.attempt_count : 0;
      const badgeClass = prog === 'completed' ? 'completed' : prog === 'in_progress' ? 'in_progress' : '';
      const badgeText = prog === 'completed' ? 'Пройден' : prog === 'in_progress' ? 'В процессе' : 'Не начат';
      const canContinue = prog === 'in_progress' && m.last_step;
      const card = document.createElement('div');
      card.className = 'module-card';
      card.innerHTML =
        '<div><strong>' + escapeHtml(m.title) + '</strong>' +
        '<p class="meta">' + m.minutes + ' мин · ' + escapeHtml(m.topic) + '</p>' +
        '<span class="progress-badge ' + badgeClass + '">' + escapeHtml(badgeText) + (attempts ? ' · ' + attempts + ' попыток' : '') + '</span></div>' +
        '<div class="module-actions">' +
        (canContinue ? '<button type="button" class="btn btn-primary" data-action="continue" data-id="' + escapeHtml(m.id) + '">Продолжить</button>' : '') +
        '<button type="button" class="btn ' + (canContinue ? 'btn-secondary' : 'btn-primary') + '" data-action="start" data-id="' + escapeHtml(m.id) + '">' + (canContinue ? 'Заново' : 'Start') + '</button>' +
        (prog !== 'not_started' ? '<button type="button" class="btn btn-ghost" data-action="reset" data-id="' + escapeHtml(m.id) + '">Reset</button>' : '') +
        '</div>';
      card.querySelector('[data-action="continue"]')?.addEventListener('click', () => startModule(m.id, true));
      card.querySelector('[data-action="start"]')?.addEventListener('click', () => startModule(m.id, false));
      card.querySelector('[data-action="reset"]')?.addEventListener('click', () => resetModule(m.id));
      list.appendChild(card);
    });
  }

  function resetModule(moduleId) {
    post('/modules/' + moduleId + '/progress', { reset: true }).then(() => {
      return get('/modules');
    }).then(list => {
      modules = list;
      renderCatalog();
    }).catch(() => {});
  }

  function startModule(moduleId, continueFromProgress) {
    get('/modules/' + moduleId).then(m => {
      currentModule = m;
      fileContents = {};
      (m.lab && m.lab.files || []).forEach(f => { fileContents[f.path] = f.content; });
      document.getElementById('module-title').textContent = m.title;
      document.getElementById('module-meta').textContent = m.minutes + ' мин · ' + m.topic;
      showStep('screen-module');
      const prog = m.progress || {};
      const startPanel = continueFromProgress && prog.last_step && PANEL_ORDER.includes(prog.last_step)
        ? prog.last_step
        : 'theory';
      showPanel(startPanel);
    }).catch(e => alert('Ошибка загрузки модуля: ' + e.message));
  }

  function renderTheory() {
    const t = currentModule.theory || {};
    const ul = document.getElementById('theory-bullets');
    ul.innerHTML = (t.bullets || []).map(b => '<li>' + escapeHtml(b) + '</li>').join('');
    document.getElementById('theory-bad').textContent = t.bad_example || '';
    document.getElementById('theory-good').textContent = t.good_example || '';
  }

  function renderCheckpointQuiz() {
    const q = currentModule.checkpoint_quiz || {};
    const container = document.getElementById('quiz-questions');
    container.innerHTML = '';
    (q.questions || []).forEach((quest, i) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.style.marginBottom = '1rem';
      div.innerHTML = '<p><strong>' + escapeHtml(quest.text) + '</strong></p><div class="radio-group" data-q="' + i + '">' +
        (quest.options || []).map((opt, j) =>
          '<label><input type="radio" name="cq_' + i + '" value="' + j + '"> ' + escapeHtml(opt) + '</label>'
        ).join('') + '</div><p class="explanation" style="display:none;margin-top:0.5rem;color:var(--text-muted)"></p>';
      const expl = div.querySelector('.explanation');
      div.querySelectorAll('input').forEach(rad => {
        rad.addEventListener('change', () => {
          const val = parseInt(rad.value, 10);
          expl.textContent = quest.explanation || '';
          expl.style.display = 'block';
          post('/quizzes/' + q.id + '/answer', { question_id: quest.id, answer: val, correct: val === quest.correct }).catch(() => {});
        });
      });
      container.appendChild(div);
    });
    document.getElementById('btn-next-quiz').style.display = 'block';
  }

  function renderLab() {
    const lab = currentModule.lab || {};
    document.getElementById('lab-task').textContent = lab.task || '';
    const criteria = document.getElementById('lab-criteria');
    criteria.innerHTML = (lab.acceptance_criteria || []).map(c => '<li>' + escapeHtml(c) + '</li>').join('');
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    (lab.files || []).forEach(f => {
      const li = document.createElement('li');
      li.textContent = f.path;
      li.dataset.path = f.path;
      li.addEventListener('click', () => selectFile(f.path));
      fileList.appendChild(li);
    });
    document.getElementById('rule-results').innerHTML = '<p class="text-muted" style="font-size:0.9rem;color:var(--text-muted)">После Submit здесь появятся результаты проверки.</p>';
    const firstPath = (lab.files && lab.files[0] && lab.files[0].path) || null;
    if (firstPath) selectFile(firstPath);
    document.getElementById('code-editor').value = firstPath ? (fileContents[firstPath] || '') : '';
    currentFile = firstPath;
  }

  function selectFile(path) {
    currentFile = path;
    document.querySelectorAll('#file-list li').forEach(li => li.classList.toggle('active', li.dataset.path === path));
    document.getElementById('code-editor').value = fileContents[path] || '';
  }

  document.getElementById('code-editor').addEventListener('input', function () {
    if (currentFile) fileContents[currentFile] = this.value;
  });

  document.getElementById('btn-reset-file').addEventListener('click', function () {
    if (!currentModule || !currentModule.lab || !currentFile) return;
    const f = currentModule.lab.files.find(x => x.path === currentFile);
    if (f) {
      fileContents[currentFile] = f.content;
      document.getElementById('code-editor').value = f.content;
    }
  });

  document.getElementById('btn-submit').addEventListener('click', function () {
    const lab = currentModule.lab;
    const files = Object.keys(fileContents).map(path => ({ path, content: fileContents[path] }));
    post('/labs/' + lab.id + '/submit', { submission_id: 'draft-' + Date.now(), files })
      .then(res => {
        lastSubmitResult = res;
        showPanel('results');
      })
      .catch(e => alert('Ошибка: ' + e.message));
  });

  function renderResults() {
    const res = lastSubmitResult;
    const statusEl = document.getElementById('result-status');
    statusEl.textContent = res.status === 'passed' ? 'Passed' : 'Failed';
    statusEl.className = 'status ' + res.status;
    const container = document.getElementById('result-rules');
    container.innerHTML = (res.rule_results || []).map(rr => {
      const cls = 'rule ' + (rr.passed ? 'passed' : rr.severity || '');
      let hints = '';
      if (!rr.passed && (rr.hint1 || rr.hint2 || rr.hint3)) {
        hints = '<div class="hint-toggle" data-rule="' + escapeHtml(rr.rule_id) + '">Показать подсказки</div>' +
          '<div class="hint-body" id="hints-' + escapeHtml(rr.rule_id) + '">' +
          '<div class="hint">Hint 1: ' + escapeHtml(rr.hint1 || '') + '</div>' +
          (rr.hint2 ? '<div class="hint">Hint 2: ' + escapeHtml(rr.hint2) + '</div>' : '') +
          (rr.hint3 ? '<div class="hint">Hint 3: ' + escapeHtml(rr.hint3) + '</div>' : '') +
          '</div>';
      }
      return '<div class="' + cls + '"><div class="msg">' + escapeHtml(rr.message) + '</div>' + hints + '</div>';
    }).join('');
    container.querySelectorAll('.hint-toggle').forEach(el => {
      el.addEventListener('click', () => {
        const body = document.getElementById('hints-' + el.dataset.rule);
        if (body) { body.classList.toggle('open'); el.textContent = body.classList.contains('open') ? 'Скрыть подсказки' : 'Показать подсказки'; }
      });
    });
  }

  function renderFix() {
    const fx = currentModule.fix_explanation || {};
    document.getElementById('fix-why').textContent = fx.why_fix || '';
    document.getElementById('fix-antipatterns').innerHTML = (fx.anti_patterns || []).map(a => '<li>' + escapeHtml(a) + '</li>').join('');
    document.getElementById('fix-checklist').innerHTML = (fx.checklist || []).map(c => '<li>' + escapeHtml(c) + '</li>').join('');
  }

  function renderFinalQuiz() {
    const q = currentModule.final_quiz || {};
    const container = document.getElementById('final-questions');
    container.innerHTML = '';
    (q.questions || []).forEach((quest, i) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.style.marginBottom = '1rem';
      div.innerHTML = '<p><strong>' + escapeHtml(quest.text) + '</strong></p><div class="radio-group">' +
        (quest.options || []).map((opt, j) =>
          '<label><input type="radio" name="fq_' + i + '" value="' + j + '"> ' + escapeHtml(opt) + '</label>'
        ).join('') + '</div>';
      container.appendChild(div);
    });
    document.getElementById('btn-next-final').style.display = 'block';
  }

  function renderSummary() {
    const prog = getProgress();
    const attempts = prog.attempt_count != null ? prog.attempt_count : 0;
    const completed = prog.completed === true;
    const el = document.getElementById('summary-stats');
    el.innerHTML =
      '<div class="stat"><div class="label">Попыток (лаба)</div><div class="value">' + attempts + '</div></div>' +
      '<div class="stat"><div class="label">Статус</div><div class="value">' + (completed ? 'Пройден' : 'В процессе') + '</div></div>';
  }

  document.getElementById('btn-next-theory').addEventListener('click', () => showPanel('quiz'));
  document.getElementById('btn-next-quiz').addEventListener('click', () => showPanel('lab'));
  document.getElementById('btn-next-results').addEventListener('click', () => showPanel('fix'));
  document.getElementById('btn-next-fix').addEventListener('click', () => showPanel('final-quiz'));
  document.getElementById('btn-next-final').addEventListener('click', () => showPanel('summary'));
  document.getElementById('btn-next-module').addEventListener('click', () => {
    showStep('screen-catalog');
    get('/modules').then(list => { modules = list; renderCatalog(); });
  });
  document.getElementById('back-to-catalog').addEventListener('click', (e) => {
    e.preventDefault();
    showStep('screen-catalog');
    get('/modules').then(list => { modules = list; renderCatalog(); });
  });

  get('/modules').then(list => {
    modules = list;
    renderCatalog();
  }).catch(() => { modules = []; renderCatalog(); });
})();
