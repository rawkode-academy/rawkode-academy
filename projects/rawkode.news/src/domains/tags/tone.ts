export type TagToneStrength = "soft" | "strong";

const normalize = (slug: string) => slug.trim().toLowerCase();

export const getTagToneClass = (slug: string, strength: TagToneStrength = "soft") => {
  const key = normalize(slug);
  if (key === "news") {
    return strength === "strong" ? "rkn-tag-tone-news" : "rkn-tag-tone-news-soft";
  }
  if (key === "ask") {
    return strength === "strong" ? "rkn-tag-tone-ask" : "rkn-tag-tone-ask-soft";
  }
  if (key === "show") {
    return strength === "strong" ? "rkn-tag-tone-show" : "rkn-tag-tone-show-soft";
  }
  if (key === "rka") {
    return strength === "strong" ? "rkn-tag-tone-rka" : "rkn-tag-tone-rka-soft";
  }
  return "";
};
