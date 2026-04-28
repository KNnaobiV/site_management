export default function DashboardPage() {
  return (
    <div className="page-panel">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your projects, sites, and current activity.</p>
      </div>

      <section className="dashboard-grid">
        <div className="card">
          <h2>Projects</h2>
          <p>View and manage your current projects.</p>
        </div>

        <div className="card">
          <h2>Sites</h2>
          <p>Navigate to site details and work items.</p>
        </div>

        <div className="card">
          <h2>Invitations</h2>
          <p>Accept or decline pending team invites.</p>
        </div>
      </section>
    </div>
  )
}