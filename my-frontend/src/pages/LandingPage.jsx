export default function LandingPage() {
  return (
    <div className="landing-shell">
      <div className="landing-hero">
        <div className="landing-brand">Build<span>Track</span></div>
        <h1 className="landing-title">Welcome to BuildTrack</h1>
        <p className="landing-subtitle">
          Construction management made simple. Track projects, sites, work items, and reports—all in one place for your team.
        </p>
        <div className="landing-cta">
          <a href="/register" className="btn btn-primary btn-lg">Get Started</a>
          <a href="/login" className="btn btn-secondary btn-lg">Sign In</a>
        </div>
      </div>
      <div className="landing-features">
        <div className="feature-card">
          <h3>Project Tracking</h3>
          <p>Monitor progress across multiple sites and teams.</p>
        </div>
        <div className="feature-card">
          <h3>Daily Reports</h3>
          <p>Streamline reporting with easy-to-use tools.</p>
        </div>
        <div className="feature-card">
          <h3>Team Collaboration</h3>
          <p>Invite members and manage permissions seamlessly.</p>
        </div>
      </div>
    </div>
  )
}