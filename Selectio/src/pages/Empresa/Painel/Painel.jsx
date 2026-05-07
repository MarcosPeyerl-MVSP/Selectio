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
  const navigate = useNavigate();
  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem("empresaUser");
    return storedEmpresa ? JSON.parse(storedEmpresa) : null;
  });

  useEffect(() => {
    if (!empresa) {
      navigate("/login");
    }
  }, [empresa, navigate]);

  if (!empresa) {
    return null;
  }

  return (
    <>
      <Navbar />

      <div className="painel-container">
        <Sidebar type="empresa" user={empresa} />

        <main className="painel-content">
          <p className="breadcrumb">BOAS-VINDAS - Painel Central</p>

          <h1>
            Bem-vinda, <span>{empresa.nomeEmpresa}.</span>
          </h1>

          <p className="subtitle">
            Gerencie suas vagas, explore novas oportunidades e acompanhe seu crescimento em um so lugar.
          </p>

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
              <Link to="/painel/empresa">Meu Perfil {'->'}</Link>
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
              <Link to="/painel/empresa">Minhas Entrevistas {'->'}</Link>
            </div>
          </section>

          <Link className="floating-btn" to="/criar-vaga/empresa">+</Link>
        </main>
      </div>

      <Footer />
    </>
  );
}

export default PainelEmpresa;
