import { useLocation } from 'react-router-dom'

/** Area lezioni (la vecchia home). La home "/" è la landing. */
export const LESSONS_PATH = '/lezioni'

/** Stato passato a /accedi e /registrati per riportare lo studente dov'era. */
export interface ReturnState {
  from?: string
}

const AUTH_PATHS = ['/accedi', '/registrati']

/**
 * Dove mandare lo studente dopo login o registrazione: la pagina da cui
 * arrivava (es. /book/123) oppure l'area lezioni. Accetta solo percorsi
 * interni, mai URL esterni.
 */
export function useReturnTo(): string {
  const location = useLocation()
  const from = (location.state as ReturnState | null)?.from
  if (from && from.startsWith('/') && !from.startsWith('//') && !AUTH_PATHS.includes(from)) {
    return from
  }
  return LESSONS_PATH
}
