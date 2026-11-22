import { useRef, useState } from 'react'
import { Button, Card, Confirm, Field, PageHeader, fieldClass } from '../components/ui.tsx'
import { useBookData } from '../hooks/useBookData.tsx'
import { bookingsToCsv, createBackup, parseBackup, shareOrDownload, type RestoredBackup } from '../lib/backup.ts'
import { addTable, deleteTable, restoreBackup, updateSettings, updateTable } from '../lib/db.ts'
import { DURATION_OPTIONS } from '../lib/settings.ts'
import { durationLabel } from '../lib/format.ts'
import { isIos } from '../lib/platform.ts'

export function SettingsPage() {
  const { settings, bookings, tables } = useBookData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tableName, setTableName] = useState('')
  const [seats, setSeats] = useState(2)
  const [notice, setNotice] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState<RestoredBackup | null>(null)
  const onIphone = isIos()

  async function exportCsv() {
    const csv = bookingsToCsv(bookings, tables, settings.timezone)
    await shareOrDownload('booktrack-bookings.csv', csv, 'text/csv')
  }

  async function exportBackup() {
    const json = createBackup(settings, bookings, tables)
    await shareOrDownload('booktrack-backup.json', json, 'application/json')
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    const parsed = parseBackup(text)
    if ('error' in parsed) {
      setNotice(parsed.error)
      setPendingRestore(null)
      return
    }
    setNotice(null)
    setPendingRestore(parsed)
  }

  return (
    <>
      <PageHeader title="Settings" detail="The book stays on this device." />
      <Card className="mb-3">
        <SavedField
          label="Restaurant"
          saved={settings.restaurantName}
          onSave={(next) => {
            if (next !== settings.restaurantName) void updateSettings({ restaurantName: next })
          }}
        />
        <SavedField
          label="Usual party size"
          saved={String(settings.defaultPartySize)}
          inputMode="numeric"
          onSave={(value) => {
            const next = Number(value)
            if (Number.isInteger(next) && next >= 1 && next <= 40 && next !== settings.defaultPartySize) {
              void updateSettings({ defaultPartySize: next })
            }
          }}
        />
        <Field label="Usual sitting">
          <select
            className={fieldClass}
            value={settings.defaultDurationMinutes}
            onChange={(event) => {
              void updateSettings({ defaultDurationMinutes: Number(event.target.value) })
            }}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {durationLabel(minutes)}
              </option>
            ))}
          </select>
        </Field>
        <p className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Appearance</p>
        <div className="grid grid-cols-2 gap-2">
          <Button aria-pressed={settings.theme === 'dark'} variant={settings.theme === 'dark' ? 'primary' : 'secondary'} onClick={() => void updateSettings({ theme: 'dark' })}>
            Dark
          </Button>
          <Button aria-pressed={settings.theme === 'light'} variant={settings.theme === 'light' ? 'primary' : 'secondary'} onClick={() => void updateSettings({ theme: 'light' })}>
            Light
          </Button>
        </div>
      </Card>

      <Card className="mb-3">
        <h2 className="text-lg font-semibold">Tables</h2>
        <p className="mt-1 mb-4 text-sm leading-5 text-muted">Add the tables you book. A booking can still be saved with no table.</p>
        {tables.length === 0 && <p className="mb-3 text-sm text-muted">No tables yet.</p>}
        <div className="flex flex-col gap-2">
          {tables.map((table) => (
            <TableRow
              key={table.id}
              name={table.name}
              seats={table.seats}
              onRename={async (name) => {
                const error = await updateTable(table.id, { name })
                setTableError(error)
              }}
              onSeats={(next) => {
                void updateTable(table.id, { seats: next }).then(setTableError)
              }}
              onDelete={() => {
                void deleteTable(table.id)
              }}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-[1fr_5rem] gap-2">
          <input className={fieldClass} value={tableName} placeholder="Table name" aria-label="Table name" onChange={(event) => setTableName(event.target.value)} />
          <input
            className={fieldClass}
            inputMode="numeric"
            aria-label="Seats"
            value={seats}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isInteger(next)) setSeats(next)
            }}
          />
        </div>
        {tableError && <p className="mt-2 text-sm text-danger">{tableError}</p>}
        <Button
          className="mt-3 w-full"
          size="regular"
          variant="secondary"
          onClick={() => {
            void addTable(tableName, seats).then((error) => {
              setTableError(error)
              if (!error) setTableName('')
            })
          }}
        >
          Add table
        </Button>
      </Card>

      <Card className="mb-3">
        <h2 className="text-lg font-semibold">Backup</h2>
        <p className="mt-1 mb-4 text-sm leading-5 text-muted">
          There is no account. Export a copy if you want the book on another phone, or a spreadsheet of the bookings.
        </p>
        <div className="flex flex-col gap-2">
          <Button size="regular" className="w-full" variant="secondary" onClick={() => void exportCsv()}>Export bookings as CSV</Button>
          <Button size="regular" className="w-full" variant="secondary" onClick={() => void exportBackup()}>Download full backup</Button>
          <Button size="regular" className="w-full" variant="secondary" onClick={() => fileRef.current?.click()}>Restore a backup</Button>
        </div>
        <input
          ref={fileRef}
          className="hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void onFile(file)
          }}
        />
        {notice && <p className="mt-3 text-sm text-danger">{notice}</p>}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">On your iPhone</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {onIphone
            ? 'You already have BookTrack open. Add this page to the Home Screen from Safari’s Share button so it opens full screen.'
            : 'Open the GitHub Pages address in Safari, tap Share, then Add to Home Screen. Chrome on iPhone cannot install it.'}
          {' '}Open it once while you are online. After that, the book works with no connection. Private browsing can wipe it.
        </p>
      </Card>

      {pendingRestore && (
        <Confirm
          title="Replace the book on this device?"
          body={`This restores ${pendingRestore.bookings.length} bookings and ${pendingRestore.tables.length} tables. The current book on this device will be replaced.`}
          confirmLabel="Restore"
          danger
          onCancel={() => setPendingRestore(null)}
          onConfirm={() => {
            const next = pendingRestore
            setPendingRestore(null)
            void restoreBackup(next)
          }}
        />
      )}
    </>
  )
}

