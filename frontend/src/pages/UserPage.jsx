import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Building2, ClipboardList, Search } from 'lucide-react'
import { BuildingStorefrontIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '../components/DashboardLayout'
import {
  createRezervacija,
  fetchSaloni,
  fetchTermini,
  fetchUserRezervacije,
  otkaziRezervaciju,
} from '../lib/api'

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

function getCalendarDays(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = (first.getDay() + 6) % 7
  const days = []
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - startPad + i)
    days.push({
      date: d.toISOString().split('T')[0],
      isCurrentMonth: false,
      day: d.getDate(),
    })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const today = getTodayDate()
    days.push({
      date: dateStr,
      isCurrentMonth: true,
      isToday: dateStr === today,
      day: d,
    })
  }
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    days.push({
      date: d.toISOString().split('T')[0],
      isCurrentMonth: false,
      day: d.getDate(),
    })
  }
  return days
}

const MONTH_NAMES = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
]
const WEEKDAYS = ['P', 'U', 'S', 'Č', 'P', 'S', 'N']

const validTabs = new Set(['saloni', 'rezervacije'])

export default function UserPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = validTabs.has(searchParams.get('tab')) ? searchParams.get('tab') : 'saloni'
  const [saloni, setSaloni] = useState([])
  const [aktivniSalon, setAktivniSalon] = useState(null)
  const [termini, setTermini] = useState([])
  const [odabraniTerminId, setOdabraniTerminId] = useState(null)
  const [datum, setDatum] = useState(getTodayDate)
  const [calendarView, setCalendarView] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [rezervacije, setRezervacije] = useState([])
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [pendingCancelRezervacijaId, setPendingCancelRezervacijaId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (!validTabs.has(tab)) {
      setSearchParams({ tab: 'saloni' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    async function loadSaloni() {
      try {
        const data = await fetchSaloni(searchQuery)
        setSaloni(data)
      } catch (err) {
        toast.error(err.message)
      }
    }

    const timer = setTimeout(loadSaloni, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    async function loadRezervacije() {
      if (activeSection !== 'rezervacije') return
      try {
        const data = await fetchUserRezervacije()
        setRezervacije(data)
      } catch (err) {
        toast.error(err.message)
      }
    }

    loadRezervacije()
  }, [activeSection])

  async function handleSelectSalon(salon) {
    setAktivniSalon(salon)
    setOdabraniTerminId(null)
    try {
      const data = await fetchTermini(salon.id, datum)
      setTermini(data)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleRezerviraj(termin) {
    try {
      await createRezervacija({
        salon: aktivniSalon?.id,
        datum: termin.datum,
        vrijeme_od: termin.vrijeme_od,
        vrijeme_do: termin.vrijeme_do,
      })
      toast.success('Termin je uspješno rezerviran.')
      if (aktivniSalon) {
        const data = await fetchTermini(aktivniSalon.id, datum)
        setTermini(data)
      }
      setOdabraniTerminId(null)
      const rezData = await fetchUserRezervacije()
      setRezervacije(rezData)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDaySelect(dateStr) {
    setDatum(dateStr)
    setOdabraniTerminId(null)
    if (!aktivniSalon) return
    try {
      const data = await fetchTermini(aktivniSalon.id, dateStr)
      setTermini(data)
    } catch (err) {
      toast.error(err.message)
    }
  }

  function handlePrevMonth() {
    setCalendarView((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 }
      return { year: prev.year, month: prev.month - 1 }
    })
  }

  function handleNextMonth() {
    setCalendarView((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 }
      return { year: prev.year, month: prev.month + 1 }
    })
  }

  function handleToday() {
    const today = getTodayDate()
    setDatum(today)
    setOdabraniTerminId(null)
    const d = new Date()
    setCalendarView({ year: d.getFullYear(), month: d.getMonth() })
    if (aktivniSalon) {
      fetchTermini(aktivniSalon.id, today)
        .then(setTermini)
        .catch((err) => toast.error(err.message))
    }
  }

  function formatTime(value) {
    if (typeof value === 'string' && value.length >= 5) return value.slice(0, 5)
    return value
  }

  const odabraniTermin = useMemo(
    () => termini.find((termin) => termin.id === odabraniTerminId && termin.slobodan) || null,
    [termini, odabraniTerminId],
  )

  async function handleOtkaziRezervaciju(rezervacijaId) {
    setPendingCancelRezervacijaId(rezervacijaId)
    setIsCancelDialogOpen(true)
  }

  async function handleConfirmOtkaziRezervaciju() {
    if (!pendingCancelRezervacijaId) {
      return
    }
    try {
      await otkaziRezervaciju(pendingCancelRezervacijaId)
      toast.success('Rezervacija je uspješno otkazana.')
      const data = await fetchUserRezervacije()
      setRezervacije(data)
      if (aktivniSalon) {
        const terminiData = await fetchTermini(aktivniSalon.id, datum)
        setTermini(terminiData)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsCancelDialogOpen(false)
      setPendingCancelRezervacijaId(null)
    }
  }

  const calendarDays = useMemo(
    () => getCalendarDays(calendarView.year, calendarView.month),
    [calendarView.year, calendarView.month],
  )

  return (
    <DashboardLayout
      title=""
      links={[
        {
          id: 'saloni',
          to: '/user?tab=saloni',
          label: 'Saloni',
          icon: Building2,
          isActive: activeSection === 'saloni',
        },
        {
          id: 'rezervacije',
          to: '/user?tab=rezervacije',
          label: 'Rezervacije',
          icon: ClipboardList,
          isActive: activeSection === 'rezervacije',
        },
      ]}
    >
      {activeSection === 'saloni' && (
        <>
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Dostupni saloni</h3>
            <div className="mb-4 relative w-full sm:w-64">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="size-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Pretraži salone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {saloni.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
                <BuildingStorefrontIcon className="size-6 text-slate-400" />
                <p className="text-sm text-slate-600">
                  {searchQuery ? 'Nema salona koji odgovaraju pretrazi.' : 'Trenutno nema dostupnih salona. Admin prvo treba dodati salon.'}
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {saloni.map((salon) => (
                  <button
                    key={salon.id}
                    type="button"
                    onClick={() => handleSelectSalon(salon)}
                    className={`rounded-md border p-3 text-left ${aktivniSalon?.id === salon.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                  >
                    <p className="font-semibold text-slate-900">{salon.naziv}</p>
                    <p className="text-sm text-slate-600">{salon.adresa}</p>
                    <p className="mt-1 text-xs text-slate-500">{salon.aktivan ? 'Aktivan' : 'Neaktivan'}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {aktivniSalon ? `Slobodni termini - ${aktivniSalon.naziv}` : 'Odaberite salon za pregled termina'}
            </h3>

            {aktivniSalon && (
              <div className="mt-4 flex min-h-[420px] flex-col gap-6 lg:flex-row lg:items-stretch">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Termini za {new Date(datum + 'T12:00:00').toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' })}:
                  </p>
                  {termini.length === 0 ? (
                    <p className="text-sm text-slate-500">Nema slobodnih termina za ovaj datum.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {termini.map((termin) => {
                          const isSelected = odabraniTerminId === termin.id
                          return (
                            <button
                              key={termin.id}
                              type="button"
                              disabled={!termin.slobodan}
                              onClick={() => setOdabraniTerminId(termin.id)}
                              className={`rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition ${isSelected
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                                } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white`}
                            >
                              {formatTime(termin.vrijeme_od)} - {formatTime(termin.vrijeme_do)}
                            </button>
                          )
                        })}
                      </div>

                      {odabraniTermin && (
                        <div className="mt-4 flex justify-start">
                          <button
                            type="button"
                            onClick={() => handleRezerviraj(odabraniTermin)}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                          >
                            Potvrdi rezervaciju
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex min-w-[320px] shrink-0 lg:min-h-full">
                  <div className="flex w-full min-w-[320px] max-w-[420px] flex-1 flex-col">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Prethodni mjesec"
                        >
                          <ChevronLeftIcon className="size-5" />
                        </button>
                        <span className="min-w-[140px] text-center text-sm font-semibold text-slate-900">
                          {MONTH_NAMES[calendarView.month]} {calendarView.year}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Sljedeći mjesec"
                        >
                          <ChevronRightIcon className="size-5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleToday}
                        className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                      >
                        Danas
                      </button>
                    </div>

                    <div className="mt-4 grid flex-1 grid-cols-7 gap-px rounded-lg bg-slate-200 text-center ring-1 ring-slate-200">
                      {WEEKDAYS.map((w) => (
                        <div key={w} className="flex items-center justify-center rounded-t bg-slate-50 py-2 text-xs font-medium text-slate-500">
                          {w}
                        </div>
                      ))}
                      {calendarDays.map((day) => {
                        const isSelected = day.date === datum
                        return (
                          <button
                            key={day.date}
                            type="button"
                            onClick={() => handleDaySelect(day.date)}
                            className={`flex min-h-[2.5rem] items-center justify-center rounded-sm text-sm transition ${!day.isCurrentMonth
                              ? 'bg-slate-50 text-slate-400'
                              : isSelected
                                ? 'bg-indigo-600 font-semibold text-white'
                                : day.isToday
                                  ? 'bg-indigo-50 font-semibold text-indigo-600 hover:bg-indigo-100'
                                  : 'bg-white text-slate-900 hover:bg-slate-50'
                              }`}
                          >
                            {day.day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {activeSection === 'rezervacije' && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-slate-900">Moje rezervacije</h3>
          {rezervacije.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Nema rezervacija.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Salon</th>
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Vrijeme</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Akcija</th>
                  </tr>
                </thead>
                <tbody>
                  {rezervacije.map((rez) => (
                    <tr key={rez.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{rez.salon_naziv}</td>
                      <td className="px-3 py-2">{rez.termin_datum}</td>
                      <td className="px-3 py-2">
                        {formatTime(rez.termin_od)} - {formatTime(rez.termin_do)}
                      </td>
                      <td className="px-3 py-2">{rez.status}</td>
                      <td className="px-3 py-2 text-right">
                        {rez.status === 'potvrdena' ? (
                          <button
                            type="button"
                            onClick={() => handleOtkaziRezervaciju(rez.id)}
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                          >
                            Otkaži
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Dialog open={isCancelDialogOpen} onClose={setIsCancelDialogOpen} className="relative z-10">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-slate-900/50 transition-opacity data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
        />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in data-closed:sm:translate-y-0 data-closed:sm:scale-95"
            >
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:size-10">
                  <ExclamationTriangleIcon aria-hidden="true" className="size-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <DialogTitle as="h3" className="text-base font-semibold text-slate-900">
                    Otkazivanje rezervacije
                  </DialogTitle>
                  <p className="mt-2 text-sm text-slate-600">
                    Jeste li sigurni da želite otkazati odabranu rezervaciju?
                  </p>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleConfirmOtkaziRezervaciju}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 sm:ml-3 sm:w-auto"
                >
                  Otkaži rezervaciju
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCancelDialogOpen(false)
                    setPendingCancelRezervacijaId(null)
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 sm:mt-0 sm:w-auto"
                >
                  Odustani
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </DashboardLayout>
  )
}
