// Objetivo do arquivo: renderizar e controlar o formulário de cadastro de empresa.
// O componente consulta CNPJ em API externa, valida senha forte, confirma senha,
// valida aceite dos termos, salva o perfil no Firebase/Firestore e salva a sessão da empresa.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./CadastroEmpresa.css";
import { FaCheck, FaEye, FaEyeSlash, FaGoogle, FaTimes } from "react-icons/fa";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { auth } from "../../services/firebase";
import { getFirebaseAuthErrorKey, isFirebaseAuthError } from "../../services/errosAutenticacao";
import { buscarPerfilUsuario, salvarPerfilUsuario } from "../../services/firestoreUsers";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import {
  MODO_EMPRESA_CLASSICO,
  MODO_EMPRESA_EMPRESARIAL,
  SETOR_ADMIN_EMPRESA,
  criarPayloadSetoresEmpresariais,
  setoresEmpresariais,
} from "../../utils/modoEmpresarial";
import { formatCurrency } from "../../i18n/formatters";

// Opções fixas de porte/tamanho da empresa.
const tamanhoOptions = [
  "Microempresa (ME)",
  "Empresa de Pequeno Porte (EPP)",
  "Média empresa",
  "Grande empresa",
];

const tamanhoLabelKeys = {
  "Microempresa (ME)": "companyRegistration.sizes.micro",
  "Empresa de Pequeno Porte (EPP)": "companyRegistration.sizes.small",
  "Média empresa": "companyRegistration.sizes.medium",
  "Grande empresa": "companyRegistration.sizes.large",
};

const createInitialSectorPasswords = () => setoresEmpresariais.reduce((passwords, setor) => ({
  ...passwords,
  [setor.id]: "",
}), {});

// Critérios usados para avaliar a força da senha.
const passwordCriteria = [
  { key: "length", labelKey: "registration.passwordCriteria.length" },
  { key: "uppercase", labelKey: "registration.passwordCriteria.uppercase" },
  { key: "lowercase", labelKey: "registration.passwordCriteria.lowercase" },
  { key: "numbers", labelKey: "registration.passwordCriteria.numbers" },
  { key: "special", labelKey: "registration.passwordCriteria.special" },
  { key: "noSequence", labelKey: "registration.passwordCriteria.noSequence" },
];

// Textos exibidos de acordo com a força calculada da senha.
const strengthCopy = {
  fraca: {
    labelKey: "registration.passwordStrength.weakLabel",
    hintKey: "companyRegistration.weakHint",
  },
  média: {
    labelKey: "registration.passwordStrength.mediumLabel",
    hintKey: "companyRegistration.mediumHint",
  },
  forte: {
    labelKey: "registration.passwordStrength.strongLabel",
    hintKey: "companyRegistration.strongHint",
  },
};

const rollbackFirebaseUser = async (firebaseUser) => {
  if (!firebaseUser) return;

  try {
    await deleteUser(firebaseUser);
  } catch {
    // O cadastro local não deve travar se o rollback no Firebase falhar.
  }
};

