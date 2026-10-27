// Multi-Source Cartoon PNG, Photo & GIF Search + Auto-Recommended Photo Engine + Setup Presets

export type AnswerContentMode = 'words' | 'photos_gifs' | 'both';

export interface ParsedOptionContent {
  raw: string;
  text: string;
  imageUrl: string | null;
  mode: 'word' | 'image' | 'both';
}

export const OPTION_MEDIA_DELIMITER = '|||';

/**
 * Checks if a string looks like a direct image/GIF URL or data URI
 */
export function isDirectMediaUrl(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.includes(OPTION_MEDIA_DELIMITER)) return false;
  return (
    trimmed.startsWith('data:image') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/assets/')
  );
}

/**
 * Parses an option string that may be:
 * - Plain text: "Apple"
 * - Direct image/GIF URL: "https://..."
 * - Combined Word + Image/GIF: "Apple|||https://..."
 */
export function parseOptionContent(rawOpt: string): ParsedOptionContent {
  if (!rawOpt || typeof rawOpt !== 'string') {
    return { raw: '', text: '', imageUrl: null, mode: 'word' };
  }
  const trimmed = rawOpt.trim();
  if (trimmed.includes(OPTION_MEDIA_DELIMITER)) {
    const [textPart, ...urlParts] = trimmed.split(OPTION_MEDIA_DELIMITER);
    const url = urlParts.join(OPTION_MEDIA_DELIMITER).trim();
    const cleanText = textPart.trim();
    if (url && (url.startsWith('http') || url.startsWith('data:image') || url.startsWith('/'))) {
      if (cleanText) {
        return { raw: rawOpt, text: cleanText, imageUrl: url, mode: 'both' };
      }
      return { raw: rawOpt, text: '', imageUrl: url, mode: 'image' };
    }
    return { raw: rawOpt, text: cleanText, imageUrl: null, mode: 'word' };
  }

  if (isDirectMediaUrl(trimmed)) {
    return { raw: rawOpt, text: '', imageUrl: trimmed, mode: 'image' };
  }

  return { raw: rawOpt, text: trimmed, imageUrl: null, mode: 'word' };
}

/**
 * Formats text and imageUrl according to the desired mode
 */
export function formatOptionContent(
  text: string,
  imageUrl: string | null | undefined,
  mode: AnswerContentMode = 'both'
): string {
  const cleanText = (text || '').replace(/\|\|\|/g, ' ').trim();
  const cleanUrl = (imageUrl || '').trim();

  if (mode === 'words' || !cleanUrl) {
    return cleanText;
  }
  if (mode === 'photos_gifs') {
    return cleanUrl || cleanText;
  }
  // mode === 'both'
  if (cleanText && cleanUrl) {
    return `${cleanText}${OPTION_MEDIA_DELIMITER}${cleanUrl}`;
  }
  return cleanUrl || cleanText;
}

/**
 * Curated map of common classroom vocabulary words to Twemoji high-res transparent Cartoon PNGs
 * (72x72 / 512x512 crisp vector-rendered cartoon PNGs via jsDelivr CDN, 100% uptime & CORS-friendly)
 * Plus ARASAAC cartoon pictograms lookup for thousands more words!
 */
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

