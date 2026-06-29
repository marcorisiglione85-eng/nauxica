window.NauxicaStorage = (function () {

  var DEFAULT_BUCKET = 'task-photos';
  var DEFAULT_ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ];
  var DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

  var MIME_EXTENSION_MAP = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif'
  };

  function fail(code, error) {
    return { ok: false, error: error || code, code: code };
  }

  // Prefers the file's own name extension (sanitized to a short
  // alphanumeric token, so nothing from a user-controlled filename ever
  // reaches the storage path unescaped); falls back to a MIME-type map
  // for files with no name or an unrecognizable extension (e.g. HEIC
  // photos straight off a phone camera, which often arrive unnamed in
  // upload pipelines).
  function deriveExtension(file, mimeType) {
    if (file && typeof file.name === 'string') {
      var match = /\.([a-zA-Z0-9]{1,5})$/.exec(file.name);
      if (match) return match[1].toLowerCase();
    }
    return MIME_EXTENSION_MAP[mimeType] || null;
  }

  async function uploadTaskPhoto(options) {
    try {
      var opts = options || {};

      var sb = window.NauxicaSupabase;
      if (!sb || !sb.storage) {
        return fail('missing_supabase_client', 'Supabase client is not available');
      }

      var taskId = opts.taskId;
      if (!taskId || typeof taskId !== 'string') {
        return fail('missing_task_id', 'taskId is required');
      }

      var file = opts.file;
      if (!file || typeof file.size !== 'number' || typeof file.type !== 'string') {
        return fail('missing_file', 'file is required');
      }

      var allowedMimeTypes = (opts.allowedMimeTypes || DEFAULT_ALLOWED_MIME_TYPES)
        .map(function (t) { return String(t).toLowerCase(); });
      var mimeType = String(file.type).toLowerCase();

      if (mimeType.indexOf('image/') !== 0 || allowedMimeTypes.indexOf(mimeType) === -1) {
        return fail('invalid_file_type', 'File type "' + (file.type || 'unknown') + '" is not allowed');
      }

      var maxSizeBytes = opts.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES;
      if (file.size > maxSizeBytes) {
        return fail('file_too_large', 'File exceeds the maximum allowed size of ' + maxSizeBytes + ' bytes');
      }

      var ext = deriveExtension(file, mimeType);
      if (!ext) {
        return fail('invalid_extension', 'Could not determine a safe file extension');
      }

      var bucket = opts.bucket || DEFAULT_BUCKET;
      var photoId = opts.photoId || crypto.randomUUID();
      var path = taskId + '/' + photoId + '.' + ext;

      var { error } = await sb.storage.from(bucket).upload(path, file, { upsert: false });
      if (error) {
        return fail('upload_failed', error.message || String(error));
      }

      return {
        ok: true,
        bucket: bucket,
        path: path,
        photoId: photoId,
        mimeType: mimeType,
        sizeBytes: file.size
      };

    } catch (err) {
      return fail('unexpected_error', (err && err.message) || String(err));
    }
  }

  return { uploadTaskPhoto: uploadTaskPhoto };

})();