export default function Cadastro() {
  const { t } = useTranslation("auth");
  // Hook usado para redirecionar a empresa após cadastro bem-sucedido.
  const navigate = useNavigate();
  const toast = useToast();
  const { adotarPerfil } = useAuth();

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
    modoEmpresa: MODO_EMPRESA_CLASSICO,
    senhasSetores: createInitialSectorPasswords(),
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

  const [googleSignupUser, setGoogleSignupUser] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMessage, setGoogleMessage] = useState("");
  const pendingGoogleUidRef = useRef("");
  const keepGoogleSessionRef = useRef(false);

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
  const isGoogleSignup = Boolean(googleSignupUser);
  const isModoEmpresarialSelecionado = form.modoEmpresa === MODO_EMPRESA_EMPRESARIAL;
  const setoresComSenha = setoresEmpresariais.every((setor) => (
    form.senhasSetores[setor.id]?.trim().length >= 4
  ));
  const canSubmit = !submitLoading;

  useEffect(() => {
    return () => {
      const pendingUid = pendingGoogleUidRef.current;

      if (
        pendingUid &&
        !keepGoogleSessionRef.current &&
        auth.currentUser?.uid === pendingUid
      ) {
        signOut(auth).catch(() => {});
      }
    };
  }, []);

  const redirectExistingProfile = (perfil) => {
    keepGoogleSessionRef.current = true;

    if (perfil.tipo === "empresa") {
      adotarPerfil(perfil);
      toast.info(t("companyRegistration.existingCompany"));
      navigate("/painel/empresa");
      return;
    }

    if (perfil.tipo === "indicador") {
      adotarPerfil(perfil);
      toast.info(t("companyRegistration.existingReferrer"));
      navigate("/painel/indicador");
      return;
    }

    if (perfil.tipo === "admin") {
      adotarPerfil(perfil);
      toast.info(t("companyRegistration.existingAdmin"));
      navigate("/admin/visao-geral");
      return;
    }

    toast.info(t("companyRegistration.existingAccount"));
    navigate("/login");
  };

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
      strength: score <= 2 ? "fraca" : score <= 4 ? "média" : "forte",
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

  const handleSetorSenhaChange = (setorId, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      senhasSetores: {
        ...currentForm.senhasSetores,
        [setorId]: value,
      },
    }));
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
      setCnpjMessage(t("companyRegistration.cnpjLength"));
      return;
    }

    setCnpjStatus("loading");
    setCnpjMessage(t("companyRegistration.cnpjSearching"));

    try {
      const response = await fetch(`https://api.opencnpj.org/${cnpj}`);

      if (!response.ok) {
        throw new Error("cnpj-not-found");
      }

      const result = await response.json();
      const empresa = result.data || result;

      if (!empresa?.cnpj) {
        throw new Error("cnpj-not-found");
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
      setCnpjMessage(t("companyRegistration.cnpjVerified"));
    } catch {
      setCnpjStatus("error");
      setCnpjMessage(t("companyRegistration.cnpjNotFound"));
    }
  };

  // Responsabilidade: validar dados obrigatórios e salvar o cadastro no Firebase/Firestore.
  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setGoogleMessage("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const credential = await signInWithPopup(auth, provider);
      const googleUser = credential.user;
      pendingGoogleUidRef.current = googleUser.uid;

      const existingProfile = await buscarPerfilUsuario(googleUser.uid);

      if (existingProfile) {
        redirectExistingProfile(existingProfile);
        return;
      }

      setGoogleSignupUser({
        uid: googleUser.uid,
        email: googleUser.email || "",
        nome: googleUser.displayName || "",
      });
      setPasswordStrength(null);
      setForm((currentForm) => ({
        ...currentForm,
        nome: currentForm.nome || googleUser.displayName || "",
        email: googleUser.email || currentForm.email,
        senha: "",
        confirmarSenha: "",
      }));
      setGoogleMessage(t("companyRegistration.googleTemporaryLinked"));
      toast.success(t("companyRegistration.googleTemporaryLinked"));
    } catch (error) {
      if (pendingGoogleUidRef.current && auth.currentUser?.uid === pendingGoogleUidRef.current) {
        await signOut(auth).catch(() => {});
      }

      if (isFirebaseAuthError(error)) {
        const message = t(getFirebaseAuthErrorKey(error));
        setGoogleMessage(message);
        toast.warning(message);
      } else {
        setGoogleMessage(t("companyRegistration.googleFailed"));
        toast.warning(t("companyRegistration.googleFailed"));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.termos) {
      toast.warning(t("companyRegistration.acceptTerms"));
      return;
    }

    if (!form.nome || !form.email || !form.cnpj) {
      toast.warning(t("companyRegistration.requiredFields"));
      return;
    }

    if (isModoEmpresarialSelecionado && !setoresComSenha) {
      toast.warning(t("companyRegistration.sectorPasswordsRequired"));
      return;
    }

    if (!isGoogleSignup) {
      if (!form.senha || !form.confirmarSenha) {
        toast.warning(t("companyRegistration.passwordRequired"));
        return;
      }

      if (form.senha !== form.confirmarSenha) {
        toast.warning(t("companyRegistration.passwordMismatch"));
        return;
      }

      if (!isPasswordStrong) {
        toast.warning(t("companyRegistration.strongPasswordRequired"));
        return;
      }
    }

    if (cnpjStatus !== "verified") {
      toast.warning(t("companyRegistration.verifyCnpj"));
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
      curadoriaIA: form.ia,
      modoEmpresa: form.modoEmpresa,
      modoOperacao: form.modoEmpresa,
      fluxoEmpresarialAtivo: isModoEmpresarialSelecionado,
    };

    let firebaseUser = null;
    let verificationSent = false;

    try {
      setSubmitLoading(true);

      let profileUid = googleSignupUser?.uid;

      if (isGoogleSignup) {
        if (!profileUid || auth.currentUser?.uid !== profileUid) {
          toast.warning(t("companyRegistration.googleAgain"));
          return;
        }

        const existingProfile = await buscarPerfilUsuario(profileUid);

        if (existingProfile) {
          redirectExistingProfile(existingProfile);
          return;
        }
      } else {
        const firebaseCredential = await createUserWithEmailAndPassword(
          auth,
          payload.email,
          form.senha
        );
        firebaseUser = firebaseCredential.user;
        profileUid = firebaseUser.uid;
        verificationSent = await sendEmailVerification(firebaseUser)
          .then(() => true)
          .catch(() => {
            toast.warning(t("companyRegistration.verificationFailed"));
            return false;
          });
      }

      payload.firebaseUid = profileUid;
      payload.setoresEmpresariais = isModoEmpresarialSelecionado
        ? await criarPayloadSetoresEmpresariais(form.senhasSetores, profileUid)
        : {};

      const perfilEmpresa = await salvarPerfilUsuario({
        uid: profileUid,
        tipo: "empresa",
        dados: {
          id: profileUid,
          nomeEmpresa: payload.nomeEmpresa,
          razaoSocial: payload.razaoSocial,
          cnpj: payload.cnpj,
          email: payload.email,
          telefone: payload.telefone,
          site: payload.site,
          endereco: payload.endereco,
          setor: payload.setor,
          tamanho: payload.tamanho,
          formaPagamento: payload.formaPagamento,
          dadosPagamento: payload.dadosPagamento,
          curadoriaIA: payload.curadoriaIA,
          modoEmpresa: payload.modoEmpresa,
          modoOperacao: payload.modoOperacao,
          fluxoEmpresarialAtivo: payload.fluxoEmpresarialAtivo,
          setoresEmpresariais: payload.setoresEmpresariais,
          plano: "Plano Electio"
        }
      });

      keepGoogleSessionRef.current = true;
      adotarPerfil(isModoEmpresarialSelecionado
        ? {
          ...perfilEmpresa,
          setorEmpresarial: {
            id: SETOR_ADMIN_EMPRESA,
            nome: "Administrador Empresa",
            acessadoEm: new Date().toISOString(),
          },
        }
        : perfilEmpresa);
      toast.success(isGoogleSignup
        ? t("companyRegistration.completedGoogle")
        : verificationSent
          ? t("companyRegistration.completedVerification")
          : t("companyRegistration.completed"));
      navigate("/painel/empresa");
    } catch (error) {
      await rollbackFirebaseUser(firebaseUser);

      if (isFirebaseAuthError(error)) {
        toast.error(t(getFirebaseAuthErrorKey(error)));
      } else {
        toast.error(t("companyRegistration.firestoreFailed"));
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
              <span>{t("companyRegistration.tag")}</span>
              <h1>{t("companyRegistration.title")}</h1>
              <p>{t("companyRegistration.description")}</p>
            </header>

            <section className="form-section">
              <h2>{t("companyRegistration.verification")}</h2>

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
                  {cnpjStatus === "loading"
                    ? t("companyRegistration.searching")
                    : t("companyRegistration.search")}
                </button>
              </div>
              {cnpjMessage && (
                <p className={`cnpj-message ${cnpjStatus}`}>{cnpjMessage}</p>
              )}
            </section>

            <section className="form-section">
              <h2>{t("companyRegistration.company")}</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="nome">
                    {t("companyRegistration.tradeName")}
                  </label>
                  <input
                    id="nome"
                    name="nome"
                    placeholder={t("companyRegistration.tradeNamePlaceholder")}
                    value={form.nome}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="razao">
                    {t("companyRegistration.legalName")}
                  </label>
                  <input
                    id="razao"
                    name="razao"
                    placeholder={t("companyRegistration.legalName")}
                    value={form.razao}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <label className="field-label" htmlFor="endereco">
                {t("companyRegistration.address")}
              </label>
              <input
                id="endereco"
                name="endereco"
                placeholder={t("companyRegistration.addressPlaceholder")}
                value={form.endereco}
                onChange={handleChange}
              />
            </section>

            <section className="form-section">
              <h2>{t("companyRegistration.contact")}</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="email">
                    {t("companyRegistration.corporateEmail")}
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
                    {t("companyRegistration.phone")}
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
                {t("companyRegistration.website")}
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
              <h2>{t("companyRegistration.profile")}</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="setor">
                    {t("companyRegistration.industry")}
                  </label>
                  <select
                    id="setor"
                    name="setor"
                    value={form.setor}
                    onChange={handleChange}
                  >
                    <option value="">{t("companyRegistration.select")}</option>
                    <option value="Tecnologia">{t("companyRegistration.industries.technology")}</option>
                    <option value="Financeiro">{t("companyRegistration.industries.finance")}</option>
                    <option value="Indústria">{t("companyRegistration.industries.industry")}</option>
                    <option value="Serviços">{t("companyRegistration.industries.services")}</option>
                    <option value="Varejo">{t("companyRegistration.industries.retail")}</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="tamanho">
                    {t("companyRegistration.size")}
                  </label>
                  <select
                    id="tamanho"
                    name="tamanho"
                    value={form.tamanho}
                    onChange={handleChange}
                  >
                    <option value="">{t("companyRegistration.select")}</option>
                    {tamanhoSelectOptions.map((option) => (
                      <option key={option} value={option}>
                        {tamanhoLabelKeys[option] ? t(tamanhoLabelKeys[option]) : option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="form-section">
              <h2>{t("companyRegistration.usageMode")}</h2>

              <div className="mode-options">
                <label className={form.modoEmpresa === MODO_EMPRESA_CLASSICO ? "mode-option selected" : "mode-option"}>
                  <input
                    type="radio"
                    name="modoEmpresa"
                    value={MODO_EMPRESA_CLASSICO}
                    checked={form.modoEmpresa === MODO_EMPRESA_CLASSICO}
                    onChange={handleChange}
                  />
                  <span>
                    <strong>{t("companyRegistration.classic")}</strong>
                    <small>{t("companyRegistration.classicDescription")}</small>
                  </span>
                </label>

                <label className={form.modoEmpresa === MODO_EMPRESA_EMPRESARIAL ? "mode-option selected" : "mode-option"}>
                  <input
                    type="radio"
                    name="modoEmpresa"
                    value={MODO_EMPRESA_EMPRESARIAL}
                    checked={form.modoEmpresa === MODO_EMPRESA_EMPRESARIAL}
                    onChange={handleChange}
                  />
                  <span>
                    <strong>{t("companyRegistration.business")}</strong>
                    <small>{t("companyRegistration.businessDescription")}</small>
                  </span>
                </label>
              </div>

              {isModoEmpresarialSelecionado && (
                <div className="modo-empresarial-card">
                  <div>
                    <span>{t("companyRegistration.businessFlow")}</span>
                    <h3>{t("companyRegistration.businessFlowTitle")}</h3>
                    <p>{t("companyRegistration.businessFlowDescription")}</p>
                  </div>

                  <ol>
                    <li><strong>{t("sectors.chefe_departamento")}</strong> {t("companyRegistration.flowStepDepartment")}</li>
                    <li><strong>{t("sectors.reitoria_auditoria")}</strong> {t("companyRegistration.flowStepAudit")}</li>
                    <li><strong>{t("sectors.setor_rh")}</strong> {t("companyRegistration.flowStepHr")}</li>
                    <li><strong>{t("sectors.admin_empresa")}</strong> {t("companyRegistration.flowStepAdmin")}</li>
                  </ol>

                  <div className="sector-passwords">
                    <h4>{t("companyRegistration.initialSectorPasswords")}</h4>
                    <p>{t("companyRegistration.sectorPasswordsDescription")}</p>

                    <div className="grid-2">
                      {setoresEmpresariais.map((setor) => (
                        <div key={setor.id}>
                          <label className="field-label" htmlFor={`senha-${setor.id}`}>
                            {t(`sectors.${setor.id}`, { defaultValue: setor.nome })}
                          </label>
                          <input
                            id={`senha-${setor.id}`}
                            type="password"
                            placeholder={t("companyRegistration.sectorPassword")}
                            value={form.senhasSetores[setor.id]}
                            onChange={(event) => handleSetorSenhaChange(setor.id, event.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="form-section">
              <h2>{t("companyRegistration.access")}</h2>

              {isGoogleSignup && (
                <div className="google-linked-card">
                  <FaGoogle />
                  <div>
                    <strong>{t("companyRegistration.googleLinkedTitle")}</strong>
                    <p>{googleSignupUser.email || t("companyRegistration.googleSelected")}</p>
                  </div>
                </div>
              )}

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="senha">
                    {t("registration.password")}
                  </label>
                  <div className="password-field">
                    <input
                      id="senha"
                      name="senha"
                      type={showPassword ? "text" : "password"}
                      placeholder={isGoogleSignup
                        ? t("registration.googleAccess")
                        : t("companyRegistration.createPassword")}
                      value={form.senha}
                      onChange={handleChange}
                      disabled={isGoogleSignup}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword
                        ? t("registration.hidePassword")
                        : t("registration.showPassword")}
                      disabled={isGoogleSignup}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="field-label" htmlFor="confirmarSenha">
                    {t("registration.confirmPassword")}
                  </label>
                  <div className={`password-field confirm-password-field ${confirmPasswordStatus}`}>
                    <input
                      id="confirmarSenha"
                      name="confirmarSenha"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={isGoogleSignup
                        ? t("registration.googleAccess")
                        : t("companyRegistration.repeatPassword")}
                      value={form.confirmarSenha}
                      onChange={handleChange}
                      disabled={isGoogleSignup}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword((visible) => !visible)}
                      aria-label={showConfirmPassword
                        ? t("registration.hidePasswordConfirmation")
                        : t("registration.showPasswordConfirmation")}
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              </div>

              {!isGoogleSignup && passwordStrength && (
                <div className={`password-strength strength-${passwordStrength.strength}`}>
                  <div className="strength-header">
                    <div>
                      <strong>{t("registration.passwordStrength.label", {
                        strength: t(currentStrength.labelKey)
                      })}</strong>
                      <p>{t(currentStrength.hintKey)}</p>
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
                          {t(item.labelKey)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {!isGoogleSignup && confirmPasswordStatus && (
                <span className={`confirm-password-message ${confirmPasswordStatus}`}>
                  {confirmPasswordStatus === "match"
                    ? t("registration.passwordsMatch")
                    : t("registration.passwordsDoNotMatch")}
                </span>
              )}
            </section>

            <section className="form-section">
              <h2>{t("companyRegistration.payment")}</h2>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="pagamento">
                    {t("companyRegistration.paymentMethod")}
                  </label>
                  <select
                    id="pagamento"
                    name="pagamento"
                    value={form.pagamento}
                    onChange={handleChange}
                  >
                    <option value="">{t("companyRegistration.select")}</option>
                    <option value="pix">Pix</option>
                    <option value="banco">{t("companyRegistration.bankAccount")}</option>
                    <option value="outros">{t("companyRegistration.other")}</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="dadosPagamento">
                    {t("companyRegistration.paymentData")}
                  </label>
                  <input
                    id="dadosPagamento"
                    name="dadosPagamento"
                    placeholder={t("companyRegistration.paymentDataPlaceholder")}
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
                {t("companyRegistration.assistedCuration")}
              </label>

              <label>
                <input
                  type="checkbox"
                  name="termos"
                  checked={form.termos}
                  onChange={handleChange}
                />
                {t("companyRegistration.terms")}
              </label>
            </div>

            <button type="submit" className="submit-button" disabled={!canSubmit}>
              {submitLoading
                ? t("companyRegistration.registering")
                : t("companyRegistration.registerCompany")}
            </button>

            <div className="google-signup-area">
              <div className="google-divider">
                <span>{t("registration.or")}</span>
              </div>

              {googleMessage && (
                <p className={`google-signup-message ${isGoogleSignup ? "success" : "warning"}`}>
                  {googleMessage}
                </p>
              )}

              <button
                type="button"
                className="google-signup-button"
                onClick={handleGoogleSignup}
                disabled={googleLoading || submitLoading || isGoogleSignup}
              >
                <FaGoogle />
                {googleLoading
                  ? t("registration.connecting")
                  : isGoogleSignup
                    ? t("registration.googleLinked")
                    : t("registration.continueWithGoogle")}
              </button>
            </div>
          </form>

          {/* Card lateral com informações do plano selecionado. */}
          <aside className="plano-box">
            <span className="plano-title">{t("companyRegistration.selectedPlan")}</span>

            <div className="plano-card">
              <h2>{t("companyRegistration.planName")}</h2>
              <p className="preco">
                {formatCurrency(499, { maximumFractionDigits: 0 })}<span>{t("companyRegistration.perMonth")}</span>
              </p>

              <ul>
                <li>{t("companyRegistration.jobPosting")}</li>
                <li>{t("companyRegistration.referralManagement")}</li>
                <li>{t("companyRegistration.onboardingSupport")}</li>
              </ul>
            </div>

            <button type="button" className="plano-btn">{t("companyRegistration.changePlan")}</button>

            <div className="help-box">
              <h3>{t("companyRegistration.needHelp")}</h3>
              <p>{t("companyRegistration.helpDescription")}</p>
              <span className="help-link">{t("companyRegistration.talkToExpert")}</span>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
}
