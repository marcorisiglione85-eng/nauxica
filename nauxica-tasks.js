window.NauxicaTasks = (function () {

  var EVIDENCE_CHECK_KEYS = {
    cleaning:      ['property_accessed', 'work_completed', 'no_damage_or_issues', 'photos_uploaded'],
    maintenance:   ['issue_inspected', 'repair_attempted_or_completed', 'photos_uploaded', 'follow_up_needed'],
    laundry:       ['items_collected_or_delivered', 'issue_reported_if_any'],
    transfers:     ['guest_picked_up_or_dropped_off', 'delay_reported_if_any'],
    experiences:   ['guest_attended', 'issue_reported_if_any'],
    guest_request: ['request_fulfilled', 'issue_reported_if_any'],
    other:         ['work_completed', 'issue_reported_if_any']
  };

  async function openTaskPhoto(opts) {
    try {
      var sb = opts && opts.supabase;
      if (!sb) return { ok: false, code: 'missing_supabase_client', error: 'Supabase client is required' };

      var storagePath = opts.storagePath;
      if (!storagePath) return { ok: false, code: 'missing_storage_path', error: 'Storage path is required' };

      var bucket    = opts.bucket    || 'task-photos';
      var expiresIn = opts.expiresIn || 300;

      var res = await sb.storage.from(bucket).createSignedUrl(storagePath, expiresIn);

      if (res.error || !res.data || !res.data.signedUrl) {
        return {
          ok:    false,
          code:  'signed_url_failed',
          error: (res.error && res.error.message) || 'Signed URL creation failed'
        };
      }

      return {
        ok:          true,
        signedUrl:   res.data.signedUrl,
        bucket:      bucket,
        storagePath: storagePath,
        expiresIn:   expiresIn
      };

    } catch (err) {
      return { ok: false, code: 'unexpected_error', error: (err && err.message) || String(err) };
    }
  }

  return {
    EVIDENCE_CHECK_KEYS: EVIDENCE_CHECK_KEYS,
    openTaskPhoto:       openTaskPhoto
  };

})();
