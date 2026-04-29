/* =================================================================
   UToledo AI Institute — Community of Practice
   Front-end controller.

   Architecture notes
   ------------------
   - Data is loaded from `faculty_data.json` via fetch(). When the
     portal is wired to a real backend later, replace `loadData()`
     with an authenticated API call (e.g. /api/community/bootstrap)
     and keep the rest of the renderers untouched — they only depend
     on the shape of `state.data`.
   - View switching is hash-based (#dashboard, #directory, ...).
     This works on GitHub Pages without server-side routing.
   - All rendering is idempotent; calling renderXxx() again redraws
     a section from `state.data` and the current `state.filters`.
   ================================================================= */

(function () {
  'use strict';

  /* ---------- 1. State ---------------------------------------- */

  // Single source of truth for the portal session.
  var state = {
    data: null,
    filters: {
      search: '',
      tech:   new Set(),
      domain: new Set()
    }
  };

  var TABS = ['dashboard', 'directory', 'showcase', 'forums'];
  var DEFAULT_TAB = 'dashboard';

  /* ---------- 2. DOM helpers ---------------------------------- */

  function $(sel, scope)  { return (scope || document).querySelector(sel); }
  function $$(sel, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(sel));
  }

  // Escape user/data strings before injecting them into innerHTML.
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ---------- 3. Data loading --------------------------------- */

  // Loads faculty_data.json. On real deployments this becomes an API call.
  async function loadData() {
    try {
      var res = await fetch('faculty_data.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      console.error('[CoP] Failed to load faculty_data.json:', err);
      showLoadError();
      throw err;
    }
  }

  function showLoadError() {
    var wrap = $('.wrap');
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="empty-state">' +
        '<strong>Could not load community data.</strong>' +
        'If you are previewing locally from the file system, run a static server first ' +
        '(<code>python3 -m http.server</code> in this folder), then open ' +
        '<code>http://localhost:8000/community.html</code>. On GitHub Pages this loads automatically.' +
      '</div>';
  }

  /* ---------- 4. Tab routing ---------------------------------- */

  function getTabFromHash() {
    var h = (location.hash || '').replace('#', '').trim();
    return TABS.indexOf(h) === -1 ? DEFAULT_TAB : h;
  }

  function setActiveTab(name) {
    if (TABS.indexOf(name) === -1) name = DEFAULT_TAB;
    $$('.view').forEach(function (v) {
      v.hidden = (v.id !== 'view-' + name);
    });
    $$('.tab').forEach(function (t) {
      var active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      if (active) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    if ((location.hash || '').replace('#', '') !== name) {
      history.replaceState(null, '', '#' + name);
    }
    // Scroll to top of main content on tab change for clarity.
    var main = $('#main');
    if (main) main.scrollIntoView({ block: 'start', behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function setupTabs() {
    // Tab clicks (the .tab nav items)
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        setActiveTab(t.dataset.tab);
      });
    });
    // Inline links inside the page that should also switch tabs (e.g. "Browse all →")
    $$('[data-tab-link]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        setActiveTab(a.dataset.tabLink);
      });
    });
    window.addEventListener('hashchange', function () {
      setActiveTab(getTabFromHash());
    });
    setActiveTab(getTabFromHash());
  }

  /* ---------- 5. Card templates ------------------------------- */

  function facultyCardHtml(f) {
    var techTags = (f.ai_focus || []).map(function (t) {
      return '<span class="tag tech">' + escapeHtml(t) + '</span>';
    }).join('');
    var domainTags = (f.domains || []).map(function (d) {
      return '<span class="tag domain">' + escapeHtml(d) + '</span>';
    }).join('');

    var projectsHtml = '';
    if (f.projects && f.projects.length) {
      projectsHtml =
        '<div class="faculty-projects">' +
          '<span class="faculty-projects-label">Active research</span>' +
          escapeHtml(f.projects.join('; ')) +
        '</div>';
    }

    var mailto = 'mailto:' + encodeURIComponent(f.email) +
      '?subject=' + encodeURIComponent('UToledo AI Institute — collaboration inquiry');

    return '' +
      '<article class="faculty-card" data-id="' + escapeHtml(f.id) + '">' +
        '<h3 class="faculty-name">' + escapeHtml(f.name) + '</h3>' +
        '<div class="faculty-title">' + escapeHtml(f.title) + '</div>' +
        '<div class="faculty-affil">' +
          escapeHtml(f.department) + '<br>' +
          '<span style="color:var(--muted)">' + escapeHtml(f.college) + '</span>' +
        '</div>' +
        '<div class="faculty-tags">' + techTags + domainTags + '</div>' +
        projectsHtml +
        '<div class="faculty-actions">' +
          '<a class="btn btn-primary" href="' + mailto + '">Connect</a>' +
          '<a class="btn btn-ghost" href="mailto:' + escapeHtml(f.email) + '">Email</a>' +
        '</div>' +
      '</article>';
  }

  function projectCardHtml(p) {
    var statusClass = (p.status || '').toLowerCase() === 'pilot' ? 'pilot' : '';
    var techTags = (p.ai_focus || []).map(function (t) {
      return '<span class="tag tech">' + escapeHtml(t) + '</span>';
    }).join('');
    var domainTag = '<span class="tag domain">' + escapeHtml(p.domain) + '</span>';
    var coPiHtml = '';
    if (p.co_pis && p.co_pis.length) {
      coPiHtml = ' &middot; <strong>Co-PIs:</strong> ' +
        p.co_pis.map(escapeHtml).join(', ');
    }
    return '' +
      '<article class="project-card" data-id="' + escapeHtml(p.id) + '">' +
        '<span class="project-status ' + statusClass + '">' + escapeHtml(p.status || 'Active') + '</span>' +
        '<h3 class="project-title">' + escapeHtml(p.title) + '</h3>' +
        '<p class="project-meta">' +
          '<strong>Lead PI:</strong> ' + escapeHtml(p.lead_pi) + coPiHtml + '<br>' +
          '<strong>Funding:</strong> ' + escapeHtml(p.funding) +
        '</p>' +
        '<div class="project-tags">' + domainTag + techTags + '</div>' +
        '<div class="project-block">' +
          '<div class="project-block-label">Computational Challenges</div>' +
          '<p class="project-challenges">' + escapeHtml(p.challenges) + '</p>' +
        '</div>' +
      '</article>';
  }

  function threadHtml(t, opts) {
    opts = opts || {};
    var metaExtra = opts.showCategory && t.categoryName
      ? ' &middot; in ' + escapeHtml(t.categoryName)
      : '';
    return '' +
      '<li class="thread">' +
        '<div>' +
          '<div class="thread-title">' + escapeHtml(t.title) + '</div>' +
          '<div class="thread-meta">' + escapeHtml(t.author) + metaExtra +
            (t.views != null ? ' &middot; ' + t.views + ' views' : '') +
          '</div>' +
        '</div>' +
        '<div class="thread-stat">' +
          '<div class="thread-stat-num">' + (t.replies != null ? t.replies : 0) + '</div>' +
          '<div class="thread-stat-label">Replies</div>' +
        '</div>' +
        '<div class="thread-time">' + escapeHtml(t.last_active || '') + '</div>' +
      '</li>';
  }

  /* ---------- 6. Dashboard ------------------------------------ */

  function renderDashboard() {
    var data = state.data;

    // Aggregate stats from the current data (so they stay accurate as
    // mock data is edited).
    var techSet   = new Set();
    var domainSet = new Set();
    data.faculty.forEach(function (f) {
      (f.ai_focus || []).forEach(function (t) { techSet.add(t); });
      (f.domains  || []).forEach(function (d) { domainSet.add(d); });
    });

    var stats = [
      { num: data.faculty.length,             label: 'Faculty Members' },
      { num: data.projects.length,            label: 'Active Projects' },
      { num: techSet.size,                    label: 'Core AI Areas' },
      { num: domainSet.size,                  label: 'Application Domains' }
    ];
    $('#dashboard-stats').innerHTML = stats.map(function (s) {
      return '<div class="stat">' +
        '<div class="stat-num">' + s.num + '</div>' +
        '<div class="stat-label">' + escapeHtml(s.label) + '</div>' +
      '</div>';
    }).join('');

    // Featured: first 3 entries (in a real system, "featured" would
    // come from an editor-controlled flag).
    $('#featured-faculty').innerHTML  = data.faculty.slice(0, 3).map(facultyCardHtml).join('');
    $('#featured-projects').innerHTML = data.projects.slice(0, 3).map(projectCardHtml).join('');

    // Flatten the most recent threads across all categories.
    var threads = [];
    data.forum_categories.forEach(function (cat) {
      (cat.threads || []).forEach(function (th) {
        threads.push(Object.assign({ categoryName: cat.name, categoryId: cat.id }, th));
      });
    });
    $('#recent-threads').innerHTML =
      threads.slice(0, 5).map(function (t) {
        return threadHtml(t, { showCategory: true });
      }).join('');
  }

  /* ---------- 7. Directory: filters & rendering --------------- */

  function setupDirectory() {
    var data = state.data;

    // Build the chip lists from the union of values across faculty.
    var techSet   = new Set();
    var domainSet = new Set();
    data.faculty.forEach(function (f) {
      (f.ai_focus || []).forEach(function (t) { techSet.add(t); });
      (f.domains  || []).forEach(function (d) { domainSet.add(d); });
    });

    function renderChips(containerSel, values, group) {
      $(containerSel).innerHTML = Array.from(values).sort().map(function (v) {
        return '<button type="button" class="chip" data-group="' +
          group + '" data-value="' + escapeHtml(v) + '">' +
          escapeHtml(v) + '</button>';
      }).join('');
    }
    renderChips('#filter-tech',   techSet,   'tech');
    renderChips('#filter-domain', domainSet, 'domain');

    // Chip toggles (delegated; survives re-renders).
    document.addEventListener('click', function (e) {
      var chip = e.target.closest && e.target.closest('.chip');
      if (!chip) return;
      var group = chip.dataset.group;
      var value = chip.dataset.value;
      if (!group || !value) return;
      var set = state.filters[group];
      if (set.has(value)) {
        set.delete(value);
        chip.classList.remove('active');
      } else {
        set.add(value);
        chip.classList.add('active');
      }
      applyFilters();
    });

    // Search box (debounced lightly via input event).
    $('#search-input').addEventListener('input', function (e) {
      state.filters.search = e.target.value.trim().toLowerCase();
      applyFilters();
    });

    // Clear all
    $('#clear-filters').addEventListener('click', function () {
      state.filters.search = '';
      state.filters.tech.clear();
      state.filters.domain.clear();
      $('#search-input').value = '';
      $$('.chip').forEach(function (c) { c.classList.remove('active'); });
      applyFilters();
    });
  }

  // Filters faculty by current state, then re-renders the grid.
  // Search matches name, title, department, college, projects, and tags.
  function applyFilters() {
    var data = state.data;
    var f = state.filters;

    var matches = data.faculty.filter(function (fac) {
      // Free-text search
      if (f.search) {
        var hay = [
          fac.name, fac.title, fac.department, fac.college,
          (fac.projects || []).join(' '),
          (fac.ai_focus || []).join(' '),
          (fac.domains  || []).join(' ')
        ].join(' ').toLowerCase();
        if (hay.indexOf(f.search) === -1) return false;
      }
      // Tech: faculty must match at least one selected tech (OR within group)
      if (f.tech.size) {
        var anyTech = (fac.ai_focus || []).some(function (t) { return f.tech.has(t); });
        if (!anyTech) return false;
      }
      // Domain: same OR-within-group semantics
      if (f.domain.size) {
        var anyDom = (fac.domains || []).some(function (d) { return f.domain.has(d); });
        if (!anyDom) return false;
      }
      return true;
    });

    $('#result-count').innerHTML =
      '<strong>' + matches.length + '</strong> of ' + data.faculty.length + ' faculty';

    if (matches.length === 0) {
      $('#faculty-grid').innerHTML =
        '<div class="empty-state" style="grid-column:1/-1">' +
          '<strong>No matches.</strong>Try removing a filter or broadening your search.' +
        '</div>';
    } else {
      $('#faculty-grid').innerHTML = matches.map(facultyCardHtml).join('');
    }
  }

  /* ---------- 8. Showcase ------------------------------------- */

  function renderShowcase() {
    $('#projects-grid').innerHTML = state.data.projects.map(projectCardHtml).join('');
  }

  /* ---------- 9. Forums --------------------------------------- */

  function renderForums() {
    $('#forums-list').innerHTML = state.data.forum_categories.map(function (cat) {
      var threads = (cat.threads || []).map(function (t) {
        return threadHtml(t, { showCategory: false });
      }).join('');
      return '' +
        '<section class="forum" data-id="' + escapeHtml(cat.id) + '">' +
          '<header class="forum-head">' +
            '<h3>' + escapeHtml(cat.name) + '</h3>' +
            '<p>' + escapeHtml(cat.description) + '</p>' +
          '</header>' +
          '<ul class="thread-list">' + threads + '</ul>' +
        '</section>';
    }).join('');
  }

  /* ---------- 10. Init ---------------------------------------- */

  async function init() {
    try {
      state.data = await loadData();
    } catch (e) {
      return; // showLoadError() already rendered a message
    }
    renderDashboard();
    setupDirectory();
    applyFilters();      // initial render of directory
    renderShowcase();
    renderForums();
    setupTabs();         // last so views are populated before showing
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
