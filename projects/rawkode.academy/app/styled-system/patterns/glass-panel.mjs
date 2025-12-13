import { getPatternStyles, patternFns } from '../helpers.mjs';
import { css } from '../css/index.mjs';

const glassPanelConfig = {
transform() {
  return {
    backgroundColor: "surface.card",
    backdropFilter: "blur(24px)",
    borderRadius: "xl",
    border: "1px solid",
    borderColor: "surface.border"
  };
}}

export const getGlassPanelStyle = (styles = {}) => {
  const _styles = getPatternStyles(glassPanelConfig, styles)
  return glassPanelConfig.transform(_styles, patternFns)
}

export const glassPanel = (styles) => css(getGlassPanelStyle(styles))
glassPanel.raw = getGlassPanelStyle