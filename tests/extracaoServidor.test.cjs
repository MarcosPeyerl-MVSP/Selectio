const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createRequire } = require('node:module')
const path = require('node:path')
const { extrairCurriculo } = require('../functions/src/indicacoesCore.cjs')
const deps = createRequire(path.resolve('functions/package.json'))

test('extracao recusa arquivo acima de 10 MB antes de iniciar o parser', async () => {
  await assert.rejects(extrairCurriculo(Buffer.alloc(10 * 1024 * 1024 + 1), 'application/pdf'),
    (error) => error.details.motivo === 'curriculo_invalido')
})

function pdfTexto(texto) {
  const stream = `BT /F1 12 Tf 40 750 Td (${texto}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ]
  let content = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(content)); content += `${i + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(content)
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(content)
}

test('extrai PDF real no servidor sem texto fornecido pelo navegador', async () => {
  const resultado = await extrairCurriculo(pdfTexto('Desenvolvedor React com cinco anos de experiencia.'), 'application/pdf')
  assert.match(resultado.texto, /Desenvolvedor React/)
  assert.equal(resultado.paginas, 1)
  assert.equal(resultado.metodo, 'pdf_texto_servidor')
})

test('extrai DOCX real e rejeita arquivos ilegíveis e DOC antigo', async () => {
  const Zip = deps('jszip')
  const zip = new Zip()
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Desenvolvedor React com cinco anos de experiencia.</w:t></w:r></w:p></w:body></w:document>')
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const resultado = await extrairCurriculo(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.match(resultado.texto, /Desenvolvedor React/)
  assert.equal(resultado.metodo, 'docx_servidor')
  await assert.rejects(extrairCurriculo(Buffer.from('ilegivel'), 'application/pdf'), (e) => e.details.motivo === 'extracao_falhou')
  await assert.rejects(extrairCurriculo(pdfTexto(''), 'application/pdf'), (e) => e.details.motivo === 'extracao_falhou')
  await assert.rejects(extrairCurriculo(Buffer.from('doc'), 'application/msword'), (e) => e.details.motivo === 'curriculo_invalido')
})
