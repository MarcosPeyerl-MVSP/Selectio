import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Home from './pages/Home/Home'
import Login from './pages/Login/Login'
// CADASTRO:
import Cadastro from './pages/Cadastro/Cadastro'
import CadastroIndicador from './pages/Indicador/Cadastro/Cadastro'
import CadastroEmpresa from './pages/Empresa/Cadastro/Cadastro'
//PAINEIS
import PainelIndicado from './pages/Indicador/Painel/Painel'



function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ROTA HOME */}
        <Route path="/" element={<Home />} />
        {/* ROTA LOGIN */}
        <Route path="/login" element={<Login />} />
        {/* ROTA CADASTROS */}
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/cadastro/indicador" element={<CadastroIndicador />} />
        <Route path="/cadastro/empresa" element={<CadastroEmpresa />} />
        {/* ROTA PAINEIS */}
        <Route path="/painel/indicador" element={<PainelIndicado />} />
        {/* ROTA PAGE NOT FOUND */}
        <Route path="*" element={<h1>PAGE NOT FOUND</h1>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
