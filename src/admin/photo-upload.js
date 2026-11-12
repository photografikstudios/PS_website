// Browser-only preparation shared by every dashboard photo upload. The local original is never modified.
(function () {
  var MAX_EDGE = 2400;
  var MAX_BYTES = 5000000; // Strictly below the dashboard's decimal 5 MB limit.
  function photoType(file) {
    if (/^image\/(jpeg|png|webp)$/.test(file.type)) return file.type;
    if (!file.type || file.type === 'application/octet-stream') {
      if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg';
      if (/\.png$/i.test(file.name)) return 'image/png';
      if (/\.webp$/i.test(file.name)) return 'image/webp';
    }
    return '';
  }
  function decode(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      // Modern browsers apply EXIF orientation when decoding <img>, including its natural dimensions.
      image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('This image could not be opened. Export it as JPG, PNG or WebP and try again.')); };
      image.src = url;
    });
  }
  function encode(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob && blob.size) resolve(blob);
        else reject(new Error('This browser could not prepare the image. Try a JPG, PNG or WebP export.'));
      }, type, quality);
    });
  }
  async function prepare(file) {
    var type = photoType(file);
    if (!type) throw new Error('Choose a JPG, PNG or WebP photo. Export iPhone HEIC photos as JPG first.');
    var image = await decode(file);
    var originalWidth = image.naturalWidth, originalHeight = image.naturalHeight;
    if (!originalWidth || !originalHeight) throw new Error('This image has no readable dimensions.');
    if (Math.max(originalWidth, originalHeight) <= MAX_EDGE && file.size < MAX_BYTES) {
      return { file: file, width: originalWidth, height: originalHeight, changed: false, notice: '' };
    }
    var ratio = Math.min(1, MAX_EDGE / Math.max(originalWidth, originalHeight));
    var width = Math.max(1, Math.round(originalWidth * ratio));
    var height = Math.max(1, Math.round(originalHeight * ratio));
    var canvas = document.createElement('canvas');
    try {
      var blob;
      // PNG stays lossless when it fits. A large PNG may use WebP, preserving transparent backgrounds.
      // Older browsers without WebP encoding fall back to a smaller PNG, never a flattened logo.
      for (var attempt = 0; attempt < 9; attempt++) {
        canvas.width = width; canvas.height = height;
        var ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('This browser could not resize the photo. Try another browser.');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, width, height);
        var outputType = type;
        if (type === 'image/png') {
          blob = await encode(canvas, 'image/png');
          if (blob.size < MAX_BYTES) break;
          outputType = 'image/webp';
        }
        for (var quality of [0.9, 0.82, 0.74, 0.66, 0.58]) {
          blob = await encode(canvas, outputType, quality);
          if (blob.size < MAX_BYTES) break;
          if (blob.type !== outputType) {
            // Safari may decode WebP without being able to encode it. Opaque photos can use JPEG at
            // the full 2400px edge; transparent images must retain their alpha, even if PNG needs less resolution.
            var pixels = ctx.getImageData(0, 0, width, height).data;
            var transparent = false;
            for (var pixel = 3; pixel < pixels.length; pixel += 4) {
              if (pixels[pixel] !== 255) { transparent = true; break; }
            }
            pixels = null;
            if (!transparent) {
              for (var jpegQuality of [0.9, 0.82, 0.74, 0.66, 0.58]) {
                blob = await encode(canvas, 'image/jpeg', jpegQuality);
                if (blob.size < MAX_BYTES) break;
              }
            }
            break;
          }
        }
        if (blob.size < MAX_BYTES) break;
        ratio *= 0.82;
        width = Math.max(1, Math.round(originalWidth * ratio));
        height = Math.max(1, Math.round(originalHeight * ratio));
      }
      if (!blob || blob.size >= MAX_BYTES) throw new Error('This image could not be reduced below 5 MB. Try a web JPG or WebP export.');
      var extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      var name = file.name.replace(/\.[^.]+$/, '') + '.' + extension;
      var prepared = new File([blob], name, { type: blob.type, lastModified: file.lastModified });
      return { file: prepared, width: width, height: height, changed: true,
        notice: 'Prepared ' + file.name + ': ' + width + ' × ' + height + ' px, ' + (prepared.size / 1000000).toFixed(2) + ' MB. Your original file is unchanged.' };
    } finally {
      canvas.width = 0; canvas.height = 0;
    }
  }
  window.PHOTOGRAFIK_PHOTO_UPLOAD = { prepare: prepare, isPhoto: function (file) { return !!photoType(file); }, maxEdge: MAX_EDGE, maxBytes: MAX_BYTES };
})();
