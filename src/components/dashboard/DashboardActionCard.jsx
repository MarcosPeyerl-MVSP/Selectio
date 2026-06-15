import { Link } from 'react-router-dom'

function DashboardActionCard({ icon: Icon, title, description, to, action, dataTour }) {
  return (
    <div className="dashboard-card" data-tour={dataTour}>
      <Icon className="dashboard-card-icon" />
      <h3>{title}</h3>
      <p>{description}</p>
      <Link to={to}>{action} {'->'}</Link>
    </div>
  )
}

export default DashboardActionCard
