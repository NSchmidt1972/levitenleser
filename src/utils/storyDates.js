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

export const parseStoryDate = (value) => {
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
