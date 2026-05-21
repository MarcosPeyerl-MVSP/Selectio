// Objetivo do arquivo: renderizar e controlar o formulário de cadastro de empresa.
// O componente consulta CNPJ em API externa, valida senha forte, confirma senha,
// valida aceite dos termos, envia o cadastro para a API local e salva a sessão da empresa.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Cadastro.css";
import { FaCheck, FaEye, FaEyeSlash, FaTimes } from "react-icons/fa";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";

import Navbar from "../../../components/Navbar/Navbar/Navbar";
import Footer from "../../../components/Footer/Footer";
import { auth } from "../../../services/firebase";
import { getFirebaseAuthErrorMessage, isFirebaseAuthError } from "../../../services/authErrors";

// Opções fixas de porte/tamanho da empresa.
const tamanhoOptions = [
  "Microempresa (ME)",
  "Empresa de Pequeno Porte (EPP)",
  "Média empresa",
  "Grande empresa",
];

// Critérios usados para avaliar a força da senha.
const passwordCriteria = [
  { key: "length", label: "12+ caracteres" },
  { key: "uppercase", label: "Maiúscula" },
  { key: "lowercase", label: "Minúscula" },
  { key: "numbers", label: "Número" },
  { key: "special", label: "Símbolo" },
  { key: "noSequence", label: "Sem repetição" },
];

// Textos exibidos de acordo com a força calculada da senha.
const strengthCopy = {
  fraca: {
    label: "fraca",
    hint: "Use mais caracteres e misture letras, números e símbolo.",
  },
  media: {
    label: "média",
    hint: "Quase lá. Complete os critérios restantes.",
  },
  forte: {
    label: "forte",
    hint: "Senha pronta para proteger o acesso da empresa.",
  },
};

const rollbackFirebaseUser = async (firebaseUser) => {
  if (!firebaseUser) return;

  try {
    await deleteUser(firebaseUser);
  } catch {
    // O cadastro local nao deve travar se o rollback no Firebase falhar.
  }
};

