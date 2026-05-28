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
    '<a class="dashboard-nav-item" href="dashboard-homeowner.html#overview">Overview</a>',
    '<a class="dashboard-nav-item" data-page="calendar" href="calendar.html">Calendar</a>',
    '<a class="dashboard-nav-item" data-page="availability" href="availability.html">Availability</a>',
    '<a class="dashboard-nav-item" data-page="reservations" href="reservations.html">Reservations</a>',
    '<a class="dashboard-nav-item" data-page="guests" href="guests.html">Guests</a>',
    '<a class="dashboard-nav-item" data-page="messages" href="messages.html">Messages</a>',
    '<a class="dashboard-nav-item" data-page="operations" href="operations.html">Operations</a>',
    '<a class="dashboard-nav-item" data-page="tasks" href="tasks.html">Tasks</a>',
    '<a class="dashboard-nav-item" data-page="properties" href="properties.html">Properties</a>',
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

  function handleLogout() {
    localStorage.removeItem('accountType');
    localStorage.removeItem('nauxicaAccountType');
    window.location.href = 'index.html';
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

  function updateTopbar(accountType) {
    if (accountType !== 'partner') return;
    var updates = {
      'workspace-label': 'Nauxica partner workspace',
      'profile-avatar': 'SP',
      'profile-name': 'Partner',
      'profile-role': 'Service Partner'
    };
    Object.keys(updates).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = updates[id];
    });
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
