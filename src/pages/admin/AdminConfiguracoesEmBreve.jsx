import './styles/AdminPages.css'

import { FaCog } from 'react-icons/fa'

function AdminConfiguracoesEmBreve() {
  return (
    <section className="admin-coming-soon">
      <FaCog />
      <h1>Configurações em breve</h1>
      <p>Taxas, administradores, e-mails transacionais e auditoria não fazem parte desta versão.</p>
    </section>
  )
}

export default AdminConfiguracoesEmBreve
