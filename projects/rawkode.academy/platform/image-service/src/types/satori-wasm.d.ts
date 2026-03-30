declare module "satori/wasm" {
  export interface SatoriFont {
    data: unknown;
    name: string;
    weight?: number;
    style?: "normal" | "italic";
  }

  export interface SatoriOptions {
    width: number;
    height: number;
    fonts: SatoriFont[];
  }

  export function init(yoga: unknown): void;
  export default function satori(
    element: unknown,
    options: SatoriOptions,
  ): Promise<string>;
}