export default function Cadastro() {
  // Hook usado para redirecionar a empresa após cadastro bem-sucedido.
  const navigate = useNavigate();

  // Estado central do formulário de cadastro da empresa.
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
    senha: "",
    confirmarSenha: "",
    ia: false,
    termos: false,
  });

  // Controla o estado da consulta de CNPJ.
  const [cnpjStatus, setCnpjStatus] = useState("idle");

  // Armazena a mensagem exibida após consulta ou validação do CNPJ.
  const [cnpjMessage, setCnpjMessage] = useState("");

  // Armazena o resultado da validação de força da senha.
  const [passwordStrength, setPasswordStrength] = useState(null);

  // Controla a visibilidade do campo de senha.
  const [showPassword, setShowPassword] = useState(false);

  // Controla a visibilidade do campo de confirmação de senha.
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitLoading, setSubmitLoading] = useState(false);

  // Mantém opções vindas da API caso o porte retornado não exista na lista fixa.
  const tamanhoSelectOptions = form.tamanho && !tamanhoOptions.includes(form.tamanho)
    ? [form.tamanho, ...tamanhoOptions]
    : tamanhoOptions;

  // Define o estado visual da confirmação de senha.
  const confirmPasswordStatus = form.confirmarSenha
    ? form.senha === form.confirmarSenha
      ? "match"
      : "mismatch"
    : "";

  // Recupera os textos correspondentes à força atual da senha.
  const currentStrength = passwordStrength
    ? strengthCopy[passwordStrength.strength]
    : null;

  // Regra de envio: o cadastro só pode ser enviado com senha forte.
  const isPasswordStrong = passwordStrength?.strength === "forte";
  const canSubmit = isPasswordStrong && !submitLoading;

  // Responsabilidade: aplicar máscara de CNPJ no formato 00.000.000/0000-00.
  const formatCNPJ = (value) => {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/, "$1.$2");
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
    value = value.replace(/(\d{4})(\d)/, "$1-$2");
    return value.slice(0, 18);
  };

  // Responsabilidade: aplicar máscara ao telefone informado.
  const formatTelefone = (value) => {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d{5})(\d)/, "$1-$2");
    return value.slice(0, 15);
  };

  // Responsabilidade: remover caracteres não numéricos do CNPJ.
  const getCnpjNumbers = (value) => value.replace(/\D/g, "");

  // Responsabilidade: avaliar os critérios de segurança da senha.
  const validatePasswordStrength = (password) => {
    const criteria = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noSequence: !/(.)\1{2,}/.test(password),
    };

    const score = Object.values(criteria).filter(Boolean).length;

    return {
      criteria,
      score,
      strength: score <= 2 ? "fraca" : score <= 4 ? "media" : "forte",
    };
  };

  // Responsabilidade: atualizar campos do formulário, incluindo checkboxes e senha.
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "senha") {
      setPasswordStrength(validatePasswordStrength(value));
    }

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Responsabilidade: formatar CNPJ digitado e limpar o status da consulta.
  const handleCNPJ = (e) => {
    setForm({ ...form, cnpj: formatCNPJ(e.target.value) });
    setCnpjStatus("idle");
    setCnpjMessage("");
  };

  // Responsabilidade: formatar telefone digitado.
  const handleTelefone = (e) => {
    setForm({ ...form, telefone: formatTelefone(e.target.value) });
  };

  // Responsabilidade: consultar dados públicos da empresa pelo CNPJ.
  const consultarCNPJ = async () => {
    const cnpj = getCnpjNumbers(form.cnpj);

    if (cnpj.length !== 14) {
      setCnpjStatus("error");
      setCnpjMessage("Digite um CNPJ com 14 números.");
      return;
    }

    setCnpjStatus("loading");
    setCnpjMessage("Consultando dados públicos da empresa...");

    try {
      const response = await fetch(`https://api.opencnpj.org/${cnpj}`);

      if (!response.ok) {
        throw new Error("CNPJ não encontrado");
      }

      const result = await response.json();
      const empresa = result.data || result;

      if (!empresa?.cnpj) {
        throw new Error("CNPJ não encontrado");
      }

      // Preenche dados da empresa com as informações retornadas pela consulta.
      setForm((currentForm) => ({
        ...currentForm,
        nome: empresa.nome_fantasia || empresa.nomeFantasia || empresa.razao_social || currentForm.nome,
        razao: empresa.razao_social || empresa.razaoSocial || currentForm.razao,
        email: empresa.email || currentForm.email,
        endereco: [empresa.logradouro, empresa.numero].filter(Boolean).join(", ") || currentForm.endereco,
        tamanho: empresa.porte_empresa || currentForm.tamanho,
      }));

      setCnpjStatus("verified");
      setCnpjMessage("Empresa verificada. Revise os dados antes de concluir.");
    } catch {
      setCnpjStatus("error");
      setCnpjMessage("Não encontramos esse CNPJ no OpenCNPJ.");
    }
  };

  // Responsabilidade: validar dados obrigatórios e enviar o cadastro para a API.
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

    if (!form.senha || !form.confirmarSenha) {
      alert("Informe e confirme a senha da empresa.");
      return;
    }

    if (form.senha !== form.confirmarSenha) {
      alert("As senhas não conferem.");
      return;
    }

    if (!isPasswordStrong) {
      alert("Crie uma senha forte antes de cadastrar a empresa.");
      return;
    }

    if (cnpjStatus !== "verified") {
      alert("Consulte e verifique o CNPJ antes de cadastrar a empresa.");
      return;
    }

    const payload = {
      nomeEmpresa: form.nome,
      razaoSocial: form.razao,
      cnpj: getCnpjNumbers(form.cnpj),
      email: form.email.trim(),
      telefone: form.telefone,
      site: form.site,
      endereco: form.endereco,
      setor: form.setor,
      tamanho: form.tamanho,
      formaPagamento: form.pagamento,
      dadosPagamento: form.dadosPagamento,
      senha: form.senha,
      curadoriaIA: form.ia,
    };

    let firebaseUser = null;

    try {
      setSubmitLoading(true);

      const firebaseCredential = await createUserWithEmailAndPassword(
        auth,
        payload.email,
        form.senha
      );
      firebaseUser = firebaseCredential.user;
      payload.firebaseUid = firebaseUser.uid;

      const response = await fetch("http://localhost:3333/empresa/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.sucesso) {
        localStorage.setItem("empresaUser", JSON.stringify(data.empresa));
        localStorage.removeItem("indicadorUser");
        navigate("/painel/empresa");
      } else {
        await rollbackFirebaseUser(firebaseUser);
        alert(data.erro || "Nao foi possivel salvar a empresa no servidor.");
      }
    } catch (error) {
      await rollbackFirebaseUser(firebaseUser);

      if (isFirebaseAuthError(error)) {
        alert(getFirebaseAuthErrorMessage(error));
      } else {
        alert("Falha de conexao. Verifique se o backend esta rodando em localhost:3333.");
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="empresa-container">
        <div className="empresa-wrapper">
          <form className="empresa-form" onSubmit={handleSubmit}>
            <header className="form-header">
              <span>Cadastro de empresa</span>
              <h1>Dados da organização</h1>
              <p>Informe o CNPJ para preencher os dados principais automaticamente.</p>
            </header>

            <section className="form-section">
              <h2>Verificação</h2>

              <label className="field-label" htmlFor="cnpj">
                CNPJ
              </label>
              <div className="cnpj-lookup">
                <input
                  id="cnpj"
                  name="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={handleCNPJ}
                />
                <button
                  type="button"
                  onClick={consultarCNPJ}
                  disabled={cnpjStatus === "loading"}
                >
                  {cnpjStatus === "loading" ? "Buscando..." : "Buscar"}
                </button>
              </div>
              {cnpjMessage && (
                <p className={`cnpj-message ${cnpjStatus}`}>{cnpjMessage}</p>
              )}
            </section>

            <section className="form-section">
              <h2>Empresa</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="nome">
                    Nome fantasia
                  </label>
                  <input
                    id="nome"
                    name="nome"
                    placeholder="Nome exibido da empresa"
                    value={form.nome}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="razao">
                    Razão social
                  </label>
                  <input
                    id="razao"
                    name="razao"
                    placeholder="Razão social"
                    value={form.razao}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <label className="field-label" htmlFor="endereco">
                Endereço
              </label>
              <input
                id="endereco"
                name="endereco"
                placeholder="Logradouro, número"
                value={form.endereco}
                onChange={handleChange}
              />
            </section>

            <section className="form-section">
              <h2>Contato</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="email">
                    E-mail corporativo
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="telefone">
                    Telefone
                  </label>
                  <input
                    id="telefone"
                    name="telefone"
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={handleTelefone}
                  />
                </div>
              </div>

              <label className="field-label" htmlFor="site">
                Site
              </label>
              <input
                id="site"
                name="site"
                placeholder="https://empresa.com"
                value={form.site}
                onChange={handleChange}
              />
            </section>

            <section className="form-section">
              <h2>Perfil</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="setor">
                    Setor
                  </label>
                  <select
                    id="setor"
                    name="setor"
                    value={form.setor}
                    onChange={handleChange}
                  >
                    <option value="">Selecione</option>
                    <option>Tecnologia</option>
                    <option>Financeiro</option>
                    <option>Indústria</option>
                    <option>Serviços</option>
                    <option>Varejo</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="tamanho">
                    Tamanho
                  </label>
                  <select
                    id="tamanho"
                    name="tamanho"
                    value={form.tamanho}
                    onChange={handleChange}
                  >
                    <option value="">Selecione</option>
                    {tamanhoSelectOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="form-section">
              <h2>Acesso</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="senha">
                    Senha
                  </label>
                  <div className="password-field">
                    <input
                      id="senha"
                      name="senha"
                      type={showPassword ? "text" : "password"}
                      placeholder="Crie uma senha"
                      value={form.senha}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="field-label" htmlFor="confirmarSenha">
                    Confirmar senha
                  </label>
                  <div className={`password-field confirm-password-field ${confirmPasswordStatus}`}>
                    <input
                      id="confirmarSenha"
                      name="confirmarSenha"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repita a senha"
                      value={form.confirmarSenha}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword((visible) => !visible)}
                      aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              </div>

              {passwordStrength && (
                <div className={`password-strength strength-${passwordStrength.strength}`}>
                  <div className="strength-header">
                    <div>
                      <strong>Senha {currentStrength.label}</strong>
                      <p>{currentStrength.hint}</p>
                    </div>
                    <span className="strength-score">
                      {passwordStrength.score}/6
                    </span>
                  </div>

                  <div className="strength-meter" aria-hidden="true">
                    {passwordCriteria.map((item, index) => (
                      <span
                        key={item.key}
                        className={index < passwordStrength.score ? "active" : ""}
                      />
                    ))}
                  </div>

                  <ul className="criteria-list">
                    {passwordCriteria.map((item) => {
                      const isMet = passwordStrength.criteria[item.key];

                      return (
                        <li key={item.key} className={isMet ? "met" : ""}>
                          {isMet ? <FaCheck /> : <FaTimes />}
                          {item.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {confirmPasswordStatus && (
                <span className={`confirm-password-message ${confirmPasswordStatus}`}>
                  {confirmPasswordStatus === "match"
                    ? "Senhas conferem"
                    : "As senhas ainda não conferem"}
                </span>
              )}
            </section>

            <section className="form-section">
              <h2>Pagamento</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="pagamento">
                    Forma de pagamento
                  </label>
                  <select
                    id="pagamento"
                    name="pagamento"
                    value={form.pagamento}
                    onChange={handleChange}
                  >
                    <option value="">Selecione</option>
                    <option value="pix">Pix</option>
                    <option value="banco">Conta bancária</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="dadosPagamento">
                    Dados de pagamento
                  </label>
                  <input
                    id="dadosPagamento"
                    name="dadosPagamento"
                    placeholder="Chave Pix, banco ou observação"
                    value={form.dadosPagamento}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </section>

            <div className="choice-list">
              <label>
                <input
                  type="checkbox"
                  name="ia"
                  checked={form.ia}
                  onChange={handleChange}
                />
                Usar curadoria assistida nas vagas
              </label>

              <label>
                <input
                  type="checkbox"
                  name="termos"
                  checked={form.termos}
                  onChange={handleChange}
                />
                Li e concordo com os termos
              </label>
            </div>

            <button type="submit" className="submit-button" disabled={!canSubmit}>
              {submitLoading ? "Cadastrando..." : isPasswordStrong ? "Cadastrar empresa" : "Complete a senha forte"}
            </button>
          </form>

          {/* Card lateral com informações do plano selecionado. */}
          <aside className="plano-box">
            <span className="plano-title">Plano selecionado</span>

            <div className="plano-card">
              <h2>Plano Electio</h2>
              <p className="preco">
                R$ 499<span>/mês</span>
              </p>

              <ul>
                <li>Publicação de vagas</li>
                <li>Gestão de indicações</li>
                <li>Suporte no onboarding</li>
              </ul>
            </div>

            <button type="button" className="plano-btn">Alterar plano</button>

            <div className="help-box">
              <h3>Precisa de ajuda?</h3>
              <p>Fale com a equipe para revisar o cadastro da empresa.</p>
              <span className="help-link">Falar com especialista →</span>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
}
