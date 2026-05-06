const db = require('./database.cjs')

const vagas = [
  {
    titulo: 'Senior UX Designer',
    empresa: 'Vanguard Tech',
    localizacao: 'São Paulo, SP',
    salario: 'R$ 14k - 18k',
    tipo: 'Híbrido',
    recompensa: 'R$ 7.500,00',
    descricaoCurta: 'Buscamos um profissional apaixonado por criar experiências digitais que não apenas funcionem perfeitamente, mas que também encantem os usuários.',
    descricaoLonga: 'Como Senior UX Designer na Vanguard Tech, você será responsável por liderar a visão de design dos nossos produtos core, garantindo uma experiência editorial de alta qualidade e eficiência técnica. Trabalhará em estreita colaboração com times de produto, engenharia e pesquisa para transformar problemas complexos em soluções intuitivas.',
    beneficios: [
      'Plano de Saúde Premium',
      'Vale Refeição de R$ 900',
      'Auxílio Home Office',
      'Plataformas de Educação',
    ],
    requisitos: [
      'Mínimo de 6 anos de experiência em design de produtos digitais.',
      'Portfólio demonstrando domínio de sistemas de design e tipografia.',
      'Experiência com ferramentas de prototipagem avançada (Figma, Framer).',
      'Capacidade de conduzir pesquisas com usuários e testes de usabilidade.',
    ],
    imagem: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    area: 'Tecnologia'
  },
  {
    titulo: 'Product Designer Lead',
    empresa: 'Nova Labs',
    localizacao: 'Remoto',
    salario: 'R$ 12.500',
    tipo: 'Remoto',
    recompensa: 'R$ 6.000,00',
    descricaoCurta: 'Lidere projetos de produto com foco em experiência do usuário e produto digital.',
    descricaoLonga: 'Como Product Designer Lead, você vai moldar a estratégia de design, trabalhar com stakeholders e garantir entregas consistentes que impactem diretamente a jornada do usuário.',
    beneficios: [
      'Plano de Saúde Premium',
      'Vale Refeição de R$ 900',
      'Auxílio Home Office',
      'Plataformas de Educação',
    ],
    requisitos: [
      'Experiência em liderança de equipes de design.',
      'Portfólio sólido com produtos escaláveis.',
      'Conhecimento avançado de metodologias ágeis.',
      'Experiência com user research.',
    ],
    imagem: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80',
    area: 'Design'
  },
  {
    titulo: 'Gerente de Growth',
    empresa: 'Elevate Agency',
    localizacao: 'São Paulo, SP',
    salario: 'R$ 11.000',
    tipo: 'Presencial',
    recompensa: 'R$ 5.500,00',
    descricaoCurta: 'Conduza estratégias de growth para impulsionar aquisição e retenção.',
    descricaoLonga: 'Como Gerente de Growth, você será responsável por planejar e executar campanhas, métricas de performance e otimização contínua do funil.',
    beneficios: [
      'Plano de Saúde Premium',
      'Vale Refeição de R$ 900',
      'Auxílio Home Office',
      'Plataformas de Educação',
    ],
    requisitos: [
      'Experiência em growth hacking e funis de crescimento.',
      'Domínio de dados e analytics.',
      'Trabalho com times multidisciplinares.',
      'Experiência em marketing digital.',
    ],
    imagem: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1200&q=80',
    area: 'Marketing'
  }
]

db.serialize(() => {
  vagas.forEach((vaga) => {
    const sql = `
      INSERT OR IGNORE INTO vagas (
        titulo, empresa, localizacao, salario, tipo, recompensa,
        descricao_curta, descricao_longa, beneficios, requisitos,
        imagem, area
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    db.run(
      sql,
      [
        vaga.titulo,
        vaga.empresa,
        vaga.localizacao,
        vaga.salario,
        vaga.tipo,
        vaga.recompensa,
        vaga.descricaoCurta,
        vaga.descricaoLonga,
        JSON.stringify(vaga.beneficios),
        JSON.stringify(vaga.requisitos),
        vaga.imagem,
        vaga.area
      ],
      function (err) {
        if (err) {
          console.error('Erro ao inserir vaga:', err)
        } else {
          console.log(`Vaga "${vaga.titulo}" inserida com ID: ${this.lastID}`)
        }
      }
    )
  })
})

console.log('Seed de vagas executado!')