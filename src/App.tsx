import { useEffect } from 'react'
import { SHOP } from '../shared/shop'
import Admin from './pages/Admin'
import Book from './pages/Book'
import MyBooking from './pages/MyBooking'
import { Link, Pole, usePath } from './router'

export default function App() {
  const path = usePath()
  const admin = path.startsWith('/admin')

  useEffect(() => {
    document.title = admin
      ? `หลังร้าน · ${SHOP.name}`
      : path.startsWith('/my')
        ? `เช็กคิวของฉัน · ${SHOP.name}`
        : `${SHOP.name} — จองคิวตัดผมออนไลน์`
  }, [path, admin])

  return (
    <div className={`shell ${admin ? 'is-admin' : ''}`}>
      <div className="demo-strip" role="note">
        ระบบตัวอย่าง (ร้านสมมติ) — ข้อมูลล้างทุกคืน กรุณาอย่าใส่ชื่อหรือเบอร์จริง
      </div>
      {!admin && (
        <header className="top">
          <div className="wrap top-in">
            <Link to="/" className="brand">
              <Pole className="pole-sm" />
              <span>
                <b>คมกริบ</b>
                <small>BARBER · CHIANG MAI</small>
              </span>
            </Link>
            <nav className="top-nav" aria-label="เมนูหลัก">
              <Link to="/">จองคิว</Link>
              <Link to="/my">คิวของฉัน</Link>
              <Link to="/admin" className="nav-admin">
                หลังร้าน
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main>{admin ? <Admin /> : path.startsWith('/my') ? <MyBooking /> : <Book />}</main>

      {!admin && (
        <footer className="foot">
          <div className="wrap foot-in">
            <div className="foot-brand">
              <Pole className="pole-sm" />
              <div>
                <b>{SHOP.name}</b>
                <span>
                  {SHOP.area} · โทร {SHOP.phone}
                </span>
                <span>เปิดทุกวัน 10:00–20:00 · หยุดวันพุธ</span>
              </div>
            </div>
            <p className="foot-note">
              ร้านนี้เป็นธุรกิจสมมติ สร้างเป็นผลงานตัวอย่างระบบจองคิวสำหรับร้านบริการ (ร้านตัดผม คลินิก สปา ร้านทำเล็บ)
            </p>
          </div>
        </footer>
      )}
    </div>
  )
}
