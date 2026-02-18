import { RKA_ALLOWED_NAMES } from "astro:env/server";
import { postCategories, type PostCategory } from "@/components/app-data";

type UserIdentity = {
  name?: string | null;
  email?: string | null;
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const getAllowlist = () =>
  new Set(
    RKA_ALLOWED_NAMES.split(",")
      .map((name: string) => normalize(name))
      .filter((name: string) => Boolean(name)),
  );

export type Permissions = {
  canSubmitRka: boolean;
  allowedCategories: PostCategory[];
};

export const getPermissions = (user: UserIdentity): Permissions => {
  const allowlist = getAllowlist();
  const nameToken = normalize(user.name);
  const canSubmitRka = allowlist.has(nameToken);

  return {
    canSubmitRka,
    allowedCategories: postCategories.filter(
      (category) => category !== "rka" || canSubmitRka,
    ),
  };
};
