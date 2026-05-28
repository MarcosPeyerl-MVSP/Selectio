import { Link } from 'react-router-dom'

function DashboardActionCard({ icon: Icon, title, description, to, action }) {
  return (
    <div className="dashboard-card">
      <Icon className="dashboard-card-icon" />
      <h3>{title}</h3>
      <p>{description}</p>
      <Link to={to}>{action} {'->'}</Link>
    </div>
  )
}

export default DashboardActionCard
