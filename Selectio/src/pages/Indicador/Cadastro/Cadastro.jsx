import './Cadastro.css'
import { useState } from 'react'
import Navbar from '../../../components/Navbar/Navbar'
import Footer from '../../../components/Footer/Footer'

function CadastroIndicador() {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    cpf: '',
    pix: '',
    dataNascimento: '',
    senha: '',
    confirmarSenha: ''
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (form.senha !== form.confirmarSenha) {
      alert('As senhas não conferem')
      return
    }

    const response = await fetch('http://localhost:3333/indicador/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    const data = await response.json()

    if (data.sucesso) {
      alert('Cadastro realizado com sucesso!')
    } else {
      alert(data.erro || 'Erro ao cadastrar')
    }
  }

  return (
    <>
      <Navbar />

      <main className="indicador-cadastro-container">
        <div className="indicador-cadastro-card">
          <span className="tag center">CADASTRO DE INDICADOR</span>
          <h1>Junte-se à Selectio</h1>
          <p className="subtitle">
            Transforme sua rede profissional em oportunidades reais e seja
            recompensado por indicações bem-sucedidas.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <input
                name="nome"
                placeholder="Nome completo"
                onChange={handleChange}
                required
              />

              <input
                name="email"
                type="email"
                placeholder="E-mail"
                onChange={handleChange}
                required
              />

              <input
                name="cpf"
                placeholder="CPF"
                onChange={handleChange}
              />

              <input
                name="pix"
                placeholder="Chave Pix"
                onChange={handleChange}
              />

              <input
                name="dataNascimento"
                type="date"
                onChange={handleChange}
              />

              <input
                type="password"
                name="senha"
                placeholder="Senha"
                onChange={handleChange}
                required
              />

              <input
                type="password"
                name="confirmarSenha"
                placeholder="Confirmar senha"
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn-primary">
              Criar conta →
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </>
  )
}

export default CadastroIndicador
