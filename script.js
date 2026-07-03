(function () {
    'use strict';

    const STORAGE_KEY = 'drift.tasks.v1';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------- State ---------------- */
    let tasks = [];          // { id, title, completed, createdAt }
    let currentFilter = 'all';

    /* ---------------- DOM refs ---------------- */
    const els = {
        form: document.getElementById('taskForm'),
        input: document.getElementById('taskInput'),
        inputError: document.getElementById('inputError'),
        inputRow: document.querySelector('.input-row'),
        list: document.getElementById('taskList'),
        emptyState: document.getElementById('emptyState'),
        filterBtns: Array.from(document.querySelectorAll('.filter-btn')),
        filterPill: document.getElementById('filterPill'),
        remainingCount: document.getElementById('remainingCount'),
        totalCount: document.getElementById('totalCount'),
        completedCount: document.getElementById('completedCount'),
        clearCompletedBtn: document.getElementById('clearCompletedBtn'),
        ringProgress: document.getElementById('ringProgress'),
        ringPercent: document.getElementById('ringPercent'),
        dateLine: document.getElementById('dateLine'),
        srAnnounce: document.getElementById('srAnnounce'),
    };

    const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52

    /* ---------------- Utilities ---------------- */
    function uid() {
        return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        if (sameDay) return timeStr;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + timeStr;
    }

    function announce(msg) {
        els.srAnnounce.textContent = msg;
    }

    /* ---------------- Local Storage ---------------- */
    function loadTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            tasks = raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn('Could not read saved tasks, starting fresh.', e);
            tasks = [];
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (e) {
            console.warn('Could not save tasks (storage may be full or disabled).', e);
        }
    }

    /* ---------------- Derived data ---------------- */
    function getFilteredTasks() {
        if (currentFilter === 'active') return tasks.filter(t => !t.completed);
        if (currentFilter === 'completed') return tasks.filter(t => t.completed);
        return tasks;
    }

    function getCounts() {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        return { total, completed, remaining: total - completed };
    }

    /* ---------------- Rendering ---------------- */
    function renderAll() {
        renderList();
        renderCounts();
        renderEmptyState();
    }

    function renderList() {
        const filtered = getFilteredTasks();
        els.list.innerHTML = '';

        filtered.forEach((task) => {
            const li = buildTaskElement(task);
            els.list.appendChild(li);
        });

        // Entrance animation for the currently rendered set
        if (!prefersReducedMotion && filtered.length) {
            const items = els.list.querySelectorAll('.task-item');
            gsap.fromTo(
                items,
                { opacity: 0, y: 10, scale: 0.98 },
                { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out', stagger: 0.045 }
            );
        }
    }

    function buildTaskElement(task) {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.completed ? ' is-completed' : '');
        li.dataset.id = task.id;

        li.innerHTML = `
      <button class="check-btn" type="button" aria-pressed="${task.completed}" aria-label="${task.completed ? 'Mark as active' : 'Mark as complete'}">
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 8.5L6.2 11.5L13 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="task-body">
        <p class="task-title">${escapeHTML(task.title)}</p>
        <span class="task-time">${formatTime(task.createdAt)}</span>
      </div>
      <button class="delete-btn" type="button" aria-label="Delete task: ${escapeHTML(task.title)}">
        <i data-lucide="trash-2"></i>
      </button>
    `;

        return li;
    }

    function renderCounts() {
        const { total, completed, remaining } = getCounts();

        animateNumber(els.remainingCount, remaining);
        els.totalCount.textContent = total;
        els.completedCount.textContent = completed;

        els.clearCompletedBtn.hidden = completed === 0;

        // Progress ring
        const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
        const offset = RING_CIRCUMFERENCE - (pct / 100) * RING_CIRCUMFERENCE;
        els.ringProgress.style.strokeDashoffset = String(offset);
        animateNumber(els.ringPercent, pct);
    }

    // Small counter tween so numbers don't just "snap"
    function animateNumber(el, target) {
        const current = parseInt(el.textContent, 10) || 0;
        if (current === target) return;
        if (prefersReducedMotion) {
            el.textContent = target;
            return;
        }
        const obj = { val: current };
        gsap.to(obj, {
            val: target,
            duration: 0.45,
            ease: 'power2.out',
            onUpdate: () => { el.textContent = Math.round(obj.val); },
        });
    }

    function renderEmptyState() {
        const filtered = getFilteredTasks();
        const shouldShow = filtered.length === 0;

        if (shouldShow && !els.emptyState.classList.contains('is-visible')) {
            els.emptyState.classList.add('is-visible');
            if (!prefersReducedMotion) {
                gsap.fromTo(els.emptyState, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
            } else {
                els.emptyState.style.opacity = 1;
            }
            // Tailor empty-state copy to the active filter
            const title = els.emptyState.querySelector('.empty-title');
            const sub = els.emptyState.querySelector('.empty-sub');
            if (tasks.length === 0) {
                title.textContent = 'Nothing here yet';
                sub.textContent = 'Add your first task above — keep it small.';
            } else if (currentFilter === 'active') {
                title.textContent = 'All caught up';
                sub.textContent = 'No active tasks. Nice work.';
            } else if (currentFilter === 'completed') {
                title.textContent = 'Nothing completed yet';
                sub.textContent = 'Finished tasks will collect here.';
            }
        } else if (!shouldShow) {
            els.emptyState.classList.remove('is-visible');
            els.emptyState.style.opacity = 0;
        }
    }

    /* ---------------- Actions ---------------- */
    function addTask(rawTitle) {
        const title = rawTitle.trim();

        if (!title) {
            showInputError('Type something before adding.');
            return;
        }
        if (title.length > 140) {
            showInputError('Keep it under 140 characters.');
            return;
        }

        const task = {
            id: uid(),
            title,
            completed: false,
            createdAt: Date.now(),
        };

        tasks.unshift(task);
        saveTasks();
        clearInputError();

        // If a filter would hide the new task, snap back to "all" so the user sees feedback
        if (currentFilter === 'completed') setFilter('all');
        else renderAll();

        lucide.createIcons();
        announce(`Added task: ${title}`);

        // Success micro-interaction on the input
        if (!prefersReducedMotion) {
            gsap.fromTo(els.inputRow, { scale: 1 }, { scale: 1.015, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' });
        }
    }

    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        task.completed = !task.completed;
        saveTasks();

        const li = els.list.querySelector(`[data-id="${id}"]`);

        if (task.completed && !prefersReducedMotion && li) {
            // Little "pop" on completion, then re-render (handles filter changes)
            gsap.timeline({ onComplete: () => renderAll() })
                .to(li, { scale: 0.985, duration: 0.08, ease: 'power1.out' })
                .to(li, { scale: 1, duration: 0.18, ease: 'back.out(2)' });
            li.classList.add('is-completed');
        } else {
            renderAll();
        }

        announce(task.completed ? `Completed: ${task.title}` : `Reopened: ${task.title}`);
    }

    function deleteTask(id) {
        const li = els.list.querySelector(`[data-id="${id}"]`);
        const task = tasks.find(t => t.id === id);

        const finish = () => {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderAll();
            lucide.createIcons();
            if (task) announce(`Deleted: ${task.title}`);
        };

        if (li && !prefersReducedMotion) {
            gsap.to(li, {
                opacity: 0,
                x: 24,
                height: 0,
                marginBottom: 0,
                paddingTop: 0,
                paddingBottom: 0,
                duration: 0.3,
                ease: 'power2.in',
                onComplete: finish,
            });
        } else {
            finish();
        }
    }

    function clearCompleted() {
        const completedIds = tasks.filter(t => t.completed).map(t => t.id);
        if (!completedIds.length) return;

        const nodes = completedIds
            .map(id => els.list.querySelector(`[data-id="${id}"]`))
            .filter(Boolean);

        const finish = () => {
            tasks = tasks.filter(t => !t.completed);
            saveTasks();
            renderAll();
            announce('Cleared completed tasks');
        };

        if (nodes.length && !prefersReducedMotion) {
            gsap.to(nodes, {
                opacity: 0,
                x: 24,
                duration: 0.25,
                stagger: 0.03,
                ease: 'power2.in',
                onComplete: finish,
            });
        } else {
            finish();
        }
    }

    function setFilter(filter) {
        currentFilter = filter;

        els.filterBtns.forEach(btn => {
            const active = btn.dataset.filter === filter;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', String(active));
        });

        movePill();
        renderAll();
        lucide.createIcons();
    }

    function movePill() {
        const activeBtn = els.filterBtns.find(b => b.dataset.filter === currentFilter);
        if (!activeBtn) return;
        const offsetLeft = activeBtn.offsetLeft - 4; // account for container padding
        const width = activeBtn.offsetWidth;

        if (prefersReducedMotion) {
            els.filterPill.style.transform = `translateX(${offsetLeft}px)`;
            els.filterPill.style.width = `${width}px`;
        } else {
            gsap.to(els.filterPill, {
                x: offsetLeft,
                width,
                duration: 0.35,
                ease: 'power3.out',
            });
        }
    }

    /* ---------------- Input validation UI ---------------- */
    let errorTimeout;
    function showInputError(msg) {
        els.inputError.textContent = msg;
        els.inputRow.classList.add('shake');
        clearTimeout(errorTimeout);
        errorTimeout = setTimeout(() => els.inputRow.classList.remove('shake'), 400);
    }
    function clearInputError() {
        els.inputError.textContent = '';
    }

    /* ---------------- Event wiring ---------------- */
    function bindEvents() {
        els.form.addEventListener('submit', (e) => {
            e.preventDefault();
            addTask(els.input.value);
            els.input.value = '';
            els.input.focus();
        });

        els.input.addEventListener('input', clearInputError);

        els.list.addEventListener('click', (e) => {
            const checkBtn = e.target.closest('.check-btn');
            const delBtn = e.target.closest('.delete-btn');
            const li = e.target.closest('.task-item');
            if (!li) return;
            const id = li.dataset.id;

            if (checkBtn) toggleTask(id);
            if (delBtn) deleteTask(id);
        });

        els.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => setFilter(btn.dataset.filter));
        });

        els.clearCompletedBtn.addEventListener('click', clearCompleted);

        window.addEventListener('resize', movePill);
    }

    /* ---------------- Header date + page load animation ---------------- */
    function setDateLine() {
        const today = new Date();
        els.dateLine.textContent = today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }

    function playIntro() {
        if (prefersReducedMotion) {
            document.querySelectorAll('.eyebrow, .title, .subtitle, .ring-wrap, .input-card, .controls-row, .footer-line')
                .forEach(el => { el.style.opacity = 1; });
            return;
        }

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.to('.eyebrow', { opacity: 1, y: 0, duration: 0.5 }, 0)
            .fromTo('.title', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7 }, 0.05)
            .fromTo('.subtitle', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6 }, 0.2)
            .fromTo('.ring-wrap', { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6 }, 0.25)
            .fromTo('.input-card', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 }, 0.35)
            .fromTo('.controls-row', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 0.45)
            .fromTo('.footer-line', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.6);
    }

    /* ---------------- Init ---------------- */
    function init() {
        loadTasks();
        setDateLine();
        bindEvents();
        lucide.createIcons();
        renderAll();
        lucide.createIcons();

        // position pill after layout settles
        requestAnimationFrame(movePill);

        playIntro();
    }

    document.addEventListener('DOMContentLoaded', init);
})();