import { getPatternStyles, patternFns } from '../helpers.mjs';
import { css } from '../css/index.mjs';

const stackConfig = {
transform(props) {
  const { direction = "column", gap = "4" } = props;
  return {
    display: "flex",
    flexDirection: direction,
    gap
  };
},
defaultValues:{direction:'column',gap:'10px'}}

export const getStackStyle = (styles = {}) => {
  const _styles = getPatternStyles(stackConfig, styles)
  return stackConfig.transform(_styles, patternFns)
}

export const stack = (styles) => css(getStackStyle(styles))
stack.raw = getStackStyle