import * as path from "path";
import * as url from "url";

export const getSourceDir = (fileUrl: string): string => {
  return path.dirname(url.fileURLToPath(fileUrl));
};