const WORD_TO_TWEMOJI_CODE: Record<string, string> = {
  // Fruits & Vegetables
  apple: '1f34e',
  'red apple': '1f34e',
  'green apple': '1f34f',
  banana: '1f34c',
  bananas: '1f34c',
  orange: '1f34a',
  lemon: '1f34b',
  watermelon: '1f349',
  grapes: '1f347',
  grape: '1f347',
  strawberry: '1f353',
  strawberries: '1f353',
  cherry: '1f352',
  cherries: '1f352',
  peach: '1f351',
  pear: '1f350',
  pineapple: '1f34d',
  mango: '1f96d',
  coconut: '1f965',
  kiwi: '1f95d',
  avocado: '1f951',
  tomato: '1f345',
  carrot: '1f955',
  corn: '1f33d',
  broccoli: '1f966',
  potato: '1f954',
  mushroom: '1f344',
  onion: '1f9c5',
  garlic: '1f9c4',
  cucumber: '1f952',
  eggplant: '1f346',

  // Food & Drinks
  pizza: '1f355',
  burger: '1f354',
  hamburger: '1f354',
  fries: '1f35f',
  'french fries': '1f35f',
  hotdog: '1f32d',
  'hot dog': '1f32d',
  sandwich: '1f96a',
  taco: '1f32e',
  sushi: '1f363',
  noodles: '1f35c',
  spaghetti: '1f35d',
  pasta: '1f35d',
  rice: '1f35a',
  bread: '1f35e',
  croissant: '1f950',
  pancake: '1f95e',
  pancakes: '1f95e',
  waffle: '1f9c7',
  cheese: '1f9c0',
  egg: '1f95a',
  eggs: '1f373',
  chicken: '1f357',
  meat: '1f356',
  steak: '1f969',
  bacon: '1f953',
  cake: '1f370',
  'birthday cake': '1f382',
  cupcake: '1f9c1',
  cookie: '1f36a',
  cookies: '1f36a',
  chocolate: '1f36b',
  candy: '1f36c',
  lollipop: '1f36d',
  donut: '1f369',
  doughnut: '1f369',
  'ice cream': '1f368',
  icecream: '1f368',
  popcorn: '1f37f',
  honey: '1f36f',
  milk: '1f95b',
  coffee: '2615',
  tea: '1f375',
  juice: '1f9c3',
  water: '1f4a7',

  // Animals
  dog: '1f436',
  puppy: '1f436',
  cat: '1f431',
  kitten: '1f431',
  mouse: '1f42d',
  hamster: '1f439',
  rabbit: '1f430',
  bunny: '1f430',
  fox: '1f98a',
  bear: '1f43b',
  panda: '1f43c',
  koala: '1f428',
  tiger: '1f42f',
  lion: '1f981',
  cow: '1f42e',
  pig: '1f437',
  frog: '1f438',
  monkey: '1f435',
  chicken_bird: '1f414',
  hen: '1f414',
  rooster: '1f413',
  penguin: '1f427',
  bird: '1f426',
  duck: '1f986',
  eagle: '1f985',
  owl: '1f989',
  bat: '1f987',
  wolf: '1f43a',
  horse: '1f434',
  unicorn: '1f984',
  bee: '1f41d',
  butterfly: '1f98b',
  bug: '1f41b',
  ant: '1f41c',
  ladybug: '1f41e',
  spider: '1f577',
  turtle: '1f422',
  snake: '1f40d',
  lizard: '1f98e',
  trex: '1f996',
  dinosaur: '1f996',
  octopus: '1f419',
  squid: '1f991',
  shrimp: '1f990',
  crab: '1f980',
  fish: '1f41f',
  dolphin: '1f42c',
  whale: '1f433',
  shark: '1f988',
  crocodile: '1f40a',
  alligator: '1f40a',
  zebra: '1f993',
  gorilla: '1f98d',
  elephant: '1f418',
  hippo: '1f99b',
  rhino: '1f98f',
  camel: '1f42b',
  giraffe: '1f992',
  kangaroo: '1f998',
  sheep: '1f411',
  goat: '1f410',
  deer: '1f98c',
  peacock: '1f99a',
  parrot: '1f99c',
  swan: '1f9a2',
  flamingo: '1f9a9',
  snail: '1f40c',

  // Vehicles & Transport
  car: '1f697',
  taxi: '1f695',
  bus: '1f68c',
  'school bus': '1f68c',
  police: '1f693',
  'police car': '1f693',
  ambulance: '1f691',
  'fire truck': '1f692',
  truck: '1f69a',
  tractor: '1f69c',
  bicycle: '1f6b2',
  bike: '1f6b2',
  scooter: '1f6f4',
  motorcycle: '1f3cd',
  train: '1f686',
  metro: '1f687',
  airplane: '2708',
  plane: '2708',
  helicopter: '1f681',
  rocket: '1f680',
  UFO: '1f6f8',
  boat: '26f5',
  ship: '1f6a2',
  submarine: '1f6a2',

  // School, Objects & Everyday Items
  book: '1f4d6',
  books: '1f4da',
  notebook: '1f4d3',
  pencil: '270f',
  pen: '1f58a',
  crayon: '1f58d',
  paintbrush: '1f58c',
  scissors: '2702',
  ruler: '1f4cf',
  backpack: '1f392',
  'school bag': '1f392',
  bag: '1f392',
  school: '1f3eb',
  house: '1f3e0',
  home: '1f3e0',
  hospital: '1f3e5',
  castle: '1f3f0',
  computer: '1f4bb',
  laptop: '1f4bb',
  phone: '1f4f1',
  telephone: '260e',
  television: '1f4fa',
  tv: '1f4fa',
  camera: '1f4f7',
  clock: '1f570',
  watch: '231a',
  lightbulb: '1f4a1',
  key: '1f511',
  lock: '1f512',
  umbrella: '2602',
  balloon: '1f388',
  gift: '1f381',
  present: '1f381',
  trophy: '1f3c6',
  medal: '1f3c5',
  crown: '1f451',
  hat: '1f452',
  cap: '1f9e2',
  glasses: '1f453',
  shirt: '1f455',
  tshirt: '1f455',
  dress: '1f457',
  pants: '1f456',
  jeans: '1f456',
  shoe: '1f45f',
  shoes: '1f45f',
  sock: '1f9e6',
  socks: '1f9e6',
  gloves: '1f9e4',
  chair: '1fa91',
  bed: '1f6cf',
  door: '1f6aa',
  window: '1fa9f',
  mirror: '1fa9e',

  // Sports & Music
  soccer: '26bd',
  football: '26bd',
  basketball: '1f3c0',
  baseball: '26be',
  tennis: '1f3be',
  volleyball: '1f3d0',
  guitar: '1f3b8',
  piano: '1f3b9',
  drum: '1f941',
  trumpet: '1f3ba',
  violin: '1f3bb',
  microphone: '1f3a4',
  headphones: '1f3a7',

  // Nature, Weather & Space
  sun: '2600',
  sunny: '2600',
  moon: '1f319',
  star: '2b50',
  stars: '1f31f',
  cloud: '2601',
  cloudy: '2601',
  rain: '1f327',
  rainy: '1f327',
  snow: '2744',
  snowy: '2744',
  snowman: '26c4',
  rainbow: '1f308',
  fire: '1f525',
  tree: '1f333',
  flower: '1f33b',
  rose: '1f339',
  cactus: '1f335',
  leaf: '1f343',
  earth: '1f30d',
  world: '1f30d',
  planet: '1fa90',
  mountain: '26f0',
  volcano: '1f30b',
  island: '1f3dd',
  ocean: '1f30a',
  wave: '1f30a',

  // Emotions, People, Body & Actions
  happy: '1f604',
  smile: '1f604',
  laugh: '1f602',
  sad: '1f622',
  cry: '1f62d',
  angry: '1f621',
  mad: '1f621',
  surprised: '1f632',
  scared: '1f631',
  sleepy: '1f634',
  tired: '1f634',
  sleep: '1f6cc',
  sick: '1f912',
  cool: '1f60e',
  love: '2764',
  heart: '2764',
  run: '1f3c3',
  running: '1f3c3',
  walk: '1f6b6',
  walking: '1f6b6',
  swim: '1f3ca',
  swimming: '1f3ca',
  dance: '1f483',
  dancing: '1f483',
  sing: '1f3a4',
  read: '1f4d6',
  write: '270d',
  eat: '1f37d',
  drink: '1f964',
  cook: '1f468-200d-1f373',
  chef: '1f468-200d-1f373',
  teacher: '1f469-200d-1f3eb',
  doctor: '1f468-200d-2695-fe0f',
  student: '1f468-200d-1f393',
  police_officer: '1f46e',
  firefighter: '1f468-200d-1f692',
  astronaut: '1f468-200d-1f680',
  artist: '1f468-200d-1f3a8',
  pilot: '1f468-200d-2708-fe0f',
  farmer: '1f468-200d-1f33e',
  eye: '1f441',
  eyes: '1f440',
  ear: '1f442',
  nose: '1f443',
  mouth: '1f444',
  hand: '1f91a',
  foot: '1f9b6',
  brain: '1f9e0',
  tooth: '1f9b7',

  // Colors & Numbers
  red: '1f534',
  blue: '1f535',
  green: '1f7e2',
  yellow: '1f7e1',
  purple: '1f7e3',
  orange_color: '1f7e0',
  black: '26ab',
  white: '26aa',
};

