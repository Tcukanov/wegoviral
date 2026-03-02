import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page, HTTPResponse } from "puppeteer";

puppeteerExtra.use(StealthPlugin());

export interface ScrapedPost {
  instagramId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  thumbnailUrl: string;
  caption: string;
  hashtags: string[];
  audioName: string | null;
  isAudioTrending: boolean;
  views: number;
  likes: number;
  comments: number;
  duration: number;
  postedAt: Date | null;
}

const USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0.6167.171 Mobile/15E148 Safari/604.1",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function detectPlatform(url: string): "instagram" | "tiktok" | null {
  if (/instagram\.com|instagr\.am/.test(url)) return "instagram";
  if (/tiktok\.com|vm\.tiktok\.com/.test(url)) return "tiktok";
  return null;
}

export function extractShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function extractTikTokVideoId(url: string): string | null {
  // Standard: tiktok.com/@username/video/1234567890
  const stdMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (stdMatch) return stdMatch[1];
  // Mobile: m.tiktok.com/v/1234567890
  const mobileMatch = url.match(/tiktok\.com\/v\/(\d+)/);
  if (mobileMatch) return mobileMatch[1];
  // Short URLs (vm.tiktok.com/XXXX) — resolved via Puppeteer redirect, return placeholder
  if (/vm\.tiktok\.com|tiktok\.com\/t\//.test(url)) return "short-url";
  return null;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) || [];
  return matches.map((h) => h.slice(1).toLowerCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMediaData(data: any): Partial<ScrapedPost> | null {
  try {
    // Handle /api/v1/media/{id}/info/ response format
    const item = data?.items?.[0] ?? data?.graphql?.shortcode_media ?? data;
    if (!item) return null;

    const user = item.user ?? item.owner;
    const caption = item.caption?.text ?? item.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
    const views = item.play_count ?? item.video_view_count ?? item.view_count ?? 0;
    const likes = item.like_count ?? item.edge_media_preview_like?.count ?? 0;
    const comments = item.comment_count ?? item.edge_media_to_comment?.count ?? 0;

    return {
      instagramId: item.id ?? item.pk ?? "",
      username: user?.username ?? "",
      displayName: user?.full_name ?? undefined,
      avatarUrl: user?.profile_pic_url ?? undefined,
      thumbnailUrl:
        item.thumbnail_url ??
        item.image_versions2?.candidates?.[0]?.url ??
        item.display_url ??
        "",
      caption,
      hashtags: extractHashtags(caption),
      audioName: item.music_metadata?.music_info?.music_asset_info?.title ?? item.clips_metadata?.audio_type ?? null,
      isAudioTrending: item.music_metadata?.is_trending_in_clips ?? false,
      views: Number(views),
      likes: Number(likes),
      comments: Number(comments),
      duration: Math.round(item.video_duration ?? item.clip_metadata?.video_duration ?? item.duration ?? -1),
      postedAt: item.taken_at ? new Date(item.taken_at * 1000) : null,
    };
  } catch {
    return null;
  }
}

export async function scrapeTikTokPost(url: string): Promise<ScrapedPost> {
  const videoId = extractTikTokVideoId(url);
  if (!videoId) throw new Error("INVALID_URL");

  const TIKTOK_UAS = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
  ];

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-gpu", "--no-first-run", "--no-zygote",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(TIKTOK_UAS[Math.floor(Math.random() * TIKTOK_UAS.length)]);
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const rt = req.resourceType();
      if (["media", "font", "stylesheet"].includes(rt)) req.abort();
      else req.continue();
    });

    const cleanUrl = url.replace(/\?.*$/, "");
    const response = await page.goto(cleanUrl, { waitUntil: "networkidle2", timeout: 35000 });

    if (response?.status() === 404) throw new Error("POST_NOT_FOUND");
    if (response?.status() === 429) throw new Error("RATE_LIMITED");

    await sleep(2000);

    // Resolve final URL after redirects (for short URLs)
    const finalUrl = page.url();
    const resolvedId = finalUrl.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)?.[1] ?? videoId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await page.evaluate((): any => {
      // Try __NEXT_DATA__ (most common)
      const nextScript = document.getElementById("__NEXT_DATA__");
      if (nextScript?.textContent) {
        try { return { source: "next", data: JSON.parse(nextScript.textContent) }; } catch { /* skip */ }
      }
      // Try SIGI_STATE / __UNIVERSAL_DATA_FOR_REHYDRATION__
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        const txt = s.textContent || "";
        if (txt.includes("itemInfo") && txt.includes("itemStruct")) {
          const m = txt.match(/\{[\s\S]*"itemInfo"[\s\S]*\}/);
          if (m) try { return { source: "sigi", data: JSON.parse(m[0]) }; } catch { /* skip */ }
        }
        if (txt.startsWith("window.__INITIAL_STATE__")) {
          try {
            const json = JSON.parse(txt.replace("window.__INITIAL_STATE__=", "").replace(/;$/, ""));
            return { source: "initial", data: json };
          } catch { /* skip */ }
        }
      }
      // OG tag fallback
      const get = (sel: string, attr: string) =>
        (document.querySelector(sel) as HTMLMetaElement)?.getAttribute(attr) ?? "";
      return {
        source: "og",
        data: {
          title:     get('meta[property="og:title"]', "content"),
          desc:      get('meta[property="og:description"]', "content"),
          image:     get('meta[property="og:image"]', "content"),
          videoUrl:  get('meta[property="og:video"]', "content"),
        },
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let item: any = null;

    if (data.source === "next") {
      item = data.data?.props?.pageProps?.itemInfo?.itemStruct
          ?? data.data?.props?.pageProps?.videoData?.itemInfo?.itemStruct;
    } else if (data.source === "sigi" || data.source === "initial") {
      const str = JSON.stringify(data.data);
      const match = str.match(/"itemStruct"\s*:\s*(\{[^]+?\})\s*,\s*"shareInfo"/);
      if (match) try { item = JSON.parse(match[1]); } catch { /* skip */ }
      if (!item) item = data.data?.ItemModule
        ? Object.values(data.data.ItemModule)[0]
        : null;
    }

    if (item) {
      const caption = item.desc ?? "";
      const stats   = item.stats ?? item.statsV2 ?? {};
      return {
        instagramId:    resolvedId,
        username:       item.author?.uniqueId ?? item.authorStats?.uniqueId ?? "unknown",
        displayName:    item.author?.nickname ?? undefined,
        avatarUrl:      item.author?.avatarMedium ?? item.author?.avatarThumb ?? undefined,
        thumbnailUrl:   item.video?.cover ?? item.video?.originCover ?? "",
        caption,
        hashtags:       extractHashtags(caption),
        audioName:      item.music?.title ?? null,
        isAudioTrending: false,
        views:          Number(stats.playCount ?? stats.play_count ?? 0),
        likes:          Number(stats.diggCount ?? stats.digg_count ?? stats.heart ?? 0),
        comments:       Number(stats.commentCount ?? stats.comment_count ?? 0),
        duration:       Math.max(0, Math.round(item.video?.duration ?? 0)),
        postedAt:       item.createTime ? new Date(item.createTime * 1000) : null,
      };
    }

    // OG fallback
    if (data.source === "og") {
      const { title, desc, image } = data.data;
      if (!title && !desc) throw new Error("POST_NOT_FOUND");
      const usernameMatch = finalUrl.match(/tiktok\.com\/@([^/]+)/);
      return {
        instagramId: resolvedId,
        username:    usernameMatch?.[1] ?? "unknown",
        thumbnailUrl: image,
        caption:     desc ?? title ?? "",
        hashtags:    extractHashtags(desc ?? ""),
        audioName:   null,
        isAudioTrending: false,
        views: 0, likes: 0, comments: 0, duration: 0, postedAt: null,
      };
    }

    throw new Error("POST_NOT_FOUND");
  } finally {
    await browser.close();
  }
}

