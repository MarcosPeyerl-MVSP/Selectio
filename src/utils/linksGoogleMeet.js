const fusoHorarioPadrao = 'America/Sao_Paulo'

const textoSeguro = (valor, fallback) => {
  const texto = String(valor || '').trim()
  return texto || fallback
}

const compactarData = (data, hora) => {
  const [ano = '', mes = '', dia = ''] = String(data || '').split('-')
  const [horas = '00', minutos = '00'] = String(hora || '00:00').split(':')

  return `${ano}${mes}${dia}T${horas.padStart(2, '0')}${minutos.padStart(2, '0')}00`
}

export const somarMinutosAoHorario = (data, horaInicio, duracaoMinutos = 45) => {
  const [ano, mes, dia] = String(data || '').split('-').map(Number)
  const [horas, minutos] = String(horaInicio || '09:00').split(':').map(Number)
  const duracao = Number(duracaoMinutos || 45)
  const horario = new Date(ano, (mes || 1) - 1, dia || 1, horas || 0, minutos || 0)

  horario.setMinutes(horario.getMinutes() + duracao)

  return `${String(horario.getHours()).padStart(2, '0')}:${String(horario.getMinutes()).padStart(2, '0')}`
}

export const montarTituloMeet = (vagaTitulo, candidatoNome) => (
  `${textoSeguro(vagaTitulo, 'Entrevista Selectio')} - ${textoSeguro(candidatoNome, 'Candidato')}`
)

export const montarDescricaoEntrevista = ({
  candidatoNome,
  candidatoEmail,
  vagaTitulo,
  empresaNome,
  indicadorNome,
  observacoes
}) => [
  `Candidato: ${textoSeguro(candidatoNome, 'Nao informado')}`,
  candidatoEmail ? `E-mail: ${candidatoEmail}` : '',
  `Vaga: ${textoSeguro(vagaTitulo, 'Nao informada')}`,
  empresaNome ? `Empresa: ${empresaNome}` : '',
  indicadorNome ? `Indicador: ${indicadorNome}` : '',
  observacoes ? `Observacoes: ${observacoes}` : '',
  '',
  'Evento gerado pelo Selectio. O link do Google Meet pode ser criado ao salvar o evento no Google Calendar.'
].filter(Boolean).join('\n')

export const montarUrlGoogleCalendarMeet = ({
  titulo,
  data,
  horaInicio,
  horaFim,
  duracaoMinutos = 45,
  descricao,
  fusoHorario = fusoHorarioPadrao
}) => {
  const tituloFinal = textoSeguro(titulo, 'Entrevista Selectio')
  const horarioFim = horaFim || somarMinutosAoHorario(data, horaInicio, duracaoMinutos)
  const parametros = new URLSearchParams({
    action: 'TEMPLATE',
    text: tituloFinal,
    dates: `${compactarData(data, horaInicio)}/${compactarData(data, horarioFim)}`,
    details: descricao || 'Entrevista agendada pelo Selectio.',
    ctz: fusoHorario
  })

  return `https://calendar.google.com/calendar/render?${parametros.toString()}`
}
