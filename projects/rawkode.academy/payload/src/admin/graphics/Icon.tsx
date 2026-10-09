import { monogramPaths, monogramViewBox } from './paths'

// Nav and favicon-sized mark. currentColor follows the admin theme.
export function Icon() {
	return (
		<svg className="academy-icon" viewBox={monogramViewBox} width="24" height="24" role="img" aria-label="Rawkode Academy" fill="currentColor">
			{monogramPaths.map(d => (
				<path key={d} d={d} />
			))}
		</svg>
	)
}
