import { supabase } from './supabase'

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** Cierra sesión vía API (servidor) para no borrar el code_verifier y que Google OAuth siga funcionando. */
export async function signOut() {
  await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' })
}
