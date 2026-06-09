window.NauxicaTimeline = (function () {

  async function log(opts) {
    try {
      var sb = window.NauxicaSupabase;
      if (!sb) { console.warn('[NauxicaTimeline] Supabase not ready'); return; }

      var sessRes = await sb.auth.getSession();
      var actorId = (sessRes.data && sessRes.data.session)
        ? sessRes.data.session.user.id
        : null;

      if (!actorId) { console.warn('[NauxicaTimeline] no active session — event dropped'); return; }

      var row = {
        actor_id:          actorId,
        actor_type:        opts.actor_type || 'homeowner',
        event_type:        opts.event_type,
        event_title:       opts.event_title,
        event_description: opts.event_description || null,
        metadata:          opts.metadata          || {}
      };

      if (opts.property_id)     row.property_id     = opts.property_id;
      if (opts.reservation_id)  row.reservation_id  = opts.reservation_id;
      if (opts.task_id)         row.task_id         = opts.task_id;
      if (opts.conversation_id) row.conversation_id = opts.conversation_id;

      var { error } = await sb.from('timeline_events').insert(row);
      if (error) console.warn('[NauxicaTimeline] insert failed:', error.message);

    } catch (err) {
      console.warn('[NauxicaTimeline] unexpected error:', err);
    }
  }

  return { log: log };

})();
