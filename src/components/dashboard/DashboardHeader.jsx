function DashboardHeader({ eyebrow, greeting, name, description }) {
  return (
    <>
      <p className="dashboard-breadcrumb">{eyebrow}</p>

      <h1 className="dashboard-title">
        {greeting} <span>{name}</span>.
      </h1>

      <p className="dashboard-subtitle">{description}</p>
    </>
  )
}

export default DashboardHeader
