const reviewUrl = 'https://preview.rawkode.academy/review'

export default function Page() {
  return (
    <main className="portal">
      <header className="portal-header">
        <a className="wordmark" href="/" aria-label="Rawkode Academy home">
          <span className="wordmark-mark" aria-hidden="true">R</span>
          <span>RAWKODE <strong>ACADEMY</strong></span>
        </a>
        <nav className="portal-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a className="nav-sign-in" href={reviewUrl}>Sign in <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Private video review</p>
          <h1 id="hero-title">Your next cut, <em>together.</em></h1>
          <p className="hero-lede">A calm, private space to watch your video, leave precise feedback, and approve the final version for publication.</p>
          <div className="hero-actions">
            <a className="button button-light" href={reviewUrl}>Open your review room <span aria-hidden="true">→</span></a>
            <span className="hero-note">For invited Academy customers</span>
          </div>
        </div>

        <div className="review-card" aria-label="Illustration of a video review">
          <div className="review-card-topline">
            <span className="mini-brand"><span aria-hidden="true">R</span> REVIEW ROOM</span>
            <span className="live-dot"><i aria-hidden="true" /> Private</span>
          </div>
          <div className="video-frame">
            <div className="video-glow" />
            <div className="video-title">A better way to<br /><strong>ship the story.</strong></div>
            <span className="play-button" aria-hidden="true">▶</span>
            <span className="frame-label">01:24 / 08:42</span>
          </div>
          <div className="timeline" aria-hidden="true">
            <span className="timeline-progress" />
            <b className="timeline-marker marker-one" />
            <b className="timeline-marker marker-two" />
            <b className="timeline-marker marker-three" />
          </div>
          <div className="review-card-footer">
            <div><strong>Latest revision</strong><span>3 comments · 1 open</span></div>
            <span className="approval-badge">Needs review</span>
          </div>
        </div>
      </section>

      <section className="trust-row" aria-label="Review room benefits">
        <div><span className="trust-icon">✦</span><div><strong>Private by default</strong><span>Only invited accounts can view</span></div></div>
        <div><span className="trust-icon">⌁</span><div><strong>Feedback in context</strong><span>Comments stay with the exact moment</span></div></div>
        <div><span className="trust-icon">✓</span><div><strong>Clear approval</strong><span>One decision before publication</span></div></div>
      </section>

      <section className="intro-section" id="how-it-works" aria-labelledby="intro-title">
        <div className="section-heading">
          <p className="eyebrow">A better handoff</p>
          <h2 id="intro-title">Less back-and-forth.<br /><em>Better work.</em></h2>
        </div>
        <div className="feature-grid">
          <article className="feature-card feature-card-dark">
            <span className="feature-number">01</span>
            <h3>Watch the cut</h3>
            <p>Open a private video delivered for your project, wherever you are, on any device.</p>
          </article>
          <article className="feature-card">
            <span className="feature-number">02</span>
            <h3>Mark the moment</h3>
            <p>Leave a note at an exact timestamp so every suggestion is clear to the editing team.</p>
          </article>
          <article className="feature-card">
            <span className="feature-number">03</span>
            <h3>Approve with confidence</h3>
            <p>When the revision is right, approve it once. The approved version becomes the source for publication.</p>
          </article>
        </div>
      </section>

      <section className="closing-card" aria-labelledby="closing-title">
        <div>
          <p className="eyebrow">Ready when you are</p>
          <h2 id="closing-title">Your review is waiting.</h2>
          <p>Sign in with the Academy account that received your invitation.</p>
        </div>
        <a className="button button-accent" href={reviewUrl}>Sign in to continue <span aria-hidden="true">→</span></a>
      </section>

      <footer className="portal-footer">
        <span>RAWKODE ACADEMY</span>
        <span>Private customer portal</span>
      </footer>
    </main>
  )
}
