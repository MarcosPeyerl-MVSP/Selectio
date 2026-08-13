import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import Home from './pages/public/Home'
import Login from './pages/public/Login'
// CADASTRO:
import CadastroEscolha from './pages/cadastro/CadastroEscolha'
import CadastroIndicador from './pages/cadastro/CadastroIndicador'
import CadastroEmpresa from './pages/cadastro/CadastroEmpresa'
//PAINEIS
import PainelIndicador from './pages/indicador/PainelIndicador'
import IndicadorPainelInterno from './pages/indicador/IndicadorPainel'
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
import CandidatoCadastroIndicador from './pages/indicador/IndicadorCandidatoCadastro'
import ProtectedRoute from './components/auth/ProtectedRoute'
import PageLoader from './components/ui/PageLoader'
import AdminLayout from './components/admin/AdminLayout'

const AdminVisaoGeral = lazy(() => import('./pages/admin/AdminVisaoGeral'))
const AdminEmpresas = lazy(() => import('./pages/admin/AdminEmpresas'))
const AdminIndicadores = lazy(() => import('./pages/admin/AdminIndicadores'))
const AdminVagas = lazy(() => import('./pages/admin/AdminVagas'))
const AdminCandidatos = lazy(() => import('./pages/admin/AdminCandidatos'))
const AdminFinanceiro = lazy(() => import('./pages/admin/AdminFinanceiro'))
const AdminConfiguracoesEmBreve = lazy(() => import('./pages/admin/AdminConfiguracoesEmBreve'))

const proteger = (element, tipo) => (
  <ProtectedRoute tipo={tipo}>{element}</ProtectedRoute>
)

const adminPage = (element, loadingLabel) => (
  <Suspense fallback={<PageLoader label={loadingLabel} />}>
    {element}
  </Suspense>
)

function App() {
  const { t } = useTranslation('common')

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
        <Route path="/painel/indicador" element={proteger(<PainelIndicador />, 'indicador')} />
        <Route path="/painel/indicador/dashboard" element={proteger(<IndicadorPainelInterno />, 'indicador')} />
        <Route path="/painel/empresa" element={proteger(<PainelEmpresa />, 'empresa')} />
        <Route path="/candidatos/empresa" element={proteger(<CandidatosEmpresa />, 'empresa')} />
        {/* ROTA VAGAS */}
        <Route path="/vagas" element={<Vagas />} />
        <Route path="/vagas/indicador" element={<Navigate to="/vagas" replace />} />
        <Route path="/vagas/empresa" element={<Navigate to="/vagas" replace />} />
        <Route path="/criar-vaga/empresa" element={proteger(<CriarVagaEmpresa />, 'empresa')} />
        <Route path="/editar-vaga/empresa/:id" element={proteger(<EditarVagaEmpresa />, 'empresa')} />
        {/* ROTA VAGA */}
        <Route path="/vaga/:id" element={proteger(<VagaDetalhe />)} />
        <Route path="/indicar/:vagaId" element={proteger(<Indicar />, 'indicador')} />
        <Route path="/candidatos/indicador/novo" element={proteger(<CandidatoCadastroIndicador />, 'indicador')} />
        <Route path="/candidatos/indicador/:candidatoId/editar" element={proteger(<CandidatoCadastroIndicador />, 'indicador')} />
        <Route path="/candidatos/indicador" element={proteger(<CandidatosIndicador />, 'indicador')} />
        {/* ROTAS ADMINISTRATIVAS */}
        <Route path="/admin" element={proteger(<AdminLayout />, 'admin')}>
          <Route index element={<Navigate to="/admin/visao-geral" replace />} />
          <Route path="visao-geral" element={adminPage(<AdminVisaoGeral />, t('loading.admin'))} />
          <Route path="empresas" element={adminPage(<AdminEmpresas />, t('loading.admin'))} />
          <Route path="indicadores" element={adminPage(<AdminIndicadores />, t('loading.admin'))} />
          <Route path="vagas" element={adminPage(<AdminVagas />, t('loading.admin'))} />
          <Route path="candidatos" element={adminPage(<AdminCandidatos />, t('loading.admin'))} />
          <Route path="financeiro" element={adminPage(<AdminFinanceiro />, t('loading.admin'))} />
          <Route path="configuracoes" element={adminPage(<AdminConfiguracoesEmBreve />, t('loading.admin'))} />
        </Route>
        {/* ROTA PAGE NOT FOUND */}
        <Route path="*" element={<h1>{t('notFound')}</h1>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
