import { useNavigate } from 'react-router-dom'
import { CalendarPlus, ChevronRight, FileText, Images, ScanLine, Ticket, X } from 'lucide-react'
import { useUI } from '../store/ui'
import { pickFiles } from '../lib/media'
import { draftFromImage, draftFromPdf } from '../lib/ticketImport'

function Sheet({ children }: { children: React.ReactNode }) {
  const openSheet = useUI((s) => s.openSheet)
  return (
    <>
      <div className="backdrop" onClick={() => openSheet(null)} />
      <div className="sheet fixed-col" role="dialog">
        <div className="sheet-grip" />
        {children}
      </div>
    </>
  )
}

function PlusSheet() {
  const nav = useNavigate()
  const openSheet = useUI((s) => s.openSheet)
  const go = (to: string) => {
    openSheet(null)
    nav(to)
  }
  const rows = [
    { t: 'Добавить воспоминание', s: 'Начните с фото с того вечера', bg: 'linear-gradient(135deg,#FF2E88,#FF8A2B)', Icon: Images, on: () => go('/memory/new') },
    { t: 'Запланировать концерт', s: 'Обратный отсчёт, напоминания и заметки', bg: 'linear-gradient(135deg,#7B61FF,#B592FF)', Icon: CalendarPlus, on: () => go('/event/new') },
    { t: 'Добавить билет', s: 'PDF, скриншот или скан бумажного', bg: 'linear-gradient(135deg,#E0531F,#FF9F43)', Icon: Ticket, on: () => openSheet('ticket') },
  ]
  return (
    <Sheet>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 14px' }}>
        <div className="sheet-title">Создать</div>
        <button onClick={() => openSheet(null)} aria-label="Закрыть" style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx2)' }}>
          <X size={20} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <button key={r.t} className="sheet-row" onClick={r.on}>
            <div className="sheet-ico" style={{ background: r.bg }}>
              <r.Icon size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '700 16px var(--sans)' }}>{r.t}</div>
              <div style={{ font: '400 13px var(--sans)', color: 'var(--tx2)', marginTop: 2 }}>{r.s}</div>
            </div>
            <ChevronRight size={20} color="var(--tx3)" />
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function TicketSheet() {
  const nav = useNavigate()
  const { openSheet, setDraft, setBusy, say } = useUI()

  const run = async (accept: string, make: (f: File) => Promise<import('../store/ui').TicketDraft>, label: string) => {
    // several files at once = several tickets for the same concert
    const files = await pickFiles(accept, true)
    if (!files.length) return
    openSheet(null)
    setBusy(label)
    try {
      const drafts = []
      for (const f of files) drafts.push(await make(f))
      setDraft(drafts.length > 1 ? { ...drafts[0], more: drafts.slice(1) } : drafts[0])
      nav('/tickets/assign')
    } catch (e) {
      console.error(e)
      say('Не удалось открыть файл')
    } finally {
      setBusy(null)
    }
  }

  const opt = (label: string, Icon: typeof FileText, on: () => void, accent?: boolean, tint?: [string, string]) => (
    <button
      onClick={on}
      style={{
        height: 150, borderRadius: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 14, textAlign: 'left',
        ...(accent
          ? { background: 'var(--grad)', color: '#fff', boxShadow: '0 12px 30px -12px rgba(255,46,136,.8)' }
          : { background: 'var(--s2)', border: '1px solid var(--line)' }),
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 23, display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent ? 'rgba(255,255,255,.22)' : tint![0], color: accent ? '#fff' : tint![1] }}>
        <Icon size={24} />
      </div>
      <div style={{ font: '700 15px/1.2 var(--sans)' }}>{label}</div>
    </button>
  )

  return (
    <Sheet>
      <div style={{ padding: '0 4px 16px' }}>
        <div className="sheet-title">Добавить билет</div>
        <div style={{ font: '400 14px var(--sans)', color: 'var(--tx2)', marginTop: 4 }}>Из PDF мы прочитаем сектор, ряд и место.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {opt('Импорт PDF', FileText, () => run('application/pdf,.pdf', draftFromPdf, 'Читаем PDF…'), false, ['rgba(255,46,136,.16)', 'var(--mag)'])}
        {opt('Выбрать из фото', Images, () => run('image/*', draftFromImage, 'Готовим изображение…'), false, ['rgba(123,97,255,.18)', 'var(--vi)'])}
        {opt('Сканировать бумажный', ScanLine, () => { openSheet(null); nav('/tickets/scan') }, true)}
      </div>
    </Sheet>
  )
}

export function Sheets() {
  const sheet = useUI((s) => s.sheet)
  if (sheet === 'plus') return <PlusSheet />
  if (sheet === 'ticket') return <TicketSheet />
  return null
}
