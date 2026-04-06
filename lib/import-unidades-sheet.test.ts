import { describe, expect, it } from 'vitest'
import {
  extractUnidadImportRow,
  filaSinDatosImport,
  normalizeHeaderKey,
  cleanHeaderKey,
} from './import-unidades-sheet'

describe('normalizeHeaderKey', () => {
  it('unifica tildes, mayúsculas y signos', () => {
    expect(normalizeHeaderKey('  Número  de  Unidad  ')).toBe('numero de unidad')
    expect(normalizeHeaderKey('Unidad (Apto/Casa)')).toBe('unidad apto casa')
    expect(normalizeHeaderKey('Coeficiente %')).toBe('coeficiente')
  })
})

describe('cleanHeaderKey', () => {
  it('quita BOM', () => {
    const k = '\uFEFFnumero'
    expect(cleanHeaderKey(k)).toBe('numero')
  })
})

describe('extractUnidadImportRow', () => {
  it('lee claves estándar', () => {
    const r = extractUnidadImportRow({
      torre: 'A',
      numero: '301',
      coeficiente: '0.5',
      tipo: 'Apartamento',
      propietario: 'Ana',
      email: 'a@x.com',
    })
    expect(r.torre).toBe('A')
    expect(r.numero).toBe('301')
    expect(r.coeficienteStr).toBe('0.5')
    expect(r.email).toBe('a@x.com')
  })

  it('resuelve encabezado con BOM en número', () => {
    const r = extractUnidadImportRow({
      '\uFEFFnumero': '102',
      coeficiente: '0.25',
    })
    expect(r.numero).toBe('102')
    expect(r.coeficienteStr).toBe('0.25')
  })

  it('resuelve columnas solo por nombre semántico', () => {
    const r = extractUnidadImportRow({
      'Apartamento / Casa': '501',
      'Participación copropiedad': '1.234',
      'Bloque residencial': 'T2',
      'Correo electrónico del titular': 'p@q.com',
    })
    expect(r.numero).toBe('501')
    expect(r.coeficienteStr).toBe('1.234')
    expect(r.torre).toBe('T2')
    expect(r.email).toBe('p@q.com')
  })

  it('no confunde coeficiente con columna de unidad', () => {
    const r = extractUnidadImportRow({
      Unidad: '12',
      'Coef. prorrateo': '3.5',
    })
    expect(r.numero).toBe('12')
    expect(r.coeficienteStr).toBe('3.5')
  })
})

describe('filaSinDatosImport', () => {
  it('ignora __rowNum__', () => {
    expect(filaSinDatosImport({ __rowNum__: 34 })).toBe(true)
  })
})
