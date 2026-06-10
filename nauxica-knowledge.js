// nauxica-knowledge.js — Sprint 013B
// Provides NauxicaKnowledge.init(propertyId) which loads and renders the
// Knowledge Base and Emergency Data cards on property-detail.html.
//
// Knowledge blocks are written via the `knowledge-writer` Edge Function
// (service_role required; homeowner RLS allows SELECT only on that table).
// Emergency data and contacts are written directly via the anon client
// (homeowner UPDATE and INSERT/UPDATE policies exist for those tables).
//
// Commission, partner, financial, and nauxica_operator-write paths are
// excluded from this module.

window.NauxicaKnowledge = (function () {
  'use strict';

  /* ── Block definitions ─────────────────────────────────────────────── */
  var KB_BLOCKS = [
    { type: 'property_summary', label: 'Property Summary' },
    { type: 'wifi',             label: 'WiFi' },
    { type: 'access',           label: 'Access & Entry' },
    { type: 'check_in',         label: 'Check-in' },
    { type: 'check_out',        label: 'Check-out' },
    { type: 'house_rules',      label: 'House Rules' },
    { type: 'tourist_tax',      label: 'Tourist Tax' },
    { type: 'fallback_support', label: 'Fallback Support' },
  ];

  /* ── Canonical visibility codes per block type ─────────────────────── */
  // Must match the pkb_visibility_scope_check constraint: PUB / GST / PTR / INT.
  var BLOCK_VISIBILITY = {
    property_summary: 'PUB',
    wifi:             'GST',
    access:           'GST',
    check_in:         'PUB',
    check_out:        'PUB',
    house_rules:      'PUB',
    tourist_tax:      'PUB',
    fallback_support: 'GST',
  };

  // Maps both long-form strings and already-canonical codes to canonical form.
  var VISIBILITY_NORM = {
    'public':   'PUB', 'PUB': 'PUB',
    'guest':    'GST', 'GST': 'GST',
    'partner':  'PTR', 'PTR': 'PTR',
    'internal': 'INT', 'INT': 'INT',
  };

  function _normVis(raw, blockType) {
    if (raw && VISIBILITY_NORM[raw]) return VISIBILITY_NORM[raw];
    return BLOCK_VISIBILITY[blockType] || 'PUB';
  }

  /* ── Private state ─────────────────────────────────────────────────── */
  var _propertyId  = null;
  var _kbBlocks    = {};
  var _emData      = {};
  var _contacts    = {};
  var _afterSaveFn = null;

  /* ── CSS injection ─────────────────────────────────────────────────── */
  (function () {
    if (document.getElementById('nk-styles')) return;
    var s = document.createElement('style');
    s.id = 'nk-styles';
    s.textContent = [
      /* overlay / modal chrome */
      '.nk-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.48);display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow-y:auto;opacity:0;pointer-events:none;transition:opacity .2s}',
      '.nk-overlay.nk-open{opacity:1;pointer-events:auto}',
      '.nk-modal{background:#fff;border-radius:16px;width:100%;max-width:640px;box-shadow:0 20px 60px rgba(15,23,42,.18);display:flex;flex-direction:column;max-height:calc(100vh - 64px);margin:auto}',
      '.nk-modal-hd{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid rgba(15,23,42,.08);flex-shrink:0}',
      '.nk-modal-hd h2{margin:0;font-size:1.05rem;font-weight:900;color:var(--charcoal)}',
      '.nk-modal-close{background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--stone);padding:2px 8px;border-radius:6px;line-height:1;font-weight:300}',
      '.nk-modal-close:hover{background:rgba(15,23,42,.06)}',
      '.nk-modal-body{flex:1;overflow-y:auto;padding:20px 24px}',
      '.nk-modal-ft{padding:14px 24px;border-top:1px solid rgba(15,23,42,.08);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0}',
      '.nk-modal-err{font-size:.82rem;color:#b91c1c;flex:1}',
      '.nk-modal-save{padding:9px 22px;border-radius:999px;background:var(--terracotta,#c5683d);color:#fff;border:none;font:inherit;font-size:.84rem;font-weight:800;cursor:pointer;white-space:nowrap}',
      '.nk-modal-save:hover{opacity:.88}.nk-modal-save:disabled{opacity:.5;cursor:not-allowed}',
      /* accordion sections */
      '.nk-sec{border:1px solid rgba(15,23,42,.09);border-radius:10px;overflow:hidden;margin-bottom:8px}',
      '.nk-sec-hd{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none;background:none}',
      '.nk-sec-hd:hover{background:rgba(15,23,42,.025)}',
      '.nk-sec-title{font-size:.88rem;font-weight:800;color:var(--charcoal);flex:1}',
      '.nk-toggle-wrap{display:flex;align-items:center;gap:6px;font-size:.77rem;color:var(--stone);flex-shrink:0}',
      '.nk-toggle{width:34px;height:18px;border-radius:999px;border:none;cursor:pointer;position:relative;background:rgba(15,23,42,.2);transition:background .15s;padding:0;flex-shrink:0;vertical-align:middle}',
      '.nk-toggle.on{background:var(--terracotta,#c5683d)}',
      '.nk-toggle::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}',
      '.nk-toggle.on::after{transform:translateX(16px)}',
      '.nk-sec-chevron{font-size:.72rem;color:var(--stone);transition:transform .2s;flex-shrink:0}',
      '.nk-sec.open .nk-sec-chevron{transform:rotate(180deg)}',
      '.nk-sec-body{padding:0 14px 14px;display:none}',
      '.nk-sec.open .nk-sec-body{display:block}',
      /* form fields */
      '.nk-field{margin-bottom:12px}',
      '.nk-label{display:block;font-size:.74rem;font-weight:800;color:var(--stone);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}',
      '.nk-input,.nk-textarea,.nk-select{width:100%;font:inherit;font-size:.86rem;color:var(--charcoal);background:#fffaf4;border:1px solid rgba(15,23,42,.14);border-radius:8px;padding:8px 11px;box-sizing:border-box}',
      '.nk-input:focus,.nk-textarea:focus,.nk-select:focus{outline:none;border-color:var(--terracotta,#c5683d);background:#fff}',
      '.nk-textarea{resize:vertical;min-height:72px}',
      '.nk-input[readonly]{background:rgba(15,23,42,.04);color:var(--stone);cursor:default}',
      '.nk-ro-note{font-size:.8rem;color:var(--stone);background:rgba(15,23,42,.03);border:1px solid rgba(15,23,42,.08);border-radius:8px;padding:9px 12px;margin-bottom:12px}',
      /* section labels inside modal body */
      '.nk-sub-label{font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--terracotta,#c5683d);margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid rgba(15,23,42,.06)}',
      '.nk-sub-label:first-child{margin-top:0}',
      /* KB card block rows */
      '.nk-kb-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(15,23,42,.06)}',
      '.nk-kb-row:last-child{border-bottom:none}',
      '.nk-kb-name{font-size:.84rem;font-weight:600;color:var(--charcoal)}',
      /* EM card info rows */
      '.nk-em-row{display:grid;grid-template-columns:120px 1fr;gap:8px;padding:8px 12px;border-radius:8px;background:#fffaf4;border:1px solid rgba(15,23,42,.05);margin-bottom:5px}',
      '.nk-em-lbl{font-size:.73rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--stone);padding-top:1px}',
      '.nk-em-val{font-size:.84rem;color:var(--charcoal);font-weight:500;line-height:1.4}',
      '.nk-em-empty{color:rgba(15,23,42,.3);font-style:italic}',
      /* shared card footer */
      '.nk-card-action{display:flex;align-items:center;justify-content:flex-end;margin-top:14px}',
      '.nk-action-btn{padding:8px 18px;border-radius:999px;background:var(--terracotta,#c5683d);color:#fff;border:none;font:inherit;font-size:.82rem;font-weight:800;cursor:pointer}',
      '.nk-action-btn:hover{opacity:.88}',
      /* status badges used in cards */
      '.nk-badge{font-size:.72rem;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap}',
      '.nk-ok{background:rgba(22,163,74,.13);color:#15803d}',
      '.nk-warn{background:rgba(217,119,6,.14);color:#b45309}',
      '.nk-muted{background:rgba(100,100,110,.1);color:#555}',
    ].join('');
    document.head.appendChild(s);
  }());

  /* ── Helpers ───────────────────────────────────────────────────────── */
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function val(obj, key, fallback) {
    if (!obj || obj[key] == null || obj[key] === '') return (fallback != null ? fallback : '');
    return obj[key];
  }

  function gv(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function field(id, label, type, currentVal, placeholder, opts) {
    opts = opts || {};
    var inputHtml;
    if (type === 'textarea') {
      inputHtml = '<textarea id="' + esc(id) + '" class="nk-textarea"' +
        (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') +
        (opts.readonly ? ' readonly' : '') + '>' + esc(currentVal) + '</textarea>';
    } else if (type === 'select') {
      var optionsHtml = (opts.options || []).map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (currentVal === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('');
      inputHtml = '<select id="' + esc(id) + '" class="nk-select">' + optionsHtml + '</select>';
    } else {
      inputHtml = '<input id="' + esc(id) + '" type="' + (type || 'text') + '" class="nk-input"' +
        ' value="' + esc(currentVal) + '"' +
        (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') +
        (opts.readonly ? ' readonly' : '') + '>';
    }
    return '<div class="nk-field"><label class="nk-label" for="' + esc(id) + '">' + esc(label) + '</label>' + inputHtml + '</div>';
  }

  /* ── KB accordion section builder ─────────────────────────────────── */
  function _kbSectionHTML(blockDef) {
    var type     = blockDef.type;
    var label    = blockDef.label;
    var existing = _kbBlocks[type] || {};
    var isActive = existing.is_active !== false;
    var c        = existing.content_jsonb || {};
    var fid      = 'nk-kb-' + type.replace(/_/g, '-');

    var toggleHtml =
      '<div class="nk-toggle-wrap">' +
        '<button type="button" class="nk-toggle' + (isActive ? ' on' : '') + '" id="nk-tog-' + type + '" aria-label="Toggle active" aria-pressed="' + (isActive ? 'true' : 'false') + '"></button>' +
        '<span id="nk-tog-lbl-' + type + '">' + (isActive ? 'Active' : 'Inactive') + '</span>' +
      '</div>';

    var formFields = '';
    switch (type) {
      case 'property_summary':
        formFields =
          field(fid + '-summary', 'Summary', 'textarea', val(c, 'summary'), 'Describe the property for guests…') +
          field(fid + '-airport', 'Nearest airport', 'text', val(c, 'nearest_airport'), 'e.g. Catania-Fontanarossa (CTA) — 6 km, 15 min');
        break;
      case 'wifi':
        formFields =
          field(fid + '-name',   'Network name', 'text', val(c, 'network_name'), 'WiFi SSID') +
          field(fid + '-pw',     'Password',     'text', val(c, 'password'),     'WiFi password') +
          field(fid + '-backup', 'Backup note',  'text', val(c, 'backup_note'),  'e.g. Hotspot available on request');
        break;
      case 'access':
        formFields =
          field(fid + '-entry',   'Entry instructions',     'textarea', val(c, 'entry_instructions'),       'How to enter the property…') +
          field(fid + '-keyret',  'Key return instructions', 'textarea', val(c, 'key_return_instructions'),  'Where to leave keys on departure…') +
          field(fid + '-lockout', 'Lockout instructions',   'textarea', val(c, 'lockout_instructions'),     'What to do if locked out…');
        break;
      case 'check_in':
        formFields =
          field(fid + '-time',   'Check-in time',         'text',     val(c, 'checkin_time'),         'e.g. 15:00') +
          field(fid + '-early',  'Early check-in policy', 'textarea', val(c, 'early_checkin_policy'), 'Early check-in conditions…') +
          field(fid + '-instrs', 'Check-in instructions', 'textarea', val(c, 'checkin_instructions'), 'Step-by-step check-in guide…');
        break;
      case 'check_out':
        formFields =
          field(fid + '-time',   'Check-out time',         'text',     val(c, 'checkout_time'),         'e.g. 10:00') +
          field(fid + '-tasks',  'Check-out tasks',        'textarea', val(c, 'checkout_tasks'),        'Tasks for guests to complete before leaving…') +
          field(fid + '-instrs', 'Check-out instructions', 'textarea', val(c, 'checkout_instructions'), 'Step-by-step check-out guide…');
        break;
      case 'house_rules':
        formFields =
          field(fid + '-summary', 'Rules summary', 'textarea', val(c, 'rules_summary'), 'Key house rules in plain language…') +
          field(fid + '-pets',    'Pet policy',    'text',     val(c, 'pet_policy'),    'e.g. No pets allowed') +
          field(fid + '-smoke',   'Smoking policy','text',     val(c, 'smoking_policy'),'e.g. No smoking indoors') +
          field(fid + '-party',   'Events policy', 'text',     val(c, 'party_policy'),  'e.g. No events or parties') +
          field(fid + '-quiet',   'Quiet hours',   'text',     val(c, 'quiet_hours'),   'e.g. 22:00 – 08:00') +
          field(fid + '-guests',  'Max guests note','text',    val(c, 'max_guests_note'),'e.g. Maximum 4 guests per booking');
        break;
      case 'tourist_tax':
        formFields =
          field(fid + '-amount',  'Amount (EUR)', 'number', val(c, 'amount_eur'), '2.50') +
          field(fid + '-nights',  'Max nights',   'number', val(c, 'max_nights'), '7') +
          field(fid + '-method',  'Collection method', 'select', val(c, 'collection_method'), '', {
            options: [
              { value: '',              label: '— Select method —' },
              { value: 'on_arrival',    label: 'Collected on arrival (cash)' },
              { value: 'bank_transfer', label: 'Bank transfer before arrival' },
              { value: 'online',        label: 'Online payment' },
            ],
          }) +
          field(fid + '-exempt',  'Exemptions',   'textarea', val(c, 'exemptions'),   'Who is exempt from tourist tax…') +
          field(fid + '-receipt', 'Receipt note', 'textarea', val(c, 'receipt_note'), 'How to provide a receipt or declaration…');
        break;
      case 'fallback_support':
        formFields =
          field(fid + '-msg',   'Escalation message', 'textarea', val(c, 'escalation_message'), 'Message shown when the AI cannot help…') +
          field(fid + '-note',  'Contact note',       'text',     val(c, 'contact_note'),        'e.g. Contact the host directly') +
          field(fid + '-hours', 'Support hours',      'text',     val(c, 'support_hours'),       'e.g. 08:00 – 22:00 daily');
        break;
      default:
        formFields = '<p style="color:var(--stone);font-size:.84rem">No editable fields for this block type.</p>';
    }

    return (
      '<div class="nk-sec" id="nk-sec-' + type + '">' +
        '<div class="nk-sec-hd">' +
          '<span class="nk-sec-title">' + esc(label) + '</span>' +
          toggleHtml +
          '<span class="nk-sec-chevron" aria-hidden="true">▾</span>' +
        '</div>' +
        '<div class="nk-sec-body">' + formFields + '</div>' +
      '</div>'
    );
  }

  /* ── KB modal ──────────────────────────────────────────────────────── */
  function _openKbModal() {
    var existing = document.getElementById('nk-kb-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'nk-kb-overlay';
    overlay.className = 'nk-overlay';
    overlay.innerHTML = (
      '<div class="nk-modal" role="dialog" aria-modal="true" aria-labelledby="nk-kb-title">' +
        '<div class="nk-modal-hd">' +
          '<h2 id="nk-kb-title">Configure Knowledge Base</h2>' +
          '<button type="button" class="nk-modal-close" id="nk-kb-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="nk-modal-body">' +
          KB_BLOCKS.map(_kbSectionHTML).join('') +
        '</div>' +
        '<div class="nk-modal-ft">' +
          '<span class="nk-modal-err" id="nk-kb-err" hidden></span>' +
          '<button type="button" class="nk-modal-save" id="nk-kb-save">Save changes</button>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(overlay);

    overlay.querySelector('#nk-kb-close').addEventListener('click', function () { _closeOverlay('nk-kb-overlay'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeOverlay('nk-kb-overlay'); });

    overlay.querySelectorAll('.nk-sec-hd').forEach(function (hd) {
      hd.addEventListener('click', function (e) {
        if (e.target.classList.contains('nk-toggle')) return;
        hd.closest('.nk-sec').classList.toggle('open');
      });
    });

    overlay.querySelectorAll('.nk-toggle').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = btn.classList.toggle('on');
        btn.setAttribute('aria-pressed', String(on));
        var lbl = document.getElementById(btn.id.replace('nk-tog-', 'nk-tog-lbl-'));
        if (lbl) lbl.textContent = on ? 'Active' : 'Inactive';
      });
    });

    document.getElementById('nk-kb-save').addEventListener('click', _saveKnowledge);

    var firstSec = overlay.querySelector('.nk-sec');
    if (firstSec) firstSec.classList.add('open');

    requestAnimationFrame(function () { overlay.classList.add('nk-open'); });
  }

  function _closeOverlay(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('nk-open');
    setTimeout(function () { el.remove(); }, 220);
  }

  /* ── KB collect & save ─────────────────────────────────────────────── */
  function _collectKbBlocks() {
    return KB_BLOCKS.map(function (bd) {
      var type    = bd.type;
      var fid     = 'nk-kb-' + type.replace(/_/g, '-');
      var togBtn  = document.getElementById('nk-tog-' + type);
      var isActive = togBtn ? togBtn.classList.contains('on') : true;
      var existing = _kbBlocks[type] || {};
      var content  = {};

      switch (type) {
        case 'property_summary':
          content = { summary: gv(fid + '-summary'), nearest_airport: gv(fid + '-airport') };
          break;
        case 'wifi':
          content = { network_name: gv(fid + '-name'), password: gv(fid + '-pw'), backup_note: gv(fid + '-backup') };
          break;
        case 'access':
          content = { entry_instructions: gv(fid + '-entry'), key_return_instructions: gv(fid + '-keyret'), lockout_instructions: gv(fid + '-lockout') };
          break;
        case 'check_in':
          content = { checkin_time: gv(fid + '-time'), early_checkin_policy: gv(fid + '-early'), checkin_instructions: gv(fid + '-instrs') };
          break;
        case 'check_out':
          content = { checkout_time: gv(fid + '-time'), checkout_tasks: gv(fid + '-tasks'), checkout_instructions: gv(fid + '-instrs') };
          break;
        case 'house_rules':
          content = { rules_summary: gv(fid + '-summary'), pet_policy: gv(fid + '-pets'), smoking_policy: gv(fid + '-smoke'), party_policy: gv(fid + '-party'), quiet_hours: gv(fid + '-quiet'), max_guests_note: gv(fid + '-guests') };
          break;
        case 'tourist_tax':
          content = {
            amount_eur:        parseFloat(gv(fid + '-amount'))    || null,
            max_nights:        parseInt(gv(fid + '-nights'), 10)  || null,
            collection_method: gv(fid + '-method'),
            exemptions:        gv(fid + '-exempt'),
            receipt_note:      gv(fid + '-receipt'),
          };
          break;
        case 'fallback_support':
          content = { escalation_message: gv(fid + '-msg'), contact_note: gv(fid + '-note'), support_hours: gv(fid + '-hours') };
          break;
      }

      return {
        block_type:         type,
        content_jsonb:      content,
        is_active:          isActive,
        visibility_scope:   _normVis(existing.visibility_scope, type),
        session_phase_gate: existing.session_phase_gate || null,
      };
    });
  }

  async function _saveKnowledge() {
    var saveBtn = document.getElementById('nk-kb-save');
    var errEl   = document.getElementById('nk-kb-err');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    if (errEl)   { errEl.hidden = true; errEl.textContent = ''; }

    try {
      var blocks = _collectKbBlocks();
      var result = await window.NauxicaSupabase.functions.invoke('knowledge-writer', {
        body: { property_id: _propertyId, blocks: blocks },
      });
      if (result.error) {
        var body = result.data || {};
        console.error('[NauxicaKnowledge] knowledge-writer failed', {
          invokeError: result.error,
          serverError: body.error,
          code:        body.code,
          hint:        body.hint,
          details:     body.details,
        });
        var msg = body.error || result.error.message || 'Edge function error';
        if (body.hint)    msg += ' — ' + body.hint;
        if (body.details) msg += ' (' + body.details + ')';
        throw new Error(msg);
      }

      blocks.forEach(function (b) {
        _kbBlocks[b.block_type] = Object.assign({}, _kbBlocks[b.block_type] || {}, b);
      });

      _closeOverlay('nk-kb-overlay');
      _renderKbCard();
      if (typeof _afterSaveFn === 'function') _afterSaveFn();
    } catch (err) {
      if (errEl) {
        errEl.textContent = 'Save failed: ' + (err.message || String(err));
        errEl.hidden = false;
      }
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; }
    }
  }

  /* ── KB card renderer ──────────────────────────────────────────────── */
  function _renderKbCard() {
    var slot = document.getElementById('nk-kb-slot');
    if (!slot) return;

    var activeCount = 0;
    var rows = KB_BLOCKS.map(function (bd) {
      var block    = _kbBlocks[bd.type] || {};
      var isActive = block.is_active === true;
      if (isActive) activeCount++;
      var badgeCls = isActive ? 'nk-badge nk-ok' : 'nk-badge nk-muted';
      return (
        '<div class="nk-kb-row">' +
          '<span class="nk-kb-name">' + esc(bd.label) + '</span>' +
          '<span class="' + badgeCls + '">' + (isActive ? 'Active' : 'Not set') + '</span>' +
        '</div>'
      );
    }).join('');

    var headerBadge = activeCount > 0
      ? '<span class="nk-badge nk-ok">' + activeCount + '/' + KB_BLOCKS.length + ' active</span>'
      : '<span class="nk-badge nk-muted">Not configured</span>';

    slot.className = 'dashboard-card';
    slot.innerHTML = (
      '<div class="card-heading-row">' +
        '<div>' +
          '<h3 class="dashboard-section-title">Knowledge Base</h3>' +
          '<p class="dashboard-card-text">AI concierge content and property knowledge</p>' +
        '</div>' +
        headerBadge +
      '</div>' +
      '<div style="margin:12px 0 4px">' + rows + '</div>' +
      '<div class="nk-card-action">' +
        '<button type="button" class="nk-action-btn" id="nk-kb-open-btn">Configure Knowledge Base</button>' +
      '</div>'
    );

    document.getElementById('nk-kb-open-btn').addEventListener('click', _openKbModal);
  }

  /* ── Emergency Data modal ──────────────────────────────────────────── */
  function _openEmModal() {
    var existing = document.getElementById('nk-em-overlay');
    if (existing) existing.remove();

    var em  = _emData             || {};
    var oc  = _contacts['owner']      || {};
    var cc  = _contacts['caretaker']  || {};
    var nop = _contacts['nauxica_operator'] || {};

    var nauxicaNote = nop.name || nop.phone
      ? ('<div class="nk-ro-note"><strong>' + esc(nop.name || 'Nauxica operator') + '</strong>' + (nop.phone ? ' · ' + esc(nop.phone) : '') + '<br><small>Set by Nauxica — not editable here</small></div>')
      : '<div class="nk-ro-note" style="color:var(--stone)">Nauxica operator contact — assigned by Nauxica</div>';

    var formHtml = (
      '<p class="nk-sub-label">Nauxica Operator (read-only)</p>' +
      nauxicaNote +

      '<p class="nk-sub-label">Nearest Hospital</p>' +
      field('nk-em-hosp-name',  'Hospital name',     'text', val(em, 'nearest_hospital_name'),     'e.g. Ospedale Garibaldi-Centro') +
      field('nk-em-hosp-addr',  'Address',           'text', val(em, 'nearest_hospital_address'),  'Street and city') +
      field('nk-em-hosp-dist',  'Distance',          'text', val(em, 'nearest_hospital_distance'), 'e.g. 2 km, 8 min by car') +
      field('nk-em-hosp-phone', 'Emergency phone',   'text', val(em, 'nearest_hospital_phone'),    'e.g. 118') +

      '<p class="nk-sub-label">Utility Shutoffs</p>' +
      field('nk-em-gas',   'Gas shutoff instructions',         'textarea', val(em, 'gas_shutoff_instructions'),         'Location and steps to shut off gas…') +
      field('nk-em-elec',  'Electricity shutoff instructions', 'textarea', val(em, 'electricity_shutoff_instructions'), 'Location and steps to shut off electricity…') +
      field('nk-em-water', 'Water shutoff instructions',       'textarea', val(em, 'water_shutoff_instructions'),       'Location and steps to shut off water…') +

      '<p class="nk-sub-label">Evacuation & Hazards</p>' +
      field('nk-em-evac-route',    'Evacuation route',       'textarea', val(em, 'evacuation_route_description'), 'Describe the evacuation route from the property…') +
      field('nk-em-evac-assembly', 'Assembly point',         'text',     val(em, 'evacuation_assembly_point'),   'e.g. Car park on the corner of Via Roma') +
      field('nk-em-hazards',       'Property hazards',       'textarea', val(em, 'property_specific_hazards'),   'Any property-specific hazards guests should know about…') +
      field('nk-em-instrs',        'Emergency instructions', 'textarea', val(em, 'emergency_instructions'),      'General emergency instructions for guests…') +

      '<p class="nk-sub-label">Owner Contact</p>' +
      field('nk-ct-owner-name',  'Name *',  'text', val(oc, 'contact_name'),  'Your full name') +
      field('nk-ct-owner-phone', 'Phone *', 'text', val(oc, 'contact_phone'), '+39 …') +

      '<p class="nk-sub-label">Caretaker Contact</p>' +
      field('nk-ct-caretaker-name',  'Name',  'text', val(cc, 'contact_name'),  'Caretaker name') +
      field('nk-ct-caretaker-phone', 'Phone', 'text', val(cc, 'contact_phone'), '+39 …')
    );

    var overlay = document.createElement('div');
    overlay.id = 'nk-em-overlay';
    overlay.className = 'nk-overlay';
    overlay.innerHTML = (
      '<div class="nk-modal" role="dialog" aria-modal="true" aria-labelledby="nk-em-title">' +
        '<div class="nk-modal-hd">' +
          '<h2 id="nk-em-title">Emergency Data</h2>' +
          '<button type="button" class="nk-modal-close" id="nk-em-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="nk-modal-body">' + formHtml + '</div>' +
        '<div class="nk-modal-ft">' +
          '<span class="nk-modal-err" id="nk-em-err" hidden></span>' +
          '<button type="button" class="nk-modal-save" id="nk-em-save">Save changes</button>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(overlay);

    overlay.querySelector('#nk-em-close').addEventListener('click', function () { _closeOverlay('nk-em-overlay'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeOverlay('nk-em-overlay'); });
    document.getElementById('nk-em-save').addEventListener('click', _saveEmData);

    requestAnimationFrame(function () { overlay.classList.add('nk-open'); });
  }

  /* ── EM save — routes through emergency-writer Edge Function ───────── */
  async function _saveEmData() {
    var saveBtn = document.getElementById('nk-em-save');
    var errEl   = document.getElementById('nk-em-err');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    if (errEl)   { errEl.hidden = true; errEl.textContent = ''; }

    try {
      // Collect required NOT NULL fields first so validation runs before any network call.
      var ownerName  = gv('nk-ct-owner-name');
      var ownerPhone = gv('nk-ct-owner-phone');
      var hospName   = gv('nk-em-hosp-name');
      var hospAddr   = gv('nk-em-hosp-addr');

      var missing = [];
      if (!ownerName)  missing.push('Owner name is required');
      if (!ownerPhone) missing.push('Owner phone is required');
      if (!hospName)   missing.push('Nearest hospital name is required');
      if (!hospAddr)   missing.push('Nearest hospital address is required');
      if (missing.length) throw new Error(missing.join('. '));

      // owner_emergency_name / owner_emergency_phone are NOT NULL in emergency_data.
      // The owner contact form fields serve both the emergency_data row and the
      // emergency_contacts 'owner' row — same person, same values.
      var emPayload = {
        owner_emergency_name:             ownerName,
        owner_emergency_phone:            ownerPhone,
        nearest_hospital_name:            hospName,
        nearest_hospital_address:         hospAddr,
        nearest_hospital_distance:        gv('nk-em-hosp-dist')     || null,
        nearest_hospital_phone:           gv('nk-em-hosp-phone')    || null,
        gas_shutoff_instructions:         gv('nk-em-gas')           || null,
        electricity_shutoff_instructions: gv('nk-em-elec')          || null,
        water_shutoff_instructions:       gv('nk-em-water')         || null,
        evacuation_route_description:     gv('nk-em-evac-route')    || null,
        evacuation_assembly_point:        gv('nk-em-evac-assembly') || null,
        property_specific_hazards:        gv('nk-em-hazards')       || null,
        emergency_instructions:           gv('nk-em-instrs')        || null,
      };

      var contacts = {};
      if (ownerName || ownerPhone) {
        contacts.owner = {
          contact_name:        ownerName  || null,
          contact_phone:       ownerPhone || null,
          escalation_priority: 1,
          is_active:           true,
          guest_visible:       false,
          ai_usable:           false,
        };
      }

      var ctName  = gv('nk-ct-caretaker-name');
      var ctPhone = gv('nk-ct-caretaker-phone');
      if (ctName || ctPhone) {
        contacts.caretaker = {
          contact_name:        ctName  || null,
          contact_phone:       ctPhone || null,
          escalation_priority: 2,
          is_active:           true,
          guest_visible:       false,
          ai_usable:           false,
        };
      }

      var result = await window.NauxicaSupabase.functions.invoke('emergency-writer', {
        body: {
          property_id:    _propertyId,
          emergency_data: emPayload,
          contacts:       contacts,
        },
      });

      if (result.error) {
        var body = result.data || {};
        console.error('[NauxicaKnowledge] emergency-writer failed', {
          invokeError: result.error,
          serverError: body.error,
          code:        body.code,
          hint:        body.hint,
        });
        var msg = body.error || result.error.message || 'Edge function error';
        if (body.hint)    msg += ' — ' + body.hint;
        if (body.details) msg += ' (' + body.details + ')';
        throw new Error(msg);
      }

      // Merge saved data back into local state.
      Object.assign(_emData, emPayload);
      var savedContacts = (result.data && result.data.contacts) || {};
      if (savedContacts.owner)     _contacts.owner     = Object.assign({}, _contacts.owner     || {}, savedContacts.owner);
      if (savedContacts.caretaker) _contacts.caretaker = Object.assign({}, _contacts.caretaker || {}, savedContacts.caretaker);

      _closeOverlay('nk-em-overlay');
      _renderEmCard();
      if (typeof _afterSaveFn === 'function') _afterSaveFn();
    } catch (err) {
      if (errEl) {
        errEl.textContent = 'Save failed: ' + (err.message || String(err));
        errEl.hidden = false;
      }
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; }
    }
  }

  /* ── EM card renderer ──────────────────────────────────────────────── */
  function _renderEmCard() {
    var slot = document.getElementById('nk-em-slot');
    if (!slot) return;

    var em  = _emData              || {};
    var oc  = _contacts['owner']       || {};
    var cc  = _contacts['caretaker']   || {};

    var ownerStr     = oc.contact_name  ? (oc.contact_name + (oc.contact_phone ? ' · ' + oc.contact_phone : '')) : null;
    var caretakerStr = cc.contact_name  ? (cc.contact_name + (cc.contact_phone ? ' · ' + cc.contact_phone : '')) : null;

    var hasHospital = !!(em.nearest_hospital_name);
    var hasOwner    = !!(ownerStr);
    var requiredMet = [hasHospital, hasOwner].filter(Boolean).length;
    var requiredTotal = 2;

    var headerBadge = requiredMet >= requiredTotal
      ? '<span class="nk-badge nk-ok">Complete</span>'
      : '<span class="nk-badge nk-warn">' + requiredMet + '/' + requiredTotal + ' required</span>';

    function emRow(label, value) {
      var valHtml = value
        ? '<span class="nk-em-val">' + esc(value) + '</span>'
        : '<span class="nk-em-val nk-em-empty">Not set</span>';
      return '<div class="nk-em-row"><span class="nk-em-lbl">' + esc(label) + '</span>' + valHtml + '</div>';
    }

    slot.className = 'dashboard-card';
    slot.innerHTML = (
      '<div class="card-heading-row">' +
        '<div>' +
          '<h3 class="dashboard-section-title">Emergency Data</h3>' +
          '<p class="dashboard-card-text">Emergency contacts and utility shutoff locations</p>' +
        '</div>' +
        headerBadge +
      '</div>' +
      '<div style="margin:12px 0 4px">' +
        emRow('Hospital',  em.nearest_hospital_name || null) +
        emRow('Owner',     ownerStr) +
        emRow('Caretaker', caretakerStr) +
      '</div>' +
      '<div class="nk-card-action">' +
        '<button type="button" class="nk-action-btn" id="nk-em-open-btn">Edit Emergency Data</button>' +
      '</div>'
    );

    document.getElementById('nk-em-open-btn').addEventListener('click', _openEmModal);
  }

  /* ── Init ──────────────────────────────────────────────────────────── */
  async function init(propertyId, afterSaveFn) {
    _propertyId  = propertyId;
    _afterSaveFn = afterSaveFn || null;
    _kbBlocks    = {};
    _emData      = {};
    _contacts    = {};

    var kbSlot = document.getElementById('nk-kb-slot');
    var emSlot = document.getElementById('nk-em-slot');
    var loadingHtml = '<p style="color:var(--stone);font-size:.84rem;padding:8px 0">Loading…</p>';
    if (kbSlot) { kbSlot.className = 'dashboard-card'; kbSlot.innerHTML = loadingHtml; }
    if (emSlot) { emSlot.className = 'dashboard-card'; emSlot.innerHTML = loadingHtml; }

    try {
      var results = await Promise.all([
        window.NauxicaSupabase
          .from('property_knowledge_blocks')
          .select('block_type, content_jsonb, is_active, visibility_scope, session_phase_gate')
          .eq('property_id', propertyId),
        window.NauxicaSupabase
          .from('emergency_data')
          .select('*')
          .eq('property_id', propertyId)
          .maybeSingle(),
        window.NauxicaSupabase
          .from('emergency_contacts')
          .select('*')
          .eq('property_id', propertyId),
      ]);

      var kbRes = results[0];
      var emRes = results[1];
      var ctRes = results[2];

      if (kbRes.data) {
        kbRes.data.forEach(function (row) { _kbBlocks[row.block_type] = row; });
      }
      if (emRes.data) { _emData = emRes.data; }
      if (ctRes.data) {
        ctRes.data.forEach(function (row) { _contacts[row.contact_type] = row; });
      }
    } catch (err) {
      console.error('[NauxicaKnowledge] init error:', err);
    }

    _renderKbCard();
    _renderEmCard();
  }

  return { init: init };
}());
