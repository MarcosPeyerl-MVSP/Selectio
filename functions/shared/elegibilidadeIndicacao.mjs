import { avaliarCompatibilidade } from './motorCompatibilidade.mjs'
import { normalizarRubricaDaVaga, pesosPadraoRubrica, validarRubricaCompatibilidade } from './rubricaCompatibilidade.mjs'

export const LIMIAR_COMPATIBILIDADE_INDICACAO = 45
export const REGRA_INDICACAO_VERSAO = '1.0.0'

export const notaPermiteIndicacao = (nota) => typeof nota === 'number'
  && Number.isFinite(nota) && nota > LIMIAR_COMPATIBILIDADE_INDICACAO && nota <= 100

export const prepararVagaParaIndicacao = (vaga) => {
  if (vaga.rubricaCompatibilidade?.ativa !== false && vaga.rubricaCompatibilidade) return vaga
  const requisitos = Array.isArray(vaga.requisitos) ? vaga.requisitos : String(vaga.requisitos || '').split(/[;\n]/)
  return {
    ...vaga,
    rubricaCompatibilidade: {
      ativa: true, versao: 0, perfilIdeal: String(vaga.descricaoLonga || '').trim(),
      requisitosObrigatorios: requisitos.map(String).map((v) => v.trim()).filter(Boolean),
      requisitosDesejaveis: [], criteriosEliminatorios: [], idiomasExigidos: [],
      experienciaMinima: 0, escolaridadeMinima: '', modeloTrabalho: '', pesos: { ...pesosPadraoRubrica }
    }
  }
}

export const avaliarElegibilidadeIndicacao = ({ candidato, vaga, textoCurriculo = '', extracao = {} }) => {
  const vagaAvaliacao = prepararVagaParaIndicacao(vaga)
  const rubrica = normalizarRubricaDaVaga(vagaAvaliacao.rubricaCompatibilidade)
  if (!validarRubricaCompatibilidade(rubrica).valida) {
    return { analiseValida: false, podeIndicar: false, motivo: 'vaga_sem_criterios' }
  }
  const resultado = avaliarCompatibilidade({ candidato, vaga: vagaAvaliacao, textoCurriculo, extracao })
  const aplicaveis = resultado.criterios.filter((c) => c.peso > 0 && c.resultado !== 'nao_aplicavel')
  if (!aplicaveis.length) return { analiseValida: false, podeIndicar: false, motivo: 'vaga_sem_criterios' }
  if (!aplicaveis.some((c) => c.cobertura > 0)) {
    return { ...resultado, analiseValida: false, podeIndicar: false, motivo: 'candidato_sem_dados' }
  }
  const podeIndicar = notaPermiteIndicacao(resultado.notaPrecisa)
  return {
    ...resultado, analiseValida: true, podeIndicar,
    motivo: podeIndicar ? 'compativel' : 'compatibilidade_insuficiente',
    limite: LIMIAR_COMPATIBILIDADE_INDICACAO, operador: '>', regraVersao: REGRA_INDICACAO_VERSAO,
    rubricaVersao: rubrica.versao, rubricaOrigem: vagaAvaliacao === vaga ? 'configurada' : 'dados_da_vaga',
    semantica: { motor: 'lexical_servidor', modelo: '' }
  }
}
