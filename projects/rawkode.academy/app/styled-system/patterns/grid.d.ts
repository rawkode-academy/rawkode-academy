/* eslint-disable */
import type { SystemStyleObject, ConditionalValue } from '../types/index';
import type { Properties } from '../types/csstype';
import type { SystemProperties } from '../types/style-props';
import type { DistributiveOmit } from '../types/system-types';
import type { Tokens } from '../tokens/index';

export interface GridProperties {
   columnGap?: SystemProperties["gap"]
	rowGap?: SystemProperties["gap"]
	minChildWidth?: ConditionalValue<Tokens["sizes"] | Properties["width"]>
	columns?: ConditionalValue<number>
	gap?: ConditionalValue<Tokens["spacing"]>
}


interface GridStyles extends GridProperties, DistributiveOmit<SystemStyleObject, keyof GridProperties > {}

interface GridPatternFn {
  (styles?: GridStyles): string
  raw: (styles?: GridStyles) => SystemStyleObject
}

/**
 * Responsive grid layout


 */
export declare const grid: GridPatternFn;
