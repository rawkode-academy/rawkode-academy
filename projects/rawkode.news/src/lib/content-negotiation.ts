const parseQuality = (value: string) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(0, Math.min(1, parsed));
};

export const acceptsAiHtml = (request: Request) => {
  const accept = request.headers.get("accept");
  if (!accept) {
    return false;
  }

  for (const rawPart of accept.split(",")) {
    const [mediaTypePart, ...params] = rawPart.split(";");
    const mediaType = mediaTypePart.trim().toLowerCase();
    if (mediaType !== "ai/html") {
      continue;
    }

    let quality = 1;
    for (const param of params) {
      const [rawKey, rawValue] = param.split("=");
      if (rawKey?.trim().toLowerCase() === "q") {
        quality = parseQuality(rawValue?.trim() ?? "1");
      }
    }

    if (quality > 0) {
      return true;
    }
  }

  return false;
};
