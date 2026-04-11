/**
 * Genera plantilla Excel de contingencia: quorum y votación ponderada por coeficiente.
 * Ejecutar: node scripts/generar-excel-contingencia-votacion.mjs
 */
import XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'plantillas')
const OUT_FILE = join(OUT_DIR, 'contingencia-votacion-unidades.xlsx')

const UNIDADES = [
  [101, 'BALLEN FLOR', 2.908],
  [102, 'BERMUDEZ ALIDA', 2.776],
  [201, 'CORREDOR ANA FLOR', 3.17],
  [202, 'MONTENEGRO BIDU', 3.11],
  [203, 'PEDRO LUIS JIMENEZ SOLER', 2.921],
  [204, 'GRUESO GONZALEZ NATALI', 3.342],
  [205, 'MAHECHA MARIA NURY', 3.216],
  [301, 'MANCILLA RICO EDNA IBETH', 3.17],
  [302, 'ZULLY ANDREA VARGAS', 3.12],
  [303, 'DE CARVAJAL CAMILA', 2.887],
  [304, 'GARCIA MARIA IVONNE', 3.381],
  [305, 'MUÑOZ JUAN CAMILO', 3.213],
  [401, 'ALFONSO AURA ALICIA', 3.163],
  [402, 'BERNAL ANA CLELIA', 3.193],
  [403, 'ARCOS CRISTIAN CAMILO', 2.851],
  [404, 'MADERO TRIVIÑO CLARA INES', 3.344],
  [405, 'RUBIO GONZALO', 3.178],
  [501, 'CAÑON DE RANGEL FABIOLA', 3.168],
  [502, 'LA ROTTA MONROY CESAR DAVID', 3.19],
  [503, 'HERNANDEZ JESUS', 2.854],
  [504, 'AMAYA NATALY', 3.334],
  [505, 'ACUÑA PEREZ MARTHA', 3.166],
  [601, 'DIANA ESPERANZA JIMENEZ POVEDA', 3.17],
  [602, 'SABOGAL RAUL', 3.127],
  [603, 'SEGURA GERMAN', 2.862],
  [604, 'ACUÑA DE MEDINA EDILMA', 3.341],
  [605, 'MARCELA CASTILLO HERNANDEZ', 3.166],
  [701, 'MOGOLLON AQUILINO', 3.17],
  [702, 'VILLARRAGA MATEO', 3.123],
  [703, 'RAMIREZ MARLEN', 2.847],
  [704, 'SERRATO ZULUAGA MARTHA', 3.363],
  [705, 'DIANA CAROLINA PACHECO FONSECA', 3.178],
]

const FIRST_DATA_ROW = 15 // Excel row number (1-based)
const LAST_DATA_ROW = FIRST_DATA_ROW + UNIDADES.length - 1
const COL = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7 }

function encCol(c) {
  return XLSX.utils.encode_col(c)
}

function encCell(r, c) {
  return XLSX.utils.encode_cell({ r: r - 1, c })
}

