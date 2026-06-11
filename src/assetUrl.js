/** Resolve a public/ asset path for the current Vite base URL. */
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
