export interface ImageServicePayload {
  text: string;
  format: "svg" | "png";
  image: URL | undefined;
}
