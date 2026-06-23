/**
 * nauxica-wizard.js
 * Shared Add / Edit Property wizard.
 * Usage: NauxicaWizard.open(existingProp, afterSaveFn)
 *   existingProp  — null for CREATE, property object for EDIT
 *   afterSaveFn   — function(savedProp) called after successful save
 */
window.NauxicaWizard = (function () {

  var _initialized    = false;
  var _wizardData     = {};
  var _editId         = null;
  var _currentStep    = 1;
  var _afterSave      = null;
  var _mode           = 'property'; // 'property' | 'guest'
  var _guestData      = {};
  var _guestPropId    = null;
  var _emergencyData  = {};
  var _contactsData   = { owner: {}, caretaker: {} };

  var TOTAL_STEPS = 9;
  var STEP_TITLES = [
    'Property Identity',
    'Location',
    'Configuration & Amenities',
    'Access & Check-in',
    'House Rules',
    'Registration & Compliance',
    'WiFi & Connectivity',
    'Emergency Data',
    'Emergency Contacts'
  ];

  var GUEST_TOTAL_STEPS = 4;
  var GUEST_STEP_TITLES = [
    'Guest Identity',
    'Stay Details',
    'Booking Info',
    'Confirm & Save'
  ];

  /* ── CSS ──────────────────────────────────────────────────── */
  var WIZARD_CSS = [
    '.wizard-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9996;',
    'opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease}',
    '.wizard-overlay.is-visible{opacity:1;visibility:visible}',
    '.wizard-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-48%) scale(.98);',
    'width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 48px);background:#fff;',
    'border-radius:24px;box-shadow:0 28px 80px rgba(15,23,42,.2);display:flex;',
    'flex-direction:column;overflow:hidden;z-index:9997;opacity:0;visibility:hidden;',
    'transition:opacity .25s ease,transform .25s ease,visibility .25s ease}',
    '.wizard-modal.is-visible{opacity:1;visibility:visible;transform:translate(-50%,-50%) scale(1)}',
    '.wizard-header{display:flex;align-items:flex-start;justify-content:space-between;',
    'padding:22px 24px 14px;border-bottom:1px solid rgba(15,23,42,.06);flex-shrink:0}',
    '.wizard-eyebrow{margin:0 0 3px;font-size:.76rem;font-weight:700;text-transform:uppercase;',
    'letter-spacing:.08em;color:var(--terracotta)}',
    '.wizard-mode-label{margin:2px 0 0;font-size:.72rem;font-weight:700;color:var(--stone)}',
    '.wizard-title{margin:0;font-size:1.15rem;font-weight:900;color:var(--charcoal)}',
    '.wizard-close{border:none;background:rgba(15,23,42,.06);color:var(--stone);width:34px;height:34px;',
    'border-radius:999px;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;',
    'justify-content:center;flex-shrink:0;margin-top:2px;transition:background .15s}',
    '.wizard-close:hover{background:rgba(15,23,42,.12)}',
    '.wizard-progress-track{height:3px;background:rgba(15,23,42,.08);flex-shrink:0}',
    '.wizard-progress-fill{height:100%;background:var(--terracotta);transition:width .3s ease;',
    'border-radius:0 2px 2px 0}',
    '.wizard-body{flex:1;overflow-y:auto;padding:22px 24px;display:grid;gap:16px;align-content:start}',
    '.wizard-body label{display:grid;gap:6px;font-size:.84rem;font-weight:800;color:var(--charcoal)}',
    '.wizard-body input,.wizard-body select,.wizard-body textarea{width:100%;padding:12px 14px;',
    'border-radius:12px;border:1px solid rgba(15,23,42,.1);background:#fffaf4;font:inherit;',
    'font-size:.9rem;color:var(--charcoal);box-sizing:border-box;transition:border-color .15s}',
    '.wizard-body input:focus,.wizard-body select:focus,.wizard-body textarea:focus{',
    'outline:none;border-color:var(--terracotta)}',
    '.wizard-body textarea{resize:vertical;min-height:80px}',
    '.wizard-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '.wizard-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}',
    '.wizard-section-label{margin:6px 0 0;font-size:.78rem;font-weight:900;text-transform:uppercase;',
    'letter-spacing:.07em;color:var(--terracotta)}',
    '.wizard-optional{font-size:.75rem;font-weight:600;color:var(--muted)}',
    '.wizard-checklist{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.wizard-check-item{display:flex!important;flex-direction:row!important;align-items:center;',
    'gap:8px;padding:10px 12px;border-radius:10px;border:1px solid rgba(15,23,42,.08);',
    'background:#fffaf4;font-size:.84rem!important;font-weight:600!important;cursor:pointer;',
    'transition:border-color .15s,background .15s}',
    '.wizard-check-item:hover{border-color:rgba(197,104,61,.3)}',
    '.wizard-check-item input[type="checkbox"]{width:16px!important;height:16px!important;',
    'padding:0!important;border-radius:4px!important;flex-shrink:0;accent-color:var(--terracotta)}',
    '.wizard-error{padding:10px 14px;border-radius:10px;background:rgba(220,38,38,.08);',
    'color:#b91c1c;font-size:.84rem;font-weight:700;display:none}',
    '.wizard-error.is-visible{display:block}',
    '.wizard-footer{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;',
    'border-top:1px solid rgba(15,23,42,.06);flex-shrink:0;background:#fff}',
    '.wizard-back-btn{border:1px solid rgba(15,23,42,.12);background:transparent;color:var(--stone);',
    'font:inherit;font-size:.88rem;font-weight:700;padding:9px 20px;border-radius:999px;cursor:pointer;',
    'transition:background .15s}',
    '.wizard-back-btn:hover{background:rgba(15,23,42,.05)}',
    '.wizard-back-btn:disabled{opacity:.35;cursor:default}',
    '.wizard-next-btn{border:none;background:var(--terracotta);color:#fff;font:inherit;',
    'font-size:.88rem;font-weight:900;padding:10px 24px;border-radius:999px;cursor:pointer;',
    'box-shadow:0 8px 20px rgba(197,104,61,.22);transition:transform .15s,box-shadow .15s}',
    '.wizard-next-btn:hover{transform:translateY(-1px);box-shadow:0 12px 26px rgba(197,104,61,.28)}',
    '.wizard-summary-block{display:grid;gap:6px}',
    '.wizard-summary-section{font-size:.78rem;font-weight:900;text-transform:uppercase;',
    'letter-spacing:.07em;color:var(--terracotta);margin:10px 0 4px}',
    '.wizard-summary-section:first-child{margin-top:0}',
    '.wizard-summary-row{display:grid;grid-template-columns:120px 1fr;gap:8px;padding:8px 12px;',
    'border-radius:8px;background:#fffaf4;border:1px solid rgba(15,23,42,.06);align-items:start}',
    '.wizard-summary-label{font-size:.76rem;font-weight:800;color:var(--stone);text-transform:uppercase;letter-spacing:.06em}',
    '.wizard-summary-value{font-size:.86rem;color:var(--charcoal);font-weight:500}',
    '@media(max-width:640px){.wizard-row-2{grid-template-columns:1fr}',
    '.wizard-row-3{grid-template-columns:1fr 1fr}.wizard-checklist{grid-template-columns:1fr}}'
  ].join('');

  /* ── HTML ─────────────────────────────────────────────────── */
  var WIZARD_HTML = [
    '<div id="wizardOverlay" class="wizard-overlay" aria-hidden="true"></div>',
    '<div id="wizardModal" class="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizardTitle">',
      '<div class="wizard-header">',
        '<div>',
          '<p class="wizard-eyebrow" id="wizardEyebrow">Step 1 of 6</p>',
          '<p class="wizard-mode-label" id="wizardModeLabel"></p>',
          '<h2 class="wizard-title" id="wizardTitle">Property Identity</h2>',
        '</div>',
        '<button class="wizard-close" id="wizardClose" aria-label="Close wizard">&#215;</button>',
      '</div>',
      '<div class="wizard-progress-track">',
        '<div class="wizard-progress-fill" id="wizardProgressFill" style="width:16.66%"></div>',
      '</div>',
      '<div class="wizard-body" id="wizardBody"></div>',
      '<div class="wizard-footer">',
        '<button class="wizard-back-btn" id="wizardBack" disabled>Back</button>',
        '<button class="wizard-next-btn" id="wizardNext">Next</button>',
      '</div>',
    '</div>'
  ].join('');

  /* ── Init (runs once) ─────────────────────────────────────── */
  function _ensureInit() {
    if (_initialized) return;

    var style = document.createElement('style');
    style.textContent = WIZARD_CSS;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.innerHTML = WIZARD_HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    document.getElementById('wizardClose').addEventListener('click', _close);
    document.getElementById('wizardOverlay').addEventListener('click', _close);
    document.getElementById('wizardNext').addEventListener('click', _handleNext);
    document.getElementById('wizardBack').addEventListener('click', _handleBack);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') _close();
    });

    _initialized = true;
  }

  /* ── Public: open ─────────────────────────────────────────── */
  function open(existingProp, afterSaveFn) {
    _ensureInit();
    _mode          = 'property';
    _editId        = existingProp ? existingProp.id : null;
    _wizardData    = existingProp ? Object.assign({}, existingProp) : {};
    _emergencyData = {};
    _contactsData  = { owner: {}, caretaker: {} };
    _afterSave     = typeof afterSaveFn === 'function' ? afterSaveFn : null;
    _currentStep   = 1;
    _renderStep();
    document.getElementById('wizardOverlay').classList.add('is-visible');
    document.getElementById('wizardModal').classList.add('is-visible');
    document.getElementById('wizardBody').scrollTop = 0;
  }

  /* ── Close ────────────────────────────────────────────────── */
  function _close() {
    document.getElementById('wizardOverlay').classList.remove('is-visible');
    document.getElementById('wizardModal').classList.remove('is-visible');
  }

  /* ── Render step ──────────────────────────────────────────── */
  function _renderStep() {
    var isGuest    = _mode === 'guest';
    var totalSteps = isGuest ? GUEST_TOTAL_STEPS : TOTAL_STEPS;
    var titles     = isGuest ? GUEST_STEP_TITLES  : STEP_TITLES;
    var saveLabel  = isGuest ? 'Save Guest' : 'Save Property';
    var modeLabel  = isGuest ? 'New guest' : (_editId ? 'Editing property' : 'New property');

    var pct = (_currentStep / totalSteps * 100).toFixed(2) + '%';
    document.getElementById('wizardProgressFill').style.width = pct;
    document.getElementById('wizardEyebrow').textContent      = 'Step ' + _currentStep + ' of ' + totalSteps;
    document.getElementById('wizardModeLabel').textContent    = modeLabel;
    document.getElementById('wizardTitle').textContent        = titles[_currentStep - 1];
    document.getElementById('wizardBack').disabled            = _currentStep === 1;
    document.getElementById('wizardNext').textContent         = _currentStep === totalSteps ? saveLabel : 'Next';
    document.getElementById('wizardBody').innerHTML           = isGuest ? _buildGuestStepHTML(_currentStep) : _buildStepHTML(_currentStep);
    if (!isGuest) _bindStepEvents(_currentStep);
    document.getElementById('wizardBody').scrollTop = 0;
  }

  /* ── Value helpers ────────────────────────────────────────── */
  function _v(key)  { return _wizardData[key] != null ? _wizardData[key] : ''; }
  function _vb(key) { return _wizardData[key] === true; }
  function _gv(key) { return _guestData[key]  != null ? _guestData[key]  : ''; }

  function _e(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _opt(val, label, current) {
    return '<option value="' + _e(val) + '"' + (val === current ? ' selected' : '') + '>' + _e(label) + '</option>';
  }

  function _check(id, label, checked) {
    return '<label class="wizard-check-item"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '> ' + _e(label) + '</label>';
  }

  function _errorBox() {
    return '<div class="wizard-error" id="wizardError"></div>';
  }

  function _arrToText(arr, sep) {
    if (!arr || !arr.length) return '';
    return arr.join(sep || '\n');
  }

  /* ── Step HTML ────────────────────────────────────────────── */
  function _buildStepHTML(step) {
    var e = _e;
    var v = _v;

    if (step === 1) return [
      '<label>Property name <span style="color:var(--terracotta)">*</span>',
        '<input type="text" id="wf_display_name" maxlength="60" placeholder="e.g. Villa del Sole" value="' + e(v('display_name')) + '">',
      '</label>',
      '<label>Property type <span style="color:var(--terracotta)">*</span>',
        '<select id="wf_property_type">',
          _opt('','Select a type',v('property_type')),
          _opt('apartment','Apartment',v('property_type')),
          _opt('studio','Studio',v('property_type')),
          _opt('house','House',v('property_type')),
          _opt('villa','Villa',v('property_type')),
          _opt('penthouse','Penthouse',v('property_type')),
          _opt('cottage','Cottage',v('property_type')),
          _opt('bed_and_breakfast','Bed & Breakfast',v('property_type')),
          _opt('guest_house','Guest House',v('property_type')),
          _opt('holiday_home','Holiday Home',v('property_type')),
          _opt('other','Other',v('property_type')),
        '</select>',
      '</label>',
      '<div id="wf_custom_type_row" style="display:' + (v('property_type')==='other' ? 'grid' : 'none') + '">',
        '<label>Custom type name',
          '<input type="text" id="wf_property_type_custom" placeholder="e.g. Farmhouse" value="' + e(v('property_type_custom')) + '">',
        '</label>',
      '</div>',
      '<label>Area / neighbourhood description <span class="wizard-optional">(recommended)</span>',
        '<textarea id="wf_area_description" placeholder="Describe the area to help guests orient themselves…">' + e(v('area_description')) + '</textarea>',
      '</label>',
      '<label>Property description <span class="wizard-optional">(recommended — shown to AI concierge)</span>',
        '<textarea id="wf_property_summary" placeholder="A brief, welcoming description of your property for guests…">' + e(v('property_summary')) + '</textarea>',
      '</label>',
      '<label>Nearest airport <span class="wizard-optional">(optional)</span>',
        '<input type="text" id="wf_nearest_airport" placeholder="e.g. Catania-Fontanarossa (CTA), 45 km" value="' + e(v('nearest_airport')) + '">',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 2) return [
      '<label>Street address <span style="color:var(--terracotta)">*</span>',
        '<input type="text" id="wf_address_street" placeholder="Via Roma 1" value="' + e(v('address_street')) + '">',
      '</label>',
      '<label>Locality <span style="color:var(--terracotta)">*</span>',
        '<input type="text" id="wf_address_locality" placeholder="e.g. Taormina Centro" value="' + e(v('address_locality')) + '">',
      '</label>',
      '<div class="wizard-row-2">',
        '<label>Municipality <span style="color:var(--terracotta)">*</span>',
          '<input type="text" id="wf_address_municipality" placeholder="e.g. Taormina" value="' + e(v('address_municipality')) + '">',
        '</label>',
        '<label>Province <span style="color:var(--terracotta)">*</span>',
          '<input type="text" id="wf_address_province" placeholder="e.g. ME" value="' + e(v('address_province')) + '">',
        '</label>',
      '</div>',
      '<label>Postcode <span style="color:var(--terracotta)">*</span>',
        '<input type="text" id="wf_address_postcode" placeholder="98039" value="' + e(v('address_postcode')) + '">',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 3) return [
      '<div class="wizard-row-3">',
        '<label>Max guests <span style="color:var(--terracotta)">*</span>',
          '<input type="number" id="wf_max_guests" min="1" max="50" placeholder="6" value="' + e(v('max_guests')) + '">',
        '</label>',
        '<label>Bedrooms <span style="color:var(--terracotta)">*</span>',
          '<input type="number" id="wf_bedrooms" min="0" max="20" placeholder="3" value="' + e(v('bedrooms')) + '">',
        '</label>',
        '<label>Bathrooms <span style="color:var(--terracotta)">*</span>',
          '<input type="number" id="wf_bathrooms" min="0" max="20" step="0.5" placeholder="2" value="' + e(v('bathrooms')) + '">',
        '</label>',
      '</div>',
      '<label>Beds configuration <span style="color:var(--terracotta)">*</span>',
        '<input type="text" id="wf_beds_configuration" placeholder="e.g. 1 double, 2 singles, 1 sofa bed" value="' + e(v('beds_configuration')) + '">',
      '</label>',
      '<p class="wizard-section-label">Amenities</p>',
      '<div class="wizard-checklist">',
        _check('wf_has_air_conditioning',  'Air conditioning',  _vb('has_air_conditioning')),
        _check('wf_has_washing_machine',   'Washing machine',   _vb('has_washing_machine')),
        _check('wf_has_dishwasher',        'Dishwasher',        _vb('has_dishwasher')),
        _check('wf_has_elevator',          'Elevator',          _vb('has_elevator')),
        _check('wf_has_parking',           'Parking',           _vb('has_parking')),
        _check('wf_has_balcony_or_terrace','Balcony / terrace', _vb('has_balcony_or_terrace')),
        _check('wf_has_pool',              'Swimming pool',     _vb('has_pool')),
        _check('wf_has_bbq',              'BBQ',               _vb('has_bbq')),
      '</div>',
      '<label>Additional amenities <span class="wizard-optional">(optional — one per line)</span>',
        '<textarea id="wf_amenities_list" placeholder="Heated pool&#10;Outdoor shower&#10;Bicycles">' + e(_arrToText(_wizardData.amenities_list)) + '</textarea>',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 4) return [
      '<div class="wizard-row-3">',
        '<label>Check-in from <span style="color:var(--terracotta)">*</span>',
          '<input type="time" id="wf_checkin_time_from" value="' + e(v('checkin_time_from') || '15:00') + '">',
        '</label>',
        '<label>Check-in until <span style="color:var(--terracotta)">*</span>',
          '<input type="time" id="wf_checkin_time_to" value="' + e(v('checkin_time_to') || '20:00') + '">',
        '</label>',
        '<label>Check-out by <span style="color:var(--terracotta)">*</span>',
          '<input type="time" id="wf_checkout_time" value="' + e(v('checkout_time') || '10:00') + '">',
        '</label>',
      '</div>',
      '<label>Access method <span style="color:var(--terracotta)">*</span>',
        '<select id="wf_access_method">',
          _opt('','Select method',v('access_method')),
          _opt('key_box','Key box',v('access_method')),
          _opt('smart_lock','Smart lock',v('access_method')),
          _opt('host_handover','Host handover',v('access_method')),
          _opt('concierge_desk','Concierge desk',v('access_method')),
        '</select>',
      '</label>',
      '<div class="wizard-row-2">',
        '<label>Early check-in <span class="wizard-optional">(recommended)</span>',
          '<select id="wf_early_checkin_policy">',
            _opt('','Not specified',v('early_checkin_policy')),
            _opt('yes_free','Yes, free of charge',v('early_checkin_policy')),
            _opt('yes_paid','Yes, with a fee',v('early_checkin_policy')),
            _opt('exceptional','On request only',v('early_checkin_policy')),
            _opt('no','Not available',v('early_checkin_policy')),
          '</select>',
        '</label>',
        '<label>Late check-out <span class="wizard-optional">(recommended)</span>',
          '<select id="wf_late_checkout_policy">',
            _opt('','Not specified',v('late_checkout_policy')),
            _opt('yes_free','Yes, free of charge',v('late_checkout_policy')),
            _opt('yes_paid','Yes, with a fee',v('late_checkout_policy')),
            _opt('exceptional','On request only',v('late_checkout_policy')),
            _opt('no','Not available',v('late_checkout_policy')),
          '</select>',
        '</label>',
      '</div>',
      '<div id="wf_early_notes_row" style="display:' + (v('early_checkin_policy')==='yes_paid' ? 'grid' : 'none') + '">',
        '<label>Early check-in fee / notes',
          '<input type="text" id="wf_early_checkin_notes" placeholder="e.g. €20 per stay" value="' + e(v('early_checkin_notes')) + '">',
        '</label>',
      '</div>',
      '<div id="wf_late_notes_row" style="display:' + (v('late_checkout_policy')==='yes_paid' ? 'grid' : 'none') + '">',
        '<label>Late check-out fee / notes',
          '<input type="text" id="wf_late_checkout_notes" placeholder="e.g. €20 per stay" value="' + e(v('late_checkout_notes')) + '">',
        '</label>',
      '</div>',
      '<p class="wizard-section-label">Entry & Access Details</p>',
      '<div id="wf_keybox_row" style="display:' + (v('access_method')==='key_box' ? 'grid' : 'none') + '">',
        '<div class="wizard-row-2">',
          '<label>Key box location',
            '<input type="text" id="wf_key_box_location" placeholder="e.g. Front gate, left pillar" value="' + e(v('key_box_location')) + '">',
          '</label>',
          '<label>Key box code',
            '<input type="text" id="wf_key_box_code" placeholder="e.g. 1234" value="' + e(v('key_box_code')) + '">',
          '</label>',
        '</div>',
      '</div>',
      '<label>Entry instructions <span class="wizard-optional">(recommended)</span>',
        '<textarea id="wf_entry_instructions" placeholder="Step-by-step directions to enter the property…">' + e(v('entry_instructions')) + '</textarea>',
      '</label>',
      '<label>Check-in instructions <span class="wizard-optional">(optional)</span>',
        '<textarea id="wf_checkin_instructions" rows="3" placeholder="Welcome steps guests should follow on arrival…">' + e(v('checkin_instructions')) + '</textarea>',
      '</label>',
      '<label>Check-out tasks <span class="wizard-optional">(optional — one per line)</span>',
        '<textarea id="wf_checkout_tasks" rows="3" placeholder="Lock all doors&#10;Leave keys in key box&#10;Turn off air conditioning">' + e(v('checkout_tasks')) + '</textarea>',
      '</label>',
      '<label>Key return instructions <span class="wizard-optional">(optional)</span>',
        '<input type="text" id="wf_key_return_instructions" placeholder="e.g. Leave keys in the key box at the front gate" value="' + e(v('key_return_instructions')) + '">',
      '</label>',
      '<label>Lockout instructions <span class="wizard-optional">(optional)</span>',
        '<textarea id="wf_lockout_instructions" rows="2" placeholder="If you are locked out, call…">' + e(v('lockout_instructions')) + '</textarea>',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 5) return [
      '<div class="wizard-row-2">',
        '<label>Pet policy <span style="color:var(--terracotta)">*</span>',
          '<select id="wf_pet_policy">',
            _opt('','Select policy',v('pet_policy')),
            _opt('no_pets','No pets',v('pet_policy')),
            _opt('pets_allowed','Pets allowed',v('pet_policy')),
            _opt('pets_on_request','On request',v('pet_policy')),
            _opt('small_pets_only','Small pets only',v('pet_policy')),
          '</select>',
        '</label>',
        '<label>Smoking policy <span style="color:var(--terracotta)">*</span>',
          '<select id="wf_smoking_policy">',
            _opt('','Select policy',v('smoking_policy')),
            _opt('no_smoking','No smoking',v('smoking_policy')),
            _opt('outdoor_only','Outdoor only',v('smoking_policy')),
            _opt('designated_area','Designated area',v('smoking_policy')),
            _opt('smoking_allowed','Smoking allowed',v('smoking_policy')),
          '</select>',
        '</label>',
      '</div>',
      '<div id="wf_pet_notes_row" style="display:' + (['pets_allowed','pets_on_request','small_pets_only'].indexOf(v('pet_policy')) !== -1 ? 'grid' : 'none') + '">',
        '<label>Pet policy notes <span class="wizard-optional">(optional)</span>',
          '<textarea id="wf_pet_policy_notes" rows="2" placeholder="e.g. Max 2 small dogs, no cats">' + e(v('pet_policy_notes')) + '</textarea>',
        '</label>',
      '</div>',
      '<label>Events / parties policy <span style="color:var(--terracotta)">*</span>',
        '<select id="wf_party_policy">',
          _opt('','Select policy',v('party_policy')),
          _opt('no_events','No events or parties',v('party_policy')),
          _opt('on_request','On request only',v('party_policy')),
          _opt('events_allowed','Events allowed',v('party_policy')),
        '</select>',
      '</label>',
      '<div class="wizard-row-2">',
        '<label>Quiet hours from <span class="wizard-optional">(recommended)</span>',
          '<input type="time" id="wf_quiet_hours_from" value="' + e(v('quiet_hours_from') || '22:00') + '">',
        '</label>',
        '<label>Quiet hours until <span class="wizard-optional">(recommended)</span>',
          '<input type="time" id="wf_quiet_hours_to" value="' + e(v('quiet_hours_to') || '08:00') + '">',
        '</label>',
      '</div>',
      '<label>House rules <span style="color:var(--terracotta)">*</span>',
        '<textarea id="wf_house_rules" rows="4" placeholder="Main rules guests must follow…">' + e(v('house_rules')) + '</textarea>',
      '</label>',
      '<label>Minimum stay (nights) <span style="color:var(--terracotta)">*</span>',
        '<input type="number" id="wf_min_stay_nights" min="1" placeholder="2" value="' + e(v('min_stay_nights') || '') + '">',
      '</label>',
      '<label>Cancellation / penalty notes <span class="wizard-optional">(optional)</span>',
        '<textarea id="wf_penalty_notes" rows="2" placeholder="e.g. 50% refund up to 7 days before arrival…">' + e(v('penalty_notes')) + '</textarea>',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 6) return [
      '<p class="wizard-section-label">Legal & Compliance</p>',
      '<div class="wizard-row-2">',
        '<label>CIR code <span class="wizard-optional">(activation-blocking)</span>',
          '<input type="text" id="wf_cir_code" placeholder="e.g. CT0000001234" value="' + e(v('cir_code')) + '">',
        '</label>',
        '<label>Alloggiati Web required <span style="color:var(--terracotta)">*</span>',
          '<select id="wf_alloggiati_web_required">',
            _opt('','—', String(v('alloggiati_web_required'))),
            _opt('true','Yes', String(v('alloggiati_web_required'))),
            _opt('false','No', String(v('alloggiati_web_required'))),
          '</select>',
        '</label>',
      '</div>',
      '<p class="wizard-section-label">Tourist Tax</p>',
      '<div class="wizard-row-2">',
        '<label>Tax per person / night (€)',
          '<input type="number" id="wf_tourist_tax_amount_eur" min="0" step="0.5" placeholder="2.50" value="' + e(v('tourist_tax_amount_eur')) + '">',
        '</label>',
        '<label>Max nights taxable',
          '<input type="number" id="wf_tourist_tax_max_nights" min="0" placeholder="7" value="' + e(v('tourist_tax_max_nights')) + '">',
        '</label>',
      '</div>',
      '<label>Tax exemptions <span class="wizard-optional">(optional)</span>',
        '<textarea id="wf_tourist_tax_exemptions" rows="2" placeholder="e.g. Children under 14, residents…">' + e(v('tourist_tax_exemptions')) + '</textarea>',
      '</label>',
      '<label>Tax collection method <span class="wizard-optional">(optional)</span>',
        '<select id="wf_tourist_tax_collection_method">',
          _opt('', 'Select method', v('tourist_tax_collection_method')),
          _opt('host_collected', 'Collected by host', v('tourist_tax_collection_method')),
          _opt('platform_collected', 'Collected by platform', v('tourist_tax_collection_method')),
          _opt('guest_pays_directly', 'Guest pays at town hall', v('tourist_tax_collection_method')),
        '</select>',
      '</label>',
      '<p class="wizard-section-label">Listings</p>',
      '<label>Listing channels <span class="wizard-optional">(comma-separated)</span>',
        '<input type="text" id="wf_listing_channels" placeholder="Airbnb, Booking.com, direct" value="' + e(_arrToText(_wizardData.listing_channels, ', ')) + '">',
      '</label>',
      '<label>Listing URLs <span class="wizard-optional">(comma-separated)</span>',
        '<input type="text" id="wf_listing_urls" placeholder="https://airbnb.com/rooms/…" value="' + e(_arrToText(_wizardData.listing_urls, ', ')) + '">',
      '</label>',
      '<p class="wizard-section-label">Availability</p>',
      '<label>Availability status',
        '<select id="wf_availability_status">',
          _opt('available','Available', v('availability_status') || 'available'),
          _opt('unavailable','Not available', v('availability_status')),
          _opt('maintenance','Under maintenance', v('availability_status')),
        '</select>',
      '</label>',
      '<label>Private notes <span class="wizard-optional">(optional)</span>',
        '<textarea id="wf_owner_notes" rows="3" placeholder="Internal notes visible only to you…">' + e(v('owner_notes')) + '</textarea>',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 7) return [
      '<p style="margin:0 0 4px;font-size:.84rem;color:var(--stone)">WiFi credentials are revealed to guests only after check-in.</p>',
      '<label>Network name (SSID) <span style="color:var(--terracotta)">*</span>',
        '<input type="text" id="wf_wifi_network_name" placeholder="e.g. VillaChloe_WiFi" value="' + e(v('wifi_network_name')) + '">',
      '</label>',
      '<label>Password <span style="color:var(--terracotta)">*</span>',
        '<input type="text" id="wf_wifi_password" placeholder="Network password" value="' + e(v('wifi_password')) + '">',
      '</label>',
      '<label>Backup note <span class="wizard-optional">(optional)</span>',
        '<input type="text" id="wf_wifi_backup_note" placeholder="e.g. Router is in the living room cabinet" value="' + e(v('wifi_backup_note')) + '">',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 8) {
      var ed = _emergencyData;
      function edv(k) { return ed[k] != null ? ed[k] : ''; }
      return [
        '<p style="margin:0 0 4px;font-size:.84rem;color:var(--stone)">Required to activate your property. Not shared with guests verbatim.</p>',
        '<p class="wizard-section-label">Owner Emergency Contact</p>',
        '<div class="wizard-row-2">',
          '<label>Name <span style="color:var(--terracotta)">*</span>',
            '<input type="text" id="wf_em_owner_name" placeholder="Your full name" value="' + e(String(edv('owner_emergency_name'))) + '">',
          '</label>',
          '<label>Phone <span style="color:var(--terracotta)">*</span>',
            '<input type="tel" id="wf_em_owner_phone" placeholder="+39 333 000 0000" value="' + e(String(edv('owner_emergency_phone'))) + '">',
          '</label>',
        '</div>',
        '<p class="wizard-section-label">Nearest Hospital</p>',
        '<div class="wizard-row-2">',
          '<label>Hospital name <span style="color:var(--terracotta)">*</span>',
            '<input type="text" id="wf_em_hospital_name" placeholder="e.g. Ospedale Cannizzaro" value="' + e(String(edv('nearest_hospital_name'))) + '">',
          '</label>',
          '<label>Distance <span class="wizard-optional">(optional)</span>',
            '<input type="text" id="wf_em_hospital_distance" placeholder="e.g. 3.2 km" value="' + e(String(edv('nearest_hospital_distance'))) + '">',
          '</label>',
        '</div>',
        '<label>Hospital address <span style="color:var(--terracotta)">*</span>',
          '<input type="text" id="wf_em_hospital_address" placeholder="Via Messina, 95126 Catania CT" value="' + e(String(edv('nearest_hospital_address'))) + '">',
        '</label>',
        '<p class="wizard-section-label">Utility Shutoffs</p>',
        '<label>Gas shutoff instructions',
          '<textarea id="wf_em_gas_shutoff" rows="2" placeholder="e.g. Red valve behind the kitchen stove — turn clockwise">' + e(String(edv('gas_shutoff_instructions'))) + '</textarea>',
        '</label>',
        '<label>Water shutoff instructions',
          '<textarea id="wf_em_water_shutoff" rows="2" placeholder="e.g. Stopcock under the kitchen sink">' + e(String(edv('water_shutoff_instructions'))) + '</textarea>',
        '</label>',
        '<label>Electricity shutoff instructions',
          '<textarea id="wf_em_electricity_shutoff" rows="2" placeholder="e.g. Circuit breaker in the hallway cupboard">' + e(String(edv('electricity_shutoff_instructions'))) + '</textarea>',
        '</label>',
        '<p class="wizard-section-label">Evacuation</p>',
        '<label>Evacuation route description',
          '<textarea id="wf_em_evacuation_route" rows="2" placeholder="e.g. Exit via main staircase, do not use the lift">' + e(String(edv('evacuation_route_description'))) + '</textarea>',
        '</label>',
        '<label>Assembly point',
          '<input type="text" id="wf_em_assembly_point" placeholder="e.g. Car park opposite the main entrance" value="' + e(String(edv('evacuation_assembly_point'))) + '">',
        '</label>',
        '<label>Property-specific hazards <span class="wizard-optional">(optional)</span>',
          '<textarea id="wf_em_hazards" rows="2" placeholder="e.g. Pool edge has no rail, uneven terrace steps">' + e(String(edv('property_specific_hazards'))) + '</textarea>',
        '</label>',
        _errorBox()
      ].join('');
    }

    if (step === 9) {
      var oc = _contactsData.owner    || {};
      var cc = _contactsData.caretaker || {};
      return [
        '<p style="margin:0 0 4px;font-size:.84rem;color:var(--stone)">These contacts are used by the AI concierge to assist guests.</p>',
        '<p class="wizard-section-label">Owner Contact</p>',
        '<div class="wizard-row-2">',
          '<label>Display name',
            '<input type="text" id="wf_ct_owner_name" placeholder="Your name" value="' + e(oc.contact_name || '') + '">',
          '</label>',
          '<label>Phone',
            '<input type="tel" id="wf_ct_owner_phone" placeholder="+39 333 000 0000" value="' + e(oc.contact_phone || '') + '">',
          '</label>',
        '</div>',
        '<label>Available hours <span class="wizard-optional">(optional)</span>',
          '<input type="text" id="wf_ct_owner_hours" placeholder="e.g. 09:00–21:00 daily" value="' + e(oc.available_hours || '') + '">',
        '</label>',
        '<p class="wizard-section-label">Caretaker / Property Manager <span class="wizard-optional">(optional)</span></p>',
        '<div class="wizard-row-2">',
          '<label>Display name',
            '<input type="text" id="wf_ct_caretaker_name" placeholder="Caretaker name" value="' + e(cc.contact_name || '') + '">',
          '</label>',
          '<label>Phone',
            '<input type="tel" id="wf_ct_caretaker_phone" placeholder="+39 333 000 0000" value="' + e(cc.contact_phone || '') + '">',
          '</label>',
        '</div>',
        '<label>Available hours <span class="wizard-optional">(optional)</span>',
          '<input type="text" id="wf_ct_caretaker_hours" placeholder="e.g. 08:00–18:00 Mon–Sat" value="' + e(cc.available_hours || '') + '">',
        '</label>',
        _errorBox()
      ].join('');
    }

    return '';
  }

  /* ── Conditional bindings per step ───────────────────────── */
  function _bindStepEvents(step) {
    if (step === 1) {
      var ptSelect = document.getElementById('wf_property_type');
      if (ptSelect) ptSelect.addEventListener('change', function () {
        var row = document.getElementById('wf_custom_type_row');
        if (row) row.style.display = this.value === 'other' ? 'grid' : 'none';
      });
    }
    if (step === 4) {
      var accessSel = document.getElementById('wf_access_method');
      if (accessSel) accessSel.addEventListener('change', function () {
        var row = document.getElementById('wf_keybox_row');
        if (row) row.style.display = this.value === 'key_box' ? 'grid' : 'none';
      });
      ['wf_early_checkin_policy','wf_late_checkout_policy'].forEach(function (selId) {
        var sel = document.getElementById(selId);
        if (!sel) return;
        sel.addEventListener('change', function () {
          var rowId = selId === 'wf_early_checkin_policy' ? 'wf_early_notes_row' : 'wf_late_notes_row';
          var row = document.getElementById(rowId);
          if (row) row.style.display = this.value === 'yes_paid' ? 'grid' : 'none';
        });
      });
    }
    if (step === 5) {
      var petSel = document.getElementById('wf_pet_policy');
      if (petSel) petSel.addEventListener('change', function () {
        var row = document.getElementById('wf_pet_notes_row');
        if (row) row.style.display = ['pets_allowed','pets_on_request','small_pets_only'].indexOf(this.value) !== -1 ? 'grid' : 'none';
      });
    }
  }

  /* ── Validation ───────────────────────────────────────────── */
  function _showError(msg) {
    var el = document.getElementById('wizardError');
    if (el) { el.textContent = msg; el.classList.add('is-visible'); }
  }
  function _clearError() {
    var el = document.getElementById('wizardError');
    if (el) { el.textContent = ''; el.classList.remove('is-visible'); }
  }

  function _validateStep(step) {
    _clearError();
    var missing = [];

    function req(id, label) {
      var el = document.getElementById(id);
      if (!el) return;
      if (!(el.value || '').trim()) missing.push(label);
    }
    function reqNum(id, label, min) {
      var el = document.getElementById(id);
      if (!el) return;
      var n = parseFloat(el.value);
      if (isNaN(n) || n < (min != null ? min : 0)) missing.push(label);
    }

    if (step === 1) {
      req('wf_display_name', 'Property name');
      req('wf_property_type', 'Property type');
      var pt = document.getElementById('wf_property_type');
      if (pt && pt.value === 'other') req('wf_property_type_custom', 'Custom type name');
    }
    if (step === 2) {
      req('wf_address_street', 'Street address');
      req('wf_address_locality', 'Locality');
      req('wf_address_municipality', 'Municipality');
      req('wf_address_province', 'Province');
      req('wf_address_postcode', 'Postcode');
    }
    if (step === 3) {
      reqNum('wf_max_guests', 'Max guests', 1);
      var bed = document.getElementById('wf_bedrooms');
      if (!bed || bed.value === '') missing.push('Bedrooms');
      var bath = document.getElementById('wf_bathrooms');
      if (!bath || bath.value === '') missing.push('Bathrooms');
      req('wf_beds_configuration', 'Beds configuration');
    }
    if (step === 4) {
      req('wf_checkin_time_from', 'Check-in from');
      req('wf_checkin_time_to', 'Check-in until');
      req('wf_checkout_time', 'Check-out time');
      req('wf_access_method', 'Access method');
    }
    if (step === 5) {
      req('wf_pet_policy', 'Pet policy');
      req('wf_smoking_policy', 'Smoking policy');
      req('wf_party_policy', 'Events policy');
      req('wf_house_rules', 'House rules');
      reqNum('wf_min_stay_nights', 'Minimum stay (nights)', 1);
    }
    if (step === 6) {
      req('wf_alloggiati_web_required', 'Alloggiati Web required');
    }
    if (step === 7) {
      req('wf_wifi_network_name', 'WiFi network name');
      req('wf_wifi_password', 'WiFi password');
    }
    if (step === 8) {
      req('wf_em_owner_name',      'Owner emergency name');
      req('wf_em_owner_phone',     'Owner emergency phone');
      req('wf_em_hospital_name',   'Nearest hospital name');
      req('wf_em_hospital_address','Nearest hospital address');
    }

    if (missing.length) {
      _showError('Please complete: ' + missing.join(', ') + '.');
      return false;
    }
    return true;
  }

  /* ── Data collection ──────────────────────────────────────── */
  function _collectStep(step) {
    function fld(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : null;
    }
    function fldNum(id) {
      var el = document.getElementById(id);
      if (!el || el.value === '') return null;
      return parseFloat(el.value);
    }
    function fldBool(id) {
      var el = document.getElementById(id);
      return el ? el.checked : false;
    }
    function fldLines(id) {
      var el = document.getElementById(id);
      if (!el || !el.value.trim()) return [];
      return el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    function fldCSV(id) {
      var el = document.getElementById(id);
      if (!el || !el.value.trim()) return [];
      return el.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }

    if (step === 1) Object.assign(_wizardData, {
      display_name:         fld('wf_display_name') || '',
      property_type:        fld('wf_property_type') || '',
      property_type_custom: fld('wf_property_type_custom') || null,
      area_description:     fld('wf_area_description') || null,
      property_summary:     fld('wf_property_summary') || null,
      nearest_airport:      fld('wf_nearest_airport') || null
    });

    if (step === 2) Object.assign(_wizardData, {
      address_street:       fld('wf_address_street') || '',
      address_locality:     fld('wf_address_locality') || '',
      address_municipality: fld('wf_address_municipality') || '',
      address_province:     fld('wf_address_province') || '',
      address_postcode:     fld('wf_address_postcode') || ''
    });

    if (step === 3) Object.assign(_wizardData, {
      max_guests:             fldNum('wf_max_guests'),
      bedrooms:               fldNum('wf_bedrooms'),
      bathrooms:              fldNum('wf_bathrooms'),
      beds_configuration:     fld('wf_beds_configuration') || '',
      has_air_conditioning:   fldBool('wf_has_air_conditioning'),
      has_washing_machine:    fldBool('wf_has_washing_machine'),
      has_dishwasher:         fldBool('wf_has_dishwasher'),
      has_elevator:           fldBool('wf_has_elevator'),
      has_parking:            fldBool('wf_has_parking'),
      has_balcony_or_terrace: fldBool('wf_has_balcony_or_terrace'),
      has_pool:               fldBool('wf_has_pool'),
      has_bbq:                fldBool('wf_has_bbq'),
      amenities_list:         fldLines('wf_amenities_list')
    });

    if (step === 4) Object.assign(_wizardData, {
      checkin_time_from:       fld('wf_checkin_time_from') || '',
      checkin_time_to:         fld('wf_checkin_time_to') || '',
      checkout_time:           fld('wf_checkout_time') || '',
      access_method:           fld('wf_access_method') || '',
      early_checkin_policy:    fld('wf_early_checkin_policy') || null,
      late_checkout_policy:    fld('wf_late_checkout_policy') || null,
      early_checkin_notes:     fld('wf_early_checkin_notes') || null,
      late_checkout_notes:     fld('wf_late_checkout_notes') || null,
      key_box_location:        fld('wf_key_box_location') || null,
      key_box_code:            fld('wf_key_box_code') || null,
      entry_instructions:      fld('wf_entry_instructions') || null,
      checkin_instructions:    fld('wf_checkin_instructions') || null,
      checkout_tasks:          fld('wf_checkout_tasks') || null,
      key_return_instructions: fld('wf_key_return_instructions') || null,
      lockout_instructions:    fld('wf_lockout_instructions') || null
    });

    if (step === 5) Object.assign(_wizardData, {
      pet_policy:       fld('wf_pet_policy') || '',
      pet_policy_notes: fld('wf_pet_policy_notes') || null,
      smoking_policy:   fld('wf_smoking_policy') || '',
      party_policy:     fld('wf_party_policy') || '',
      quiet_hours_from: fld('wf_quiet_hours_from') || null,
      quiet_hours_to:   fld('wf_quiet_hours_to') || null,
      house_rules:      fld('wf_house_rules') || '',
      min_stay_nights:  fldNum('wf_min_stay_nights'),
      penalty_notes:    fld('wf_penalty_notes') || null
    });

    if (step === 6) {
      var allog = fld('wf_alloggiati_web_required');
      Object.assign(_wizardData, {
        cir_code:                        fld('wf_cir_code') || null,
        alloggiati_web_required:         allog === 'true' ? true : allog === 'false' ? false : null,
        tourist_tax_amount_eur:          fldNum('wf_tourist_tax_amount_eur'),
        tourist_tax_max_nights:          fldNum('wf_tourist_tax_max_nights'),
        tourist_tax_exemptions:          fld('wf_tourist_tax_exemptions') || null,
        tourist_tax_collection_method:   fld('wf_tourist_tax_collection_method') || null,
        listing_channels:                fldCSV('wf_listing_channels'),
        listing_urls:                    fldCSV('wf_listing_urls'),
        availability_status:             fld('wf_availability_status') || 'available',
        owner_notes:                     fld('wf_owner_notes') || null
      });
    }

    if (step === 7) Object.assign(_wizardData, {
      wifi_network_name: fld('wf_wifi_network_name') || null,
      wifi_password:     fld('wf_wifi_password') || null,
      wifi_backup_note:  fld('wf_wifi_backup_note') || null
    });

    if (step === 8) {
      function emFld(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() || null : null;
      }
      Object.assign(_emergencyData, {
        owner_emergency_name:              emFld('wf_em_owner_name'),
        owner_emergency_phone:             emFld('wf_em_owner_phone'),
        nearest_hospital_name:             emFld('wf_em_hospital_name'),
        nearest_hospital_address:          emFld('wf_em_hospital_address'),
        nearest_hospital_distance:         emFld('wf_em_hospital_distance'),
        gas_shutoff_instructions:          emFld('wf_em_gas_shutoff'),
        water_shutoff_instructions:        emFld('wf_em_water_shutoff'),
        electricity_shutoff_instructions:  emFld('wf_em_electricity_shutoff'),
        evacuation_route_description:      emFld('wf_em_evacuation_route'),
        evacuation_assembly_point:         emFld('wf_em_assembly_point'),
        property_specific_hazards:         emFld('wf_em_hazards')
      });
    }

    if (step === 9) {
      function ctFld(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() || null : null;
      }
      _contactsData.owner = {
        contact_name:    ctFld('wf_ct_owner_name'),
        contact_phone:   ctFld('wf_ct_owner_phone'),
        available_hours: ctFld('wf_ct_owner_hours')
      };
      _contactsData.caretaker = {
        contact_name:    ctFld('wf_ct_caretaker_name'),
        contact_phone:   ctFld('wf_ct_caretaker_phone'),
        available_hours: ctFld('wf_ct_caretaker_hours')
      };
    }
  }

  /* ── Guest step HTML ──────────────────────────────────────── */
  function _buildGuestStepHTML(step) {
    var e  = _e;
    var gv = _gv;

    if (step === 1) return [
      '<div class="wizard-row-2">',
        '<label>First name <span style="color:var(--terracotta)">*</span>',
          '<input type="text" id="gf_first_name" maxlength="60" placeholder="Maria" value="' + e(gv('first_name')) + '">',
        '</label>',
        '<label>Last name <span style="color:var(--terracotta)">*</span>',
          '<input type="text" id="gf_last_name" maxlength="60" placeholder="Rossi" value="' + e(gv('last_name')) + '">',
        '</label>',
      '</div>',
      '<label>Phone number <span style="color:var(--terracotta)">*</span> <span class="wizard-optional">(E.164 format)</span>',
        '<input type="tel" id="gf_phone_number" placeholder="+393331234567" value="' + e(gv('phone_number')) + '">',
      '</label>',
      '<label>Email address <span class="wizard-optional">(optional)</span>',
        '<input type="email" id="gf_email" placeholder="maria.rossi@example.com" value="' + e(gv('email')) + '">',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 2) return [
      '<div class="wizard-row-2">',
        '<label>Check-in date <span style="color:var(--terracotta)">*</span>',
          '<input type="date" id="gf_check_in_date" value="' + e(gv('check_in_date')) + '">',
        '</label>',
        '<label>Check-out date <span style="color:var(--terracotta)">*</span>',
          '<input type="date" id="gf_check_out_date" value="' + e(gv('check_out_date')) + '">',
        '</label>',
      '</div>',
      '<label>Number of guests <span style="color:var(--terracotta)">*</span>',
        '<input type="number" id="gf_number_of_guests" min="1" max="50" placeholder="2" value="' + e(gv('number_of_guests')) + '">',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 3) return [
      '<label>Booking reference <span class="wizard-optional">(optional)</span>',
        '<input type="text" id="gf_booking_reference" placeholder="e.g. HM123456789" value="' + e(gv('booking_reference')) + '">',
      '</label>',
      '<label>Booking channel <span class="wizard-optional">(optional)</span>',
        '<select id="gf_channel">',
          _opt('',           'Select channel (optional)', gv('channel')),
          _opt('airbnb',     'Airbnb',                    gv('channel')),
          _opt('booking_com','Booking.com',               gv('channel')),
          _opt('vrbo',       'VRBO',                      gv('channel')),
          _opt('direct',     'Direct',                    gv('channel')),
          _opt('other',      'Other',                     gv('channel')),
        '</select>',
      '</label>',
      '<div class="wizard-row-2">',
        '<label>Reservation value <span class="wizard-optional">(optional)</span>',
          '<input type="number" id="gf_reservation_value_amount" min="0" step="0.01" placeholder="0.00" value="' + e(gv('reservation_value_amount') != null ? gv('reservation_value_amount') : '') + '">',
        '</label>',
        '<label>Currency',
          '<select id="gf_reservation_value_currency">',
            _opt('EUR','EUR', gv('reservation_value_currency') || 'EUR'),
            _opt('USD','USD', gv('reservation_value_currency') || 'EUR'),
            _opt('GBP','GBP', gv('reservation_value_currency') || 'EUR'),
          '</select>',
        '</label>',
      '</div>',
      '<label>Special requests <span class="wizard-optional">(optional)</span>',
        '<textarea id="gf_special_requests" rows="3" placeholder="Early check-in, extra towels, allergies…">' + e(gv('special_requests')) + '</textarea>',
      '</label>',
      _errorBox()
    ].join('');

    if (step === 4) {
      var ci  = gv('check_in_date');
      var co  = gv('check_out_date');
      var fmt = function (d) {
        if (!d) return '—';
        return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      };
      var nights = '';
      if (ci && co) {
        var diff = (new Date(co) - new Date(ci)) / 86400000;
        if (diff > 0) nights = ' (' + diff + ' night' + (diff !== 1 ? 's' : '') + ')';
      }
      var CHANNEL_LABELS = { airbnb:'Airbnb', booking_com:'Booking.com', vrbo:'VRBO', direct:'Direct', other:'Other' };
      var ch = gv('channel');
      var resValAmt = gv('reservation_value_amount');
      var resValCur = gv('reservation_value_currency') || 'EUR';
      var resValSym = resValCur === 'EUR' ? '€' : resValCur === 'USD' ? '$' : resValCur === 'GBP' ? '£' : resValCur + ' ';
      var resValStr = resValAmt != null ? resValSym + parseFloat(resValAmt).toFixed(2) : null;
      return [
        '<p style="margin:0 0 4px;font-size:.84rem;color:var(--stone)">Please review before saving.</p>',
        '<div class="wizard-summary-block">',
          '<p class="wizard-summary-section">Guest</p>',
          '<div class="wizard-summary-row"><span class="wizard-summary-label">Name</span><span class="wizard-summary-value">' + e(gv('first_name')) + ' ' + e(gv('last_name')) + '</span></div>',
          (gv('phone_number') ? '<div class="wizard-summary-row"><span class="wizard-summary-label">Phone</span><span class="wizard-summary-value">' + e(gv('phone_number')) + '</span></div>' : ''),
          (gv('email')        ? '<div class="wizard-summary-row"><span class="wizard-summary-label">Email</span><span class="wizard-summary-value">' + e(gv('email')) + '</span></div>' : ''),
          '<p class="wizard-summary-section">Stay</p>',
          '<div class="wizard-summary-row"><span class="wizard-summary-label">Check-in</span><span class="wizard-summary-value">' + e(fmt(ci)) + '</span></div>',
          '<div class="wizard-summary-row"><span class="wizard-summary-label">Check-out</span><span class="wizard-summary-value">' + e(fmt(co)) + e(nights) + '</span></div>',
          '<div class="wizard-summary-row"><span class="wizard-summary-label">Guests</span><span class="wizard-summary-value">' + e(String(gv('number_of_guests') || '—')) + '</span></div>',
          (gv('booking_reference') || ch || gv('special_requests') || resValStr ? '<p class="wizard-summary-section">Booking</p>' : ''),
          (gv('booking_reference') ? '<div class="wizard-summary-row"><span class="wizard-summary-label">Reference</span><span class="wizard-summary-value">' + e(gv('booking_reference')) + '</span></div>' : ''),
          (ch ? '<div class="wizard-summary-row"><span class="wizard-summary-label">Channel</span><span class="wizard-summary-value">' + e(CHANNEL_LABELS[ch] || ch) + '</span></div>' : ''),
          (resValStr ? '<div class="wizard-summary-row"><span class="wizard-summary-label">Value</span><span class="wizard-summary-value" style="color:#15803d;font-weight:800">' + e(resValStr) + '</span></div>' : ''),
          (gv('special_requests') ? '<div class="wizard-summary-row"><span class="wizard-summary-label">Requests</span><span class="wizard-summary-value">' + e(gv('special_requests')) + '</span></div>' : ''),
        '</div>'
      ].join('');
    }

    return '';
  }

  /* ── Phone normalization (browser-side mirror of concierge-resolver.normalizePhone) ── */
  function _normalizePhoneInput(raw) {
    if (!raw) return null;
    var cleaned = raw.replace(/[\s\-\.\(\)]/g, '');
    if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
    if (/^00\d{7,13}$/.test(cleaned)) return '+' + cleaned.slice(2);
    if (/^3\d{9}$/.test(cleaned))     return '+39' + cleaned;
    return null;
  }

  /* ── Guest validation ─────────────────────────────────────── */
  function _validateGuestStep(step) {
    _clearError();
    var missing = [];

    function req(id, label) {
      var el = document.getElementById(id);
      if (!el || !(el.value || '').trim()) missing.push(label);
    }

    if (step === 1) {
      req('gf_first_name',   'First name');
      req('gf_last_name',    'Last name');
      req('gf_phone_number', 'Phone number');

      var phoneEl = document.getElementById('gf_phone_number');
      if (phoneEl && (phoneEl.value || '').trim() && !_normalizePhoneInput(phoneEl.value)) {
        _showError('Please enter a valid phone number, e.g. +393331234567');
        return false;
      }
    }
    if (step === 2) {
      req('gf_check_in_date',    'Check-in date');
      req('gf_check_out_date',   'Check-out date');
      req('gf_number_of_guests', 'Number of guests');
      var ci = document.getElementById('gf_check_in_date');
      var co = document.getElementById('gf_check_out_date');
      if (ci && co && ci.value && co.value && ci.value >= co.value) {
        _showError('Check-out date must be after check-in date.');
        return false;
      }
    }

    if (missing.length) {
      _showError('Please complete: ' + missing.join(', ') + '.');
      return false;
    }
    return true;
  }

  /* ── Guest data collection ────────────────────────────────── */
  function _collectGuestStep(step) {
    function fld(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : null;
    }
    function fldNum(id) {
      var el = document.getElementById(id);
      if (!el || el.value === '') return null;
      return parseInt(el.value, 10);
    }

    if (step === 1) Object.assign(_guestData, {
      first_name:   fld('gf_first_name')   || '',
      last_name:    fld('gf_last_name')    || '',
      phone_number: fld('gf_phone_number') || null,
      email:        fld('gf_email')        || null
    });

    if (step === 2) Object.assign(_guestData, {
      check_in_date:    fld('gf_check_in_date')      || '',
      check_out_date:   fld('gf_check_out_date')     || '',
      number_of_guests: fldNum('gf_number_of_guests')
    });

    if (step === 3) {
      var rawVal = document.getElementById('gf_reservation_value_amount');
      var parsedVal = rawVal && rawVal.value !== '' ? parseFloat(rawVal.value) : null;
      Object.assign(_guestData, {
        booking_reference:           fld('gf_booking_reference') || null,
        channel:                     fld('gf_channel')           || null,
        special_requests:            fld('gf_special_requests')  || null,
        reservation_value_amount:    isNaN(parsedVal) ? null : parsedVal,
        reservation_value_currency:  fld('gf_reservation_value_currency') || 'EUR'
      });
    }
  }

  /* ── Guest status ─────────────────────────────────────────── */
  function _computeGuestStatus(checkIn, checkOut) {
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var cin  = checkIn  ? new Date(checkIn  + 'T00:00:00') : null;
    var cout = checkOut ? new Date(checkOut + 'T00:00:00') : null;
    if (!cin || !cout)  return 'upcoming';
    if (now < cin)      return 'upcoming';
    if (now > cout)     return 'checked_out';
    return 'in_house';
  }

  /* ── Save guest ───────────────────────────────────────────── */
  async function _saveGuest() {
    var nextBtn = document.getElementById('wizardNext');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving…'; }
    try {
      var sessionRes = await window.NauxicaSupabase.auth.getSession();
      if (!sessionRes.data || !sessionRes.data.session) throw new Error('Not authenticated.');

      var guestName = ((_guestData.first_name || '') + ' ' + (_guestData.last_name || '')).trim() || 'Guest';
      var internalNotes = _guestData.booking_reference
        ? 'Booking ref: ' + _guestData.booking_reference
        : null;

      var payload = {
        property_id:               _guestPropId,
        guest_name:                guestName,
        guest_phone:               _normalizePhoneInput(_guestData.phone_number),
        guest_email:               _guestData.email        || null,
        checkin_date:              _guestData.check_in_date,
        checkout_date:             _guestData.check_out_date,
        guest_count:               _guestData.number_of_guests || null,
        booking_source:            _guestData.channel      || 'direct',
        special_requests:          _guestData.special_requests || null,
        internal_notes:            internalNotes,
        reservation_value_amount:  _guestData.reservation_value_amount  != null ? _guestData.reservation_value_amount  : null,
        reservation_value_currency:_guestData.reservation_value_currency || 'EUR'
      };

      var dbRes = await window.NauxicaSupabase
        .from('reservations')
        .insert(payload)
        .select()
        .single();

      if (dbRes.error) throw dbRes.error;

      // Create conversation for this reservation (non-fatal — reservation is already saved)
      try {
        var ownerId = sessionRes.data.session.user.id;
        var propNameRes = await window.NauxicaSupabase
          .from('properties').select('display_name').eq('id', _guestPropId).single();
        var propName = (propNameRes.data && propNameRes.data.display_name) || 'the property';

        var convIns = await window.NauxicaSupabase
          .from('conversations')
          .insert({ reservation_id: dbRes.data.id, property_id: _guestPropId, owner_id: ownerId })
          .select('id')
          .single();

        if (convIns.error) {
          console.warn('Nauxica: could not create conversation:', convIns.error.message);
        } else {
          await window.NauxicaSupabase.from('messages').insert({
            conversation_id: convIns.data.id,
            sender_type:     'system',
            message_text:    'Conversation opened for ' + guestName + ' at ' + propName + '.',
            is_read:         true
          });
        }
      } catch (convErr) {
        console.warn('Nauxica: conversation creation error:', convErr);
      }

      _close();
      if (_afterSave) _afterSave(dbRes.data);
    } catch (err) {
      _showError((err && err.message) || 'Failed to save. Please try again.');
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Save Guest'; }
    }
  }

  /* ── Property code ────────────────────────────────────────── */
  function _generatePropertyCode(state) {
    state.property_code_sequence = (state.property_code_sequence || 0) + 1;
    return 'NAU-' + String(state.property_code_sequence).padStart(5, '0');
  }

  /* ── Supabase mapping ───────────────────────────────────────── */
  var _PT_REMAP = {
    penthouse:         'apartment',
    cottage:           'house',
    bed_and_breakfast: 'house',
    guest_house:       'house',
    holiday_home:      'house',
    other:             'house'
  };

  function _toSupabasePayload(data, ownerId) {
    var dbType = _PT_REMAP[data.property_type] || data.property_type || 'apartment';

    var amenities = [];
    if (data.has_air_conditioning)   amenities.push('air_conditioning');
    if (data.has_washing_machine)    amenities.push('washing_machine');
    if (data.has_dishwasher)         amenities.push('dishwasher');
    if (data.has_elevator)           amenities.push('elevator');
    if (data.has_parking)            amenities.push('parking');
    if (data.has_balcony_or_terrace) amenities.push('balcony_or_terrace');
    if (data.has_pool)               amenities.push('pool');
    if (data.has_bbq)                amenities.push('bbq');

    var di = {};
    if (_PT_REMAP[data.property_type]) {
      di.property_type_label = (data.property_type_custom || data.property_type)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    if (data.address_locality || data.area_description) {
      di.location = {};
      if (data.address_locality) di.location.locality         = data.address_locality;
      if (data.area_description) di.location.area_description = data.area_description;
    }
    var extraAm = data.amenities_list && data.amenities_list.length ? data.amenities_list : null;
    if (amenities.length || extraAm) {
      di.amenities = {};
      if (amenities.length) di.amenities.features   = amenities;
      if (extraAm)          di.amenities.additional = extraAm;
    }
    if (data.checkin_time_from || data.early_checkin_policy || data.late_checkout_policy) {
      di.checkin = {};
      if (data.checkin_time_from && data.checkin_time_to)
        di.checkin.window = data.checkin_time_from + ' – ' + data.checkin_time_to;
      if (data.early_checkin_policy) di.checkin.early_policy = data.early_checkin_policy;
      if (data.early_checkin_notes)  di.checkin.early_notes  = data.early_checkin_notes;
      if (data.late_checkout_policy) di.checkin.late_policy  = data.late_checkout_policy;
      if (data.late_checkout_notes)  di.checkin.late_notes   = data.late_checkout_notes;
    }
    if (data.pet_policy || data.smoking_policy || data.party_policy ||
        data.quiet_hours_from || data.min_stay_nights != null) {
      di.rules = {};
      if (data.pet_policy)       di.rules.pet_policy     = data.pet_policy;
      if (data.pet_policy_notes) di.rules.pet_notes      = data.pet_policy_notes;
      if (data.smoking_policy)   di.rules.smoking_policy = data.smoking_policy;
      if (data.party_policy)     di.rules.party_policy   = data.party_policy;
      if (data.quiet_hours_from && data.quiet_hours_to)
        di.rules.quiet_hours = data.quiet_hours_from + ' – ' + data.quiet_hours_to;
      if (data.min_stay_nights != null) di.rules.min_stay_nights = data.min_stay_nights;
    }
    if (data.tourist_tax_max_nights != null || data.tourist_tax_collection_method) {
      di.compliance = {};
      if (data.tourist_tax_max_nights != null) di.compliance.tourist_tax_max_nights = data.tourist_tax_max_nights;
      if (data.tourist_tax_collection_method)  di.compliance.tourist_tax_collection_method = data.tourist_tax_collection_method;
    }
    if (data.property_summary) di.property_summary = data.property_summary;
    if (data.nearest_airport)  di.nearest_airport  = data.nearest_airport;
    if (data.wifi_network_name || data.wifi_password || data.wifi_backup_note) {
      di.wifi = {};
      if (data.wifi_network_name) di.wifi.network_name = data.wifi_network_name;
      if (data.wifi_password)     di.wifi.password     = data.wifi_password;
      if (data.wifi_backup_note)  di.wifi.backup_note  = data.wifi_backup_note;
    }
    if (data.entry_instructions || data.key_box_location || data.key_box_code ||
        data.lockout_instructions || data.checkin_instructions ||
        data.checkout_tasks || data.key_return_instructions) {
      di.access = {};
      if (data.entry_instructions)      di.access.entry_instructions      = data.entry_instructions;
      if (data.key_box_location)        di.access.key_box_location        = data.key_box_location;
      if (data.key_box_code)            di.access.key_box_code            = data.key_box_code;
      if (data.lockout_instructions)    di.access.lockout_instructions    = data.lockout_instructions;
      if (data.checkin_instructions)    di.access.checkin_instructions    = data.checkin_instructions;
      if (data.checkout_tasks)          di.access.checkout_tasks          = data.checkout_tasks;
      if (data.key_return_instructions) di.access.key_return_instructions = data.key_return_instructions;
    }

    var checkinTime = data.checkin_time_from
      ? (data.checkin_time_to
          ? data.checkin_time_from + ' – ' + data.checkin_time_to
          : data.checkin_time_from)
      : null;

    return {
      owner_id:                ownerId,
      display_name:            data.display_name             || '',
      property_type:           dbType,
      address_street:          data.address_street           || null,
      address_city:            data.address_municipality     || null,
      address_province:        data.address_province         || null,
      address_postal_code:     data.address_postcode         || null,
      address_country:         'IT',
      max_guests:              data.max_guests               != null ? data.max_guests     : null,
      bedrooms:                data.bedrooms                 != null ? data.bedrooms       : null,
      bathrooms:               data.bathrooms                != null ? data.bathrooms      : null,
      beds_configuration:      data.beds_configuration       ? { description: data.beds_configuration } : null,
      amenities:               amenities.length ? amenities : null,
      checkin_time:            checkinTime,
      checkout_time:           data.checkout_time            || null,
      access_method:           data.access_method            || null,
      house_rules:             data.house_rules              || null,
      cancellation_policy:     data.penalty_notes            || null,
      cir_code:                data.cir_code                 || null,
      alloggiati_web_required: data.alloggiati_web_required  != null ? data.alloggiati_web_required : null,
      tourist_tax_enabled:     !!(data.tourist_tax_amount_eur > 0),
      tourist_tax_amount_eur:  data.tourist_tax_amount_eur   != null ? data.tourist_tax_amount_eur : null,
      tourist_tax_exemptions:  data.tourist_tax_exemptions   ? { notes: data.tourist_tax_exemptions } : null,
      listing_channels:        data.listing_channels && data.listing_channels.length ? data.listing_channels : null,
      listing_urls:            data.listing_urls && data.listing_urls.length ? { urls: data.listing_urls } : null,
      availability_status:     data.availability_status      || 'available',
      owner_notes:             data.owner_notes              || null,
      dynamic_instructions:    Object.keys(di).length ? di : null
    };
  }

  function _fromSupabaseToWizard(row) {
    var di   = row.dynamic_instructions || {};
    var loc  = di.location   || {};
    var ck   = di.checkin    || {};
    var rl   = di.rules      || {};
    var comp = di.compliance || {};
    var am   = di.amenities  || {};
    var acc  = di.access     || {};
    var wifi = di.wifi       || {};

    var checkinFrom = null, checkinTo = null;
    var timeStr = ck.window || row.checkin_time || '';
    if (timeStr) {
      var tp = timeStr.split(' – ');
      if (tp.length === 2) { checkinFrom = tp[0].trim(); checkinTo = tp[1].trim(); }
      else checkinFrom = timeStr;
    }

    var quietFrom = null, quietTo = null;
    if (rl.quiet_hours) {
      var qp = rl.quiet_hours.split(' – ');
      if (qp.length === 2) { quietFrom = qp[0].trim(); quietTo = qp[1].trim(); }
    }

    var feats = am.features || row.amenities || [];
    var bedsText = row.beds_configuration
      ? (typeof row.beds_configuration === 'object'
          ? (row.beds_configuration.description || '')
          : String(row.beds_configuration))
      : '';
    var taxExemptText = row.tourist_tax_exemptions
      ? (typeof row.tourist_tax_exemptions === 'object'
          ? (row.tourist_tax_exemptions.notes || '')
          : String(row.tourist_tax_exemptions))
      : '';
    var listingUrls = [];
    if (row.listing_urls) {
      if (Array.isArray(row.listing_urls))           listingUrls = row.listing_urls;
      else if (Array.isArray(row.listing_urls.urls)) listingUrls = row.listing_urls.urls;
    }

    return {
      id:                      row.id,
      property_code:           row.property_code,
      platform_status:         row.platform_status,
      availability_status:     row.availability_status  || 'available',
      created_at:              row.created_at,
      display_name:            row.display_name         || '',
      property_type:           row.property_type        || '',
      area_description:        loc.area_description     || null,
      address_street:          row.address_street       || '',
      address_locality:        loc.locality             || null,
      address_municipality:    row.address_city         || '',
      address_province:        row.address_province     || '',
      address_postcode:        row.address_postal_code  || '',
      max_guests:              row.max_guests,
      bedrooms:                row.bedrooms,
      bathrooms:               row.bathrooms,
      beds_configuration:      bedsText,
      has_air_conditioning:    feats.indexOf('air_conditioning')   !== -1,
      has_washing_machine:     feats.indexOf('washing_machine')    !== -1,
      has_dishwasher:          feats.indexOf('dishwasher')         !== -1,
      has_elevator:            feats.indexOf('elevator')           !== -1,
      has_parking:             feats.indexOf('parking')            !== -1,
      has_balcony_or_terrace:  feats.indexOf('balcony_or_terrace') !== -1,
      has_pool:                feats.indexOf('pool')               !== -1,
      has_bbq:                 feats.indexOf('bbq')                !== -1,
      amenities_list:          am.additional || [],
      checkin_time_from:       checkinFrom,
      checkin_time_to:         checkinTo,
      checkout_time:           row.checkout_time        || null,
      access_method:           row.access_method        || null,
      early_checkin_policy:    ck.early_policy          || null,
      early_checkin_notes:     ck.early_notes           || null,
      late_checkout_policy:    ck.late_policy           || null,
      late_checkout_notes:     ck.late_notes            || null,
      pet_policy:              rl.pet_policy            || null,
      pet_policy_notes:        rl.pet_notes             || null,
      smoking_policy:          rl.smoking_policy        || null,
      party_policy:            rl.party_policy          || null,
      quiet_hours_from:        quietFrom,
      quiet_hours_to:          quietTo,
      house_rules:             row.house_rules          || null,
      min_stay_nights:         rl.min_stay_nights       != null ? rl.min_stay_nights : null,
      penalty_notes:           row.cancellation_policy  || null,
      cir_code:                row.cir_code             || null,
      alloggiati_web_required: row.alloggiati_web_required,
      tourist_tax_amount_eur:  row.tourist_tax_amount_eur,
      tourist_tax_max_nights:         comp.tourist_tax_max_nights != null ? comp.tourist_tax_max_nights : null,
      tourist_tax_exemptions:         taxExemptText,
      tourist_tax_collection_method:  comp.tourist_tax_collection_method || null,
      listing_channels:               row.listing_channels     || [],
      listing_urls:                   listingUrls,
      owner_notes:                    row.owner_notes          || null,
      property_summary:               di.property_summary      || null,
      nearest_airport:                di.nearest_airport       || null,
      wifi_network_name:              wifi.network_name        || null,
      wifi_password:                  wifi.password            || null,
      wifi_backup_note:               wifi.backup_note         || null,
      entry_instructions:             acc.entry_instructions   || null,
      key_box_location:               acc.key_box_location     || null,
      key_box_code:                   acc.key_box_code         || null,
      lockout_instructions:           acc.lockout_instructions || null,
      checkin_instructions:           acc.checkin_instructions || null,
      checkout_tasks:                 acc.checkout_tasks       || null,
      key_return_instructions:        acc.key_return_instructions || null
    };
  }

  /* ── KB block builder: wizard data → knowledge-writer payload ─ */
  // Builds the blocks[] array for knowledge-writer, merging wizard-sourced
  // fields on top of any existing content so manually-edited fields (e.g.
  // fallback_support, checkout_instructions) are preserved.
  // Only blocks that have at least one non-empty value are included.
  function _buildKbBlocks(data, existingBlocks) {
    existingBlocks = existingBlocks || {};

    function exRow(type)     { return existingBlocks[type] || null; }
    function exContent(type) { var r = exRow(type); return (r && r.content_jsonb) ? r.content_jsonb : {}; }
    function exActive(type)  { var r = exRow(type); return r ? r.is_active !== false : true; }
    function exScope(type)   { var r = exRow(type); return (r && r.visibility_scope) || null; }
    function exPhase(type)   { var r = exRow(type); return (r && r.session_phase_gate) || null; }

    // Start with existing content; overlay wizard values including explicit nulls
    // (so a user-cleared wizard field clears the KB value). Then strip nulls so
    // the stored JSONB is clean and the KB editor reads fields as 'Not set'.
    function merge(type, wizContent) {
      var out = {};
      var exC = exContent(type);
      var k;
      for (k in exC)       { out[k] = exC[k]; }
      for (k in wizContent){ out[k] = wizContent[k]; }
      var cleaned = {};
      for (k in out) {
        if (out[k] !== null && out[k] !== undefined && out[k] !== '') {
          cleaned[k] = out[k];
        }
      }
      return cleaned;
    }

    function makeBlock(type, wizContent) {
      var merged = merge(type, wizContent);
      if (!Object.keys(merged).length) return null;
      return {
        block_type:         type,
        content_jsonb:      merged,
        is_active:          exActive(type),
        visibility_scope:   exScope(type),
        session_phase_gate: exPhase(type),
      };
    }

    var EARLY_LABELS = {
      'yes_free':    'Yes, free of charge',
      'yes_paid':    'Yes, with a fee',
      'exceptional': 'On request only',
      'no':          'Not available',
    };
    var PET_LABELS = {
      'no_pets':          'No pets',
      'pets_allowed':     'Pets allowed',
      'pets_on_request':  'On request',
      'small_pets_only':  'Small pets only',
    };
    var SMOKE_LABELS = {
      'no_smoking':      'No smoking',
      'outdoor_only':    'Outdoor only',
      'designated_area': 'Designated area',
      'smoking_allowed': 'Smoking allowed',
    };
    var PARTY_LABELS = {
      'no_events':      'No events or parties',
      'on_request':     'On request only',
      'events_allowed': 'Events allowed',
    };

    var blocks = [];
    var b;

    // property_summary
    b = makeBlock('property_summary', {
      summary:         data.property_summary || null,
      nearest_airport: data.nearest_airport  || null,
    });
    if (b) blocks.push(b);

    // wifi
    b = makeBlock('wifi', {
      network_name: data.wifi_network_name || null,
      password:     data.wifi_password     || null,
      backup_note:  data.wifi_backup_note  || null,
    });
    if (b) blocks.push(b);

    // access
    b = makeBlock('access', {
      entry_instructions:      data.entry_instructions      || null,
      key_return_instructions: data.key_return_instructions || null,
      lockout_instructions:    data.lockout_instructions    || null,
    });
    if (b) blocks.push(b);

    // check_in
    var ckTime = data.checkin_time_from
      ? (data.checkin_time_to
          ? data.checkin_time_from + ' – ' + data.checkin_time_to
          : data.checkin_time_from)
      : null;
    b = makeBlock('check_in', {
      checkin_time:         ckTime,
      early_checkin_policy: (data.early_checkin_policy && EARLY_LABELS[data.early_checkin_policy])
                              || data.early_checkin_policy || null,
      checkin_instructions: data.checkin_instructions || null,
    });
    if (b) blocks.push(b);

    // check_out
    b = makeBlock('check_out', {
      checkout_time:  data.checkout_time  || null,
      checkout_tasks: data.checkout_tasks || null,
    });
    if (b) blocks.push(b);

    // house_rules
    var quietHours = (data.quiet_hours_from && data.quiet_hours_to)
      ? data.quiet_hours_from + ' – ' + data.quiet_hours_to
      : null;
    b = makeBlock('house_rules', {
      rules_summary:   data.house_rules    || null,
      pet_policy:      (data.pet_policy     && PET_LABELS[data.pet_policy])   || data.pet_policy     || null,
      smoking_policy:  (data.smoking_policy && SMOKE_LABELS[data.smoking_policy]) || data.smoking_policy || null,
      party_policy:    (data.party_policy   && PARTY_LABELS[data.party_policy])   || data.party_policy   || null,
      quiet_hours:     quietHours,
      max_guests_note: data.max_guests != null ? 'Maximum ' + data.max_guests + ' guests per booking' : null,
    });
    if (b) blocks.push(b);

    // tourist_tax  (amount/max_nights can be 0, so use != null not || null)
    b = makeBlock('tourist_tax', {
      amount_eur:        data.tourist_tax_amount_eur        != null ? data.tourist_tax_amount_eur        : null,
      max_nights:        data.tourist_tax_max_nights        != null ? data.tourist_tax_max_nights        : null,
      exemptions:        data.tourist_tax_exemptions        || null,
      collection_method: data.tourist_tax_collection_method || null,
    });
    if (b) blocks.push(b);

    // fallback_support: no wizard fields — not included; manual edits preserved untouched.

    return blocks;
  }

  /* ── Save ─────────────────────────────────────────────────── */
  async function _saveProperty() {
    var nextBtn = document.getElementById('wizardNext');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving…'; }

    try {
      var sessionRes = await window.NauxicaSupabase.auth.getSession();
      var ownerId    = sessionRes.data.session ? sessionRes.data.session.user.id : null;
      if (!ownerId) throw new Error('Not authenticated.');

      var payload = _toSupabasePayload(_wizardData, ownerId);
      var dbRes;

      if (_editId) {
        dbRes = await window.NauxicaSupabase
          .from('properties')
          .update(payload)
          .eq('id', _editId)
          .eq('owner_id', ownerId)
          .select()
          .single();
      } else {
        dbRes = await window.NauxicaSupabase
          .from('properties')
          .insert(payload)
          .select()
          .single();
      }

      if (dbRes.error) throw dbRes.error;

      var propId = _editId || dbRes.data.id;

      // ── Sync to operational tables via Edge Functions ──────────────
      // Both knowledge-writer and emergency-writer are awaited before _afterSave
      // fires (and property-detail.html's reload runs), so the page always loads
      // fresh data. Failures are non-fatal — the property row is already saved.

      // 1. Read existing KB blocks (homeowner SELECT is allowed by RLS) so we can
      //    merge wizard fields on top of manual edits in content_jsonb.
      var existingKbBlocks = {};
      try {
        var kbReadRes = await window.NauxicaSupabase
          .from('property_knowledge_blocks')
          .select('block_type, content_jsonb, is_active, visibility_scope, session_phase_gate')
          .eq('property_id', propId);
        if (kbReadRes.data) {
          kbReadRes.data.forEach(function (b) { existingKbBlocks[b.block_type] = b; });
        }
      } catch (kbReadErr) {
        console.warn('Nauxica: could not read existing KB blocks, will write fresh:', kbReadErr);
      }

      // 2. Write Knowledge Base blocks via knowledge-writer Edge Function.
      var kbBlocks = _buildKbBlocks(_wizardData, existingKbBlocks);
      if (kbBlocks.length) {
        var kwRes = await window.NauxicaSupabase.functions.invoke('knowledge-writer', {
          body: { property_id: propId, blocks: kbBlocks },
        });
        if (kwRes.error) {
          console.warn('Nauxica: knowledge-writer failed:',
            kwRes.error.message, (kwRes.data && kwRes.data.error) || '');
        }
      }

      // 3. Write emergency data and contacts via emergency-writer Edge Function.
      //    Direct browser writes to emergency_data / emergency_contacts are blocked
      //    by RLS (homeowners have SELECT only); the Edge Function uses service_role.
      var hasEmName  = !!(_emergencyData.owner_emergency_name);
      var hasEmPhone = !!(_emergencyData.owner_emergency_phone);
      if (hasEmName || hasEmPhone) {
        var emPayload = {
          owner_emergency_name:             _emergencyData.owner_emergency_name             || null,
          owner_emergency_phone:            _emergencyData.owner_emergency_phone            || null,
          nearest_hospital_name:            _emergencyData.nearest_hospital_name            || null,
          nearest_hospital_address:         _emergencyData.nearest_hospital_address         || null,
          nearest_hospital_distance:        _emergencyData.nearest_hospital_distance        || null,
          gas_shutoff_instructions:         _emergencyData.gas_shutoff_instructions         || null,
          water_shutoff_instructions:       _emergencyData.water_shutoff_instructions       || null,
          electricity_shutoff_instructions: _emergencyData.electricity_shutoff_instructions || null,
          evacuation_route_description:     _emergencyData.evacuation_route_description     || null,
          evacuation_assembly_point:        _emergencyData.evacuation_assembly_point        || null,
          property_specific_hazards:        _emergencyData.property_specific_hazards        || null,
        };

        var emContacts = {};
        var oc = _contactsData.owner     || {};
        var cc = _contactsData.caretaker || {};
        if (oc.contact_name || oc.contact_phone) {
          emContacts.owner = {
            contact_name:        oc.contact_name    || null,
            contact_phone:       oc.contact_phone   || null,
            available_hours:     oc.available_hours  || null,
            escalation_priority: 1,
            is_active:           true,
            guest_visible:       false,
            ai_usable:           false,
          };
        }
        if (cc.contact_name || cc.contact_phone) {
          emContacts.caretaker = {
            contact_name:        cc.contact_name    || null,
            contact_phone:       cc.contact_phone   || null,
            available_hours:     cc.available_hours  || null,
            escalation_priority: 2,
            is_active:           true,
            guest_visible:       false,
            ai_usable:           false,
          };
        }

        var ewRes = await window.NauxicaSupabase.functions.invoke('emergency-writer', {
          body: {
            property_id:    propId,
            emergency_data: emPayload,
            contacts:       Object.keys(emContacts).length ? emContacts : undefined,
          },
        });
        if (ewRes.error) {
          console.warn('Nauxica: emergency-writer failed:',
            ewRes.error.message, (ewRes.data && ewRes.data.error) || '');
        }
      }

      var savedProp = _fromSupabaseToWizard(dbRes.data);
      _close();
      if (_afterSave) _afterSave(savedProp);
    } catch (err) {
      _showError((err && err.message) || 'Failed to save. Please try again.');
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Save Property'; }
    }
  }

  /* ── Navigation handlers ──────────────────────────────────── */
  async function _handleNext() {
    if (_mode === 'guest') {
      if (!_validateGuestStep(_currentStep)) return;
      _collectGuestStep(_currentStep);
      if (_currentStep === GUEST_TOTAL_STEPS) { await _saveGuest(); }
      else { _currentStep++; _renderStep(); }
    } else {
      if (!_validateStep(_currentStep)) return;
      _collectStep(_currentStep);
      if (_currentStep === TOTAL_STEPS) { await _saveProperty(); }
      else { _currentStep++; _renderStep(); }
    }
  }

  function _handleBack() {
    if (_currentStep <= 1) return;
    if (_mode === 'guest') _collectGuestStep(_currentStep);
    else _collectStep(_currentStep);
    _currentStep--;
    _renderStep();
  }

  /* ── Public: openGuest ────────────────────────────────────── */
  function openGuest(propertyId, afterSaveFn) {
    _ensureInit();
    _mode        = 'guest';
    _guestPropId = propertyId;
    _guestData   = {};
    _afterSave   = typeof afterSaveFn === 'function' ? afterSaveFn : null;
    _currentStep = 1;
    _renderStep();
    document.getElementById('wizardOverlay').classList.add('is-visible');
    document.getElementById('wizardModal').classList.add('is-visible');
    document.getElementById('wizardBody').scrollTop = 0;
  }

  /* ── Public API ───────────────────────────────────────────── */
  async function fromSupabase(row, afterSaveFn) {
    var propId = row.id;
    var preloadedEmergency = {};
    var preloadedContacts  = { owner: {}, caretaker: {} };

    if (propId) {
      try {
        var emRes = await window.NauxicaSupabase
          .from('emergency_data').select('*').eq('property_id', propId).maybeSingle();
        if (emRes.data) preloadedEmergency = emRes.data;
      } catch (e) { console.warn('Nauxica: could not load emergency_data:', e); }

      try {
        var ctRes = await window.NauxicaSupabase
          .from('emergency_contacts').select('*').eq('property_id', propId)
          .in('contact_type', ['owner', 'caretaker']);
        if (ctRes.data) ctRes.data.forEach(function (ct) {
          preloadedContacts[ct.contact_type] = ct;
        });
      } catch (e) { console.warn('Nauxica: could not load emergency_contacts:', e); }
    }

    var wizardData = _fromSupabaseToWizard(row);
    open(wizardData, afterSaveFn);
    // Restore pre-loaded data after open() resets the stores
    _emergencyData = preloadedEmergency;
    _contactsData  = preloadedContacts;
  }

  return { open: open, openGuest: openGuest, fromSupabase: fromSupabase };

})();
