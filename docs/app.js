const state = { tasks: [], status: 'all', category: 'all', repository: '' };

const els = {
  critical: document.querySelector('[data-critical-list]'),
  list: document.querySelector('[data-task-list]'),
  empty: document.querySelector('[data-empty-state]'),
  error: document.querySelector('[data-error-state]'),
  resultCount: document.querySelector('[data-result-count]'),
  category: document.querySelector('[data-category-filter]'),
  template: document.querySelector('#task-template')
};

const priorityLabels = { P0: 'Critical', P1: 'Important', P2: 'Improvement' };
const statusLabels = { pending: 'Open', 'in-progress': 'In progress', blocked: 'Blocked', complete: 'Verified' };

function sourceUrl(path) {
  const cleanPath = path.replace(/\*.*$/, '').replace(/\/$/, '');
  return `${state.repository}/tree/main/${cleanPath}`;
}

function configureLinks() {
  document.querySelectorAll('[data-repo-link]').forEach((link) => { link.href = state.repository; });
  document.querySelector('[data-issues-link]').href = `${state.repository}/issues`;
  document.querySelector('[data-tasks-link]').href = `${state.repository}/blob/main/docs/release-tasks.json`;
}

function renderCounts() {
  const openP0 = state.tasks.filter((task) => task.priority === 'P0' && task.status !== 'complete').length;
  const complete = state.tasks.filter((task) => task.status === 'complete').length;
  const ready = openP0 === 0 && state.tasks.every((task) => task.status === 'complete');
  document.querySelector('[data-count="P0"]').textContent = openP0;
  document.querySelector('[data-count="complete"]').textContent = complete;
  document.querySelector('[data-count="all"]').textContent = state.tasks.length;
  document.querySelector('[data-verdict-stamp] span').textContent = ready ? 'READY' : 'BLOCKED';
  document.querySelector('[data-verdict-text]').textContent = ready ? 'Release gates verified' : 'Not safe for public release';
  document.querySelector('[data-verdict-stamp]').classList.toggle('is-ready', ready);
}

function renderCritical() {
  const tasks = state.tasks.filter((task) => task.priority === 'P0' && task.status !== 'complete');
  if (tasks.length === 0) {
    const item = document.createElement('li');
    item.className = 'loading-row';
    item.textContent = 'No critical corrections remain.';
    els.critical.replaceChildren(item);
    return;
  }
  els.critical.replaceChildren(...tasks.map((task, index) => {
    const item = document.createElement('li');
    item.innerHTML = `<span class="critical-index">${String(index + 1).padStart(2, '0')}</span><div><strong>${task.title}</strong><p>${task.summary}</p></div><span class="critical-area">${task.category}</span>`;
    return item;
  }));
}

function buildTask(task) {
  const fragment = els.template.content.cloneNode(true);
  const article = fragment.querySelector('.task-row');
  const button = fragment.querySelector('.task-summary');
  const detail = fragment.querySelector('.task-detail');
  article.dataset.priority = task.priority;
  article.dataset.status = task.status;
  fragment.querySelector('.priority-mark').textContent = task.priority;
  fragment.querySelector('.task-title').textContent = task.title;
  fragment.querySelector('.task-id').textContent = `${priorityLabels[task.priority]} · ${task.id}`;
  fragment.querySelector('.task-category').textContent = task.category;
  fragment.querySelector('.status-text').textContent = statusLabels[task.status] || task.status;
  fragment.querySelector('.task-description').textContent = task.summary;

  const evidence = fragment.querySelector('.evidence-list');
  task.evidence.forEach((path) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = sourceUrl(path);
    link.textContent = path;
    link.target = '_blank';
    link.rel = 'noreferrer';
    item.append(link);
    evidence.append(item);
  });

  const sourceLink = fragment.querySelector('.task-source-link');
  sourceLink.href = sourceUrl(task.evidence[0]);
  sourceLink.target = '_blank';
  sourceLink.rel = 'noreferrer';

  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    detail.hidden = expanded;
  });
  return article;
}

function renderTasks() {
  const visible = state.tasks.filter((task) => {
    const statusMatch = state.status === 'all' || (state.status === 'open' ? task.status !== 'complete' : task.status === state.status);
    const categoryMatch = state.category === 'all' || task.category === state.category;
    return statusMatch && categoryMatch;
  });
  els.list.replaceChildren(...visible.map(buildTask));
  els.resultCount.textContent = visible.length;
  els.empty.hidden = visible.length !== 0;
}

function setupFilters() {
  const categories = [...new Set(state.tasks.map((task) => task.category))].sort();
  categories.forEach((category) => els.category.add(new Option(category, category)));

  document.querySelectorAll('[data-filter-group="status"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.status = button.dataset.filterValue;
      document.querySelectorAll('[data-filter-group="status"]').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });
      renderTasks();
    });
  });

  els.category.addEventListener('change', () => {
    state.category = els.category.value;
    renderTasks();
  });
}

async function init() {
  try {
    const response = await fetch('./release-tasks.json');
    if (!response.ok) throw new Error(`Task data returned ${response.status}`);
    const data = await response.json();
    state.tasks = data.tasks;
    state.repository = data.repository;
    document.querySelector('[data-updated]').textContent = `Updated ${new Date(`${data.updated}T00:00:00`).toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    configureLinks();
    renderCounts();
    renderCritical();
    setupFilters();
    renderTasks();
  } catch (error) {
    console.error(error);
    els.critical.innerHTML = '<li class="loading-row">Proof data unavailable.</li>';
    els.list.hidden = true;
    els.error.hidden = false;
    els.resultCount.textContent = '0';
  }
}

init();
