/* eslint-disable */
import type { ConditionalValue } from '../types/index';
import type { DistributiveOmit, Pretty } from '../types/system-types';

interface CardVariant {
  /**
 * @default true
 */
hover: boolean
/**
 * @default "md"
 */
padding: "none" | "sm" | "md" | "lg"
}

type CardVariantMap = {
  [key in keyof CardVariant]: Array<CardVariant[key]>
}

export type CardVariantProps = {
  [key in keyof CardVariant]?: ConditionalValue<CardVariant[key]> | undefined
}

export interface CardRecipe {
  __type: CardVariantProps
  (props?: CardVariantProps): string
  raw: (props?: CardVariantProps) => CardVariantProps
  variantMap: CardVariantMap
  variantKeys: Array<keyof CardVariant>
  splitVariantProps<Props extends CardVariantProps>(props: Props): [CardVariantProps, Pretty<DistributiveOmit<Props, keyof CardVariantProps>>]
  getVariantProps: (props?: CardVariantProps) => CardVariantProps
}


export declare const card: CardRecipe