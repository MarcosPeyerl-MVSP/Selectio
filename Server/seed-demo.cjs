const bcrypt = require('bcryptjs')
const db = require('./database.cjs')

const senhaPadrao = bcrypt.hashSync('Selectio@123456', 10)

const indicadores = [
  ['Ana Martins', 'ana.indicador@selectio.local', '111.111.111-11', 'ana@pix.local', '1992-04-12'],
  ['Bruno Lima', 'bruno.indicador@selectio.local', '222.222.222-22', 'bruno@pix.local', '1989-09-21'],
  ['Carla Souza', 'carla.indicador@selectio.local', '333.333.333-33', 'carla@pix.local', '1995-01-30'],
  ['Diego Rocha', 'diego.indicador@selectio.local', '444.444.444-44', 'diego@pix.local', '1987-11-08'],
  ['Elisa Ferreira', 'elisa.indicador@selectio.local', '555.555.555-55', 'elisa@pix.local', '1991-06-17'],
]

const empresas = [
  ['Vanguard Tech', 'Vanguard Tecnologia LTDA', '11222333000101', 'contato@vanguard.local', '(11) 4000-1001', 'https://vanguard.local', 'Sao Paulo, SP', 'Tecnologia', '101-500', 'Cartao', '**** 1001', 'Plano Electio', 1],
  ['Nova Labs', 'Nova Labs Produtos Digitais LTDA', '22333444000102', 'people@novalabs.local', '(11) 4000-1002', 'https://novalabs.local', 'Remoto', 'Design', '51-100', 'Boleto', 'Mensal', 'Plano Electio', 1],
  ['Elevate Agency', 'Elevate Marketing LTDA', '33444555000103', 'rh@elevate.local', '(11) 4000-1003', 'https://elevate.local', 'Sao Paulo, SP', 'Marketing', '11-50', 'Pix', 'financeiro@elevate.local', 'Plano Electio', 0],
  ['Atlas Finance', 'Atlas Financeira SA', '44555666000104', 'talentos@atlas.local', '(21) 4000-1004', 'https://atlas.local', 'Rio de Janeiro, RJ', 'Financas', '501-1000', 'Cartao', '**** 1004', 'Plano Electio', 1],
  ['Pulse Health', 'Pulse Health Care LTDA', '55666777000105', 'recrutamento@pulse.local', '(31) 4000-1005', 'https://pulse.local', 'Belo Horizonte, MG', 'Saude', '101-500', 'Boleto', 'Mensal', 'Plano Electio', 0],
]

const vagas = [
  {
    titulo: 'Senior UX Designer',
    empresaId: 1,
    localizacao: 'Sao Paulo, SP',
    salario: 'R$ 14.000 - R$ 18.000',
    tipo: 'Hibrido',
    recompensa: 'R$ 7.500,00',
    descricaoCurta: 'Crie experiencias digitais claras, elegantes e orientadas por pesquisa.',
    descricaoLonga: 'Lidere discovery, prototipacao e evolucao do design system em parceria com produto e engenharia.',
    beneficios: ['Plano de saude', 'Vale refeicao', 'Auxilio home office', 'Educacao continuada'],
    requisitos: ['6+ anos em produto digital', 'Dominio de Figma', 'Pesquisa com usuarios', 'Portfolio consistente'],
    imagem: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    area: 'Design',
  },
  {
    titulo: 'Product Manager Pleno',
    empresaId: 2,
    localizacao: 'Remoto',
    salario: 'R$ 11.000 - R$ 14.000',
    tipo: 'Remoto',
    recompensa: 'R$ 6.000,00',
    descricaoCurta: 'Conduza discovery, priorizacao e entrega de produtos B2B.',
    descricaoLonga: 'Trabalhe com times multidisciplinares para transformar oportunidades de mercado em entregas mensuraveis.',
    beneficios: ['Plano de saude', 'Horario flexivel', 'Stock options', 'Auxilio equipamentos'],
    requisitos: ['3+ anos em produto', 'Conhecimento de metricas', 'Boa comunicacao', 'Experiencia B2B'],
    imagem: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    area: 'Produto',
  },
  {
    titulo: 'Gerente de Growth',
    empresaId: 3,
    localizacao: 'Sao Paulo, SP',
    salario: 'R$ 10.000 - R$ 13.000',
    tipo: 'Presencial',
    recompensa: 'R$ 5.500,00',
    descricaoCurta: 'Escale canais de aquisicao e otimize funis com foco em receita.',
    descricaoLonga: 'Planeje experimentos, acompanhe indicadores e lidere iniciativas de crescimento em varios canais.',
    beneficios: ['Vale refeicao', 'Gympass', 'Bonus por performance', 'Plano odontologico'],
    requisitos: ['Experiencia em growth', 'Analytics avancado', 'Midia paga', 'Testes A/B'],
    imagem: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1200&q=80',
    area: 'Marketing',
  },
  {
    titulo: 'Engenheiro Backend Node.js',
    empresaId: 4,
    localizacao: 'Rio de Janeiro, RJ',
    salario: 'R$ 13.000 - R$ 17.000',
    tipo: 'Hibrido',
    recompensa: 'R$ 8.000,00',
    descricaoCurta: 'Construa APIs robustas para produtos financeiros de alta escala.',
    descricaoLonga: 'Desenvolva servicos Node.js, integre sistemas financeiros e garanta observabilidade e seguranca.',
    beneficios: ['Plano de saude premium', 'PLR', 'Vale alimentacao', 'Certificacoes'],
    requisitos: ['Node.js', 'SQL', 'Arquitetura de APIs', 'Testes automatizados'],
    imagem: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
    area: 'Tecnologia',
  },
  {
    titulo: 'Analista de Dados Senior',
    empresaId: 5,
    localizacao: 'Belo Horizonte, MG',
    salario: 'R$ 9.000 - R$ 12.000',
    tipo: 'Hibrido',
    recompensa: 'R$ 5.000,00',
    descricaoCurta: 'Transforme dados clinicos e operacionais em decisoes melhores.',
    descricaoLonga: 'Crie dashboards, modelos analiticos e estudos para apoiar eficiencia operacional e qualidade assistencial.',
    beneficios: ['Plano de saude', 'Vale refeicao', 'Auxilio educacao', 'Horario flexivel'],
    requisitos: ['SQL avancado', 'Power BI ou Tableau', 'Python', 'Storytelling com dados'],
    imagem: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    area: 'Dados',
  },
]

