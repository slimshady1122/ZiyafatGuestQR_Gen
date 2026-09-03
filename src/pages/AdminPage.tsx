import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'
import type { Guest, Scan } from '../types'
import styles from './AdminPage.module.css'

type Tab = 'guests' | 'scans'

export default function AdminPage() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('guests')
  const [guests, setGuests] = useState<Guest[]>([])
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add guest form
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPartySize, setFormPartySize] = useState('1')
  const [formEmail, setFormEmail] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // QR preview modal
  const [qrGuest, setQrGuest] = useState<Guest | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [guestRes, scanRes] = await Promise.all([
      supabase.from('guests').select('*').order('created_at', { ascending: false }),
      supabase.from('scans').select('*, guests(name, party_size)').order('scanned_at', { ascending: false }).limit(200),
    ])
    if (guestRes.data) setGuests(guestRes.data)
    if (scanRes.data) setScans(scanRes.data as Scan[])
    setLoading(false)
  }

  async function addGuest() {
    if (!formName.trim()) { setFormError('Name is required.'); return }
    const size = parseInt(formPartySize)
    if (isNaN(size) || size < 1 || size > 50) { setFormError('Party size must be 1–50.'); return }

    setFormLoading(true)
    setFormError('')
    const { error } = await supabase.from('guests').insert({
      name: formName.trim(),
      party_size: size,
      email: formEmail.trim() || null,
      notes: formNotes.trim() || null,
    })
    setFormLoading(false)

    if (error) {
      setFormError('Failed to add guest. Try again.')
      return
    }

    setFormName('')
    setFormPartySize('1')
    setFormEmail('')
    setFormNotes('')
    setShowForm(false)
    fetchAll()
  }

  async function deleteGuest(id: string) {
    if (!confirm('Delete this guest? Their scan history will also be removed.')) return
    await supabase.from('guests').delete().eq('id', id)
    setGuests(g => g.filter(x => x.id !== id))
    if (qrGuest?.id === id) setQrGuest(null)
  }

  async function openQr(guest: Guest) {
    setQrGuest(guest)
    const dataUrl = await QRCode.toDataURL(guest.id, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
    setQrDataUrl(dataUrl)
  }

  function downloadQr(guest: Guest) {
    const link = document.createElement('a')
    link.download = `${guest.name.replace(/\s+/g, '-')}-ticket.png`
    link.href = qrDataUrl
    link.click()
  }

  async function downloadAllQrs() {
    // Download one by one with small delay to avoid browser blocking
    for (let i = 0; i < guests.length; i++) {
      const g = guests[i]
      const dataUrl = await QRCode.toDataURL(g.id, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      const link = document.createElement('a')
      link.download = `${g.name.replace(/\s+/g, '-')}-ticket.png`
      link.href = dataUrl
      link.click()
      await new Promise(r => setTimeout(r, 200))
    }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus('Importing…')
    const text = await file.text()
    const lines = text.trim().split('\n').slice(1) // skip header row

    const rows = lines.map(line => {
      const [name, party_size, email, notes] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
      return {
        name,
        party_size: parseInt(party_size) || 1,
        email: email || null,
        notes: notes || null,
      }
    }).filter(r => r.name)

    if (rows.length === 0) {
      setImportStatus('No valid rows found. Check CSV format.')
      return
    }

    const { error } = await supabase.from('guests').insert(rows)
    if (error) {
      setImportStatus(`Import failed: ${error.message}`)
    } else {
      setImportStatus(`${rows.length} guests imported.`)
      fetchAll()
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = ''
    setTimeout(() => setImportStatus(''), 4000)
  }

  const filteredGuests = guests.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.email?.toLowerCase().includes(search.toLowerCase())
  )

  const checkedInIds = new Set(scans.filter(s => s.status === 'valid').map(s => s.guest_id))
  const checkedInCount = new Set(scans.filter(s => s.status === 'valid').map(s => s.guest_id)).size

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brand}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>Guest Admin</span>
          </div>

          <nav className={styles.nav}>
            <button
              className={`${styles.navItem} ${tab === 'guests' ? styles.active : ''}`}
              onClick={() => setTab('guests')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              Guests
              <span className={styles.navBadge}>{guests.length}</span>
            </button>

            <button
              className={`${styles.navItem} ${tab === 'scans' ? styles.active : ''}`}
              onClick={() => setTab('scans')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Scan log
              <span className={styles.navBadge}>{scans.length}</span>
            </button>
          </nav>
        </div>

        <div className={styles.sidebarStats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{guests.length}</span>
            <span className={styles.statLabel}>total guests</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: 'var(--green)' }}>{checkedInCount}</span>
            <span className={styles.statLabel}>checked in</span>
          </div>
        </div>

        <div className={styles.sidebarBottom}>
          <p className={styles.userEmail}>{user?.email}</p>
          <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {tab === 'guests' && (
          <>
            {/* Toolbar */}
            <div className={styles.toolbar}>
              <input
                type="search"
                className={styles.search}
                placeholder="Search guests…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className={styles.toolbarActions}>
                {importStatus && <span className={styles.importStatus}>{importStatus}</span>}
                <label className={styles.csvLabel}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    className={styles.hiddenInput}
                    onChange={handleCsvImport}
                  />
                  Import CSV
                </label>
                <button className={styles.btnSecondary} onClick={downloadAllQrs} disabled={guests.length === 0}>
                  Download all QRs
                </button>
                <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
                  + Add guest
                </button>
              </div>
            </div>

            {/* CSV hint */}
            <p className={styles.csvHint}>CSV format: <code>name, party_size, email, notes</code> (header row required)</p>

            {/* Guest table */}
            {loading ? (
              <div className={styles.loading}>Loading…</div>
            ) : filteredGuests.length === 0 ? (
              <div className={styles.empty}>
                {search ? 'No guests match your search.' : 'No guests yet. Add your first guest above.'}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Party size</th>
                      <th>Status</th>
                      <th>Email</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGuests.map(guest => {
                      const checked = checkedInIds.has(guest.id)
                      return (
                        <tr key={guest.id}>
                          <td className={styles.nameCell}>{guest.name}</td>
                          <td>{guest.party_size === 1 ? '1' : guest.party_size}</td>
                          <td>
                            <span className={`${styles.statusPill} ${checked ? styles.checked : styles.notChecked}`}>
                              {checked ? 'Checked in' : 'Pending'}
                            </span>
                          </td>
                          <td className={styles.emailCell}>{guest.email || '—'}</td>
                          <td className={styles.notesCell}>{guest.notes || '—'}</td>
                          <td>
                            <div className={styles.actions}>
                              <button className={styles.actionBtn} onClick={() => openQr(guest)} title="View QR code">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                                  <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                                QR code
                              </button>
                              <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => deleteGuest(guest.id)} title="Delete guest">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'scans' && (
          <>
            <div className={styles.toolbar}>
              <h2 className={styles.tabTitle}>Scan log</h2>
              <button className={styles.btnSecondary} onClick={fetchAll}>Refresh</button>
            </div>

            {loading ? (
              <div className={styles.loading}>Loading…</div>
            ) : scans.length === 0 ? (
              <div className={styles.empty}>No scans recorded yet.</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Guest</th>
                      <th>Party size</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map(scan => (
                      <tr key={scan.id}>
                        <td className={styles.timeCell}>
                          {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          <span className={styles.dateSmall}>
                            {new Date(scan.scanned_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                        <td className={styles.nameCell}>{scan.guests?.name ?? 'Unknown'}</td>
                        <td>{scan.guests?.party_size ?? '—'}</td>
                        <td>
                          <span className={`${styles.statusPill} ${
                            scan.status === 'valid' ? styles.checked :
                            scan.status === 'already_scanned' ? styles.alreadyScanned :
                            styles.invalidPill
                          }`}>
                            {scan.status === 'valid' ? 'Valid' :
                             scan.status === 'already_scanned' ? 'Duplicate' : 'Invalid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Guest Modal */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add guest</h2>
              <button className={styles.closeBtn} onClick={() => setShowForm(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Name *</label>
                <input
                  className={styles.input}
                  type="text"
                  value={formName}
                  onChange={e => { setFormName(e.target.value); setFormError('') }}
                  placeholder="Jane Smith"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Party size *</label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  max="50"
                  value={formPartySize}
                  onChange={e => setFormPartySize(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email (optional)</label>
                <input
                  className={styles.input}
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Notes (optional)</label>
                <input
                  className={styles.input}
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="VIP, dietary restrictions, etc."
                />
              </div>

              {formError && <p className={styles.formError}>{formError}</p>}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={addGuest} disabled={formLoading}>
                {formLoading ? 'Adding…' : 'Add guest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrGuest && (
        <div className={styles.overlay} onClick={() => setQrGuest(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>QR ticket — {qrGuest.name}</h2>
              <button className={styles.closeBtn} onClick={() => setQrGuest(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.qrBody}>
              {qrDataUrl && (
                <img src={qrDataUrl} alt={`QR code for ${qrGuest.name}`} className={styles.qrImage} />
              )}
              <p className={styles.qrName}>{qrGuest.name}</p>
              <p className={styles.qrSub}>Party of {qrGuest.party_size}</p>
              <p className={styles.qrId}>{qrGuest.id}</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setQrGuest(null)}>Close</button>
              <button className={styles.btnPrimary} onClick={() => downloadQr(qrGuest)}>
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
