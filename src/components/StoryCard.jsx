const StoryCard = ({ story, highlight = false, onOpen }) => {
  const hasBody = !!(story.body && story.body.trim().length);
  const isClickable = hasBody && onOpen;
  const author = story.author && story.author.trim();
  const commentsInfo = story.comments_count;
  const wordCount = story.body
    ? story.body
        .replace(/<[^>]+>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
    : 0;

  return (
    <article
      className={`group relative overflow-hidden border border-stone bg-white transition hover:-translate-y-1 hover:shadow-editorial ${
        highlight ? "md:col-span-2" : ""
      } ${isClickable ? "cursor-pointer" : ""}`}
      onClick={isClickable ? () => onOpen(story) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(story);
              }
            }
          : undefined
      }
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white opacity-0 transition group-hover:opacity-100" />
      <div className="p-6 sm:p-8 space-y-4 relative">
        <div className="flex items-center gap-3 text-xs uppercase tracking-wideish text-ink/70 font-sans">
          <span className="h-px flex-1 bg-ink/20" />
          <span className="inline-flex items-center gap-1 px-3 py-1">{story.tag || story.category}</span>
          <span className="h-px flex-1 bg-ink/20" />
        </div>
        <h3 className="text-2xl font-serif leading-snug group-hover:text-accent transition">{story.title}</h3>
        <p className="text-sm font-sans text-ink/75 leading-relaxed dropcap">{story.excerpt}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wideish text-ink/70 font-sans">
          {author ? (
            <>
              <span className="text-[13px] tracking-normal normal-case font-serif italic text-ink/65">
                {author}
              </span>
              <span className="w-px h-4 bg-ink/30" />
            </>
          ) : null}
          <span>{story.date}</span>
          <span className="w-px h-4 bg-ink/30" />
          <span>{story.readTime}</span>
          {wordCount ? (
            <>
              <span className="w-px h-4 bg-ink/30" />
              <span className="text-ink/60">{`${wordCount} Wörter`}</span>
            </>
          ) : null}
          {typeof commentsInfo === "number" ? (
            <>
              <span className="w-px h-4 bg-ink/30" />
              <span className="text-ink/60">
                {commentsInfo === 1 ? "1 Kommentar" : `${commentsInfo} Kommentare`}
              </span>
            </>
          ) : null}
        </div>
        {hasBody && onOpen ? (
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(story);
              }}
              className="text-xs uppercase tracking-wideish text-white bg-ink hover:bg-accent px-3 py-1 transition"
            >
              Weiterlesen
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default StoryCard;
