window.NauxicaShared = (function () {
  var PARTNER_NAV = [
    '<a class="dashboard-nav-item" id="dashboard-link" href="dashboard-partner.html">Dashboard</a>',
    '<a class="dashboard-nav-item" href="dashboard-partner.html#requests">Requests</a>',
    '<a class="dashboard-nav-item" href="dashboard-partner.html#jobs">My Jobs</a>',
    '<a class="dashboard-nav-item" data-page="calendar" href="calendar.html">Calendar</a>',
    '<a class="dashboard-nav-item" data-page="availability" href="availability.html">Availability</a>',
    '<a class="dashboard-nav-item" href="dashboard-partner.html#earnings">Earnings</a>',
    '<a class="dashboard-nav-item" data-page="messages" href="messages.html">Messages</a>',
    '<a class="dashboard-nav-item" href="dashboard-partner.html#performance">Performance</a>',
    '<a class="dashboard-nav-item" href="dashboard-partner.html#services">Services</a>',
    '<a class="dashboard-nav-item" data-page="reviews" href="reviews.html">Reviews</a>',
    '<a class="dashboard-nav-item" data-page="settings" href="settings.html">Settings</a>',
    '<a class="dashboard-nav-item" data-page="help" href="help.html">Help Center</a>'
  ].join('\n');

  var HOMEOWNER_NAV = [
    '<a class="dashboard-nav-item" id="dashboard-link" data-page="dashboard" href="dashboard-homeowner.html">Dashboard</a>',
    '<a class="dashboard-nav-item" data-page="calendar" href="calendar.html">Calendar</a>',
    '<a class="dashboard-nav-item" data-page="availability" href="availability.html">Availability</a>',
    '<a class="dashboard-nav-item" data-page="reservations" href="reservations.html">Reservations</a>',
    '<a class="dashboard-nav-item" data-page="guests" href="guests.html">Guests</a>',
    '<a class="dashboard-nav-item" data-page="messages" href="messages.html">Messages</a>',
    '<a class="dashboard-nav-item" data-page="operations" href="operations.html">Operations</a>',
    '<a class="dashboard-nav-item" data-page="tasks" href="tasks.html">Tasks</a>',
    '<a class="dashboard-nav-item" data-page="properties" href="properties.html">Properties</a>',
    '<a class="dashboard-nav-item" data-page="activity" href="activity.html">Activity</a>',
    '<a class="dashboard-nav-item" data-page="reports" href="reports.html">Reports</a>',
    '<a class="dashboard-nav-item" data-page="revenue" href="revenue.html">Revenue</a>',
    '<a class="dashboard-nav-item" data-page="reviews" href="reviews.html">Reviews</a>',
    '<a class="dashboard-nav-item" data-page="marketplace" href="marketplace.html">Marketplace</a>',
    '<a class="dashboard-nav-item" data-page="settings" href="settings.html">Settings</a>',
    '<a class="dashboard-nav-item" data-page="help" href="help.html">Help Center</a>'
  ].join('\n');

  function resolveAccountType() {
    return (
      localStorage.getItem('accountType') ||
      localStorage.getItem('nauxicaAccountType') ||
      (window.NauxicaDemoData && window.NauxicaDemoData.getCurrentAccountType
        ? window.NauxicaDemoData.getCurrentAccountType()
        : null) ||
      'homeowner'
    );
  }

  async function handleLogout(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    try {
      if (window.NauxicaSupabase && window.NauxicaSupabase.auth) {
        var result = await window.NauxicaSupabase.auth.signOut();
        if (result && result.error) {
          console.error('Supabase signOut error:', result.error);
        }
      }
    } catch (err) {
      console.error('Supabase signOut exception:', err);
    }
    localStorage.removeItem('accountType');
    localStorage.removeItem('nauxicaAccountType');
    window.location.replace('login.html');
  }

  function filterByAccountType(collection, accountType) {
    return (collection || []).filter(function (item) {
      return !item.accountType || item.accountType === accountType;
    });
  }

  function formatDateChip() {
    var d = new Date();
    return 'Today, ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function renderNav(container, accountType) {
    if (!container) return;
    container.innerHTML = accountType === 'partner' ? PARTNER_NAV : HOMEOWNER_NAV;
  }

  function setActivePage(pageName) {
    document.querySelectorAll('.dashboard-nav .dashboard-nav-item').forEach(function (a) {
      a.classList.remove('active');
    });
    var activeItem = document.querySelector(
      '.dashboard-nav .dashboard-nav-item[data-page="' + pageName + '"]'
    );
    if (activeItem) activeItem.classList.add('active');
  }

  function waitForSupabaseClient() {
    return new Promise(function (resolve) {
      if (window.NauxicaSupabase) { resolve(); return; }
      // If DOMContentLoaded already fired, deferred module scripts (which
      // includes supabase-client.js) have already run — nothing more to
      // wait for, even if the client somehow still isn't there.
      if (document.readyState !== 'loading') { resolve(); return; }
      document.addEventListener('DOMContentLoaded', function () { resolve(); }, { once: true });
    });
  }

  function initialsFrom(s) {
    if (!s) return '';
    var parts = String(s).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Resolves and renders the signed-in user's real name/initials into
  // #profile-name / #profile-avatar wherever present on the page, for
  // both homeowner and partner accounts. Fallback order: display_name →
  // full_name → session email. Runs async; safe to call without awaiting
  // — it waits internally for window.NauxicaSupabase to exist before
  // touching it, since this is invoked from a non-module bootstrap
  // script that can run before the deferred supabase-client.js module.
  async function updateTopbar(accountType) {
    if (accountType === 'partner') {
      var updates = {
        'workspace-label': 'Nauxica partner workspace',
        'profile-role': 'Service Partner'
      };
      Object.keys(updates).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = updates[id];
      });
    }

    await waitForSupabaseClient();
    if (!window.NauxicaSupabase) return;

    try {
      var sessRes = await window.NauxicaSupabase.auth.getSession();
      var session = sessRes && sessRes.data && sessRes.data.session;
      if (!session) return;

      var userRes = await window.NauxicaSupabase
        .from('users')
        .select('full_name, display_name')
        .eq('id', session.user.id)
        .single();

      var row = userRes && userRes.data;
      var resolvedName =
        (row && row.display_name && row.display_name.trim()) ||
        (row && row.full_name && row.full_name.trim()) ||
        session.user.email ||
        '';

      if (!resolvedName) return;

      var nameEl = document.getElementById('profile-name');
      if (nameEl) nameEl.textContent = resolvedName;

      // Dashboard hero greeting ("Good morning, {name}.") — same resolved
      // name as the topbar, no extra query, only present on some pages.
      var heroNameEl = document.getElementById('hero-name');
      if (heroNameEl) heroNameEl.textContent = resolvedName;

      var avatarEl = document.getElementById('profile-avatar');
      if (avatarEl) {
        var ini = initialsFrom(resolvedName) || initialsFrom(session.user.email);
        if (ini) avatarEl.textContent = ini;
      }
    } catch (err) {
      console.warn('[nauxica-shared] updateTopbar identity fetch failed:', err);
    }
  }

  return {
    resolveAccountType: resolveAccountType,
    handleLogout: handleLogout,
    filterByAccountType: filterByAccountType,
    formatDateChip: formatDateChip,
    renderNav: renderNav,
    setActivePage: setActivePage,
    updateTopbar: updateTopbar
  };
})();
