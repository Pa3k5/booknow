import { useEffect, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'
import { PlusIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Building2, ClipboardList, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout'
import {
  createFrizer,
  createSalon,
  deleteFrizer,
  deleteSalon,
  fetchAdminDashboard,
  fetchSaloni,
  fetchFrizeri,
  updateSalon,
} from '../lib/api'

const defaultSalonForm = {
  naziv: '',
  adresa: '',
  opis: '',
  aktivan: true,
  radno_od: '08:00',
  radno_do: '16:00',
  trajanje_termina_min: 30,
}

const defaultFrizerForm = {
  salon: '',
  ime_prezime: '',
  aktivan: true,
}

const validTabs = new Set(['saloni', 'zaposlenici', 'rezervacije'])

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = validTabs.has(searchParams.get('tab')) ? searchParams.get('tab') : 'saloni'
  const [openSalonDrawer, setOpenSalonDrawer] = useState(false)
  const [openRadnoVrijemeModal, setOpenRadnoVrijemeModal] = useState(false)
  const [salonZaRadnoVrijeme, setSalonZaRadnoVrijeme] = useState(null)
  const [radnoVrijemeForm, setRadnoVrijemeForm] = useState({
    naziv: '',
    adresa: '',
    opis: '',
    radno_od: '08:00',
    radno_do: '16:00',
    trajanje_termina_min: 30,
  })
  const [rezervacije, setRezervacije] = useState([])
  const [saloni, setSaloni] = useState([])
  const [sviZaposlenici, setSviZaposlenici] = useState([])
  const [salonForm, setSalonForm] = useState(defaultSalonForm)
  const [frizerForm, setFrizerForm] = useState(defaultFrizerForm)
  const [isDeleteSalonDialogOpen, setIsDeleteSalonDialogOpen] = useState(false)
  const [pendingDeleteSalon, setPendingDeleteSalon] = useState(null)
  const [isDeleteFrizerDialogOpen, setIsDeleteFrizerDialogOpen] = useState(false)
  const [pendingDeleteFrizer, setPendingDeleteFrizer] = useState(null)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (!validTabs.has(tab)) {
      setSearchParams({ tab: 'saloni' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  async function loadData() {
    try {
      const [dashboardData, saloniData] = await Promise.all([
        fetchAdminDashboard(),
        fetchSaloni(),
      ])
      setRezervacije(dashboardData)
      setSaloni(saloniData)
      if (saloniData.length === 0) {
        setSviZaposlenici([])
        return
      }
      const zaposleniciPoSalonima = await Promise.all(
        saloniData.map(async (salon) => {
          const zaposleniciSalona = await fetchFrizeri(salon.id)
          return zaposleniciSalona.map((zaposlenik) => ({
            ...zaposlenik,
            salon_naziv: salon.naziv,
          }))
        }),
      )
      setSviZaposlenici(zaposleniciPoSalonima.flat())
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    // Podatke učitavamo odmah pri ulasku na admin stranicu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  function handleSalonInput(event) {
    const { name, value } = event.target
    setSalonForm((prev) => ({
      ...prev,
      [name]: name === 'trajanje_termina_min' ? Number(value) : value,
    }))
  }

  async function handleCreateSalon(event) {
    event.preventDefault()
    try {
      await createSalon(salonForm)
      setSalonForm(defaultSalonForm)
      setOpenSalonDrawer(false)
      toast.success('Salon je uspješno dodan.')
      await loadData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function handleFrizerInput(event) {
    const { name, value } = event.target
    setFrizerForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleCreateFrizer(event) {
    event.preventDefault()
    try {
      await createFrizer(frizerForm)
      await loadData()
      setFrizerForm(defaultFrizerForm)
      toast.success('Zaposlenik je uspješno dodan.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleFrizerSalonChange(event) {
    const selectedSalon = event.target.value
    setFrizerForm((prev) => ({ ...prev, salon: selectedSalon }))
  }

  function handleOpenRadnoVrijemeModal(salon) {
    setSalonZaRadnoVrijeme(salon)
    setRadnoVrijemeForm({
      naziv: salon.naziv || '',
      adresa: salon.adresa || '',
      opis: salon.opis || '',
      radno_od: salon.radno_od?.slice(0, 5) || '08:00',
      radno_do: salon.radno_do?.slice(0, 5) || '16:00',
      trajanje_termina_min: salon.trajanje_termina_min ?? 30,
    })
    setOpenRadnoVrijemeModal(true)
  }

  function handleRadnoVrijemeInput(event) {
    const { name, value } = event.target
    setRadnoVrijemeForm((prev) => ({
      ...prev,
      [name]: name === 'trajanje_termina_min' ? Number(value) : value,
    }))
  }

  async function handleSaveRadnoVrijeme(event) {
    event.preventDefault()
    if (!salonZaRadnoVrijeme) return
    const trajanje = radnoVrijemeForm.trajanje_termina_min
    if (Number.isNaN(trajanje) || trajanje < 5 || trajanje > 180) {
      toast.error('Trajanje termina mora biti između 5 i 180 minuta.')
      return
    }
    try {
      await updateSalon(salonZaRadnoVrijeme.id, {
        naziv: radnoVrijemeForm.naziv,
        adresa: radnoVrijemeForm.adresa,
        opis: radnoVrijemeForm.opis,
        radno_od: radnoVrijemeForm.radno_od,
        radno_do: radnoVrijemeForm.radno_do,
        trajanje_termina_min: trajanje,
      })
      setOpenRadnoVrijemeModal(false)
      setSalonZaRadnoVrijeme(null)
      await loadData()
      toast.success('Podaci salona su ažurirani.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDeleteSalon(salon) {
    setPendingDeleteSalon(salon)
    setIsDeleteSalonDialogOpen(true)
  }

  async function handleConfirmDeleteSalon() {
    if (!pendingDeleteSalon) return
    try {
      await deleteSalon(pendingDeleteSalon.id)
      toast.success('Salon i povezani podaci su obrisani.')
      await loadData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsDeleteSalonDialogOpen(false)
      setPendingDeleteSalon(null)
    }
  }

  async function handleDeleteFrizer(zaposlenik) {
    setPendingDeleteFrizer(zaposlenik)
    setIsDeleteFrizerDialogOpen(true)
  }

  async function handleConfirmDeleteFrizer() {
    if (!pendingDeleteFrizer) return
    try {
      await deleteFrizer(pendingDeleteFrizer.id)
      toast.success('Zaposlenik i povezani podaci su obrisani.')
      await loadData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsDeleteFrizerDialogOpen(false)
      setPendingDeleteFrizer(null)
    }
  }

  return (
    <DashboardLayout
      title="Admin pregled"
      links={[
        {
          id: 'saloni',
          to: '/admin?tab=saloni',
          label: 'Moji saloni',
          icon: Building2,
          isActive: activeSection === 'saloni',
        },
        {
          id: 'zaposlenici',
          to: '/admin?tab=zaposlenici',
          label: 'Zaposlenici',
          icon: Users,
          isActive: activeSection === 'zaposlenici',
        },
        {
          id: 'rezervacije',
          to: '/admin?tab=rezervacije',
          label: 'Rezervacije',
          icon: ClipboardList,
          isActive: activeSection === 'rezervacije',
        },
      ]}
    >
      {activeSection === 'saloni' && <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Moji saloni</h3>
          {saloni.length > 0 && (
            <button
              type="button"
              onClick={() => setOpenSalonDrawer(true)}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              <PlusIcon className="mr-1.5 size-4" />
              Novi salon
            </button>
          )}
        </div>

        {saloni.length === 0 ? (
          <div className="py-12 text-center">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" className="mx-auto size-12 text-gray-400">
              <path
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">Nema salona</h3>
            <p className="mt-1 text-sm text-gray-500">Započni tako da kreiraš svoj prvi salon.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setOpenSalonDrawer(true)}
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                <PlusIcon className="mr-1.5 size-5" />
                Novi salon
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saloni.map((salon) => (
              <div key={salon.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{salon.naziv}</p>
                <p className="mt-1 text-sm text-slate-600">{salon.adresa}</p>
                <p className="mt-2 text-xs text-slate-500">{salon.opis || 'Bez opisa'}</p>
                <p className="mt-2 text-xs text-slate-600">
                  Radno vrijeme: {salon.radno_od?.slice(0, 5)} - {salon.radno_do?.slice(0, 5)} ({salon.trajanje_termina_min} min)
                </p>
                <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => handleOpenRadnoVrijemeModal(salon)}
                    className="rounded-md bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    Uredi salon
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSalon(salon)}
                    className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition-colors"
                  >
                    Obriši salon
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>}

      {activeSection === 'zaposlenici' && (
        <>
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-900">Dodavanje zaposlenika</h3>
            <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={handleCreateFrizer}>
              <select
                required
                name="salon"
                value={frizerForm.salon}
                onChange={handleFrizerSalonChange}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
              >
                <option value="">Odaberi salon</option>
                {saloni.map((salon) => (
                  <option key={salon.id} value={salon.id}>
                    {salon.naziv}
                  </option>
                ))}
              </select>
              <input
                required
                name="ime_prezime"
                placeholder="Ime i prezime"
                value={frizerForm.ime_prezime}
                onChange={handleFrizerInput}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
              />
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 sm:w-48"
              >
                Spremi zaposlenika
              </button>
            </form>
          </section>

          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-900">Svi zaposlenici</h3>
            {sviZaposlenici.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">Još nema zaposlenika.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Ime i prezime</th>
                      <th className="px-3 py-2">Salon</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Akcije</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sviZaposlenici.map((zaposlenik) => (
                      <tr key={zaposlenik.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{zaposlenik.ime_prezime}</td>
                        <td className="px-3 py-2">{zaposlenik.salon_naziv}</td>
                        <td className="px-3 py-2">{zaposlenik.aktivan ? 'Aktivan' : 'Neaktivan'}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteFrizer(zaposlenik)}
                            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
                          >
                            Obriši
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeSection === 'rezervacije' && <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-slate-900">Rezervacije</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Ime</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Salon</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Vrijeme</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rezervacije.map((rezervacija) => (
                <tr key={rezervacija.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{rezervacija.korisnik_username}</td>
                  <td className="px-3 py-2">{rezervacija.korisnik_email || '-'}</td>
                  <td className="px-3 py-2">{rezervacija.salon_naziv}</td>
                  <td className="px-3 py-2">{rezervacija.termin_datum}</td>
                  <td className="px-3 py-2">
                    {rezervacija.termin_od} - {rezervacija.termin_do}
                  </td>
                  <td className="px-3 py-2">{rezervacija.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>}

      <Dialog open={openSalonDrawer} onClose={setOpenSalonDrawer} className="relative z-10">
        <div className="fixed inset-0 bg-slate-900/30" />
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <DialogPanel className="pointer-events-auto w-screen max-w-2xl transform transition duration-500 ease-in-out data-closed:translate-x-full">
                <div className="relative flex h-full flex-col overflow-y-auto bg-white py-6 shadow-xl">
                  <div className="px-4 sm:px-6">
                    <div className="flex items-start justify-between">
                      <DialogTitle className="text-base font-semibold text-gray-900">Novi salon</DialogTitle>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          onClick={() => setOpenSalonDrawer(false)}
                          className="rounded-md text-gray-400 hover:text-gray-500"
                        >
                          <span className="sr-only">Zatvori</span>
                          <XMarkIcon aria-hidden="true" className="size-6" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-6 flex-1 px-4 sm:px-6">
                    <form className="grid gap-3" onSubmit={handleCreateSalon}>
                      <input
                        required
                        name="naziv"
                        placeholder="Naziv salona"
                        value={salonForm.naziv}
                        onChange={handleSalonInput}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                      />
                      <input
                        required
                        name="adresa"
                        placeholder="Adresa"
                        value={salonForm.adresa}
                        onChange={handleSalonInput}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                      />
                      <textarea
                        name="opis"
                        placeholder="Opis"
                        value={salonForm.opis}
                        onChange={handleSalonInput}
                        className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          required
                          type="time"
                          name="radno_od"
                          value={salonForm.radno_od}
                          onChange={handleSalonInput}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                        />
                        <input
                          required
                          type="time"
                          name="radno_do"
                          value={salonForm.radno_do}
                          onChange={handleSalonInput}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                        />
                        <input
                          required
                          type="number"
                          min={5}
                          name="trajanje_termina_min"
                          value={salonForm.trajanje_termina_min}
                          onChange={handleSalonInput}
                          placeholder="Trajanje (min)"
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                        />
                      </div>
                      <button
                        type="submit"
                        className="mt-2 inline-flex w-fit items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                      >
                        Spremi salon
                      </button>
                    </form>
                  </div>
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog open={openRadnoVrijemeModal} onClose={() => setOpenRadnoVrijemeModal(false)} className="relative z-10">
        <div className="fixed inset-0 bg-slate-900/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-slate-900">
                Uredi salon
                {salonZaRadnoVrijeme && (
                  <span className="ml-2 text-slate-600">– {salonZaRadnoVrijeme.naziv}</span>
                )}
              </DialogTitle>
              <button
                type="button"
                onClick={() => setOpenRadnoVrijemeModal(false)}
                className="rounded-md text-slate-400 hover:text-slate-600"
              >
                <span className="sr-only">Zatvori</span>
                <XMarkIcon aria-hidden="true" className="size-5" />
              </button>
            </div>
            <form className="mt-6 grid gap-4" onSubmit={handleSaveRadnoVrijeme}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Naziv salona</label>
                <input
                  required
                  type="text"
                  name="naziv"
                  value={radnoVrijemeForm.naziv}
                  onChange={handleRadnoVrijemeInput}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Adresa</label>
                <input
                  required
                  type="text"
                  name="adresa"
                  value={radnoVrijemeForm.adresa}
                  onChange={handleRadnoVrijemeInput}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Opis (opcionalno)</label>
                <textarea
                  name="opis"
                  value={radnoVrijemeForm.opis}
                  onChange={handleRadnoVrijemeInput}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 min-h-24"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Radno vrijeme od</label>
                  <input
                    required
                    type="time"
                    name="radno_od"
                    value={radnoVrijemeForm.radno_od}
                    onChange={handleRadnoVrijemeInput}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Radno vrijeme do</label>
                  <input
                    required
                    type="time"
                    name="radno_do"
                    value={radnoVrijemeForm.radno_do}
                    onChange={handleRadnoVrijemeInput}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Trajanje termina (minute)</label>
                <input
                  required
                  type="number"
                  min={5}
                  max={180}
                  name="trajanje_termina_min"
                  value={radnoVrijemeForm.trajanje_termina_min}
                  onChange={handleRadnoVrijemeInput}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenRadnoVrijemeModal(false)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Spremi
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>

      <Dialog open={isDeleteSalonDialogOpen} onClose={setIsDeleteSalonDialogOpen} className="relative z-10">
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
                    Obrisati salon?
                  </DialogTitle>
                  <p className="mt-2 text-sm text-slate-600">
                    Jesi siguran da želiš obrisati salon <span className="font-semibold">{pendingDeleteSalon?.naziv}</span>? Ovo će kaskadno obrisati zaposlenike, termine i rezervacije tog salona. Potez se ne može vratiti.
                  </p>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleConfirmDeleteSalon}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 sm:ml-3 sm:w-auto"
                >
                  Obriši salon
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteSalonDialogOpen(false)
                    setPendingDeleteSalon(null)
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

      <Dialog open={isDeleteFrizerDialogOpen} onClose={setIsDeleteFrizerDialogOpen} className="relative z-10">
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
                    Obrisati zaposlenika?
                  </DialogTitle>
                  <p className="mt-2 text-sm text-slate-600">
                    Jesi siguran da želiš obrisati zaposlenika <span className="font-semibold">{pendingDeleteFrizer?.ime_prezime}</span>? Time će se obrisati i svi njegovi povezani termini i rezervacije. Potez se ne može vratiti.
                  </p>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleConfirmDeleteFrizer}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 sm:ml-3 sm:w-auto"
                >
                  Obriši zaposlenika
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteFrizerDialogOpen(false)
                    setPendingDeleteFrizer(null)
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
