window.NauxicaPhotos = (function () {

  var ALLOWED_PHOTO_TYPES = ['before', 'after', 'issue', 'completion', 'other'];
  var DEFAULT_PHOTO_TYPE  = 'other';

  function fail(code, error, extra) {
    return Object.assign({ ok: false, code: code, error: error || code }, extra || {});
  }

  // Coordinates NauxicaStorage (Storage upload only) with public.task_photos
  // (metadata only) so Issue Photos and Evidence Photos can later share one
  // call instead of each re-implementing this sequence. Does not log
  // timeline events and does not touch the DOM — both stay caller-controlled,
  // since partner-job-detail.html already owns logTimelineEvent() /
  // refreshTimelineUI() / refreshActionBar() and those are closured over
  // that page's own state, not something a shared helper should depend on.
  async function attachTaskPhoto(options) {
    try {
      var opts = options || {};

      var sb = window.NauxicaSupabase;
      if (!sb) {
        return fail('missing_supabase_client', 'Supabase client is not available');
      }

      if (!window.NauxicaStorage || typeof window.NauxicaStorage.uploadTaskPhoto !== 'function') {
        return fail('missing_storage_helper', 'NauxicaStorage.uploadTaskPhoto is not available');
      }

      var taskId = opts.taskId;
      if (!taskId || typeof taskId !== 'string') {
        return fail('missing_task_id', 'taskId is required');
      }

      var file = opts.file;
      if (!file || typeof file.size !== 'number' || typeof file.type !== 'string') {
        return fail('missing_file', 'file is required');
      }

      var photoType = opts.photoType || DEFAULT_PHOTO_TYPE;
      if (ALLOWED_PHOTO_TYPES.indexOf(photoType) === -1) {
        return fail('invalid_photo_type', 'photoType "' + photoType + '" is not allowed');
      }

      // uploaded_by is always resolved from the live session, never from
      // caller input — task_photos' RLS INSERT policy requires
      // uploaded_by = auth.uid(), so trusting a caller-supplied value here
      // would only ever produce a confusing RLS denial instead of a clear
      // missing_session error.
      var sessRes = await sb.auth.getSession();
      var session = sessRes && sessRes.data && sessRes.data.session;
      if (!session) {
        return fail('missing_session', 'No authenticated user session found.');
      }
      var uploadedBy = session.user.id;

      var photoId = crypto.randomUUID();

      var upload = await window.NauxicaStorage.uploadTaskPhoto({
        taskId:           taskId,
        file:             file,
        photoId:          photoId,
        bucket:           opts.bucket,
        allowedMimeTypes: opts.allowedMimeTypes,
        maxSizeBytes:     opts.maxSizeBytes
      });

      if (!upload || !upload.ok) {
        return fail('upload_failed', (upload && upload.error) || 'Upload failed', { upload: upload });
      }

      // storage_path always reuses upload.path verbatim — never
      // reconstructed independently, so the metadata row and the actual
      // Storage object can never disagree on where the file lives.
      var { data: photo, error: insertError } = await sb
        .from('task_photos')
        .insert({
          id:           photoId,
          task_id:      taskId,
          uploaded_by:  uploadedBy,
          photo_type:   photoType,
          storage_path: upload.path,
          caption:      opts.caption || null
        })
        .select()
        .single();

      if (insertError) {
        var cleanupAttempted = false;
        var cleanupSucceeded = false;
        try {
          cleanupAttempted = true;
          var removeRes = await sb.storage.from(upload.bucket).remove([upload.path]);
          cleanupSucceeded = !(removeRes && removeRes.error);
        } catch (cleanupErr) {
          // Cleanup is best-effort only — its own failure must never
          // replace or mask the original metadata_insert_failed error.
          cleanupSucceeded = false;
        }
        return fail('metadata_insert_failed', insertError.message || String(insertError), {
          upload:           upload,
          cleanupAttempted: cleanupAttempted,
          cleanupSucceeded: cleanupSucceeded
        });
      }

      var evidenceLinked = false;
      if (opts.evidenceCheckId) {
        var { error: linkError } = await sb
          .from('task_evidence_checks')
          .update({ photo_id: photoId })
          .eq('id', opts.evidenceCheckId);

        if (linkError) {
          // The photo and its task_photos row are already valid and
          // committed — do not delete either just because linking it to
          // an evidence check failed. It can be recovered or relinked.
          return fail('evidence_link_failed', linkError.message || String(linkError), {
            photo:  photo,
            upload: upload
          });
        }
        evidenceLinked = true;
      }

      return {
        ok:             true,
        photo:          photo,
        upload:         upload,
        evidenceLinked: evidenceLinked
      };

    } catch (err) {
      return fail('unexpected_error', (err && err.message) || String(err));
    }
  }

  return { attachTaskPhoto: attachTaskPhoto };

})();
