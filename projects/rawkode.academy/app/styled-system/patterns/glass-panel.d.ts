/* eslint-disable */
import type { SystemStyleObject, ConditionalValue } from '../types/index';
import type { Properties } from '../types/csstype';
import type { SystemProperties } from '../types/style-props';
import type { DistributiveOmit } from '../types/system-types';
import type { Tokens } from '../tokens/index';

export interface GlassPanelProperties {
   
}


interface GlassPanelStyles extends GlassPanelProperties, DistributiveOmit<SystemStyleObject, keyof GlassPanelProperties > {}

interface GlassPanelPatternFn {
  (styles?: GlassPanelStyles): string
  raw: (styles?: GlassPanelStyles) => SystemStyleObject
}

/**
 * Glass morphism panel


 */
export declare const glassPanel: GlassPanelPatternFn;
