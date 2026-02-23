# Rezervacija termina - Frizerski salon

Projekt za kolegij Programiranje za web

**Student:** Patrik Kajfeš

**Tema:** Aplikacija za rezervaciju termina u frizerskim salonima.

---

## Backend (Django)

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
```

Pokretanje servera:
```bash
python manage.py runserver
```

Generiranje testnih podataka:
```bash
python manage.py generate_test_data
```

Pokretanje testova:
```bash
python manage.py test rezervacije
```

---

## Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Aplikacija se otvara na `http://localhost:5173`

---

## Prijava (nakon generate_test_data)

- **Admin:** `admin_marko@gmail.com` / `12345678`
- **Korisnik:** pogledajte output generate_test_data komande
