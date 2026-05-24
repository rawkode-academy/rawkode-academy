export interface ImageServicePayload {
  format: "png";
  title: string;
  subtitle?: string | undefined;
  text?: string | undefined;
  template?: string | undefined;
  image?: string | undefined;
}
