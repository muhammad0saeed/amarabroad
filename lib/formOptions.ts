// Options for the profile form (Match and Profile pages), loaded on the server.

import type { ProfileFormOptions } from "@/components/profile/ProfileForm";
import { listCountries, listDegreeMappings, listFields, listPrograms } from "./data";

export async function getProfileFormOptions(): Promise<ProfileFormOptions> {
  const [degrees, fields, programs, countries] = await Promise.all([listDegreeMappings(), listFields(), listPrograms(), listCountries()]);
  return {
    degrees,
    fields: fields.map(({ slug, name_en, name_bn }) => ({ slug, name_en, name_bn })),
    programFields: [...new Set(programs.map((p) => p.field))],
    countries: countries.map(({ slug, name_en, name_bn }) => ({ slug, name_en, name_bn })),
  };
}
