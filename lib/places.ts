// Links to a country or city: its guide page when the guide is written, otherwise its programs.
// (The robot creates places as it finds universities; their guides come later.)
type Place = { slug: string; has_guide?: boolean };

export const countryHref = (c: Place) => (c.has_guide === false ? `/programs?country=${c.slug}` : `/countries/${c.slug}`);
export const cityHref = (c: Place) => (c.has_guide === false ? `/programs?city=${c.slug}` : `/cities/${c.slug}`);
