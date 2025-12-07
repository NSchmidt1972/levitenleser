const SectionTitle = ({ overline, title, kicker }) => (
  <div className="space-y-2">
    <p className="text-xs uppercase tracking-wideish text-ink/70 font-sans">{overline}</p>
    <h2 className="text-3xl md:text-4xl font-serif leading-tight">{title}</h2>
    {kicker ? <p className="text-sm text-ink/70 font-sans">{kicker}</p> : null}
  </div>
);

export default SectionTitle;
