export const slugify = (text: string): string => {
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/["']+/gi, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}
