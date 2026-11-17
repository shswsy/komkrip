import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'

export function usePath(): string {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    window.addEventListener('popstate', on)
    window.addEventListener('kk:navigate', on)
    return () => {
      window.removeEventListener('popstate', on)
      window.removeEventListener('kk:navigate', on)
    }
  }, [])
  return path
}

export function navigate(to: string) {
  if (to === location.pathname + location.search) return
  history.pushState(null, '', to)
  window.dispatchEvent(new Event('kk:navigate'))
  window.scrollTo({ top: 0 })
}

export function Link({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} className={className} onClick={onClick} aria-current={location.pathname === to ? 'page' : undefined}>
      {children}
    </a>
  )
}

export function Pole({ className = '' }: { className?: string }) {
  return (
    <span className={`pole ${className}`} aria-hidden="true">
      <span className="pole-cap" />
      <span className="pole-glass">
        <span className="pole-stripes" />
      </span>
      <span className="pole-cap" />
    </span>
  )
}
