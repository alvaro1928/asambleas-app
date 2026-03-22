/** Normalización compartida entre /api/votar/validar-identificador y rutas de poderes públicos */

export type UnidadVotarRow = {
  id: string
  torre: string
  numero: string
  coeficiente: number
  nombre_propietario?: string | null
  email?: string | null
  email_propietario?: string | null
  telefono?: string | null
  telefono_propietario?: string | null
}

export const normIdent = (v: string) => v.trim().toLowerCase()
export const normPhone = (v: string) => v.replace(/\D/g, '')
export const normDoc = (v: string) => v.replace(/[^a-z0-9]/gi, '').toLowerCase()

export function emailCoincide(campo: string | null | undefined, emailNorm: string): boolean {
  if (!campo) return false
  return campo
    .split(/[;,]/)
    .map((x) => normIdent(x))
    .filter(Boolean)
    .includes(emailNorm)
}

/** Compara el identificador del votante con el valor guardado en poderes.email_receptor (email, teléfono o doc). */
export function identificadorCoincide(rawStored: string | null | undefined, identificador: string): boolean {
  if (!rawStored) return false
  const stored = normIdent(rawStored)
  if (!stored) return false
  const idNorm = normIdent(identificador)
  if (stored === idNorm) return true
  const telA = normPhone(stored)
  const telB = normPhone(idNorm)
  if (telA && telB && telA === telB) return true
  const docA = normDoc(stored)
  const docB = normDoc(idNorm)
  return !!docA && !!docB && docA === docB
}

export function unidadesPropiasParaIdentificador(
  unidadesRows: UnidadVotarRow[],
  identificador: string
): UnidadVotarRow[] {
  const identNorm = normIdent(identificador)
  const identPhone = normPhone(identNorm)
  const esEmail = identNorm.includes('@')

  return unidadesRows.filter((u) => {
    if (esEmail) {
      return emailCoincide(u.email_propietario ?? u.email ?? '', identNorm)
    }
    if (identPhone) {
      return normPhone(u.telefono_propietario ?? u.telefono ?? '') === identPhone
    }
    return false
  })
}
