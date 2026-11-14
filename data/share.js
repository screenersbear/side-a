// Hands a finished file to the phone's share sheet (AirDrop, Messages, Files...). Where the browser can't share
// files, the file is downloaded instead. Resolves to:
//   'shared'     the share sheet took it
//   'cancelled'  the share sheet was closed
//   'again'      the phone wants a fresh tap first (sharing must come straight from a tap)
//   'saved'      downloaded instead
export async function shareFile(blob, name, { nav = globalThis.navigator, doc = globalThis.document } = {}) {
  const files = [new File([blob], name, { type: blob.type })];
  if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files })) {
    try {
      await nav.share({ files });
      return 'shared';
    } catch (error) {
      const why = error && error.name;
      if (why === 'AbortError') return 'cancelled';
      if (why === 'NotAllowedError') return 'again';
      // Any other refusal (a type it won't share, say): download it instead.
    }
  }
  download(files[0], doc);
  return 'saved';
}

function download(file, doc) {
  const url = URL.createObjectURL(file);
  const link = doc.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  // Long enough for the download to start.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
