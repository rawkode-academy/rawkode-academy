import { wordmarkPaths, wordmarkViewBox } from './paths'

// Login-screen wordmark with a CMS tag. currentColor follows the admin theme.
export function Logo() {
	return (
		<span className="academy-logo">
			<svg className="academy-logo__wordmark" viewBox={wordmarkViewBox} role="img" aria-label="Rawkode Academy" fill="currentColor">
				{wordmarkPaths.map(d => (
					<path key={d} d={d} />
				))}
			</svg>
			<span className="academy-logo__tag">CMS</span>
		</span>
	)
}