const candidatos = [
  ['Mariana Costa', 'mariana.costa@email.local', '1993-05-14', 'Feminino', '(11) 98888-1001', 'Product Designer Senior', '7', 'Superior', 'Ingles avancado', 'linkedin.com/in/mariana-costa', 'marianacosta.design', 'github.com/marianacosta', 'Pesquisa, prototipos e design system.', 'Alta aderencia a times colaborativos.', 'Redesenhou jornada B2B com aumento de conversao.', 'Candidata madura, comunicativa e com excelente repertorio.', ['Figma', 'Design System', 'Research'], ['Comunicacao', 'Lideranca'], 'R$ 15.000 - R$ 18.000', 'Hibrido', '30 dias', 'mariana-costa.pdf', 1, 1],
  ['Rafael Nunes', 'rafael.nunes@email.local', '1990-02-22', 'Masculino', '(11) 98888-1002', 'Product Manager', '5', 'Superior', 'Ingles avancado', 'linkedin.com/in/rafael-nunes', 'rafaelnunes.com', 'github.com/rafaelnunes', 'Discovery e priorizacao com foco em metricas.', 'Perfil pragmatico e colaborativo.', 'Liderou produto SaaS com crescimento mensal consistente.', 'Indicado por forte capacidade de conectar negocio e tecnologia.', ['Roadmap', 'Analytics', 'SQL'], ['Negociacao', 'Clareza'], 'R$ 12.000 - R$ 14.000', 'Remoto', '15 dias', 'rafael-nunes.pdf', 2, 2],
  ['Juliana Alves', 'juliana.alves@email.local', '1988-08-03', 'Feminino', '(11) 98888-1003', 'Growth Lead', '8', 'Pos-graduacao', 'Ingles intermediario', 'linkedin.com/in/juliana-alves', 'julianaalves.marketing', '', 'Experimentacao, CRM e aquisicao paga.', 'Tem energia de execucao e bom relacionamento.', 'Construiu funil que reduziu CAC em 22%.', 'Excelente opcao para estruturar operacao de growth.', ['Growth', 'CRM', 'Meta Ads'], ['Resiliencia', 'Organizacao'], 'R$ 11.000 - R$ 13.000', 'Presencial', '30 dias', 'juliana-alves.pdf', 3, 3],
  ['Thiago Pereira', 'thiago.pereira@email.local', '1986-12-19', 'Masculino', '(21) 98888-1004', 'Backend Engineer', '9', 'Superior', 'Ingles avancado', 'linkedin.com/in/thiago-pereira', 'thiagopereira.dev', 'github.com/thiagopereira', 'APIs, arquitetura e seguranca.', 'Perfil tecnico com boa comunicacao.', 'Migrou monolito para servicos com menor latencia.', 'Indicacao forte para ambientes regulados e escala.', ['Node.js', 'PostgreSQL', 'Docker'], ['Mentoria', 'Autonomia'], 'R$ 14.000 - R$ 17.000', 'Hibrido', '45 dias', 'thiago-pereira.pdf', 4, 4],
  ['Beatriz Melo', 'beatriz.melo@email.local', '1994-10-27', 'Feminino', '(31) 98888-1005', 'Senior Data Analyst', '6', 'Superior', 'Ingles intermediario', 'linkedin.com/in/beatriz-melo', 'beatrizmelo.data', 'github.com/beatrizmelo', 'SQL, BI e narrativa executiva.', 'Muito alinhada a contexto de saude.', 'Criou paineis clinicos usados pela diretoria.', 'Candidata cuidadosa, analitica e orientada a impacto.', ['SQL', 'Python', 'Power BI'], ['Pensamento critico', 'Empatia'], 'R$ 10.000 - R$ 12.000', 'Hibrido', 'Imediato', 'beatriz-melo.pdf', 5, 5],
]

