import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { fallbackStories } from "./data/fallbackStories";
import AdminPanel from "./components/AdminPanel";
import SectionTitle from "./components/SectionTitle";
import StoryCard from "./components/StoryCard";
import CookieBanner from "./components/CookieBanner";
import { parseStoryDate } from "./utils/storyDates";
import { legalPages } from "./legal/legalPages";
import useCookieConsent from "./hooks/useCookieConsent";

const slugify = (text) => {
  if (!text) return "geschichte";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const ensureSlug = (story, idx = 0) => {
  const provided = slugify(story.slug);
  const fromTitle = slugify(story.title || story.tag || story.category || "geschichte");
  const base = provided && !provided.startsWith("-") ? provided : fromTitle;
  const suffix = provided ? "" : `-${story.id ?? idx + 1}`;
  return { ...story, slug: slugify(`${base}${suffix}`) };
};

const setMetaTag = (key, content, attr = "name") => {
  if (typeof document === "undefined" || !key || !content) return;
  let el = document.head.querySelector(`[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const setCanonical = (url) => {
  if (typeof document === "undefined" || !url) return;
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
};

const TAGS = [
  "Allgemeines",
  "Finanzen",
  "Gesellschaft",
  "Medien",
  "Politik",
  "Reise",
  "Sport",
  "Technik",
  "Wirtschaft"
];

function App() {
  const [stories, setStories] = useState(() => fallbackStories.map((s, idx) => ensureSlug(s, idx)));
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState(null);
  const [route, setRoute] = useState(typeof window !== "undefined" ? window.location.pathname : "/");
  const [activeTag, setActiveTag] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState({ state: "idle", message: "" });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [readerScale, setReaderScale] = useState(1);
  const [invertReader, setInvertReader] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentForm, setCommentForm] = useState({ author: "", body: "", trap: "", open: false });
  const [commentStatus, setCommentStatus] = useState({ state: "idle", message: "" });
  const { showCookieBanner, handleCookieChoice } = useCookieConsent();
  const nextSunday = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sonntag
    const daysToAdd = day === 0 ? 7 : 7 - day;
    const target = new Date(now);
    target.setDate(now.getDate() + daysToAdd);
    return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(target);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = "de";
  }, []);

  const fetchStories = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const fetchWith = async (withSlug) =>
      supabase
        .from("stories")
        .select(
          withSlug
            ? "id, title, slug, author, category, date, read_time, tag, excerpt, body, created_at, comments_count:comments(count)"
            : "id, title, author, category, date, read_time, tag, excerpt, body, created_at, comments_count:comments(count)"
        )
        .order("date", { ascending: false });

    let data;
    let err;
    ({ data, error: err } = await fetchWith(true));

    if (err && err.message && err.message.toLowerCase().includes("slug")) {
      ({ data, error: err } = await fetchWith(false));
      if (!err) {
        setError("Hinweis: Supabase-Spalte slug fehlt. Bitte Migration ausführen, Daten werden dennoch geladen.");
      }
    }

    if (err) {
      setError("Konnte Supabase-Daten nicht laden. Fallback wird genutzt.");
      setStories(fallbackStories.map((s, idx) => ensureSlug(s, idx)));
      setLoading(false);
      return;
    }

    const mapped = (data || []).map((row, idx) =>
      ensureSlug(
        {
          id: row.id,
          title: row.title,
          slug: row.slug,
          comments_count: Array.isArray(row.comments_count) ? row.comments_count[0]?.count ?? 0 : 0,
          author: row.author || "",
          category: row.category || "Feuilleton",
          date: row.date,
          readTime: row.read_time || "–",
          tag: row.tag,
          excerpt: row.excerpt,
          body: row.body || "",
          created_at: row.created_at
        },
        idx
      )
    );
    setStories(mapped.length ? mapped : fallbackStories.map((s, idx) => ensureSlug(s, idx)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const adjustReaderScale = useCallback((delta) => {
    setReaderScale((prev) => {
      const next = prev + delta;
      const clamped = Math.min(1.4, Math.max(0.8, next));
      return Number(clamped.toFixed(2));
    });
  }, []);

  const sortedStories = useMemo(() => {
    return [...stories].sort((a, b) => {
      const tsA =
        (a.created_at && new Date(a.created_at).getTime()) || (parseStoryDate(a.date)?.getTime() ?? 0);
      const tsB =
        (b.created_at && new Date(b.created_at).getTime()) || (parseStoryDate(b.date)?.getTime() ?? 0);
      if (tsA === tsB) return 0;
      return tsB - tsA;
    });
  }, [stories]);

  const issueNumber = useMemo(() => String(Math.max(sortedStories.length, 1)).padStart(2, "0"), [
    sortedStories.length
  ]);

  const checkSubscription = useCallback(
    async (email) => {
      if (!supabase || !email) return false;
      const { data, error: lookupError } = await supabase
        .from("newsletter_signups")
        .select("email")
        .eq("email", email)
        .limit(1);
      if (lookupError) return false;
      return !!(data && data.length);
    },
    [supabase]
  );

  const confirmSubscription = useCallback(
    async (email) => {
      const exists = await checkSubscription(email);
      setIsSubscribed(exists);
      if (exists && typeof window !== "undefined") {
        window.localStorage.setItem("newsletterEmail", email);
      }
    },
    [checkSubscription]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedEmail = window.localStorage.getItem("newsletterEmail");
    if (!savedEmail) return;
    confirmSubscription(savedEmail);
  }, [confirmSubscription]);

  const tagFilters = useMemo(() => {
    const set = new Set(TAGS);
    sortedStories.forEach((s) => {
      const tag = (s.tag || s.category || "").trim();
      if (tag) set.add(tag);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [sortedStories]);

  const leadStory = useMemo(() => sortedStories[0], [sortedStories]);
  const archiveStories = useMemo(() => sortedStories.filter((_, idx) => idx !== 0), [sortedStories]);
  const filteredArchiveStories = useMemo(() => {
    if (!activeTag) return archiveStories;
    return archiveStories.filter(
      (s) => (s.tag || s.category || "").toLowerCase() === activeTag.toLowerCase()
    );
  }, [activeTag, archiveStories]);

  const archiveSelection = useMemo(() => {
    if (!filteredArchiveStories.length) return [];
    if (activeTag) {
      // Bei aktivem Filter alle Stories der Rubrik anzeigen, aber die aktuelle Ausgabe ausblenden
      return filteredArchiveStories;
    }
    // Ohne Filter: die drei neuesten auf Basis von created_at/date zeigen, ohne Duplikate oder Platzhalter
    if (filteredArchiveStories.length >= 3) return filteredArchiveStories.slice(0, 3);
    return filteredArchiveStories;
  }, [activeTag, filteredArchiveStories]);

  const storySlug = useMemo(() => {
    if (!route.startsWith("/stories/")) return null;
    const raw = route.replace("/stories/", "").replace(/\/+$/, "");
    return decodeURIComponent(raw);
  }, [route]);

  const currentStory = useMemo(() => {
    if (!storySlug) return null;
    return sortedStories.find((s) => s.slug === storySlug) || null;
  }, [sortedStories, storySlug]);

  const fetchComments = useCallback(
    async (storyId) => {
      if (!supabase || !storyId) return;
      setCommentsLoading(true);
      const { data, error: err } = await supabase
        .from("comments")
        .select("id, author_name, body, created_at, status")
        .eq("story_id", storyId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (err) {
        setCommentStatus({ state: "error", message: "Kommentare konnten nicht geladen werden." });
        setComments([]);
      } else {
        setComments(data || []);
      }
      setCommentsLoading(false);
    },
    []
  );

  const navigate = useCallback((path) => {
    window.history.pushState({}, "", path);
    setRoute(path);
  }, []);

  useEffect(() => {
    const baseTitle = "Der Levitenleser – Kurzgeschichten";
    const baseDescription =
      "Der Levitenleser veröffentlicht regelmäßig Kurzgeschichten im Stil des Feuilletons – kurz, pointiert, zugänglich.";
    let title = baseTitle;
    let description = baseDescription;
    let robots = "index, follow";
    let ogType = "website";

    const origin = typeof window !== "undefined" ? window.location.origin : "https://levitenleser.de";
    const [pathOnly] = (route || "/").split("#");
    const canonicalPath = pathOnly && pathOnly.trim() !== "" ? pathOnly : "/";
    const canonicalUrl = `${origin}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;

    if (route.startsWith("/newsletter")) {
      title = "Newsletter – Der Levitenleser";
      description = "Eine kurze E-Mail, sobald eine neue Kurzgeschichte erscheint. Datenschutzfreundlich und selten.";
      ogType = "article";
    } else if (route.startsWith("/impressum")) {
      title = "Impressum – Der Levitenleser";
      description = "Impressum und Kontakt für Der Levitenleser.";
    } else if (route.startsWith("/datenschutz")) {
      title = "Datenschutz – Der Levitenleser";
      description = "Informationen zum Datenschutz und zur Datenverarbeitung bei Der Levitenleser.";
    } else if (route.startsWith("/cms")) {
      title = "CMS – Der Levitenleser";
      description = "Interner Bereich zur Verwaltung der Kurzgeschichten.";
      robots = "noindex, nofollow";
    } else if (route.startsWith("/stories/") && currentStory) {
      title = `${currentStory.title} – Der Levitenleser`;
      description = currentStory.excerpt?.slice(0, 160) || baseDescription;
      ogType = "article";
    } else if (leadStory) {
      title = `${leadStory.title} – Der Levitenleser`;
      description = leadStory.excerpt?.slice(0, 160) || baseDescription;
      ogType = "article";
    }

    if (typeof document !== "undefined") {
      document.title = title;
    }
    setMetaTag("robots", robots);
    setCanonical(canonicalUrl);
    setMetaTag("description", description);
    setMetaTag("og:title", title, "property");
    setMetaTag("og:description", description, "property");
    setMetaTag("og:url", canonicalUrl, "property");
    setMetaTag("og:type", ogType, "property");
    setMetaTag("og:locale", "de_DE", "property");
    setMetaTag("og:site_name", "Der Levitenleser", "property");
    setMetaTag("twitter:card", "summary_large_image", "name");
    setMetaTag("twitter:title", title, "name");
    setMetaTag("twitter:description", description, "name");
  }, [currentStory, leadStory, route]);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!route.startsWith("/stories/")) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [route]);

  useEffect(() => {
    if (!currentStory?.id) return;
    fetchComments(currentStory.id);
  }, [currentStory?.id, fetchComments]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const existing = document.getElementById("ld-json-story");
    if (!leadStory && !currentStory) {
      existing?.remove();
      return;
    }

    const story = currentStory || leadStory;

    const toIso = (s) => {
      if (!s) return null;
      const rawDate = s.created_at || s.date;
      if (!rawDate) return null;
      const parsed = s.created_at ? new Date(rawDate) : parseStoryDate(rawDate);
      if (!parsed || Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString();
    };

    const datePublished = toIso(story);
    const origin = typeof window !== "undefined" ? window.location.origin : "https://levitenleser.de";
    const structured = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: story.title,
      description: story.excerpt || "",
      author: {
        "@type": "Person",
        name: story.author || "Der Levitenleser"
      },
      publisher: {
        "@type": "Organization",
        name: "Der Levitenleser"
      },
      datePublished: datePublished || undefined,
      articleSection: story.tag || story.category || "Kurzgeschichte",
      url: `${origin}${route}`,
      inLanguage: "de-DE"
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "ld-json-story";
    script.textContent = JSON.stringify(structured);
    existing?.remove();
    document.head.appendChild(script);
  }, [currentStory, leadStory, route]);

  useEffect(() => {
    // Mobile-Menü schließen, sobald Route oder Modal wechselt
    setMobileNavOpen(false);
  }, [route]);

  useEffect(() => {
    if (!route.startsWith("/stories/")) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        navigate("/#archive");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, route]);

  const handleCommentSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!currentStory?.id) return;
      if (!supabase) {
        setCommentStatus({ state: "error", message: "Supabase ist nicht konfiguriert." });
        return;
      }
      if (commentForm.trap) {
        setCommentStatus({ state: "error", message: "Ungültige Eingabe." });
        return;
      }
      const author = commentForm.author.trim();
      const body = commentForm.body.trim();
      if (!body) {
        setCommentStatus({ state: "error", message: "Bitte einen Kommentar eintragen." });
        return;
      }
      setCommentStatus({ state: "loading", message: "Wird gespeichert …" });
      const { error: err } = await supabase.from("comments").insert({
        story_id: currentStory.id,
        author_name: author || "Leser:in",
        body,
        status: "approved"
      });
      if (err) {
        setCommentStatus({ state: "error", message: "Konnte Kommentar nicht speichern." });
        return;
      }
      setCommentForm({ author: "", body: "", trap: "", open: false });
      setCommentStatus({ state: "success", message: "Danke für deinen Kommentar!" });
      fetchComments(currentStory.id);
    },
    [commentForm.author, commentForm.body, commentForm.trap, currentStory?.id, fetchComments]
  );

  const handleNewsletterSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const email = newsletterEmail.trim().toLowerCase();
      if (!email) {
        setNewsletterStatus({ state: "error", message: "Bitte eine E-Mail-Adresse eintragen." });
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        setNewsletterStatus({ state: "error", message: "Die E-Mail-Adresse wirkt nicht gültig." });
        return;
      }
      if (!supabase) {
        setNewsletterStatus({
          state: "error",
          message: "Supabase ist nicht konfiguriert. Bitte später erneut versuchen."
        });
        return;
      }

      setNewsletterStatus({ state: "loading", message: "Wird gespeichert …" });
      const { error: insertError } = await supabase.from("newsletter_signups").insert({ email });
      if (insertError) {
        const duplicate = insertError.code === "23505";
        setNewsletterStatus({
          state: "error",
          message: duplicate
            ? "Diese Adresse ist bereits eingetragen."
            : "Konnte die Anmeldung nicht speichern. Bitte später erneut versuchen."
        });
        if (duplicate) {
          confirmSubscription(email);
        }
        return;
      }
      setNewsletterEmail("");
      setNewsletterStatus({
        state: "success",
        message: "Danke! Du bekommst eine Nachricht, sobald ein neuer Text erscheint."
      });
      confirmSubscription(email);
    },
    [confirmSubscription, newsletterEmail]
  );

  const newsletterForm = (
    <div className="grid md:grid-cols-2 gap-8 items-start">
      <div className="space-y-4 text-ink/85 font-sans leading-relaxed">
        <p>
          Trage deine E-Mail ein, um Vorabhinweise, Leseproben und Links zur jeweiligen Ausgabe zu erhalten. Der
          Newsletter erscheint nur, wenn eine neue Geschichte bereitsteht.
        </p>
        <p className="text-xs uppercase tracking-wideish text-ink/60">
          Datenschutzfreundlich · Keine Weitergabe · Jederzeit abbestellbar
        </p>
      </div>
      <form
        className="bg-white border border-stone p-6 space-y-4 shadow-editorial"
        onSubmit={handleNewsletterSubmit}
      >
        <label className="block text-sm uppercase tracking-wideish font-sans text-ink/70" htmlFor="email">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          type="email"
          placeholder="name@example.com"
          className="w-full border border-ink/20 px-4 py-3 bg-parchment focus:outline-none focus:border-accent transition"
          value={newsletterEmail}
          onChange={(e) => setNewsletterEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center px-5 py-3 uppercase tracking-wideish text-xs font-sans bg-ink text-white hover:bg-accent transition disabled:opacity-60"
          disabled={newsletterStatus.state === "loading"}
        >
          {newsletterStatus.state === "loading" ? "Sende …" : "Anmelden"}
        </button>
        {newsletterStatus.message ? (
          <p
            className={`text-sm ${
              newsletterStatus.state === "success" ? "text-emerald-700" : "text-accent"
            }`}
          >
            {newsletterStatus.message}
          </p>
        ) : (
          <p className="text-[11px] text-ink/60">
            Wir schicken dir nur eine kurze Nachricht, wenn ein neuer Text online geht.
          </p>
        )}
      </form>
    </div>
  );

  const handleNewsletterNav = useCallback(
    (e) => {
      if (isSubscribed) {
        e.preventDefault();
        navigate("/newsletter");
      }
    },
    [isSubscribed, navigate]
  );

  const handlePrivacyClick = useCallback(
    (e) => {
      e.preventDefault();
      navigate("/datenschutz");
    },
    [navigate]
  );

  const cookieBanner = (
    <CookieBanner
      visible={showCookieBanner}
      onAccept={() => handleCookieChoice("all")}
      onReject={() => handleCookieChoice("necessary")}
      onNavigatePrivacy={handlePrivacyClick}
    />
  );

  if (route.startsWith("/newsletter")) {
    return (
      <div className="min-h-screen bg-parchment text-ink">
        <header className="border-b border-stone/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              type="button"
              className="flex flex-col gap-1 text-left bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              onClick={() => navigate("/")}
              aria-label="Zur Startseite"
              title="Zur Startseite"
            >
              <p className="text-[11px] uppercase tracking-wideish text-ink/70 font-sans">
                Der Levitenleser – Kurzgeschichten
              </p>
              <h1 className="text-3xl md:text-4xl font-serif tracking-tight">DER LEVITENLESER</h1>
            </button>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wideish font-sans text-ink/80">
                <a
                  className="hover:text-accent transition"
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/");
                  }}
                >
                  Startseite
                </a>
                <a
                  className="hover:text-accent transition"
                  href="/impressum"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/impressum");
                  }}
                >
                  Impressum
                </a>
                <a
                  className="hover:text-accent transition"
                  href="/datenschutz"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/datenschutz");
                  }}
                >
                  Datenschutz
                </a>
              </nav>
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center w-10 h-10 border border-stone bg-white text-ink hover:text-accent"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-label="Menü öffnen oder schließen"
              >
                <span className="sr-only">Menü</span>
                <span className="flex flex-col gap-1.5">
                  <span
                    className={`block h-0.5 w-5 bg-current transition ${
                      mobileNavOpen ? "translate-y-1.5 rotate-45" : ""
                    }`}
                  />
                  <span className={`block h-0.5 w-5 bg-current transition ${mobileNavOpen ? "opacity-0" : ""}`} />
                  <span
                    className={`block h-0.5 w-5 bg-current transition ${
                      mobileNavOpen ? "-translate-y-1.5 -rotate-45" : ""
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </header>

        {mobileNavOpen ? (
          <div className="md:hidden border-b border-stone bg-white">
            <nav className="max-w-6xl mx-auto px-4 py-4 space-y-3 text-sm uppercase tracking-wideish font-sans text-ink/80">
              <a
                className="block hover:text-accent transition"
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                  setMobileNavOpen(false);
                }}
              >
                Startseite
              </a>
            </nav>
          </div>
        ) : null}

        <main className="max-w-4xl mx-auto px-4 py-14 md:py-16 space-y-8">
          <SectionTitle
            overline="Newsletter"
            title="Eine kurze Nachricht, wenn Neues erscheint"
            kicker={
              isSubscribed
                ? "Du bist angemeldet. Wenn du eine weitere Adresse eintragen willst, nutze das Formular."
                : "Kein Spam, nur ein Hinweis auf den neuen Text"
            }
          />
          <div className="border border-stone bg-white/80 backdrop-blur-sm p-6 md:p-8 shadow-editorial space-y-6">
            {isSubscribed ? (
              <p className="text-sm text-ink/70 font-sans">
                Danke für deine Anmeldung. Wir melden uns nur, wenn ein neuer Text online geht.
              </p>
            ) : null}
            {newsletterForm}
          </div>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center px-4 py-2 bg-ink text-white text-xs uppercase tracking-wideish hover:bg-accent transition"
          >
            Zur Startseite
          </button>
        </main>
        {cookieBanner}
      </div>
    );
  }

  if (route.startsWith("/impressum") || route.startsWith("/datenschutz")) {
    const key = route.includes("datenschutz") ? "datenschutz" : "impressum";
    const page = legalPages[key];
    return (
      <div className="min-h-screen bg-parchment text-ink">
        <header className="border-b border-stone/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              type="button"
              className="flex flex-col gap-1 text-left bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              onClick={() => navigate("/")}
              aria-label="Zur Startseite"
              title="Zur Startseite"
            >
              <p className="text-[11px] uppercase tracking-wideish text-ink/70 font-sans">
                Der Levitenleser – Kurzgeschichten
              </p>
              <h1 className="text-3xl md:text-4xl font-serif tracking-tight">DER LEVITENLESER</h1>
            </button>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wideish font-sans text-ink/80">
                <a
                  className="hover:text-accent transition"
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/");
                  }}
                >
                  Startseite
                </a>
                <a
                  className="hover:text-accent transition"
                  href={key === "impressum" ? "/datenschutz" : "/impressum"}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(key === "impressum" ? "/datenschutz" : "/impressum");
                  }}
                >
                  {key === "impressum" ? "Datenschutz" : "Impressum"}
                </a>
              </nav>
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center w-10 h-10 border border-stone bg-white text-ink hover:text-accent"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-label="Menü öffnen oder schließen"
              >
                <span className="sr-only">Menü</span>
                <span className="flex flex-col gap-1.5">
                  <span
                    className={`block h-0.5 w-5 bg-current transition ${
                      mobileNavOpen ? "translate-y-1.5 rotate-45" : ""
                    }`}
                  />
                  <span className={`block h-0.5 w-5 bg-current transition ${mobileNavOpen ? "opacity-0" : ""}`} />
                  <span
                    className={`block h-0.5 w-5 bg-current transition ${
                      mobileNavOpen ? "-translate-y-1.5 -rotate-45" : ""
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </header>

        {mobileNavOpen ? (
          <div className="md:hidden border-b border-stone bg-white">
            <nav className="max-w-6xl mx-auto px-4 py-4 space-y-3 text-sm uppercase tracking-wideish font-sans text-ink/80">
              <a
                className="block hover:text-accent transition"
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                  setMobileNavOpen(false);
                }}
              >
                Startseite
              </a>
            </nav>
          </div>
        ) : null}

        <main className="max-w-4xl mx-auto px-4 py-14 md:py-16 space-y-8">
          <SectionTitle overline={page.overline} title={page.title} />
          <div className="border border-stone bg-white/80 backdrop-blur-sm p-6 md:p-8 shadow-editorial">
            {page.content}
          </div>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center px-4 py-2 bg-ink text-white text-xs uppercase tracking-wideish hover:bg-accent transition"
          >
            Zur Startseite
          </button>
        </main>
        {cookieBanner}
      </div>
    );
  }

  if (route.startsWith("/cms")) {
    return (
      <div className="min-h-screen bg-parchment text-ink">
        <header className="border-b border-stone/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              type="button"
              className="flex flex-col gap-1 text-left bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              onClick={() => navigate("/")}
              aria-label="Zur Startseite"
              title="Zur Startseite"
            >
              <p className="text-[11px] uppercase tracking-wideish text-ink/70 font-sans">
                Der Levitenleser – Kurzgeschichten
              </p>
              <h1 className="text-3xl md:text-4xl font-serif tracking-tight">DER LEVITENLESER</h1>
            </button>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wideish font-sans text-ink/80">
                <a
                  className="hover:text-accent transition"
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/");
                  }}
                >
                  Startseite
                </a>
              </nav>
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center w-10 h-10 border border-stone bg-white text-ink hover:text-accent"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-label="Menü öffnen oder schließen"
              >
                <span className="sr-only">Menü</span>
                <span className="flex flex-col gap-1.5">
                  <span
                    className={`block h-0.5 w-5 bg-current transition ${
                      mobileNavOpen ? "translate-y-1.5 rotate-45" : ""
                    }`}
                  />
                  <span className={`block h-0.5 w-5 bg-current transition ${mobileNavOpen ? "opacity-0" : ""}`} />
                  <span
                    className={`block h-0.5 w-5 bg-current transition ${
                      mobileNavOpen ? "-translate-y-1.5 -rotate-45" : ""
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </header>

        {mobileNavOpen ? (
          <div className="md:hidden border-b border-stone bg-white">
            <nav className="max-w-6xl mx-auto px-4 py-4 space-y-3 text-sm uppercase tracking-wideish font-sans text-ink/80">
              <a
                className="block hover:text-accent transition"
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                  setMobileNavOpen(false);
                }}
              >
                Startseite
              </a>
            </nav>
          </div>
        ) : null}

        <main className="max-w-4xl mx-auto px-4 py-14 md:py-16 space-y-6">
          <SectionTitle title="Texte direkt hier verwalten"  />
          
          <div className="border border-stone bg-white/70 backdrop-blur-sm p-5">
            <AdminPanel onStoryCreated={fetchStories} />
          </div>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center px-4 py-2 bg-ink text-white text-xs uppercase tracking-wideish hover:bg-accent transition"
          >
            Zur Startseite
          </button>
        </main>
        {cookieBanner}
      </div>
    );
  }

  if (route.startsWith("/stories/")) {
    const story = currentStory;
    return (
      <div className={`min-h-screen ${invertReader ? "bg-ink text-parchment" : "bg-parchment text-ink"}`}>
        <header className="border-b border-stone/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              type="button"
              className="flex flex-col gap-1 text-left bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              onClick={() => navigate("/")}
              aria-label="Zur Startseite"
              title="Zur Startseite"
            >
              <p className="text-[11px] uppercase tracking-wideish text-ink/70 font-sans">
                Der Levitenleser – Kurzgeschichten
              </p>
              <h1 className="text-3xl md:text-4xl font-serif tracking-tight">DER LEVITENLESER</h1>
            </button>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wideish font-sans text-ink/80">
                <a
                  className="hover:text-accent transition"
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/");
                  }}
                >
                  Startseite
                </a>
                <a
                  className="hover:text-accent transition"
                  href="/#archive"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/");
                    setActiveTag(null);
                  }}
                >
                  Archiv
                </a>
              </nav>
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center w-10 h-10 border border-stone bg-white text-ink hover:text-accent"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-label="Menü öffnen oder schließen"
              >
                <span className="sr-only">Menü</span>
                <span className="flex flex-col gap-1.5">
                  <span
                    className={`block h-0.5 w-5 bg-current transition ${
                      mobileNavOpen ? "translate-y-1.5 rotate-45" : ""
                    }`}
                  />
                  <span className={`block h-0.5 w-5 bg-current transition ${mobileNavOpen ? "opacity-0" : ""}`} />
                  <span
                    className={`block h-0.5 w-5 bg-current transition ${
                      mobileNavOpen ? "-translate-y-1.5 -rotate-45" : ""
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </header>

        {mobileNavOpen ? (
          <div className="md:hidden border-b border-stone bg-white">
            <nav className="max-w-6xl mx-auto px-4 py-4 space-y-3 text-sm uppercase tracking-wideish font-sans text-ink/80">
              <a
                className="block hover:text-accent transition"
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                  setMobileNavOpen(false);
                }}
              >
                Startseite
              </a>
              <a
                className="block hover:text-accent transition"
                href="/#archive"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                  setActiveTag(null);
                  setMobileNavOpen(false);
                }}
              >
                Archiv
              </a>
            </nav>
          </div>
        ) : null}

        <main className="px-4 py-14 md:py-16" onClick={story ? () => navigate("/#archive") : undefined}>
          <div className="max-w-4xl mx-auto space-y-8">
          {!story ? (
            <div className="border border-stone bg-white/80 backdrop-blur-sm p-6 md:p-8 shadow-editorial space-y-4">
              <h2 className="text-2xl font-serif">Text nicht gefunden</h2>
              <p className="text-sm text-ink/70 font-sans">
                Dieser Text scheint nicht mehr verfügbar zu sein. Schau im Archiv nach anderen Geschichten.
              </p>
              <button
                type="button"
                onClick={() => navigate("/#archive")}
                className="inline-flex items-center justify-center px-4 py-2 bg-ink text-white text-xs uppercase tracking-wideish hover:bg-accent transition"
              >
                Zum Archiv
              </button>
            </div>
          ) : (
            <article
                className={`border p-6 md:p-8 shadow-editorial space-y-6 ${
                  invertReader
                    ? "border-parchment/40 bg-ink text-parchment"
                    : "border-stone bg-white/90 backdrop-blur-sm text-ink"
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center gap-3 justify-between text-[11px] uppercase tracking-wideish font-sans">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustReaderScale(-0.1)}
                    className={`h-8 px-2 border text-xs transition ${
                      invertReader
                        ? "border-parchment/30 text-parchment/80 hover:border-accent hover:text-accent"
                        : "border-ink/20 text-ink/70 hover:border-accent hover:text-accent"
                    }`}
                    aria-label="Text kleiner"
                  >
                    A−
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustReaderScale(0.1)}
                    className={`h-8 px-2 border text-xs transition ${
                      invertReader
                        ? "border-parchment/30 text-parchment/80 hover:border-accent hover:text-accent"
                        : "border-ink/20 text-ink/70 hover:border-accent hover:text-accent"
                    }`}
                    aria-label="Text größer"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvertReader((prev) => !prev)}
                    className={`h-8 px-3 border text-xs transition ${
                      invertReader
                        ? "border-parchment/30 text-parchment/80 hover:border-accent hover:text-accent"
                        : "border-ink/20 text-ink/70 hover:border-accent hover:text-accent"
                    }`}
                    aria-label="Farbschema invertieren"
                  >
                    {invertReader ? "hell" : "dunkel"}
                  </button>
                </div>
                <span className={invertReader ? "text-parchment/60" : "text-ink/70"}>
                  {story.date} · {story.readTime}
                </span>
              </div>
              <header className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-serif leading-tight">{story.title}</h1>
                {story.author ? (
                  <p className={`text-sm font-serif italic ${invertReader ? "text-parchment/70" : "text-ink/70"}`}>
                    Von {story.author}
                  </p>
                ) : null}
              </header>
              <div
                className={`text-lg md:text-xl font-sans leading-relaxed whitespace-pre-line dropcap ${
                  invertReader ? "text-parchment/90" : "text-ink/85"
                }`}
                style={{ fontSize: `${1.125 * readerScale}rem` }}
              >
                {story.body || story.excerpt}
              </div>
              <div className={`pt-4 border-t ${invertReader ? "border-parchment/20" : "border-ink/10"}`}>
                <button
                  type="button"
                  onClick={() => navigate("/#archive")}
                  className={`text-xs uppercase tracking-wideish ${
                    invertReader ? "text-parchment/70 hover:text-accent" : "text-ink/65 hover:text-accent"
                  }`}
                >
                  schließen
                </button>
              </div>
              <section
                className={`space-y-4 pt-4 border-t ${
                  invertReader ? "border-parchment/30" : "border-ink/10"
                }`}
              >
                <h2 className="text-xl font-serif">Kommentare</h2>
                {!supabase ? (
                  <p className="text-sm text-ink/70">Kommentare sind offline nicht verfügbar.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {commentsLoading ? (
                        <p className="text-sm text-ink/70">Lade Kommentare …</p>
                      ) : comments.length === 0 ? (
                        <p className="text-sm text-ink/60">Noch keine Kommentare vorhanden.</p>
                      ) : (
                        comments.map((c) => (
                          <div
                            key={c.id}
                            className={`border px-3 py-2 ${
                              invertReader ? "border-parchment/30" : "border-ink/10 bg-white/60"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs uppercase tracking-wideish text-ink/60">
                              <span>{c.author_name || "Leser:in"}</span>
                              <span>
                                {new Intl.DateTimeFormat("de-DE", {
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                }).format(new Date(c.created_at))}
                              </span>
                            </div>
                            <p className={`mt-2 text-sm leading-relaxed ${invertReader ? "text-parchment/85" : ""}`}>
                              {c.body}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-6 space-y-3">
                      <button
                        type="button"
                        className={`inline-flex items-center justify-center px-4 py-2 border text-xs uppercase tracking-wideish hover:border-accent hover:text-accent transition ${
                          invertReader ? "border-parchment/40 text-parchment/80" : "border-ink/30"
                        }`}
                        onClick={() => setCommentForm((prev) => ({ ...prev, open: !prev.open }))}
                      >
                        {commentForm.open ? "Formular schließen" : "Einen Kommentar hinterlassen"}
                      </button>
                      {commentForm.open ? (
                        <form
                          className={`space-y-3 border p-4 ${
                            invertReader ? "border-parchment/30 bg-ink/40 text-parchment" : "border-ink/10 bg-white/40"
                          }`}
                          onSubmit={(e) => {
                            handleCommentSubmit(e);
                            setCommentForm((prev) => ({ ...prev, open: false }));
                          }}
                        >
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs uppercase tracking-wideish text-ink/70">Name (optional)</label>
                              <input
                                className={`w-full border px-3 py-2 focus:outline-none focus:border-accent ${
                                  invertReader ? "border-parchment/30 bg-ink/40 text-parchment" : "border-ink/20 bg-parchment"
                                }`}
                                value={commentForm.author || ""}
                                onChange={(e) => setCommentForm((prev) => ({ ...prev, author: e.target.value }))}
                                placeholder="Dein Name"
                              />
                            </div>
                            <div className="hidden">
                              <label>Bitte leer lassen</label>
                              <input
                                tabIndex={-1}
                                autoComplete="off"
                                value={commentForm.trap || ""}
                                onChange={(e) => setCommentForm((prev) => ({ ...prev, trap: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs uppercase tracking-wideish text-ink/70">Kommentar</label>
                            <textarea
                              className={`w-full border px-3 py-2 focus:outline-none focus:border-accent min-h-[100px] ${
                                invertReader ? "border-parchment/30 bg-ink/40 text-parchment" : "border-ink/20 bg-parchment"
                              }`}
                              value={commentForm.body || ""}
                              onChange={(e) => setCommentForm((prev) => ({ ...prev, body: e.target.value }))}
                              placeholder="Was denkst du?"
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center px-4 py-2 bg-ink text-white text-xs uppercase tracking-wideish hover:bg-accent transition disabled:opacity-60"
                            disabled={commentStatus.state === "loading"}
                          >
                            {commentStatus.state === "loading" ? "Senden …" : "Kommentar senden"}
                          </button>
                          {commentStatus.message ? (
                            <p
                              className={`text-sm ${
                                commentStatus.state === "success" ? "text-emerald-700" : "text-accent"
                              }`}
                            >
                              {commentStatus.message}
                            </p>
                          ) : (
                            <p className="text-[11px] text-ink/60">
                              Spam-Schutz aktiv. Kommentare erscheinen sofort, solange sie den Richtlinien entsprechen.
                            </p>
                          )}
                        </form>
                      ) : null}
                    </div>
                  </>
                )}
              </section>
            </article>
            )}
          </div>
        </main>
        {cookieBanner}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <header className="border-b border-stone/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            className="flex flex-col gap-1 text-left bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            onClick={() => navigate("/")}
            aria-label="Zur Startseite"
            title="Zur Startseite"
          >
            <p className="text-[11px] uppercase tracking-wideish text-ink/70 font-sans">
              Der Levitenleser – Kurzgeschichten
            </p>
            <h1 className="text-3xl md:text-4xl font-serif tracking-tight">DER LEVITENLESER</h1>
          </button>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wideish font-sans text-ink/80">
              <a className="hover:text-accent transition" href="#stories">
                Aktuelle Ausgabe
              </a>
              <a className="hover:text-accent transition" href="#archive">
                Archiv
              </a>
              <a
                className="hover:text-accent transition"
                href="/cms"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/cms");
                }}
              >
                CMS
              </a>
            </nav>
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center w-10 h-10 border border-stone bg-white text-ink hover:text-accent"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Menü öffnen oder schließen"
            >
              <span className="sr-only">Menü</span>
              <span className="flex flex-col gap-1.5">
                <span
                  className={`block h-0.5 w-5 bg-current transition ${
                    mobileNavOpen ? "translate-y-1.5 rotate-45" : ""
                  }`}
                />
                <span className={`block h-0.5 w-5 bg-current transition ${mobileNavOpen ? "opacity-0" : ""}`} />
                <span
                  className={`block h-0.5 w-5 bg-current transition ${
                    mobileNavOpen ? "-translate-y-1.5 -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {mobileNavOpen ? (
        <div className="md:hidden border-b border-stone bg-white">
          <nav className="max-w-6xl mx-auto px-4 py-4 space-y-3 text-sm uppercase tracking-wideish font-sans text-ink/80">
            <a className="block hover:text-accent transition" href="#stories" onClick={() => setMobileNavOpen(false)}>
              Aktuelle Ausgabe
            </a>
            <a className="block hover:text-accent transition" href="#archive" onClick={() => setMobileNavOpen(false)}>
              Archiv
            </a>
            <a
              className="block hover:text-accent transition"
              href="/cms"
              onClick={(e) => {
                e.preventDefault();
                navigate("/cms");
                setMobileNavOpen(false);
              }}
            >
              CMS
            </a>
          </nav>
        </div>
      ) : null}

      <main>
        <section className="border-b border-stone/80 bg-gradient-to-b from-parchment via-white to-parchment">
          <div className="max-w-6xl mx-auto px-4 py-12 md:py-16 grid md:grid-cols-12 gap-10">
            <div className="md:col-span-7 space-y-6">
              <p className="text-xs uppercase tracking-wideish text-ink/70 font-sans">
                Ausgabe {issueNumber} · Online
              </p>
              <h2 className="text-3xl md:text-4xl font-serif leading-tight">
                Kurze Geschichten, die klingen wie gedruckt.
              </h2>
              <p className="text-sm md:text-base font-sans text-ink/70 leading-relaxed">
                &ldquo;Der Levitenleser veröffentlicht regelmäßig Kurzgeschichten. Jede Woche ein neuer Text, immer lesbar, immer zugänglich. Gott bewahre, ich bin nicht religiös; dennoch habe ich im 3. Buch Mose (Leviticus) meinen Ursprung. Regeln, Gebote und Verhaltensvorschriften wurden daraus bestimmend und im strengen Ton vorgelesen. Ich werde mahnen und erinnern – nicht an die religiösen Pflichten, sondern einzig daran, zu denken.&rdquo;
              </p>
              {loading ? (
                <p className="text-sm text-ink/60 font-sans">Lade Geschichten aus Supabase …</p>
              ) : error ? (
                <p className="text-sm text-accent font-sans">{error}</p>
              ) : null}
            </div>
            <div className="md:col-span-5 space-y-4">
              <div className="border border-ink/15 bg-white shadow-editorial p-6">
                <p className="text-xs uppercase tracking-wideish text-ink/70 font-sans mb-3">Nächste Veröffentlichung</p>
                <p className="text-lg font-serif leading-tight">
                  Jeden Sonntagmorgen. Als würde die Zeitung auf den Küchentisch fallen.
                </p>
              </div>
              <div className="flex gap-3 items-center text-xs uppercase tracking-wideish font-sans text-ink/70">
                <span className="h-px flex-1 bg-ink/25" />
                <span>Neuer Artikel am: {nextSunday}</span>
                <span className="h-px flex-1 bg-ink/25" />
              </div>
            </div>
          </div>
        </section>

        <section id="stories" className="border-b border-stone/80 bg-gradient-to-b from-white via-parchment/60 to-white">
          <div className="max-w-6xl mx-auto px-4 py-14 md:py-16 space-y-8">
            <div className="relative overflow-hidden border border-ink/15 bg-white/95 shadow-2xl">
              <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
              <div className="absolute -left-12 -top-16 h-32 w-32 bg-accent/10 blur-3xl" aria-hidden />
              <div className="absolute -right-16 -bottom-10 h-32 w-32 bg-ink/5 blur-3xl" aria-hidden />
              <div className="p-6 md:p-8 space-y-6 relative">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wideish font-sans text-ink/70">
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-ink text-white">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    Neu
                  </span>
                  <span className="text-ink/60">Lesbar wie im Feuilleton · Jede Woche neu</span>
                </div>
                <SectionTitle title="Aktuelle Ausgabe" kicker="Frisch aus dem Notizbuch." />
                {leadStory ? (
                  <div className="grid md:grid-cols-1 gap-6">
                    <StoryCard
                      story={leadStory}
                      highlight
                      onOpen={(story) => navigate(`/stories/${story.slug}`)}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-ink/60 font-sans">Keine Texte vorhanden.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="archive" className="border-y border-stone/80 bg-gradient-to-b from-parchment via-white to-parchment">
          <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
            <SectionTitle
              title={activeTag ? `Rubrik: ${activeTag}` : "Archiv"}
              kicker="Chronologisch, nach Rubriken (Tags) filterbar."
            />
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wideish font-sans text-ink/80 mt-6">
              <button
                type="button"
                className={`px-3 py-1 border rounded-full ${
                  !activeTag ? "border-ink bg-ink text-white" : "border-ink/20 bg-white"
                }`}
                onClick={() => setActiveTag(null)}
              >
                Alles
              </button>
              {tagFilters.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`px-3 py-1 border rounded-full ${
                    activeTag === tag ? "border-ink bg-ink text-white" : "border-ink/20 bg-white"
                  }`}
                  onClick={() => setActiveTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-8 grid gap-6 text-sm font-sans text-ink/80 grid-cols-1 md:grid-cols-3">
              {activeTag && filteredArchiveStories.length === 0 ? (
                <div className="col-span-full border border-stone bg-white p-5 space-y-3 shadow-editorial">
                  <p className="text-xs uppercase tracking-wideish text-ink/70">Noch nichts in dieser Rubrik</p>
                  <p className="leading-relaxed">
                    Hier erscheint bald ein Text mit dem Tag &bdquo;{activeTag}&ldquo;. Schau gern später noch einmal
                    vorbei oder wähle eine andere Rubrik.
                  </p>
                </div>
              ) : (
                archiveSelection.map((story, idx) => (
                  <button
                    key={`${story.id ?? "story"}-${idx}`}
                    type="button"
                    onClick={() => navigate(`/stories/${story.slug}`)}
                    className="text-left border border-stone bg-white p-5 space-y-3 hover:shadow-editorial hover:-translate-y-0.5 transition focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <p className="text-xs uppercase tracking-wideish text-ink/70">{story.date}</p>
                    <h4 className="text-xl font-serif">{story.title}</h4>
                    <p className="leading-relaxed">{story.excerpt}</p>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wideish text-ink/70">
                      <span>{story.readTime}</span>
                      <span className="w-px h-4 bg-ink/20" />
                      <span>Lesen</span>
                      {story.body ? (
                        <>
                          <span className="w-px h-4 bg-ink/20" />
                          <span className="text-ink/60">
                            {story.body
                              .replace(/<[^>]+>/g, " ")
                              .trim()
                              .split(/\s+/)
                              .filter(Boolean).length}{" "}
                            Wörter
                          </span>
                        </>
                      ) : null}
                      {typeof story.comments_count === "number" ? (
                        <>
                          <span className="w-px h-4 bg-ink/20" />
                          <span className="text-ink/60">
                            {story.comments_count === 1 ? "1 Kommentar" : `${story.comments_count} Kommentare`}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {!isSubscribed ? (
          <section id="newsletter" className="bg-gradient-to-b from-white via-parchment to-white">
            <div className="max-w-6xl mx-auto px-4 py-14 md:py-16 space-y-8">
              <SectionTitle
                overline="Newsletter"
                title="Eine kurze Nachricht, wenn Neues erscheint"
                kicker="Kein Spam, nur ein Hinweis auf den nächsten Text."
              />
              {newsletterForm}
            </div>
          </section>
        ) : null}

      </main>

      <footer className="border-t border-stone/80 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wideish text-ink/70 font-sans">Der Levitenleser</p>
            <p className="font-serif text-lg">Kurzgeschichten im Stil des Feuilletons</p>
          </div>
          <div className="flex gap-4 text-xs uppercase tracking-wideish font-sans text-ink/70">
            <a
              className="hover:text-accent transition"
              href="/impressum"
              onClick={(e) => {
                e.preventDefault();
                navigate("/impressum");
              }}
            >
              Impressum
            </a>
            <a
              className="hover:text-accent transition"
              href="/datenschutz"
              onClick={(e) => {
                e.preventDefault();
                navigate("/datenschutz");
              }}
            >
              Datenschutz
            </a>
          </div>
        </div>
      </footer>
      {cookieBanner}
    </div>
  );
}

export default App;
