function PanelPlaceholder({ title, description }) {
  return (
    <section className="panel-placeholder">
      <p className="dashboard-breadcrumb">PAINEL - Em construcao</p>
      <h1>
        {title}
        <span>.</span>
      </h1>
      <p>{description}</p>
    </section>
  )
}

export default PanelPlaceholder
