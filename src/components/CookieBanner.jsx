function CookieBanner({ visible, onAccept, onReject, onNavigatePrivacy }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-4 sm:inset-x-auto sm:right-4 sm:max-w-md z-40">
      <div className="border border-stone bg-white/95 backdrop-blur-sm shadow-editorial p-4 space-y-3">
        <p className="text-xs uppercase tracking-wideish text-ink/70 font-sans">Cookies & Datenschutz</p>
        <p className="text-sm text-ink/80 font-sans leading-relaxed">
          Technisch notwendige Cookies speichern deine Entscheidung und den Newsletter-Eintrag. Optionale
          Besucherstatistik (Google Analytics 4 mit IP-Anonymisierung) laden wir nur nach Zustimmung.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center justify-center px-4 py-2 bg-ink text-white text-xs uppercase tracking-wideish hover:bg-accent transition"
          >
            Alles akzeptieren
          </button>
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center justify-center px-4 py-2 border border-ink/30 text-xs uppercase tracking-wideish text-ink hover:border-accent hover:text-accent transition bg-white"
          >
            Nur notwendige
          </button>
          <button
            type="button"
            onClick={onNavigatePrivacy}
            className="inline-flex items-center justify-center px-4 py-2 text-xs uppercase tracking-wideish text-ink/70 hover:text-accent underline underline-offset-4"
          >
            Mehr erfahren
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieBanner;
