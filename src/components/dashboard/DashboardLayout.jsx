import './Dashboard.css'

import Navbar from '../layout/Navbar'
import Sidebar from '../layout/Sidebar'
import Footer from '../layout/Footer'

function DashboardLayout({ sidebarType, user, children }) {
  return (
    <>
      <Navbar />

      <div className="dashboard-shell">
        <Sidebar type={sidebarType} user={user} />

        <main className="dashboard-content">
          {children}
        </main>
      </div>

      <Footer />
    </>
  )
}

export default DashboardLayout