const statusIndicador = [
  [1, 4, 3, 0, 1, 2500, 7500],
  [2, 5, 4, 0, 1, 3000, 6000],
  [3, 3, 2, 1, 0, 0, 5500],
  [4, 6, 5, 0, 1, 8000, 8000],
  [5, 2, 2, 0, 0, 0, 5000],
]

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON')

  db.run('DELETE FROM candidatos')
  db.run('DELETE FROM statusIndicador')
  db.run('DELETE FROM vagas')
  db.run('DELETE FROM empresas')
  db.run('DELETE FROM indicadores')
  db.run("DELETE FROM sqlite_sequence WHERE name IN ('candidatos', 'statusIndicador', 'vagas', 'empresas', 'indicadores')")

  const indicadorSql = `
    INSERT INTO indicadores (id, nome, email, senha, cpf, pix, data_nascimento)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `

  indicadores.forEach((indicador, index) => {
    db.run(indicadorSql, [index + 1, indicador[0], indicador[1], senhaPadrao, indicador[2], indicador[3], indicador[4]])
  })

  const empresaSql = `
    INSERT INTO empresas (
      id, nome_empresa, razao_social, cnpj, senha, email, telefone, site, endereco,
      setor, tamanho, forma_pagamento, dados_pagamento, plano, curadoria_ia
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  empresas.forEach((empresa, index) => {
    db.run(empresaSql, [index + 1, empresa[0], empresa[1], empresa[2], senhaPadrao, ...empresa.slice(3)])
  })

  const vagaSql = `
    INSERT INTO vagas (
      id, titulo, empresa, localizacao, salario, tipo, recompensa, descricao_curta,
      descricao_longa, beneficios, requisitos, imagem, area, empresa_id,
      destaque_banner, banner_ativo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  vagas.forEach((vaga, index) => {
    db.run(vagaSql, [
      index + 1,
      vaga.titulo,
      empresas[vaga.empresaId - 1][0],
      vaga.localizacao,
      vaga.salario,
      vaga.tipo,
      vaga.recompensa,
      vaga.descricaoCurta,
      vaga.descricaoLonga,
      JSON.stringify(vaga.beneficios),
      JSON.stringify(vaga.requisitos),
      vaga.imagem,
      vaga.area,
      vaga.empresaId,
      index < 3 ? 1 : 0,
      index < 3 ? 1 : 0,
    ])
  })

  const candidatoSql = `
    INSERT INTO candidatos (
      id, nome, email, data_nascimento, genero, telefone, cargo_atual, anos_experiencia,
      escolaridade, proficiencia_idiomas, linkedin, portfolio, github, pontos_fortes,
      fit_cultural, destaques_projetos, narrativa, hard_skills, soft_skills,
      expectativa_salarial, modelo_trabalho, aviso_previo, curriculo_nome,
      indicador_id, vaga_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  candidatos.forEach((candidato, index) => {
    db.run(candidatoSql, [
      index + 1,
      ...candidato.slice(0, 17),
      JSON.stringify(candidato[17]),
      JSON.stringify(candidato[18]),
      ...candidato.slice(19),
    ])
  })

  const statusSql = `
    INSERT INTO statusIndicador (
      indicador_id, total_indicacoes, vagas_ativas, vagas_canceladas,
      vagas_sucesso, valor_recebido, valor_pendente, taxa_sucesso
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `

  statusIndicador.forEach((status) => {
    const [indicadorId, totalIndicacoes, vagasAtivas, vagasCanceladas, vagasSucesso, valorRecebido, valorPendente] = status
    const taxaSucesso = totalIndicacoes ? Number(((vagasSucesso / totalIndicacoes) * 100).toFixed(1)) : 0

    db.run(statusSql, [
      indicadorId,
      totalIndicacoes,
      vagasAtivas,
      vagasCanceladas,
      vagasSucesso,
      valorRecebido,
      valorPendente,
      taxaSucesso,
    ])
  })
})

db.close((err) => {
  if (err) {
    console.error('Erro ao finalizar seed:', err.message)
    process.exitCode = 1
    return
  }

  console.log('Seed executado: 5 indicadores, 5 empresas, 5 vagas, 5 candidatos e 5 status.')
  console.log('Senha padrao para indicadores e empresas: Selectio@123456')
})
