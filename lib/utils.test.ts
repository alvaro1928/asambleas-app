import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn (utils)', () => {
  it('combina clases correctamente', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('aplica tailwind-merge para clases conflictivas', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('ignora valores falsy', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('acepta arrays y objetos condicionales', () => {
    expect(cn('base', { active: true, disabled: false })).toContain('base')
    expect(cn('base', { active: true, disabled: false })).toContain('active')
    expect(cn('base', { active: true, disabled: false })).not.toContain('disabled')
  })
})