function SavedField({
  label,
  saved,
  onSave,
  inputMode = 'text',
}: {
  label: string
  saved: string
  onSave: (value: string) => void
  inputMode?: 'text' | 'numeric'
}) {
  const [draft, setDraft] = useState(saved)

  return (
    <Field label={label}>
      <input
        className={fieldClass}
        inputMode={inputMode}
        value={draft}
        onChange={(event) => {
          const value = event.target.value
          setDraft(value)
          const next = value.trim()
          if (next && next !== saved) onSave(next)
        }}
        onBlur={(event) => {
          const next = event.target.value.trim()
          if (next && next !== saved) onSave(next)
          else setDraft(saved)
        }}
      />
    </Field>
  )
}

function TableRow({
  name,
  seats,
  onRename,
  onSeats,
  onDelete,
}: {
  name: string
  seats: number
  onRename: (name: string) => void
  onSeats: (seats: number) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(name)
  return (
    <div className="grid grid-cols-[1fr_4.5rem_auto] items-center gap-2">
      <input
        className={fieldClass}
        aria-label={`Name for ${name}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft.trim() && draft.trim() !== name) onRename(draft)
          else setDraft(name)
        }}
      />
      <select className={fieldClass} aria-label={`Seats at ${name}`} value={seats} onChange={(event) => onSeats(Number(event.target.value))}>
        {Array.from({ length: 30 }, (_, index) => index + 1).map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
      <button type="button" className="px-2 text-sm font-medium text-danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  )
}
