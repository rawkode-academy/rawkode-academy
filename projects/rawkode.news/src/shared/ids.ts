import { createId, isCuid } from "@paralleldrive/cuid2";

export const createEntityId = () => createId();

export const isSupportedEntityId = (value: string) => isCuid(value);

export const parseEntityId = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return isSupportedEntityId(trimmed) ? trimmed : null;
};
