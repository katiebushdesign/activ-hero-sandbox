/** Resolve a public/ asset path for the current Vite base URL. */
export function assetUrl(path) {
  const url = `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
  const buildId = import.meta.env.VITE_BUILD_ID;

  if (!buildId) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${buildId}`;
}
