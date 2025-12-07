import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const initialStory = {
  title: "",
  slug: "",
  date: "",
  read_time: "",
  tag: "",
  excerpt: "",
  body: "",
  author: ""
};

const readTimeOptions = ["3 Min", "4 Min", "5 Min", "6 Min", "7 Min", "8 Min", "10 Min", "12 Min"];
const tagOptions = [
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

const formatDateHuman = (value) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(value);

const monthLookup = {
  januar: 0,
  februar: 1,
  maerz: 2,
  märz: 2,
  april: 3,
  mai: 4,
  juni: 5,
  juli: 6,
  august: 7,
  september: 8,
  oktober: 9,
  november: 10,
  dezember: 11
};

const parseDateValue = (value) => {
  if (!value) return null;
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const numericMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (numericMatch) {
    const [, d, m, y] = numericMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const longMatch = trimmed.match(/^(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜß]+)\s+(\d{4})$/);
  if (longMatch) {
    const [, d, monthRaw, y] = longMatch;
    const key = monthRaw.toLowerCase();
    const asciiKey = key.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
    const monthIndex = monthLookup[key] ?? monthLookup[asciiKey];
    if (typeof monthIndex === "number") {
      return new Date(Number(y), monthIndex, Number(d));
    }
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
};

const toIsoDate = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDatePickerValue = (value) => {
  const parsed = parseDateValue(value);
  return parsed ? toIsoDate(parsed) : "";
};

const normalizeDateInput = (value) => {
  const parsed = parseDateValue(value);
  if (parsed) return formatDateHuman(parsed);
  return value.trim();
};

const normalizeReadTime = (value) => {
  if (!value) return "";
  const match = value.match(/(\d+)\s*/);
  if (match) return `${match[1]} Min`;
  return value.trim();
};

const AdminPanel = ({ onStoryCreated }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [story, setStory] = useState(initialStory);
  const [stories, setStories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [auth, setAuth] = useState({ email: "", password: "", name: "" });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  const fetchStories = useCallback(async () => {
    if (!supabase) return;
    const selectStories = (withSlug) =>
      supabase
        .from("stories")
        .select(
          withSlug
            ? "id, title, slug, category, date, read_time, tag, excerpt, body, author, comments_count:comments(count)"
            : "id, title, category, date, read_time, tag, excerpt, body, author, comments_count:comments(count)"
        )
        .order("date", { ascending: false });

    let data;
    let err;
    ({ data, error: err } = await selectStories(true));
    if (err && err.message && err.message.toLowerCase().includes("slug")) {
      ({ data, error: err } = await selectStories(false));
      if (!err) {
        setError("Hinweis: Spalte slug fehlt in Supabase. Bitte Migration ausführen.");
      }
    }
    if (err) {
      setError("Konnte Stories nicht laden.");
      return;
    }
    setStories(data || []);
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories, session]);

  useEffect(() => {
    if (session?.user) {
      const metaName = session.user.user_metadata?.name || session.user.user_metadata?.full_name;
      setStory((prev) => ({ ...prev, author: prev.author || metaName || session.user.email }));
    }
  }, [session]);

  const handleAuth = async () => {
    if (!supabase) {
      setError("Supabase ist nicht konfiguriert.");
      return;
    }
    const normalizedEmail = auth.email.trim().toLowerCase();
    const password = auth.password;
    const providedName = auth.name.trim();
    setLoading(true);
    setError("");
    setMessage("");

    let allowlistName = "";
    if (authMode === "signup") {
      const { data: allow, error: allowErr } = await supabase
        .from("cms_autoren_allowlist")
        .select("email, name")
        .eq("email", normalizedEmail)
        .limit(1)
        .maybeSingle();
      if (allowErr) {
        setError("Konnte Allowlist nicht prüfen. Bitte später erneut versuchen.");
        setLoading(false);
        return;
      }
      if (!allow) {
        setError("Diese E-Mail ist nicht für das CMS freigeschaltet.");
        setLoading(false);
        return;
      }
      allowlistName = allow.name || "";
    }

    if (authMode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { name: providedName || allowlistName } }
      });
      if (err) {
        setError(err.message);
      } else {
        setMessage("Registrierung erfolgreich. Bitte E-Mail prüfen.");
      }
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (err) {
        setError(err.message);
      } else {
        const loggedInUser = data.session?.user;
        // Falls Name mitgegeben, einmalig in die User-Metadaten schreiben.
        if (loggedInUser && providedName) {
          await supabase.auth.updateUser({ data: { name: providedName } });
        }
        setMessage("Eingeloggt.");
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setEditingId(null);
    setStory(initialStory);
    setAuth({ email: "", password: "", name: "" });
  };

  const handleSelectStory = (s) => {
    setEditingId(s.id);
    setStory({
      title: s.title || "",
      slug: s.slug || "",
      date: s.date || "",
      read_time: s.read_time || "",
      tag: s.tag || "",
      excerpt: s.excerpt || "",
      body: s.body || "",
      author: s.author || session?.user?.email || ""
    });
    setMessage("");
    setError("");
  };

  const handleDelete = async (id) => {
    if (!supabase) return;
    const ok = window.confirm("Wirklich löschen? Dies kann nicht rückgängig gemacht werden.");
    if (!ok) return;
    setLoading(true);
    setError("");
    setMessage("");
    const { error: err } = await supabase.from("stories").delete().eq("id", id);
    if (err) {
      setError(err.message);
    } else {
      if (editingId === id) {
        setEditingId(null);
        setStory({ ...initialStory, author: session?.user?.email || "" });
      }
      await fetchStories();
      setMessage("Geschichte gelöscht.");
    }
    setLoading(false);
  };

const ensureUniqueSlug = async (baseSlug, currentId = null) => {
  let candidate = baseSlug || "geschichte";
  if (candidate.startsWith("-")) {
    candidate = candidate.replace(/^-+/, "");
  }
    let counter = 1;
    while (true) {
      const { data, error: lookupError } = await supabase
        .from("stories")
        .select("id")
        .eq("slug", candidate)
        .limit(1)
        .maybeSingle();
      if (lookupError && lookupError.code !== "PGRST116") {
        throw new Error(lookupError.message);
      }
      if (!data || data.id === currentId) return candidate;
      candidate = `${baseSlug}-${counter}`;
      counter += 1;
      if (counter > 50) throw new Error("Konnte keinen eindeutigen Slug erzeugen.");
    }
  };

  const handleSave = async () => {
    const metaName = session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name;
    const authorValue = story.author || metaName || session?.user?.email || "";
    if (!supabase) {
      setError("Supabase ist nicht konfiguriert.");
      return;
    }
    if (!story.title || !story.date || !story.excerpt) {
      setError("Titel, Datum und Excerpt sind Pflicht.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    const baseSlug = slugify(story.slug || story.title);
    let finalSlug = "";
    try {
      finalSlug = await ensureUniqueSlug(baseSlug, editingId);
    } catch (slugErr) {
      setError(slugErr.message || "Konnte Slug nicht bestimmen.");
      setLoading(false);
      return;
    }

    const payload = {
      title: story.title,
      slug: finalSlug,
      category: "Feuilleton",
      date: story.date,
      read_time: story.read_time,
      tag: story.tag,
      excerpt: story.excerpt,
      body: story.body,
      author: authorValue
    };
    let newStoryId = null;

    const { error: err, data: insertData } = editingId
      ? await supabase.from("stories").update(payload).eq("id", editingId)
      : await supabase.from("stories").insert(payload).select("id").single();

    if (err) {
      if (err.message && err.message.toLowerCase().includes("slug")) {
        setError("Supabase-Spalte slug fehlt. Bitte Migration ausführen (siehe Anleitung).");
      } else {
        setError(err.message);
      }
      setLoading(false);
      return;
    }

    if (!editingId) {
      newStoryId = insertData?.id || null;
    }

    // Optional: Newsletter-Trigger via Edge Function
    if (newStoryId) {
      const { error: fnError } = await supabase.functions.invoke("send-newsletter", {
        body: { storyId: newStoryId }
      });
      if (fnError) {
        setMessage("Gespeichert, aber Newsletter-Versand konnte nicht angestoßen werden.");
      }
    }

    setMessage(editingId ? "Geschichte aktualisiert." : "Geschichte gespeichert.");
    setStory({ ...initialStory, author: session?.user?.email || "" });
    setEditingId(null);
    await fetchStories();
    onStoryCreated?.(); // refresh list in main view so the new story appears
    setLoading(false);
  };

  if (!supabase) {
    return (
      <div className="p-6 border border-stone bg-white">
        <p className="text-sm text-accent">Supabase-Umgebungsvariablen fehlen. Bitte .env.local setzen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <p className="text-xs uppercase tracking-wideish font-sans text-ink/70">CMS · Supabase</p>
        {session ? (
          <span className="text-xs text-ink/70">Eingeloggt</span>
        ) : (
          <span className="text-xs text-ink/50">Nicht angemeldet</span>
        )}
      </div>

      {!session ? (
        <div className="space-y-4 border border-stone bg-white p-5">
          <div className="flex gap-4 text-xs uppercase tracking-wideish font-sans">
            <button
              className={`px-3 py-1 border ${authMode === "signin" ? "border-ink bg-ink text-white" : "border-ink/20"}`}
              onClick={() => setAuthMode("signin")}
              type="button"
            >
              Anmelden
            </button>
            <button
              className={`px-3 py-1 border ${
                authMode === "signup" ? "border-ink bg-ink text-white" : "border-ink/20"
              }`}
              onClick={() => setAuthMode("signup")}
              type="button"
            >
              Registrieren
            </button>
          </div>
          <div className="grid gap-3">
            <input
              className="border border-ink/20 px-3 py-2 bg-parchment"
              type="email"
              placeholder="editor@example.com"
              value={auth.email}
              onChange={(e) => setAuth((prev) => ({ ...prev, email: e.target.value }))}
              autoComplete="email"
            />
            <input
              className="border border-ink/20 px-3 py-2 bg-parchment"
              type="password"
              placeholder="Passwort"
              value={auth.password}
              onChange={(e) => setAuth((prev) => ({ ...prev, password: e.target.value }))}
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            />
            {authMode === "signup" ? (
              <input
                className="border border-ink/20 px-3 py-2 bg-parchment"
                type="text"
                placeholder="Name (für Autor)"
                value={auth.name}
                onChange={(e) => setAuth((prev) => ({ ...prev, name: e.target.value }))}
                autoComplete="name"
              />
            ) : null}
            <button
              type="button"
              onClick={handleAuth}
              className="inline-flex items-center justify-center px-4 py-2 bg-ink text-white text-xs uppercase tracking-wideish hover:bg-accent transition disabled:opacity-60"
              disabled={loading}
            >
              {authMode === "signup" ? "Registrieren" : "Einloggen"}
            </button>
            <p className="text-[11px] text-ink/60">
              Registrierung funktioniert nur, wenn E-Mail/Passwort in Supabase Auth aktiviert ist. Alternativ in Supabase
              Studio einen User anlegen und hier nur einloggen.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
      <div className="flex items-center justify-between border border-stone border-l-4 border-l-ink/60 bg-white p-4 rounded shadow-editorial">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wideish text-ink/70">Angemeldet als</p>
          <p className="text-sm text-ink/80">{session.user.email}</p>
        </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs uppercase tracking-wideish text-ink/70 hover:text-accent"
            >
              Abmelden
            </button>
          </div>
          <div className="space-y-4 border border-stone bg-white p-5">
            <h4 className="font-serif text-xl">Neue Geschichte</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                className="border border-ink/20 px-3 py-2 bg-parchment"
                placeholder="Titel"
                value={story.title}
                onChange={(e) => setStory((s) => ({ ...s, title: e.target.value }))}
              />
              <input
                className="border border-ink/20 px-3 py-2 bg-parchment"
                placeholder="Slug (URL, wird automatisch erzeugt)"
                value={story.slug}
                onChange={(e) => setStory((s) => ({ ...s, slug: slugify(e.target.value) }))}
              />
              <input
                className="border border-ink/20 px-3 py-2 bg-parchment"
                type="date"
                value={getDatePickerValue(story.date)}
                onChange={(e) => setStory((s) => ({ ...s, date: normalizeDateInput(e.target.value) }))}
              />
              <input
                className="border border-ink/20 px-3 py-2 bg-parchment"
                placeholder="Lesedauer (z.B. 8 Min)"
                list="readtime-options"
                value={story.read_time}
                onChange={(e) => setStory((s) => ({ ...s, read_time: normalizeReadTime(e.target.value) }))}
              />
              <input
                className="border border-ink/20 px-3 py-2 bg-parchment"
                placeholder="Tag/Badge"
                list="tag-options"
                value={story.tag}
                onChange={(e) => setStory((s) => ({ ...s, tag: e.target.value }))}
              />
              <input
                className="border border-ink/20 px-3 py-2 bg-parchment"
                placeholder="Autor (voreingestellt: angemeldeter User)"
                value={story.author}
                onChange={(e) => setStory((s) => ({ ...s, author: e.target.value }))}
              />
            </div>
            <datalist id="readtime-options">
              {readTimeOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <datalist id="tag-options">
              {tagOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <textarea
              className="border border-ink/20 px-3 py-2 bg-parchment w-full min-h-[100px]"
              placeholder="Kurz-Excerpt fürs Listing"
              value={story.excerpt}
              onChange={(e) => setStory((s) => ({ ...s, excerpt: e.target.value }))}
            />
            <textarea
              className="border border-ink/20 px-3 py-2 bg-parchment w-full min-h-[180px]"
              placeholder="Body (voller Text, Markdown möglich)"
              value={story.body}
              onChange={(e) => setStory((s) => ({ ...s, body: e.target.value }))}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center px-4 py-2 bg-ink text-white text-xs uppercase tracking-wideish hover:bg-accent transition disabled:opacity-60"
                disabled={loading}
              >
                {editingId ? "Aktualisieren" : "Speichern"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setStory({ ...initialStory, author: session?.user?.email || "" });
                    setMessage("");
                    setError("");
                  }}
                  className="text-xs uppercase tracking-wideish text-ink/70 hover:text-accent"
                >
                  Abbrechen
                </button>
              ) : null}
            </div>
            {message ? <p className="text-sm text-ink/70">{message}</p> : null}
            {error ? <p className="text-sm text-accent">{error}</p> : null}
            <div className="space-y-3 border border-ink/10 bg-parchment/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wideish text-ink/70">Bestehende Geschichten</p>
                <span className="text-[11px] text-ink/60">{stories.length} Einträge</span>
              </div>
              {stories.length === 0 ? (
                <p className="text-sm text-ink/60">Noch keine Stories gespeichert.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {stories.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 border border-ink/10 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-serif truncate">{item.title}</p>
                        <p className="text-[11px] text-ink/60">
                          {item.date} · {item.author || "Autor fehlt"}
                          {typeof item.comments_count?.[0]?.count === "number"
                            ? ` · ${item.comments_count[0].count} Kommentare`
                            : ""}
                        </p>
                        {item.slug ? (
                          <p className="text-[11px] text-ink/50 truncate">/stories/{item.slug}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="text-xs uppercase tracking-wideish text-ink/70 hover:text-accent"
                          onClick={() => handleSelectStory(item)}
                        >
                          Bearbeiten
                        </button>
                        <span className="w-px h-4 bg-ink/15" />
                        <button
                          type="button"
                          className="text-xs uppercase tracking-wideish text-accent hover:text-ink"
                          onClick={() => handleDelete(item.id)}
                          disabled={loading}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
