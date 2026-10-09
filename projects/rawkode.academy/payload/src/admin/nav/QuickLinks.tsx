import { NavGroup } from '@payloadcms/ui'
import { elsewhere } from '../links'

export function QuickLinks() {
	return (
		<NavGroup label="Elsewhere">
			{elsewhere
				.filter(link => link.label !== 'Preview review')
				.map(link => {
					const external = link.href.startsWith('https://')
					return (
						<a key={link.href} className="nav__link academy-nav__link" href={link.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
							<span className="nav__link-label">{link.label}</span>
							{external ? (
								<>
									<span className="academy-external" aria-hidden="true">
										↗
									</span>
									<span className="academy-visually-hidden"> (opens in a new tab)</span>
								</>
							) : null}
						</a>
					)
				})}
		</NavGroup>
	)
}
