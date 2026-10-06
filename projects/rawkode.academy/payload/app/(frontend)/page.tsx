const cmsUrl = '/admin'
const reviewUrl = 'https://preview.rawkode.academy/review'

export default function Page() {
  return (
    <main className="workspace">
      <header className="workspace-header">
        <a className="wordmark" href="/" aria-label="Rawkode Academy home">
          <span className="wordmark-mark" aria-hidden="true">R</span>
          <span>RAWKODE <strong>ACADEMY</strong></span>
        </a>
        <nav className="workspace-nav" aria-label="Main navigation">
          <a href="#workflows">Workflows</a>
          <a href={reviewUrl}>Customer review <span aria-hidden="true">↗</span></a>
          <a className="nav-action" href={cmsUrl}>Open CMS <span aria-hidden="true">→</span></a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Rawkode Academy CMS</p>
          <h1 id="hero-title">Everything behind the Academy, <em>in one place.</em></h1>
          <p className="hero-lede">Manage structured content, media, publishing, and customer review from a single, calm workspace.</p>
          <div className="hero-actions">
            <a className="button button-light" href={cmsUrl}>Open the CMS <span aria-hidden="true">→</span></a>
            <a className="text-link text-link-light" href={reviewUrl}>Go to customer review <span aria-hidden="true">↗</span></a>
          </div>
        </div>

        <div className="workspace-card" aria-label="Illustration of the Rawkode Academy content workspace">
          <div className="workspace-card-topline">
            <span className="mini-brand"><span aria-hidden="true">R</span> CONTENT WORKSPACE</span>
            <span className="workspace-status"><i aria-hidden="true" /> Operations</span>
          </div>
          <div className="workspace-card-body">
            <aside className="workspace-sidebar" aria-hidden="true">
              <span className="sidebar-label">Workspace</span>
              <strong>Rawkode Academy</strong>
              <span className="sidebar-item sidebar-item-active">Overview</span>
              <span className="sidebar-item">Content</span>
              <span className="sidebar-item">Media</span>
              <span className="sidebar-item">Review</span>
            </aside>
            <div className="workspace-main">
              <div className="workspace-heading">
                <div><span className="muted-label">Overview</span><strong>Content workspace</strong></div>
                <span className="date-label">Editorial operations</span>
              </div>
              <div className="workspace-metrics">
                <div><span>Catalogue</span><strong>Ready</strong><small>Structured content</small></div>
                <div><span>Review queue</span><strong>Open</strong><small>Media &amp; feedback</small></div>
              </div>
              <div className="workspace-list">
                <span className="muted-label">Recent activity</span>
                <div><i className="activity-dot activity-dot-accent" /><span>Customer review opened</span><small>Review</small></div>
                <div><i className="activity-dot" /><span>Content updated</span><small>Article</small></div>
                <div><i className="activity-dot activity-dot-soft" /><span>Media processed</span><small>Asset</small></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="capability-row" aria-label="Workspace capabilities">
        <div><span className="capability-icon">✦</span><div><strong>Structured content</strong><span>Keep the Academy catalogue coherent</span></div></div>
        <div><span className="capability-icon">⌁</span><div><strong>Media &amp; assets</strong><span>Bring the publishing pipeline together</span></div></div>
        <div><span className="capability-icon">✓</span><div><strong>Review &amp; publish</strong><span>Move work forward with confidence</span></div></div>
      </section>

      <section className="intro-section" id="workflows" aria-labelledby="intro-title">
        <div className="section-heading">
          <p className="eyebrow">One workspace, many workflows</p>
          <h2 id="intro-title">From first draft to <em>published.</em></h2>
        </div>
        <div className="feature-grid">
          <article className="feature-card feature-card-dark">
            <span className="feature-number">01</span>
            <h3>Build the catalogue</h3>
            <p>Shape articles, technologies, shows, seasons, and the rest of the Academy content model.</p>
          </article>
          <article className="feature-card">
            <span className="feature-number">02</span>
            <h3>Coordinate the work</h3>
            <p>Keep media, processing, customer feedback, and editorial decisions connected.</p>
          </article>
          <article className="feature-card">
            <span className="feature-number">03</span>
            <h3>Publish with confidence</h3>
            <p>Review changes, approve the right version, and make the finished work available.</p>
          </article>
        </div>
      </section>

      <section className="closing-card" aria-labelledby="closing-title">
        <div>
          <p className="eyebrow">Pick up where you left off</p>
          <h2 id="closing-title">Open the Academy workspace.</h2>
          <p>Staff can manage content in the CMS. Invited customers can open their private review room.</p>
        </div>
        <div className="closing-actions">
          <a className="button button-accent" href={cmsUrl}>Open the CMS <span aria-hidden="true">→</span></a>
          <a className="text-link" href={reviewUrl}>Customer review <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <footer className="workspace-footer">
        <span>RAWKODE ACADEMY CMS</span>
        <span>Content operations workspace</span>
      </footer>
    </main>
  )
}
