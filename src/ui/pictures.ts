import { PICTURES } from '@/content/index';

// Every bundled picture, resolved to a hashed URL at build time (precached).
const URLS: Record<string, string> = import.meta.glob('../../assets/pictures/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const BY_FILE = new Map(
  Object.entries(URLS).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

/** URL for a picture id, or undefined when the picture is not bundled. */
export function pictureUrl(pictureId: string | undefined): string | undefined {
  if (!pictureId) return undefined;
  const file = PICTURES.get(pictureId)?.file;
  return file ? BY_FILE.get(file) : undefined;
}