function main() {
  const wb = XLSX.utils.book_new()

  const wsData = {}
  const merges = []

  // —— Hoja Pregunta_1 ——
  wsData[encCell(1, COL.A)] = { v: 'Contingencia — Votación por coeficiente (copropiedad)', t: 's' }
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } })

  wsData[encCell(3, COL.A)] = { v: 'Suma coeficiente censo', t: 's' }
  wsData[encCell(3, COL.B)] = { f: `SUM(${encCol(COL.C)}${FIRST_DATA_ROW}:${encCol(COL.C)}${LAST_DATA_ROW})`, t: 'n' }

  wsData[encCell(4, COL.A)] = { v: 'Coeficiente presente (asistentes)', t: 's' }
  wsData[encCell(4, COL.B)] = {
    f: `SUMPRODUCT(${encCol(COL.C)}${FIRST_DATA_ROW}:${encCol(COL.C)}${LAST_DATA_ROW},${encCol(COL.D)}${FIRST_DATA_ROW}:${encCol(COL.D)}${LAST_DATA_ROW})`,
    t: 'n',
  }

  wsData[encCell(5, COL.A)] = { v: '% censo con asistencia (peso)', t: 's' }
  wsData[encCell(5, COL.B)] = { f: `IF(B3>0,B4/B3,0)`, t: 'n' }

  wsData[encCell(6, COL.A)] = { v: 'Coeficiente a favor (P1)', t: 's' }
  wsData[encCell(6, COL.B)] = { f: `SUM(${encCol(COL.F)}${FIRST_DATA_ROW}:${encCol(COL.F)}${LAST_DATA_ROW})`, t: 'n' }

  wsData[encCell(7, COL.A)] = { v: 'Coeficiente en contra (P1)', t: 's' }
  wsData[encCell(7, COL.B)] = { f: `SUM(${encCol(COL.G)}${FIRST_DATA_ROW}:${encCol(COL.G)}${LAST_DATA_ROW})`, t: 'n' }

  wsData[encCell(8, COL.A)] = { v: 'Coeficiente abstención (P1)', t: 's' }
  wsData[encCell(8, COL.B)] = { f: `SUM(${encCol(COL.H)}${FIRST_DATA_ROW}:${encCol(COL.H)}${LAST_DATA_ROW})`, t: 'n' }

  wsData[encCell(9, COL.A)] = { v: 'Coef. votantes P1 (Sí+No+Abst.)', t: 's' }
  wsData[encCell(9, COL.B)] = { f: `B6+B7+B8`, t: 'n' }

  wsData[encCell(10, COL.A)] = { v: 'Nota: ajuste el umbral de quórum según manual de convivencia / ley.', t: 's' }

  // Encabezados tabla (fila 14)
  const hRow = 14
  const headers = [
    'Número',
    'Propietario',
    'Coeficiente',
    'Asiste (1=sí,0=no)',
    'Voto P1: Sí / No / Abstención',
    'Coef. a favor',
    'Coef. en contra',
    'Coef. abstención',
  ]
  headers.forEach((text, c) => {
    wsData[encCell(hRow, c)] = { v: text, t: 's' }
  })

  UNIDADES.forEach((row, i) => {
    const excelRow = FIRST_DATA_ROW + i
    const [num, nom, coef] = row
    wsData[encCell(excelRow, COL.A)] = { v: num, t: 'n' }
    wsData[encCell(excelRow, COL.B)] = { v: nom, t: 's' }
    wsData[encCell(excelRow, COL.C)] = { v: coef, t: 'n' }
    wsData[encCell(excelRow, COL.D)] = { v: '', t: 'n' } // usuario pone 0 o 1
    wsData[encCell(excelRow, COL.E)] = { v: '', t: 's' }

    const r = excelRow
    // Fórmulas en inglés (Excel las acepta; en Excel en español se traducen al abrir)
    wsData[encCell(r, COL.F)] = {
      f: `IF(AND(${encCol(COL.D)}${r}=1,${encCol(COL.E)}${r}="Sí"),${encCol(COL.C)}${r},0)`,
      t: 'n',
    }
    wsData[encCell(r, COL.G)] = {
      f: `IF(AND(${encCol(COL.D)}${r}=1,${encCol(COL.E)}${r}="No"),${encCol(COL.C)}${r},0)`,
      t: 'n',
    }
    wsData[encCell(r, COL.H)] = {
      f: `IF(AND(${encCol(COL.D)}${r}=1,${encCol(COL.E)}${r}="Abstención"),${encCol(COL.C)}${r},0)`,
      t: 'n',
    }
  })

  wsData[encCell(LAST_DATA_ROW + 2, COL.A)] = { v: 'TOTALES (comprobación)', t: 's' }
  wsData[encCell(LAST_DATA_ROW + 2, COL.C)] = {
    f: `SUM(${encCol(COL.C)}${FIRST_DATA_ROW}:${encCol(COL.C)}${LAST_DATA_ROW})`,
    t: 'n',
  }
  wsData[encCell(LAST_DATA_ROW + 2, COL.F)] = {
    f: `SUM(${encCol(COL.F)}${FIRST_DATA_ROW}:${encCol(COL.F)}${LAST_DATA_ROW})`,
    t: 'n',
  }
  wsData[encCell(LAST_DATA_ROW + 2, COL.G)] = {
    f: `SUM(${encCol(COL.G)}${FIRST_DATA_ROW}:${encCol(COL.G)}${LAST_DATA_ROW})`,
    t: 'n',
  }
  wsData[encCell(LAST_DATA_ROW + 2, COL.H)] = {
    f: `SUM(${encCol(COL.H)}${FIRST_DATA_ROW}:${encCol(COL.H)}${LAST_DATA_ROW})`,
    t: 'n',
  }

  const lastRowTot = LAST_DATA_ROW + 2
  wsData['!ref'] = `A1:H${lastRowTot}`
  wsData['!merges'] = merges
  wsData['!cols'] = [
    { wch: 8 },
    { wch: 38 },
    { wch: 12 },
    { wch: 20 },
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ]

  XLSX.utils.book_append_sheet(wb, wsData, 'Pregunta_1')

  // —— Hoja Instrucciones ——
  const lineas = [
    'CONTINGENCIA — Si no hay sistema digital, use esta plantilla.',
    '',
    '1) Columna D "Asiste": ponga 1 si el propietario (o quien lo representa en sala) está presente, 0 si no.',
    '2) Columna E "Voto": escriba exactamente una de: Sí  |  No  |  Abstención   (con tilde en Sí). Si no asiste, deje vacío o no cuente el voto.',
    '3) Las columnas F, G, H calculan el coeficiente a favor, en contra y en abstención solo si Asiste=1.',
    '4) Arriba verá censo total, coeficiente presente y totales de la pregunta 1.',
    '5) Para más preguntas: clic derecho en la pestaña "Pregunta_1" → Mover o copiar → Crear una copia. Renombre a Pregunta_2 y ajuste el texto de la columna E.',
    '6) Verifique que la suma de la columna C coincide con el 100% del reglamento / acta de constitución.',
  ]
  const wsInst = XLSX.utils.aoa_to_sheet(lineas.map((l) => [l]))
  wsInst['!cols'] = [{ wch: 92 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones')

  mkdirSync(OUT_DIR, { recursive: true })
  XLSX.writeFile(wb, OUT_FILE)
  console.log('Escrito:', OUT_FILE)
}

main()
