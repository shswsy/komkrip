import type { CSSProperties } from 'react'
import { staffById } from '../../shared/shop'
import Icon from './Icon'

export default function Avatar({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' }) {
  const s = staffById(id)
  if (!s)
    return (
      <span className={`avatar avatar-${size} avatar-any`} aria-hidden="true">
        <Icon name="scissors" size={size === 'sm' ? 16 : 22} />
      </span>
    )
  return (
    <span className={`avatar avatar-${size}`} style={{ '--h': s.hue } as CSSProperties} aria-hidden="true">
      {s.name.replace('ช่าง', '').replace(/^[เแโใไ]/, '').slice(0, 1)}
    </span>
  )
}
