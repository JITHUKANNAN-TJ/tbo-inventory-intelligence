import { useEffect, useState } from 'react'

export interface Route {
  path: string
  param?: string
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/overview'
  const parts = raw.split('/').filter(Boolean)
  return { path: parts[0] ?? 'overview', param: parts[1] }
}

export function navigate(to: string) {
  const target = to.startsWith('/') ? to : `/${to}`
  if (window.location.hash === `#${target}`) return
  window.location.hash = `#${target}`
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const onChange = () => {
      setRoute(parse())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('hashchange', onChange)
    if (!window.location.hash) window.location.hash = '#/overview'
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