// In-memory cache for async cartoon PNG lookups
const recommendedPhotoCache = new Map<string, string>();

/**
 * Normalizes a user's typed option text to a clean keyword for photo lookup
 */
export function normalizeKeyword(input: string): string {
  if (!input) return '';
  const parsed = parseOptionContent(input);
  const text = parsed.text || '';
  return text
    .toLowerCase()
    .replace(/^[a-f]\)\s*/i, '')
    .replace(/^[1-6]\.\s*/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synchronously returns an instant Cartoon PNG URL if the word is in our common dictionary
 */
export function getInstantCartoonPng(word: string): string | null {
  const clean = normalizeKeyword(word);
  if (!clean || clean.length < 2) return null;

  if (recommendedPhotoCache.has(clean)) {
    return recommendedPhotoCache.get(clean)!;
  }

  // Exact match
  if (WORD_TO_TWEMOJI_CODE[clean]) {
    return `${TWEMOJI_BASE}/${WORD_TO_TWEMOJI_CODE[clean]}.png`;
  }

  // Singular match (strip trailing 's' or 'es')
  if (clean.endsWith('es') && WORD_TO_TWEMOJI_CODE[clean.slice(0, -2)]) {
    return `${TWEMOJI_BASE}/${WORD_TO_TWEMOJI_CODE[clean.slice(0, -2)]}.png`;
  }
  if (clean.endsWith('s') && WORD_TO_TWEMOJI_CODE[clean.slice(0, -1)]) {
    return `${TWEMOJI_BASE}/${WORD_TO_TWEMOJI_CODE[clean.slice(0, -1)]}.png`;
  }

  // Check if any word in a short phrase matches
  const tokens = clean.split(' ');
  for (const token of tokens) {
    if (WORD_TO_TWEMOJI_CODE[token]) {
      return `${TWEMOJI_BASE}/${WORD_TO_TWEMOJI_CODE[token]}.png`;
    }
    if (token.endsWith('s') && WORD_TO_TWEMOJI_CODE[token.slice(0, -1)]) {
      return `${TWEMOJI_BASE}/${WORD_TO_TWEMOJI_CODE[token.slice(0, -1)]}.png`;
    }
  }

  return null;
}

/**
 * Asynchronously fetches the best Cartoon PNG for any word or phrase:
 * 1. Checks instant Twemoji cartoon PNG dictionary
 * 2. Queries ARASAAC Cartoon Pictograms API (13,000+ transparent educational cartoon PNGs)
 * 3. Queries `/api/photo-search` (which aggregates ARASAAC, Wikimedia Cartoon PNGs, Openverse)
 */
export async function fetchRecommendedCartoonPng(word: string): Promise<string | null> {
  const clean = normalizeKeyword(word);
  if (!clean || clean.length < 2) return null;

  if (recommendedPhotoCache.has(clean)) {
    return recommendedPhotoCache.get(clean)!;
  }

  // 1. Try ARASAAC Educational Cartoon Pictogram PNG first for rich classroom cartoon illustrations!
  try {
    const arasaacRes = await fetch(
      `https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(clean)}`
    );
    if (arasaacRes.ok) {
      const data = await arasaacRes.json();
      if (Array.isArray(data) && data.length > 0 && data[0]._id) {
        const url = `https://static.arasaac.org/pictograms/${data[0]._id}/${data[0]._id}_500.png`;
        recommendedPhotoCache.set(clean, url);
        return url;
      }
    }
  } catch {
    // Fallback to next source
  }

  // 2. Check instant Twemoji cartoon PNG
  const instant = getInstantCartoonPng(clean);
  if (instant) {
    recommendedPhotoCache.set(clean, instant);
    return instant;
  }

  // 3. Try Wikimedia Commons Cartoon PNG search directly
  try {
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      `filetype:bitmap|drawing ${clean} cartoon OR clipart OR icon`
    )}&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url|mime&iiurlwidth=400&format=json&origin=*`;
    const wikiRes = await fetch(wikiUrl);
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const pages = wikiData?.query?.pages ? Object.values(wikiData.query.pages) : [];
      for (const page of pages as any[]) {
        const thumb = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
        if (thumb) {
          recommendedPhotoCache.set(clean, thumb);
          return thumb;
        }
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

export interface PhotoSearchResult {
  id: string;
  alt_description: string;
  isCartoonPng?: boolean;
  source?: string;
  urls: {
    regular: string;
    small: string;
  };
}

export interface GifSearchResult {
  id: string;
  title: string;
  source?: string;
  images: {
    fixed_height: { url: string };
    fixed_height_small: { url: string };
  };
}

/**
 * Multi-source Cartoon PNG & Photo Search (Works both via server `/api/photo-search` and direct client-side CORS APIs)
 * Prioritizes Cartoon PNGs first!
 */
export async function searchPhotosMultiSource(
  rawQuery: string,
  prioritizeCartoonPng: boolean = true
): Promise<PhotoSearchResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  const results: PhotoSearchResult[] = [];
  const seenUrls = new Set<string>();

  const pushUnique = (item: PhotoSearchResult) => {
    if (!item?.urls?.regular || seenUrls.has(item.urls.regular)) return;
    seenUrls.add(item.urls.regular);
    results.push(item);
  };

  // 1. Instant Twemoji Cartoon PNG if matching
  const instantPng = getInstantCartoonPng(query);
  if (instantPng) {
    pushUnique({
      id: `twemoji-${query}`,
      alt_description: `${query} (Cartoon PNG Sticker)`,
      isCartoonPng: true,
      source: 'Cartoon PNG',
      urls: { regular: instantPng, small: instantPng },
    });
  }

  // 2. Fetch in parallel from Server Proxy + ARASAAC Cartoon PNGs + Wikimedia Commons Cartoon PNGs
  const tasks: Promise<void>[] = [];

  // Task A: ARASAAC Cartoon Pictograms API (Transparent 500x500 Cartoon PNGs!)
  tasks.push(
    (async () => {
      try {
        const cleanQ = normalizeKeyword(query) || query;
        const res = await fetch(
          `https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(cleanQ)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            data.slice(0, 14).forEach((item: any, idx: number) => {
              if (item && item._id) {
                const pngUrl = `https://static.arasaac.org/pictograms/${item._id}/${item._id}_500.png`;
                const kw = item.keywords?.[0]?.keyword || query;
                pushUnique({
                  id: `arasaac-${item._id}-${idx}`,
                  alt_description: `${kw} (Cartoon PNG)`,
                  isCartoonPng: true,
                  source: 'ARASAAC Cartoon PNG',
                  urls: { regular: pngUrl, small: pngUrl },
                });
              }
            });
          }
        }
      } catch {
        // Ignore individual source error
      }
    })()
  );

  // Task B: Wikimedia Commons Cartoon PNGs / Clipart / Illustrations
  tasks.push(
    (async () => {
      try {
        const searchQ = prioritizeCartoonPng
          ? `filetype:bitmap|drawing ${query} cartoon OR clipart OR illustration OR icon`
          : `filetype:bitmap ${query}`;
        const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          searchQ
        )}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|mime&iiurlwidth=480&format=json&origin=*`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
          (pages as any[]).forEach((page: any) => {
            const info = page?.imageinfo?.[0];
            const thumb = info?.thumburl || info?.url;
            if (thumb) {
              const isPng =
                thumb.toLowerCase().endsWith('.png') ||
                (info?.mime && info.mime.includes('png')) ||
                (info?.mime && info.mime.includes('svg'));
              pushUnique({
                id: `wiki-${page.pageid}`,
                alt_description: (page.title || query).replace(/^File:/i, ''),
                isCartoonPng: isPng,
                source: isPng ? 'Cartoon PNG' : 'Wikimedia Photo',
                urls: { regular: thumb, small: thumb },
              });
            }
          });
        }
      } catch {
        // Ignore
      }
    })()
  );

  // Task C: Server `/api/photo-search` (Openverse + Server-side aggregation)
  tasks.push(
    (async () => {
      try {
        const res = await fetch(
          `/api/photo-search?q=${encodeURIComponent(query)}&cartoon=${prioritizeCartoonPng ? '1' : '0'}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.results)) {
            data.results.forEach((item: PhotoSearchResult) => {
              pushUnique(item);
            });
          }
        }
      } catch {
        // Ignore
      }
    })()
  );

  // Task D: Secondary Wikimedia general photos if user also wants regular photos or if cartoon results are few
  tasks.push(
    (async () => {
      try {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          `filetype:bitmap ${query}`
        )}&gsrnamespace=6&gsrlimit=16&prop=imageinfo&iiprop=url|mime&iiurlwidth=480&format=json&origin=*`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
          (pages as any[]).forEach((page: any) => {
            const info = page?.imageinfo?.[0];
            const thumb = info?.thumburl || info?.url;
            if (thumb) {
              const isPng = thumb.toLowerCase().endsWith('.png');
              pushUnique({
                id: `wiki-photo-${page.pageid}`,
                alt_description: (page.title || query).replace(/^File:/i, ''),
                isCartoonPng: isPng,
                source: isPng ? 'PNG Image' : 'Wikimedia Commons',
                urls: { regular: thumb, small: thumb },
              });
            }
          });
        }
      } catch {
        // Ignore
      }
    })()
  );

  await Promise.allSettled(tasks);

  // Sort so Cartoon PNGs are strictly prioritized first when prioritizeCartoonPng is true
  if (prioritizeCartoonPng) {
    results.sort((a, b) => {
      const aScore = a.isCartoonPng ? 1 : 0;
      const bScore = b.isCartoonPng ? 1 : 0;
      return bScore - aScore;
    });
  }

  return results;
}

/**
 * Multi-source GIF Search (Tenor API + Server `/api/giphy-search` + Wikimedia Animated GIFs)
 * Never fails or rate-limits!
 */
export async function searchGifsMultiSource(rawQuery: string): Promise<GifSearchResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  const results: GifSearchResult[] = [];
  const seenUrls = new Set<string>();

  const pushUnique = (item: GifSearchResult) => {
    const url = item?.images?.fixed_height?.url;
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    results.push(item);
  };

  const tasks: Promise<void>[] = [];

  // 1. Server `/api/giphy-search` (aggregates Tenor, Giphy, Wikimedia GIFs)
  tasks.push(
    (async () => {
      try {
        const res = await fetch(`/api/giphy-search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.data)) {
            data.data.forEach((gif: GifSearchResult) => pushUnique(gif));
          }
        }
      } catch {
        // Ignore
      }
    })()
  );

  // 2. Direct Tenor Public API (Client-side CORS enabled, super fast, millions of GIFs)
  tasks.push(
    (async () => {
      try {
        const tenorRes = await fetch(
          `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=24`
        );
        if (tenorRes.ok) {
          const tenorData = await tenorRes.json();
          if (Array.isArray(tenorData?.results)) {
            tenorData.results.forEach((item: any) => {
              const media = item.media?.[0];
              const fullGif = media?.gif?.url || media?.mediumgif?.url || media?.tinygif?.url;
              const smallGif = media?.tinygif?.url || media?.nanogif?.url || fullGif;
              if (fullGif) {
                pushUnique({
                  id: `tenor-${item.id}`,
                  title: item.content_description || item.title || query,
                  source: 'Tenor GIF',
                  images: {
                    fixed_height: { url: fullGif },
                    fixed_height_small: { url: smallGif || fullGif },
                  },
                });
              }
            });
          }
        }
      } catch {
        // Ignore
      }
    })()
  );

  // 3. Wikimedia Commons Animated GIFs
  tasks.push(
    (async () => {
      try {
        const wikiGifUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          `filetype:bitmap mime:image/gif ${query}`
        )}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url&format=json&origin=*`;
        const res = await fetch(wikiGifUrl);
        if (res.ok) {
          const data = await res.json();
          const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
          (pages as any[]).forEach((page: any) => {
            const gifUrl = page?.imageinfo?.[0]?.url;
            if (gifUrl && gifUrl.toLowerCase().endsWith('.gif')) {
              pushUnique({
                id: `wikigif-${page.pageid}`,
                title: (page.title || query).replace(/^File:/i, ''),
                source: 'Commons GIF',
                images: {
                  fixed_height: { url: gifUrl },
                  fixed_height_small: { url: gifUrl },
                },
              });
            }
          });
        }
      } catch {
        // Ignore
      }
    })()
  );

  await Promise.allSettled(tasks);
  return results;
}

// ============================================================================
// EXPANDED TOPIC, CLASS LEVEL & FOLDER PRESETS FOR ALL GAME SETUPS
// ============================================================================

export interface TopicPresetCategory {
  category: string;
  topics: string[];
}

export const SETUP_TOPIC_CATEGORIES: TopicPresetCategory[] = [
  {
    category: '🍎 Vocabulary & Cartoon Themes (Auto-Photo Ready)',
    topics: [
      'Fruits & Berries',
      'Animals & Pets',
      'Wild & Zoo Animals',
      'Sea Animals & Ocean',
      'Food & Drinks',
      'Action Verbs',
      'Daily Routines',
      'School Supplies & Classroom',
      'Jobs & Occupations',
      'Emotions & Feelings',
      'Vehicles & Transport',
      'Weather & Seasons',
      'Clothes & Accessories',
      'Sports & Hobbies',
      'Body Parts & Health',
      'Colors & Shapes',
      'House & Rooms',
      'Nature & Space',
    ],
  },
  {
    category: '🔤 English Grammar & Phonics',
    topics: [
      'Present Simple',
      'Present Continuous',
      'Past Simple',
      'Future Tense (Will / Going to)',
      'Present Perfect',
      'Comparatives & Superlatives',
      'Prepositions of Place & Time',
      'Countable & Uncountable Nouns',
      'Modal Verbs (Can / Must / Should)',
      'Phonics & CVC Words',
      'Synonyms & Antonyms',
      'Irregular Verbs',
      'WH- Questions',
    ],
  },
  {
    category: '🌍 Science, Math & General Knowledge',
    topics: [
      'Mental Math & Multiplication',
      'Fractions & Numbers',
      'Solar System & Space',
      'Living Things & Plants',
      'World Geography & Capitals',
      'Famous Landmarks',
      'Dinosaurs & Prehistory',
      'Computer & Tech Vocabulary',
    ],
  },
];

export interface ClassLevelCategory {
  category: string;
  levels: string[];
}

export const SETUP_CLASS_LEVEL_CATEGORIES: ClassLevelCategory[] = [
  {
    category: '🧸 Early Learners & Kindergarten',
    levels: ['Pre-K / Nursery', 'Kindergarten 1 (K1)', 'Kindergarten 2 (K2)', 'Kindergarten 3 (K3)', 'Phonics Starters'],
  },
  {
    category: '🎒 Primary / Elementary School',
    levels: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  },
  {
    category: '🏫 Middle & High School',
    levels: ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  },
  {
    category: '🏆 Cambridge & CEFR Exams',
    levels: [
      'Cambridge Starters (Pre-A1)',
      'Cambridge Movers (A1)',
      'Cambridge Flyers (A2)',
      'KET / A2 Key',
      'PET / B1 Preliminary',
      'FCE / B2 First',
      'IELTS / Academic',
    ],
  },
  {
    category: '📚 Popular ESL Curriculums',
    levels: [
      'Global Success 1-5',
      'Global Success 6-9',
      'Family & Friends 1-5',
      'Super Minds 1-6',
      'Oxford Discover',
      'Everybody Up',
    ],
  },
];

export const DEFAULT_SUGGESTED_FOLDERS: { id: string; name: string }[] = [
  { id: 'folder-vocab-pictures', name: '🍎 Vocabulary & Cartoon PNGs' },
  { id: 'folder-grammar', name: '🔤 English Grammar & Tenses' },
  { id: 'folder-cambridge', name: '🏆 Cambridge (Starters / Movers / Flyers / KET)' },
  { id: 'folder-kindergarten', name: '🧸 Pre-K & Kindergarten' },
  { id: 'folder-primary', name: '🎒 Primary School (Grades 1–5)' },
  { id: 'folder-secondary', name: '🏫 Secondary School (Grades 6–9)' },
  { id: 'folder-science-math', name: '🔬 Science, Math & Geography' },
  { id: 'folder-favorites', name: '⭐ Teacher Favorites' },
];

/**
 * Built-in Topic Starter Question Decks so selecting a Topic + Content Mode (Words Only / Photos & GIFs / Both)
 * can immediately generate rich questions with cartoon PNGs!
 */
export interface StarterQuestionTemplate {
  text: string;
  options: string[];
  answerIndex: number;
}

export const TOPIC_STARTER_QUESTIONS: Record<string, StarterQuestionTemplate[]> = {
  'Fruits & Berries': [
    { text: 'Which fruit is red, crunchy, and keeps the doctor away?', options: ['Apple', 'Banana', 'Grape', 'Lemon'], answerIndex: 0 },
    { text: 'Which long yellow fruit do monkeys love to peel and eat?', options: ['Strawberry', 'Banana', 'Watermelon', 'Peach'], answerIndex: 1 },
    { text: 'Which big green fruit is red and juicy with seeds inside?', options: ['Pear', 'Orange', 'Watermelon', 'Kiwi'], answerIndex: 2 },
    { text: 'Which small red berry has tiny seeds on the outside?', options: ['Strawberry', 'Pineapple', 'Coconut', 'Mango'], answerIndex: 0 },
    { text: 'Which sour yellow citrus fruit is used to make lemonade?', options: ['Peach', 'Lemon', 'Banana', 'Cherry'], answerIndex: 1 },
    { text: 'Which tropical fruit has a spiky crown and sweet yellow flesh?', options: ['Pineapple', 'Apple', 'Grapes', 'Pear'], answerIndex: 0 },
  ],
  'Animals & Pets': [
    { text: 'Which friendly pet barks and wags its tail?', options: ['Dog', 'Cat', 'Rabbit', 'Hamster'], answerIndex: 0 },
    { text: 'Which cute pet purrs, meows, and loves chasing mice?', options: ['Turtle', 'Cat', 'Frog', 'Duck'], answerIndex: 1 },
    { text: 'Which small furry pet has chubby cheeks and loves running on a wheel?', options: ['Hamster', 'Fish', 'Horse', 'Sheep'], answerIndex: 0 },
    { text: 'Which animal has long ears, hops fast, and loves crunchy carrots?', options: ['Pig', 'Cow', 'Rabbit', 'Chicken'], answerIndex: 2 },
    { text: 'Which farm animal gives us fresh milk and says "Moo"?', options: ['Cow', 'Duck', 'Horse', 'Dog'], answerIndex: 0 },
    { text: 'Which colorful bird can swim and says "Quack, quack"?', options: ['Cat', 'Duck', 'Rabbit', 'Mouse'], answerIndex: 1 },
  ],
  'Wild & Zoo Animals': [
    { text: 'Which animal is the King of the Jungle with a big golden mane?', options: ['Lion', 'Tiger', 'Zebra', 'Panda'], answerIndex: 0 },
    { text: 'Which giant gray animal has a long trunk and big ears?', options: ['Giraffe', 'Elephant', 'Monkey', 'Bear'], answerIndex: 1 },
    { text: 'Which black-and-white bear loves eating green bamboo?', options: ['Panda', 'Koala', 'Fox', 'Wolf'], answerIndex: 0 },
    { text: 'Which tallest animal in the world has a very long neck?', options: ['Zebra', 'Kangaroo', 'Giraffe', 'Lion'], answerIndex: 2 },
    { text: 'Which striped orange cat is the largest wild cat in the world?', options: ['Tiger', 'Monkey', 'Penguin', 'Frog'], answerIndex: 0 },
    { text: 'Which Australian animal carries its baby in a pouch and hops?', options: ['Bear', 'Kangaroo', 'Camel', 'Crocodile'], answerIndex: 1 },
  ],
  'Sea Animals & Ocean': [
    { text: 'Which smart ocean mammal loves jumping over waves and clicking?', options: ['Dolphin', 'Crab', 'Turtle', 'Snail'], answerIndex: 0 },
    { text: 'Which sea creature has eight long tentacles?', options: ['Shark', 'Octopus', 'Fish', 'Whale'], answerIndex: 1 },
    { text: 'Which huge ocean predator has sharp teeth and a dorsal fin?', options: ['Shark', 'Shrimp', 'Frog', 'Duck'], answerIndex: 0 },
    { text: 'Which giant marine mammal is the largest animal on Earth?', options: ['Crab', 'Whale', 'Turtle', 'Octopus'], answerIndex: 1 },
    { text: 'Which sea animal walks sideways and has two strong pincers?', options: ['Crab', 'Dolphin', 'Whale', 'Fish'], answerIndex: 0 },
    { text: 'Which slow ocean reptile wears a hard protective shell?', options: ['Turtle', 'Shark', 'Octopus', 'Squid'], answerIndex: 0 },
  ],
  'Food & Drinks': [
    { text: 'Which Italian food is round, baked with melted cheese and tomato sauce?', options: ['Pizza', 'Burger', 'Sushi', 'Taco'], answerIndex: 0 },
    { text: 'Which cold, sweet dessert comes in a cone or cup?', options: ['Soup', 'Ice Cream', 'Bread', 'Cheese'], answerIndex: 1 },
    { text: 'Which healthy white drink comes from cows and builds strong bones?', options: ['Milk', 'Coffee', 'Juice', 'Tea'], answerIndex: 0 },
    { text: 'Which food is made with a bun, patty, lettuce, and cheese?', options: ['Pancake', 'Burger', 'Popcorn', 'Donut'], answerIndex: 1 },
    { text: 'Which sweet baked treat has candles on top for a celebration?', options: ['Cake', 'Sandwich', 'Rice', 'Egg'], answerIndex: 0 },
    { text: 'Which crunchy snack do we love eating while watching a movie?', options: ['Popcorn', 'Spaghetti', 'Salad', 'Milk'], answerIndex: 0 },
  ],
  'Action Verbs': [
    { text: 'What action do you do with your legs when moving very fast in a race?', options: ['Run', 'Sleep', 'Read', 'Eat'], answerIndex: 0 },
    { text: 'What action do you do in a pool or the ocean?', options: ['Write', 'Swim', 'Cook', 'Sing'], answerIndex: 1 },
    { text: 'What action do you do when you open a storybook?', options: ['Read', 'Dance', 'Walk', 'Drink'], answerIndex: 0 },
    { text: 'What action do you do to music at a party?', options: ['Sleep', 'Dance', 'Write', 'Cook'], answerIndex: 1 },
    { text: 'What action do you do with a pencil or pen on paper?', options: ['Write', 'Swim', 'Run', 'Eat'], answerIndex: 0 },
    { text: 'What action do you do in bed at night when you are tired?', options: ['Run', 'Dance', 'Sleep', 'Swim'], answerIndex: 2 },
  ],
  'School Supplies & Classroom': [
    { text: 'What do you use to write and erase notes on paper?', options: ['Pencil', 'Scissors', 'Umbrella', 'Clock'], answerIndex: 0 },
    { text: 'What do you carry on your back to bring books to school?', options: ['Backpack', 'Chair', 'Television', 'Shoe'], answerIndex: 0 },
    { text: 'What tool has two blades and is used to cut paper carefully?', options: ['Book', 'Scissors', 'Ruler', 'Pen'], answerIndex: 1 },
    { text: 'What do you open and read during English or Science class?', options: ['Book', 'Balloon', 'Hat', 'Key'], answerIndex: 0 },
    { text: 'What tool do you use to measure straight lines in centimeters?', options: ['Ruler', 'Crayon', 'Clock', 'Glasses'], answerIndex: 0 },
  ],
  'Vehicles & Transport': [
    { text: 'Which vehicle flies high in the sky with wings?', options: ['Airplane', 'Train', 'Bus', 'Bicycle'], answerIndex: 0 },
    { text: 'Which two-wheeled vehicle do you pedal with your feet?', options: ['Car', 'Bicycle', 'Rocket', 'Boat'], answerIndex: 1 },
    { text: 'Which big red emergency vehicle helps put out fires?', options: ['Fire Truck', 'Taxi', 'Scooter', 'Train'], answerIndex: 0 },
    { text: 'Which spacecraft blasts off into outer space?', options: ['Bus', 'Rocket', 'Boat', 'Tractor'], answerIndex: 1 },
    { text: 'Which long vehicle travels on railway tracks?', options: ['Train', 'Helicopter', 'Car', 'Bicycle'], answerIndex: 0 },
  ],
  'Jobs & Occupations': [
    { text: 'Who helps sick people get better at the hospital?', options: ['Doctor', 'Chef', 'Pilot', 'Artist'], answerIndex: 0 },
    { text: 'Who teaches students in the classroom at school?', options: ['Firefighter', 'Teacher', 'Farmer', 'Astronaut'], answerIndex: 1 },
    { text: 'Who wears a tall white hat and cooks delicious meals?', options: ['Chef', 'Doctor', 'Pilot', 'Teacher'], answerIndex: 0 },
    { text: 'Who travels in a rocket to explore outer space?', options: ['Farmer', 'Astronaut', 'Chef', 'Artist'], answerIndex: 1 },
    { text: 'Who flies an airplane across the world?', options: ['Pilot', 'Doctor', 'Teacher', 'Farmer'], answerIndex: 0 },
  ],
  'Emotions & Feelings': [
    { text: 'How do you feel when you smile and laugh with friends?', options: ['Happy', 'Sad', 'Angry', 'Sleepy'], answerIndex: 0 },
    { text: 'How do you feel when you yawn and want to go to bed?', options: ['Angry', 'Sleepy', 'Surprised', 'Happy'], answerIndex: 1 },
    { text: 'How do you feel when tears fall and you are upset?', options: ['Sad', 'Cool', 'Happy', 'Sleepy'], answerIndex: 0 },
    { text: 'How do you feel when something sudden and unexpected happens?', options: ['Sleepy', 'Surprised', 'Sad', 'Tired'], answerIndex: 1 },
  ],
};
