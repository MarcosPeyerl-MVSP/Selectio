// Objetivo do arquivo: renderizar o painel central da empresa.
// A pagina valida a sessao da empresa, redireciona para login quando nao ha sessao
// e exibe as secoes internas de dashboard, perfil, configuracoes e entrevistas.

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./Painel.css";

import Navbar from "../../../components/Navbar/Navbar/Navbar";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Footer from "../../../components/Footer/Footer";
import AccountSettings from "../../../components/AccountSettings/AccountSettings";

import {
  FaUserTie,
  FaSuitcase,
  FaUserFriends,
  FaChartBar,
  FaCalendarAlt,
} from "react-icons/fa";

function PainelEmpresa() {
  // Hook usado para redirecionar a empresa quando nao ha sessao valida.
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeSection = searchParams.get("secao") || "dashboard";

  // Recupera a empresa autenticada salva no localStorage.
  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem("empresaUser");
    return storedEmpresa ? JSON.parse(storedEmpresa) : null;
  });

  useEffect(() => {
    // Regra de acesso: sem empresa autenticada, redireciona para login.
    if (!empresa) {
      navigate("/login");
    }
  }, [empresa, navigate]);

  // Evita renderizar o painel enquanto nao ha empresa autenticada.
  if (!empresa) {
    return null;
  }

  return (
    <>
      {/* Componente de navegacao principal. */}
      <Navbar />

      <div className="painel-container">
        {/* Menu lateral do painel da empresa. */}
        <Sidebar type="empresa" user={empresa} />

        <main className="painel-content">
          {activeSection === "configuracoes" ? (
            <AccountSettings user={empresa} tipo="empresa" />
          ) : activeSection === "perfil" ? (
            <PanelPlaceholder
              title="Perfil da empresa"
              description="Esta area sera liberada em uma proxima etapa. Por enquanto, os dados de acesso ficam em Configuracoes."
            />
          ) : activeSection === "entrevistas" ? (
            <PanelPlaceholder
              title="Entrevistas"
              description="A organizacao de entrevistas continuara dentro deste painel quando a funcionalidade estiver pronta."
            />
          ) : (
            <>
              <p className="breadcrumb">BOAS-VINDAS - Painel Central</p>

              <h1>
                Bem-vinda, <span>{empresa.nomeEmpresa}.</span>
              </h1>

              <p className="subtitle">
                Gerencie suas vagas, explore novas oportunidades e acompanhe seu crescimento em um so lugar.
              </p>

              {/* Cards de atalho para funcionalidades principais da empresa. */}
              <section className="cards">
                <div className="card">
                  <FaSuitcase className="card-icon" />
                  <h3>Minhas Vagas</h3>
                  <p>Crie sua rede de postagens de vagas, melhore suas conexoes e contrate rapido.</p>
                  <Link to="/criar-vaga/empresa">Criar Vagas {'->'}</Link>
                </div>

                <div className="card">
                  <FaUserFriends className="card-icon" />
                  <h3>Candidatos</h3>
                  <p>Veja os candidatos disponiveis para suas vagas publicadas.</p>
                  <Link to="/candidatos/empresa">Ver Candidatos {'->'}</Link>
                </div>

                <div className="card">
                  <FaUserTie className="card-icon" />
                  <h3>Perfil</h3>
                  <p>Personalize o perfil da sua empresa e gerencie seus dados.</p>
                  <Link to="/painel/empresa?secao=perfil">Meu Perfil {'->'}</Link>
                </div>

                <div className="card">
                  <FaChartBar className="card-icon" />
                  <h3>Dashboard</h3>
                  <p>Acompanhe status, ganhos e impacto das suas contratacoes.</p>
                  <Link to="/painel/empresa">Acompanhar {'->'}</Link>
                </div>

                <div className="card">
                  <FaCalendarAlt className="card-icon" />
                  <h3>Entrevistas</h3>
                  <p>Organize e acompanhe entrevistas com candidatos de forma simples.</p>
                  <Link to="/painel/empresa?secao=entrevistas">Minhas Entrevistas {'->'}</Link>
                </div>
              </section>

              {/* Atalho flutuante para criacao de vaga. */}
              <Link className="floating-btn" to="/criar-vaga/empresa">+</Link>
            </>
          )}
        </main>
      </div>

      {/* Componente de rodape. */}
      <Footer />
    </>
  );
}

function PanelPlaceholder({ title, description }) {
  return (
    <section className="panel-placeholder">
      <p className="breadcrumb">PAINEL - Em construcao</p>
      <h1>
        {title}
        <span>.</span>
      </h1>
      <p className="subtitle">{description}</p>
    </section>
  );
}

export default PainelEmpresa;
