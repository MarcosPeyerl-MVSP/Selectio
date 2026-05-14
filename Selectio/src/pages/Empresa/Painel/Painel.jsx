// Objetivo do arquivo: renderizar o painel central da empresa.
// A página valida a sessão da empresa, redireciona para login quando não há sessão
// e exibe atalhos para criação de vagas, candidatos, perfil, dashboard e entrevistas.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Painel.css";

import Navbar from "../../../components/Navbar/Navbar/Navbar";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Footer from "../../../components/Footer/Footer";

import {
  FaUserTie,
  FaSuitcase,
  FaUserFriends,
  FaChartBar,
  FaCalendarAlt,
} from "react-icons/fa";

function PainelEmpresa() {
  // Hook usado para redirecionar a empresa quando não há sessão válida.
  const navigate = useNavigate();

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

  // Evita renderizar o painel enquanto não há empresa autenticada.
  if (!empresa) {
    return null;
  }

  return (
    <>
      {/* Componente de navegação principal. */}
      <Navbar />

      <div className="painel-container">
        {/* Menu lateral do painel da empresa. */}
        <Sidebar type="empresa" user={empresa} />

        <main className="painel-content">
          <p className="breadcrumb">BOAS-VINDAS - Painel Central</p>

          <h1>
            Bem-vinda, <span>{empresa.nomeEmpresa}.</span>
          </h1>

          <p className="subtitle">
            Gerencie suas vagas, explore novas oportunidades e acompanhe seu crescimento em um só lugar.
          </p>

          {/* Cards de atalho para funcionalidades principais da empresa. */}
          <section className="cards">
            <div className="card">
              <FaSuitcase className="card-icon" />
              <h3>Minhas Vagas</h3>
              <p>Crie sua rede de postagens de vagas, melhore suas conexões e contrate rápido.</p>
              <Link to="/criar-vaga/empresa">Criar Vagas {'->'}</Link>
            </div>

            <div className="card">
              <FaUserFriends className="card-icon" />
              <h3>Candidatos</h3>
              <p>Veja os candidatos disponíveis para suas vagas publicadas.</p>
              <Link to="/candidatos/empresa">Ver Candidatos {'->'}</Link>
            </div>

            <div className="card">
              <FaUserTie className="card-icon" />
              <h3>Perfil</h3>
              <p>Personalize o perfil da sua empresa e gerencie seus dados.</p>
              <Link to="/painel/empresa">Meu Perfil {'->'}</Link>
            </div>

            <div className="card">
              <FaChartBar className="card-icon" />
              <h3>Dashboard</h3>
              <p>Acompanhe status, ganhos e impacto das suas contratações.</p>
              <Link to="/painel/empresa">Acompanhar {'->'}</Link>
            </div>

            <div className="card">
              <FaCalendarAlt className="card-icon" />
              <h3>Entrevistas</h3>
              <p>Organize e acompanhe entrevistas com candidatos de forma simples.</p>
              <Link to="/painel/empresa">Minhas Entrevistas {'->'}</Link>
            </div>
          </section>

          {/* Atalho flutuante para criação de vaga. */}
          <Link className="floating-btn" to="/criar-vaga/empresa">+</Link>
        </main>
      </div>

      {/* Componente de rodapé. */}
      <Footer />
    </>
  );
}

export default PainelEmpresa;
