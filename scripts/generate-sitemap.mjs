import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { parseStoryDate } from "../src/utils/storyDates.js";
import { fallbackStories } from "../src/data/fallbackStories.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const slugify = (text) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const ensureSlug = (story, idx = 0) => {
  const base = slugify(story.slug || story.title || story.tag || story.category || "geschichte");
  const suffix = story.slug ? "" : `-${story.id ?? idx + 1}`;
  return story.slug ? story.slug : slugify(`${base}${suffix}`);
};

const origin = process.env.SITE_URL || "https://levitenleser.de";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const buildDate = (story) => {
  if (story.created_at) {
    const date = new Date(story.created_at);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const parsed = parseStoryDate(story.date);
  if (parsed) return parsed.toISOString();
  return null;
};

const fetchStories = async () => {
  const fromFallback = () =>
    (fallbackStories || []).map((s, idx) => ({
      slug: ensureSlug(s, idx),
      lastmod: buildDate(s)
    }));

  if (!supabaseUrl || !supabaseKey) {
    console.warn("SUPABASE_URL oder SUPABASE_KEY fehlen. Schreibe Sitemap nur mit statischen Seiten.");
    return fromFallback();
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("stories")
    .select("id, title, slug, category, tag, date, created_at")
    .order("date", { ascending: false });
  if (error) {
    console.warn("Konnte Stories nicht laden, schreibe statische Sitemap.", error.message);
    return fromFallback();
  }
  const mapped = (data || []).map((s, idx) => ({
    slug: ensureSlug(s, idx),
    lastmod: buildDate(s)
  }));
  // Fallback-Stories ergänzen, ohne Duplikate
  const merged = [...mapped, ...fromFallback()];
  const unique = Array.from(
    merged.reduce((acc, item) => {
      if (!acc.has(item.slug)) acc.set(item.slug, item);
      return acc;
    }, new Map())
  ).map(([, value]) => value);
  return unique;
};

const buildXml = (storyUrls) => {
  const urls = [
    { loc: `${origin}/` },
    { loc: `${origin}/newsletter` },
    { loc: `${origin}/impressum` },
    { loc: `${origin}/datenschutz` },
    ...storyUrls.map((s) => ({
      loc: `${origin}/stories/${s.slug}`,
      lastmod: s.lastmod
    }))
  ];

  const xmlEntries = urls
    .map((u) => {
      const lastmodTag = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${u.loc}</loc>${lastmodTag ? `\n    ${lastmodTag}` : ""}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries}\n</urlset>\n`;
};

const main = async () => {
  const stories = await fetchStories();
  const xml = buildXml(stories);
  const outPath = path.join(__dirname, "..", "public", "sitemap.xml");
  await fs.writeFile(outPath, xml, "utf8");
  console.log(`Sitemap geschrieben: ${outPath} (${stories.length} Stories)`);
};

main().catch((err) => {
  console.error("Fehler beim Schreiben der Sitemap:", err);
  process.exit(1);
});
