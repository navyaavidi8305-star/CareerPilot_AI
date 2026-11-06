import {
  CuratedVideo,
  LearningLanguage,
  LearningLevel,
  languageSearchSuffix,
  levelSearchSuffix,
} from './learningCatalog';

export interface VideoResult {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  thumbnail: string;
  url: string;
  duration?: string;
  views?: string;
  publishedAt?: string;
  language: LearningLanguage;
  isFallback?: boolean;
}

const cache = new Map<string, { expiresAt: number; data: VideoResult[] }>();
const CACHE_MS = 15 * 60 * 1000;

function thumbnailFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function hydrateCuratedVideo(
  item: CuratedVideo,
  language: LearningLanguage,
  isFallback: boolean
): Promise<VideoResult> {
  let title = item.title;
  let channel = item.channel;
  try {
    const response = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(item.videoId))}&format=json`,
      8000
    );
    if (response.ok) {
      const data: any = await response.json();
      if (data?.title) title = String(data.title);
      if (data?.author_name) channel = String(data.author_name);
    }
  } catch {
    // Keep the catalog metadata if oEmbed is unavailable.
  }
  return {
    videoId: item.videoId,
    title,
    channel,
    description: `${title} — ${channel}`,
    thumbnail: thumbnailFor(item.videoId),
    url: watchUrl(item.videoId),
    language,
    isFallback,
  };
}

function findVideoRenderers(value: any, results: any[] = []): any[] {
  if (!value || typeof value !== 'object') return results;
  if (value.videoRenderer) results.push(value.videoRenderer);
  for (const key of Object.keys(value)) {
    const child = (value as any)[key];
    if (child && typeof child === 'object') findVideoRenderers(child, results);
  }
  return results;
}

function extractInitialData(html: string): any | null {
  const patterns = [
    /var ytInitialData\s*=\s*({[\s\S]*?});<\/script>/,
    /ytInitialData"\]\s*=\s*({[\s\S]*?});/,
    /window\["ytInitialData"\]\s*=\s*({[\s\S]*?});/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    try {
      return JSON.parse(match[1]);
    } catch {
      // Try the next pattern.
    }
  }
  return null;
}

function textFromRuns(value: any): string {
  if (!value) return '';
  if (typeof value.simpleText === 'string') return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run: any) => run?.text || '').join('');
  return '';
}

async function searchWithDataApi(
  query: string,
  language: LearningLanguage
): Promise<VideoResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '8',
    q: query,
    key,
    relevanceLanguage: language === 'Telugu' ? 'te' : language === 'Hindi' ? 'hi' : 'en',
    safeSearch: 'moderate',
  });
  const response = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) return [];
  const data: any = await response.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map((item: any) => {
      const videoId = item?.id?.videoId;
      if (!videoId) return null;
      return {
        videoId,
        title: item?.snippet?.title || 'Untitled video',
        channel: item?.snippet?.channelTitle || 'YouTube',
        description: item?.snippet?.description || '',
        thumbnail: item?.snippet?.thumbnails?.high?.url || thumbnailFor(videoId),
        url: watchUrl(videoId),
        publishedAt: item?.snippet?.publishedAt,
        language,
      } as VideoResult;
    })
    .filter((item: any): item is VideoResult => !!item);
}

async function searchByScraping(query: string, language: LearningLanguage): Promise<VideoResult[]> {
  const params = new URLSearchParams({
    search_query: query,
    hl: language === 'Telugu' ? 'te' : language === 'Hindi' ? 'hi' : 'en',
  });
  const response = await fetchWithTimeout(`https://www.youtube.com/results?${params.toString()}`);
  if (!response.ok) return [];
  const html = await response.text();
  const data = extractInitialData(html);
  if (!data) return [];
  const renderers = findVideoRenderers(data);
  const results: VideoResult[] = [];
  const seen = new Set<string>();
  for (const renderer of renderers) {
    const videoId = renderer?.videoId;
    if (!videoId || seen.has(videoId) || typeof videoId !== 'string' || videoId.length !== 11) continue;
    const title = textFromRuns(renderer?.title);
    if (!title) continue;
    seen.add(videoId);
    results.push({
      videoId,
      title,
      channel: textFromRuns(renderer?.ownerText) || textFromRuns(renderer?.longBylineText) || 'YouTube',
      description: textFromRuns(renderer?.detailedMetadataSnippets?.[0]?.snippetText) || title,
      thumbnail: thumbnailFor(videoId),
      url: watchUrl(videoId),
      duration: textFromRuns(renderer?.lengthText) || undefined,
      views: textFromRuns(renderer?.viewCountText) || undefined,
      publishedAt: textFromRuns(renderer?.publishedTimeText) || undefined,
      language,
    });
    if (results.length >= 8) break;
  }
  return results;
}

export async function searchLearningVideos(options: {
  query: string;
  language?: LearningLanguage;
  level?: LearningLevel;
  curated?: CuratedVideo[];
}): Promise<VideoResult[]> {
  const language = options.language || 'English';
  const level = options.level || 'Beginner';
  const query = `${options.query} ${levelSearchSuffix(level)} ${languageSearchSuffix(language)}`.trim();
  const cacheKey = `${query}|${language}|${level}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  let results: VideoResult[] = [];
  try {
    results = await searchWithDataApi(query, language);
    if (results.length === 0) results = await searchByScraping(query, language);
    if (results.length === 0) {
      // Some videos only appear under a simpler query.
      results = await searchByScraping(`${options.query} ${languageSearchSuffix(language)}`.trim(), language);
    }
  } catch (error: any) {
    console.error('[YouTube] search failed:', error.message);
  }

  if (results.length === 0 && options.curated?.length) {
    results = await Promise.all(
      options.curated.slice(0, 4).map(item => hydrateCuratedVideo(item, language, language !== 'English'))
    );
  } else if (results.length < 3 && options.curated?.length) {
    const existing = new Set(results.map(item => item.videoId));
    const extra = await Promise.all(
      options.curated
        .filter(item => !existing.has(item.videoId))
        .slice(0, 3 - results.length)
        .map(item => hydrateCuratedVideo(item, language, language !== 'English'))
    );
    results = [...results, ...extra];
  }

  results = results.filter((item, index, all) =>
    all.findIndex(other => other.videoId === item.videoId) === index
  );

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, data: results });
  return results;
}
