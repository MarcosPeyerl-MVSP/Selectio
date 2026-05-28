// Objetivo do arquivo: renderizar a página de escolha do tipo de cadastro.
// A página permite que o usuário selecione entre cadastro de empresa ou cadastro de indicador.

import './Cadastro.css'
import Navbar from '../../components/Navbar/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { Link } from 'react-router-dom'

function Cadastro() {
  return (
    <>
      {/* Componente de navegação principal da aplicação. */}
      <Navbar />

      {/* Container principal da página de seleção de cadastro. */}
      <main className="cadastro-container">
        {/* Cabeçalho com título e descrição da finalidade da página. */}
        <div className="cadastro-header">
          <span className="tag center">BEM-VINDO À SELECTIO · NOVA CONTA</span>
          <h1>Qual cadastro irá fazer?</h1>
          <p>
            Escolha o perfil que melhor se adapta às suas necessidades e
            comece a transformar o ecossistema de recrutamento conosco.
          </p>
        </div>

        {/* Área com os dois tipos de cadastro disponíveis. */}
        <div className="cadastro-cards">
          {/* Card que direciona para o cadastro de empresa. */}
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

            {/* Rota interna para o formulário de cadastro de empresa. */}
            <Link className="btn-primary" to={"/cadastro/empresa"}>Começar</Link>
          </div>

          {/* Card que direciona para o cadastro de indicador. */}
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

            {/* Rota interna para o formulário de cadastro de indicador. */}
            <Link className="btn-primary" to={"/cadastro/indicador"}>Começar</Link>
          </div>
        </div>
      </main>

      {/* Componente de rodapé da aplicação. */}
      <Footer />
    </>
  )
}

export default Cadastro
