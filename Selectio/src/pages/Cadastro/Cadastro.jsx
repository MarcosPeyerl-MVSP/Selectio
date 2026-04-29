import './Cadastro.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { Link } from 'react-router-dom'

function Cadastro() {
  return (
    <>
      <Navbar />

      <main className="cadastro-container">
        <div className="cadastro-header">
          <span className="tag center">BEM-VINDO À SELECTIO · NOVA CONTA</span>
          <h1>Qual cadastro irá fazer?</h1>
          <p>
            Escolha o perfil que melhor se adapta às suas necessidades e
            comece a transformar o ecossistema de recrutamento conosco.
          </p>
        </div>

        <div className="cadastro-cards">
          <div className="cadastro-card">
            <h2>Cadastro de Empresa</h2>
            <p>
              Poste vagas e encontre os melhores talentos através de curadoria
              inteligente e análise técnica humanizada.
            </p>

            <ul>
              <li>Acesso a banco de talentos pré-avaliados</li>
              <li>Gestão simplificada de candidaturas</li>
            </ul>

            <button>Começar</button>
          </div>

          <div className="cadastro-card">
            <h2>Cadastro de Indicador</h2>
            <p>
              Indique talentos da sua rede e seja recompensado por
              contratações bem-sucedidas. Transforme seu networking em valor.
            </p>

            <ul>
              <li>Monetize suas indicações profissionais</li>
              <li>Dashboard de acompanhamento em tempo real</li>
            </ul>
            <Link className="btn-primary" to={"/cadastro/indicador"}>Começar</Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}

export default Cadastro