export async function scrapePost(url: string): Promise<ScrapedPost> {
  const shortcode = extractShortcode(url);
  if (!shortcode) throw new Error("INVALID_URL");

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUA());
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    // Block heavy resources but keep API calls
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const rt = req.resourceType();
      if (["image", "media", "font", "stylesheet"].includes(rt)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Collect API responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedData: any = null;

    page.on("response", async (response: HTTPResponse) => {
      const respUrl = response.url();
      if (
        respUrl.includes("/api/v1/media/") ||
        respUrl.includes("graphql/query") ||
        respUrl.includes("/api/graphql")
      ) {
        try {
          const json = await response.json();
          if (json?.items || json?.graphql || json?.data?.xdt_shortcode_media) {
            capturedData = json?.data?.xdt_shortcode_media
              ? { graphql: { shortcode_media: json.data.xdt_shortcode_media } }
              : json;
          }
        } catch {
          // Not JSON, skip
        }
      }
    });

    const cleanUrl = `https://www.instagram.com/reel/${shortcode}/`;
    const response = await page.goto(cleanUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    if (response?.status() === 404) throw new Error("POST_NOT_FOUND");
    if (response?.status() === 429) throw new Error("RATE_LIMITED");

    // Give API calls time to complete
    await sleep(2000);

    // Try captured API data first
    if (capturedData) {
      const parsed = parseMediaData(capturedData);
      if (parsed?.instagramId) {
        return parsed as ScrapedPost;
      }
    }

    // Fallback: parse embedded JSON in page
    const scriptData = await page.evaluate(`
      (function() {
        var scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
        for (var i = 0; i < scripts.length; i++) {
          try {
            var data = JSON.parse(scripts[i].textContent || "");
            if (data && data.require) {
              var str = JSON.stringify(data);
              var match = str.match(/"shortcode_media":\\s*(\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\})/);
              if (match) return JSON.parse(match[1]);
            }
            if (data) return data;
          } catch(e) { continue; }
        }
        return null;
      })()
    `) as unknown;

    if (scriptData) {
      const parsed = parseMediaData(scriptData);
      if (parsed?.instagramId) return parsed as ScrapedPost;
    }

    // Fallback: parse og meta tags + deep-scan all inline JSON for duration
    const metaData = await page.evaluate(`
      (function() {
        var ogImage = (document.querySelector('meta[property="og:image"]') || {getAttribute:function(){return ""}}).getAttribute("content") || "";
        var ogDesc  = (document.querySelector('meta[property="og:description"]') || {getAttribute:function(){return ""}}).getAttribute("content") || "";
        var ogTitle = (document.querySelector('meta[property="og:title"]') || {getAttribute:function(){return ""}}).getAttribute("content") || "";
        var ogVideo = (document.querySelector('meta[property="og:video"]') || {getAttribute:function(){return ""}}).getAttribute("content") || "";

        var viewMatch = ogDesc.match(/([\\d,]+)\\s*[Vv]iews?/);
        var likeMatch = ogDesc.match(/([\\d,]+)\\s*[Ll]ikes?/);
        var atMatch   = ogTitle.match(/@([\\w.]+)/);
        var username  = atMatch ? atMatch[1] : (ogTitle.split(" ")[0] || "unknown").replace("@","");

        // Strip Instagram's OG description wrapper to get the real caption
        // Format: "1,423 likes, 33 comments - username on January 1, 2025: \"actual caption\""
        var cleanCaption = ogDesc;
        var captionMatch = ogDesc.match(/\\d+\\s+\\w+\\s*[-–]\\s*[\\w._]+\\s+on\\s+.+?:\\s*["""](.+)["""]\\s*\\.?\\s*$/s);
        if (captionMatch) {
          cleanCaption = captionMatch[1].trim();
        } else {
          // Try simpler pattern: strip "X likes, Y comments - user on date: " prefix
          var prefixMatch = ogDesc.match(/^[\\d,]+\\s+likes?,\\s*[\\d,]+\\s+comments?\\s*[-–]\\s*[\\w._]+\\s+on\\s+[^:]+:\\s*(.+)$/s);
          if (prefixMatch) {
            cleanCaption = prefixMatch[1].replace(/^[""]|[""]\\s*\\.?\\s*$/g, "").trim();
          }
        }

        // Deep-scan all inline scripts for metrics + duration
        var duration = -1;
        var views = viewMatch ? parseInt(viewMatch[1].replace(/,/g,"")) : 0;
        var likes = likeMatch ? parseInt(likeMatch[1].replace(/,/g,"")) : 0;
        var comments = 0;
        var audioName = null;
        var postedAt = null;
        try {
          var allScripts = Array.from(document.querySelectorAll('script'));
          for (var s = 0; s < allScripts.length; s++) {
            var txt = allScripts[s].textContent || "";
            if (txt.length < 100) continue;

            // Views: play_count, video_view_count, view_count
            if (views === 0) {
              var vm = txt.match(/"(?:play_count|video_view_count|view_count)"\\s*:\\s*(\\d+)/);
              if (vm) views = parseInt(vm[1]);
            }
            // Likes: like_count
            if (likes === 0) {
              var lm = txt.match(/"like_count"\\s*:\\s*(\\d+)/);
              if (lm) likes = parseInt(lm[1]);
            }
            // Comments: comment_count
            if (comments === 0) {
              var cm = txt.match(/"comment_count"\\s*:\\s*(\\d+)/);
              if (cm) comments = parseInt(cm[1]);
            }
            // Audio: music title
            if (!audioName) {
              var am = txt.match(/"music_asset_info"\\s*:\\s*\\{[^}]*"title"\\s*:\\s*"([^"]+)"/);
              if (am) audioName = am[1];
            }
            // Timestamp: taken_at
            if (!postedAt) {
              var tm = txt.match(/"taken_at"\\s*:\\s*(\\d{10,})/);
              if (tm) postedAt = new Date(parseInt(tm[1]) * 1000).toISOString();
            }
            // Duration
            if (duration <= 0) {
              var dm = txt.match(/"video_duration"\\s*:\\s*([\\d.]+)/);
              if (dm) { duration = Math.round(parseFloat(dm[1])); }
            }
            if (duration <= 0) {
              var dm2 = txt.match(/"duration_in_video_with_editing"\\s*:\\s*([\\d.]+)/);
              if (dm2) { duration = Math.round(parseFloat(dm2[1])); }
            }
            if (duration <= 0) {
              var dm3 = txt.match(/"clip_duration_ms"\\s*:\\s*([\\d.]+)/);
              if (dm3) { duration = Math.round(parseFloat(dm3[1]) / 1000); }
            }
          }
        } catch(e) {}

        // og:video:duration as last resort
        if (duration <= 0) {
          var ogDurEl = document.querySelector('meta[property="og:video:duration"]');
          if (ogDurEl) {
            var d = parseInt(ogDurEl.getAttribute("content") || "0");
            if (d > 0) duration = d;
          }
        }

        return {
          instagramId: "${shortcode}",
          username: username,
          thumbnailUrl: ogImage,
          caption: cleanCaption,
          hashtags: (cleanCaption.match(/#[\\w]+/g) || []).map(function(h){ return h.slice(1); }),
          audioName: audioName,
          isAudioTrending: false,
          views:    views,
          likes:    likes,
          comments: comments,
          duration: duration > 0 ? duration : -1,
          postedAt: postedAt
        };
      })()
    `) as unknown as ScrapedPost;

    if (!metaData.username || metaData.username === "unknown") {
      const isPrivate = await page.evaluate(
        `document.body.innerText.includes("This Account is Private")`
      ) as boolean;
      if (isPrivate) throw new Error("PRIVATE_ACCOUNT");
      throw new Error("POST_NOT_FOUND");
    }

    return metaData;
  } finally {
    await browser.close();
  }
}
