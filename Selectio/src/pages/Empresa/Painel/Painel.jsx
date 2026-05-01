import React from "react";
import "./Painel.css";

import Navbar from "../../../components/Navbar/Navbar";
import Footer from "../../../components/Footer/Footer";

import {
  FaUserTie,
  FaSuitcase,
  FaUserFriends,
  FaChartBar,
  FaCog,
  FaPlus,
  FaCalendarAlt,
} from "react-icons/fa";

function PainelEmpresa() {
  return (
    <>
      <Navbar />

      <div className="painel-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <h2 className="sidebar-title">PAINEL DA EMPRESA</h2>

          <div className="sidebar-user">
            <FaUserTie />
            <div>
              <strong>EMPRESA</strong>
              <p>Nome empresa</p>
            </div>
          </div>

          <nav className="sidebar-menu">
            <a href="#"><FaSuitcase /> Vagas</a>
            <a href="#"><FaChartBar /> Dashboard</a>
            <a href="#"><FaUserTie /> Perfil</a>
            <a href="#"><FaCog /> Configurações</a>
            <a href="#"><FaCalendarAlt /> Entrevistas</a>
          </nav>

          <button className="sidebar-btn">
            <FaPlus /> Nova Vaga
          </button>
        </aside>

        {/* Conteúdo */}
        <main className="painel-content">
          <p className="breadcrumb">BOAS-VINDAS • Painel Central</p>

          <h1>
            Bem-Vinda, <span>Empresa.</span>
          </h1>

          <p className="subtitle">
            Gerencie suas vagas, explore novas oportunidades e acompanhe seu crescimento em um só lugar.
          </p>

          {/* Cards */}
          <section className="cards">
            <div className="card">
              <FaSuitcase className="card-icon" />
              <h3>Minhas Vagas</h3>
              <p>
                Crie sua rede de postagens de vagas, melhore suas conexões e contrate rápido.
              </p>
              <a href="#">Criar Vagas →</a>
            </div>

            <div className="card">
              <FaUserFriends className="card-icon" />
              <h3>Candidatos</h3>
              <p>
                Veja os candidatos disponíveis para suas vagas publicadas. Não perca tempo.
              </p>
              <a href="#">Indicar Agora →</a>
            </div>

            <div className="card">
              <FaUserTie className="card-icon" />
              <h3>Perfil</h3>
              <p>
                Personalize o perfil da sua empresa e gerencie seus dados.
              </p>
              <a href="#">Meu Perfil →</a>
            </div>

            <div className="card">
              <FaChartBar className="card-icon" />
              <h3>Dashboard</h3>
              <p>
                Acompanhe status, ganhos e impacto das suas contratações.
              </p>
              <a href="#">Acompanhar →</a>
            </div>

            <div className="card">
              <FaCalendarAlt className="card-icon" />
              <h3>Entrevistas</h3>
              <p>
                Organize e acompanhe entrevistas com candidatos de forma simples.
              </p>
              <a href="#">Minhas Entrevistas →</a>
            </div>
          </section>

          <button className="floating-btn">+</button>
        </main>
      </div>

      <Footer />
    </>
  );
}

export default PainelEmpresa;