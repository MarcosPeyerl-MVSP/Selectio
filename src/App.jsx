import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'

import Home from './pages/public/Home'
import Login from './pages/public/Login'
// CADASTRO:
import CadastroEscolha from './pages/cadastro/CadastroEscolha'
import CadastroIndicador from './pages/cadastro/CadastroIndicador'
import CadastroEmpresa from './pages/cadastro/CadastroEmpresa'
//PAINEIS
import PainelIndicador from './pages/indicador/IndicadorPainel'
import PainelEmpresa from './pages/empresa/EmpresaPainel'
import CandidatosEmpresa from './pages/empresa/EmpresaCandidatos'
// VAGAS
import Vagas from './pages/public/Vagas'
import CriarVagaEmpresa from './pages/empresa/EmpresaCriarVaga'
import EditarVagaEmpresa from './pages/empresa/EmpresaEditarVaga'

// VAGA
import VagaDetalhe from './pages/public/VagaDetalhe'
import Indicar from './pages/indicador/IndicadorIndicar'
import CandidatosIndicador from './pages/indicador/IndicadorCandidatos'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ROTA HOME */}
        <Route path="/" element={<Home />} />
        {/* ROTA LOGIN */}
        <Route path="/login" element={<Login />} />
        {/* ROTA CADASTROS */}
        <Route path="/cadastro" element={<CadastroEscolha />} />
        <Route path="/cadastro/indicador" element={<CadastroIndicador />} />
        <Route path="/cadastro/empresa" element={<CadastroEmpresa />} />
        {/* ROTA PAINEIS */}
        <Route path="/painel/indicador" element={<PainelIndicador />} />
        <Route path="/painel/empresa" element={<PainelEmpresa />} />
        <Route path="/candidatos/empresa" element={<CandidatosEmpresa />} />
        {/* ROTA VAGAS */}
        <Route path="/vagas" element={<Vagas />} />
        <Route path="/vagas/indicador" element={<Navigate to="/vagas" replace />} />
        <Route path="/vagas/empresa" element={<Navigate to="/vagas" replace />} />
        <Route path="/criar-vaga/empresa" element={<CriarVagaEmpresa />} />
        <Route path="/editar-vaga/empresa/:id" element={<EditarVagaEmpresa />} />
        {/* ROTA VAGA */}
        <Route path="/vaga/:id" element={<VagaDetalhe />} />
        <Route path="/indicar/:vagaId" element={<Indicar />} />
        <Route path="/candidatos/indicador" element={<CandidatosIndicador />} />
        {/* ROTA PAGE NOT FOUND */}
        <Route path="*" element={<h1>PAGE NOT FOUND</h1>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
