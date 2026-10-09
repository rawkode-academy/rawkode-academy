import { elsewhere } from '../links'

export function QuickLinksWidget() {
	return (
		<section className="academy-widget" aria-label="Elsewhere">
			<header className="academy-widget__header">
				<h2 className="academy-widget__title">Elsewhere</h2>
			</header>
			<ul className="academy-links">
				{elsewhere.map(link => {
					const external = link.href.startsWith('https://')
					return (
						<li key={link.href}>
							<a href={link.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
								<span className="academy-links__label">{link.label}</span>
								<span className="academy-links__description">{link.description}</span>
								{external ? <span className="academy-visually-hidden"> (opens in a new tab)</span> : null}
							</a>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
