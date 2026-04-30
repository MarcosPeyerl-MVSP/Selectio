import { useState } from "react";
import "./Cadastro.css";

import Navbar from "../../../components/Navbar/Navbar";
import Footer from "../../../components/Footer/Footer";

export default function Cadastro() {
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    razao: "",
    email: "",
    telefone: "",
    site: "",
    endereco: "",
    setor: "",
    tamanho: "",
    pagamento: "",
    dadosPagamento: "",
    ia: false,
    termos: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Máscara CNPJ
  const formatCNPJ = (value) => {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/, "$1.$2");
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
    value = value.replace(/(\d{4})(\d)/, "$1-$2");
    return value.slice(0, 18);
  };

  // Máscara telefone
  const formatTelefone = (value) => {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d{5})(\d)/, "$1-$2");
    return value.slice(0, 15);
  };

  const handleCNPJ = (e) => {
    setForm({ ...form, cnpj: formatCNPJ(e.target.value) });
  };

  const handleTelefone = (e) => {
    setForm({ ...form, telefone: formatTelefone(e.target.value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.termos) {
      alert("Você precisa aceitar os termos!");
      return;
    }

    if (!form.nome || !form.email || !form.cnpj) {
      alert("Preencha os campos obrigatórios!");
      return;
    }

    const payload = {
      nomeEmpresa: form.nome,
      razaoSocial: form.razao,
      cnpj: form.cnpj.replace(/\D/g, ""),
      email: form.email,
      telefone: form.telefone,
      site: form.site,
      endereco: form.endereco,
      setor: form.setor,
      tamanho: form.tamanho,
      formaPagamento: form.pagamento,
      dadosPagamento: form.dadosPagamento,
      curadoriaIA: form.ia,
    };

    try {
      const response = await fetch("http://localhost:3333/empresa/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.sucesso) {
        alert("Empresa cadastrada com sucesso!");
      } else {
        alert(data.erro || "Erro ao cadastrar empresa");
      }
    } catch (error) {
      alert("Erro de conexão com o servidor");
    }
  };

  return (
    <>
      <Navbar />

      <div className="empresa-container">
        <div className="empresa-wrapper">

          {/* FORMULÁRIO */}
          <form className="empresa-form" onSubmit={handleSubmit}>
            <h1>Cadastro de Empresa</h1>
            <p className="subtitle">
              Prepare o perfil da sua organização para atrair talentos.
            </p>

            <h3>Identificação da Organização</h3>

            <div className="grid-2">
              <input
                name="nome"
                placeholder="Nome da empresa"
                value={form.nome}
                onChange={handleChange}
              />
              <input
                name="cnpj"
                placeholder="CNPJ"
                value={form.cnpj}
                onChange={handleCNPJ}
              />
            </div>

            <input
              name="razao"
              placeholder="Razão social"
              value={form.razao}
              onChange={handleChange}
            />

            <h3>Contato</h3>

            <div className="grid-2">
              <input
                name="email"
                placeholder="E-mail corporativo"
                value={form.email}
                onChange={handleChange}
              />
              <input
                name="telefone"
                placeholder="Telefone"
                value={form.telefone}
                onChange={handleTelefone}
              />
            </div>

            <input
              name="site"
              placeholder="Site"
              value={form.site}
              onChange={handleChange}
            />

            <input
              name="endereco"
              placeholder="Endereço"
              value={form.endereco}
              onChange={handleChange}
            />

            <h3>Perfil Operacional</h3>

            <div className="grid-2">
              <select name="setor" onChange={handleChange}>
                <option value="">Setor</option>
                <option>Tecnologia</option>
                <option>Financeiro</option>
                <option>Indústria</option>
              </select>

              <select name="tamanho" onChange={handleChange}>
                <option value="">Tamanho</option>
                <option>Micro</option>
                <option>Pequena</option>
                <option>Média</option>
                <option>Grande</option>
              </select>
            </div>

            <h3>Pagamento</h3>

            <select
              name="pagamento"
              value={form.pagamento}
              onChange={handleChange}
            >
              <option value="">Selecione a forma de pagamento</option>
              <option value="pix">Pix</option>
              <option value="banco">Conta Bancária</option>
              <option value="outros">Outros</option>
            </select>

            <input
              name="dadosPagamento"
              placeholder="Dados de pagamento"
              value={form.dadosPagamento}
              onChange={handleChange}
            />

            {/* IA */}
            <div className="ia-box">
              <input
                type="checkbox"
                name="ia"
                checked={form.ia}
                onChange={handleChange}
              />
              <span>Curadoria Inteligente (IA)</span>
            </div>

            {/* TERMOS */}
            <div className="termos">
              <input
                type="checkbox"
                name="termos"
                checked={form.termos}
                onChange={handleChange}
              />
              <span>Li e concordo com os termos</span>
            </div>

            <button type="submit">Cadastrar Empresa</button>
          </form>

          {/* SIDEBAR */}
          <div className="plano-box">
            <span className="plano-title">ASSINATURA SELECIONADA</span>

            <div className="plano-card">
              <span className="badge">MAIS POPULAR</span>
              <h2>Plano Electio</h2>
              <p className="preco">
                R$ 499<span>/mês</span>
              </p>

              <ul>
                <li>Filtros IA ilimitados</li>
                <li>Destaque de vagas</li>
                <li>Mais indicações</li>
              </ul>
            </div>

            <button className="plano-btn">Alterar Plano</button>

            <div className="help-box">
              <h4>Precisa de Ajuda?</h4>
              <p>
                Nossa equipe de curadores está pronta para auxiliar no onboarding
                da sua empresa.
              </p>
              <span className="help-link">Falar com especialista →</span>
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </>
  );
}
