import { getPatternStyles, patternFns } from '../helpers.mjs';
import { css } from '../css/index.mjs';

const gridConfig = {
transform(props) {
  const { columns = 1, gap = "4" } = props;
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap
  };
},
defaultValues(props) {
  return { gap: props.columnGap || props.rowGap ? void 0 : "10px" };
}}

export const getGridStyle = (styles = {}) => {
  const _styles = getPatternStyles(gridConfig, styles)
  return gridConfig.transform(_styles, patternFns)
}

export const grid = (styles) => css(getGridStyle(styles))
grid.raw = getGridStyle