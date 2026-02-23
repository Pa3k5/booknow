from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, time

from .models import Salon, Frizer, Termin, Rezervacija


# Testovi koji provjeravaju ispravnost modela Salon
class SalonModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testadmin', password='test1234', is_staff=True)
        self.salon = Salon.objects.create(
            naziv='Test Salon',
            adresa='Test Adresa 1',
            vlasnik=self.user,
            radno_od=time(8, 0),
            radno_do=time(16, 0),
            trajanje_termina_min=30,
        )

    # Provjera da metoda __str__ vraca naziv salona
    def test_salon_str(self):
        self.assertEqual(str(self.salon), 'Test Salon')

    # Provjera da je salon po defaultu aktivan pri kreiranju
    def test_salon_aktivan_default(self):
        self.assertTrue(self.salon.aktivan)

    # Provjera da je trajanje termina ispravno postavljeno
    def test_salon_trajanje(self):
        self.assertEqual(self.salon.trajanje_termina_min, 30)


# Testovi koji provjeravaju ispravnost modela Frizer
class FrizerModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testadmin2', password='test1234', is_staff=True)
        self.salon = Salon.objects.create(
            naziv='Salon 2',
            adresa='Adresa 2',
            vlasnik=self.user,
            radno_od=time(8, 0),
            radno_do=time(16, 0),
        )
        self.frizer = Frizer.objects.create(salon=self.salon, ime_prezime='Ivan Horvat')

    # Provjera da metoda __str__ vraca ime i prezime frizera
    def test_frizer_str(self):
        self.assertEqual(str(self.frizer), 'Ivan Horvat')

    # Provjera da je frizer po defaultu aktivan pri kreiranju
    def test_frizer_aktivan_default(self):
        self.assertTrue(self.frizer.aktivan)

    # Provjera da je frizer ispravno povezan sa odgovarajucim salonom
    def test_frizer_pripada_salonu(self):
        self.assertEqual(self.frizer.salon, self.salon)


# Testovi koji provjeravaju ispravnost modela Rezervacija
class RezervacijaModelTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='adminrez', password='test1234', is_staff=True)
        self.korisnik = User.objects.create_user(username='korisnik1', password='test1234')
        self.salon = Salon.objects.create(
            naziv='Salon Rez',
            adresa='Rez Adresa',
            vlasnik=self.admin,
            radno_od=time(8, 0),
            radno_do=time(16, 0),
        )
        self.frizer = Frizer.objects.create(salon=self.salon, ime_prezime='Ana Kovač')
        self.termin = Termin.objects.create(
            salon=self.salon,
            frizer=self.frizer,
            datum=date(2026, 3, 1),
            vrijeme_od=time(9, 0),
            vrijeme_do=time(9, 30),
        )
        self.rezervacija = Rezervacija.objects.create(
            korisnik=self.korisnik,
            termin=self.termin,
            status='potvrdena',
        )

    # Provjera da rezervacija ima ispravan status
    def test_rezervacija_status(self):
        self.assertEqual(self.rezervacija.status, 'potvrdena')

    # Provjera da je rezervacija ispravno vezana uz korisnika
    def test_rezervacija_korisnik(self):
        self.assertEqual(self.rezervacija.korisnik, self.korisnik)


# Testovi koji provjeravaju API endpoint za registraciju korisnika
class RegistracijaAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    # Provjera da registracija s ispravnim podacima vraca token i status 201
    def test_registracija_uspjesna(self):
        response = self.client.post('/api/auth/registracija/', {
            'ime': 'Pero Perić',
            'email': 'pero@test.com',
            'password': 'lozinka123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)

    # Provjera da sustav odbija registraciju ako email vec postoji u bazi
    def test_registracija_dupliran_email(self):
        User.objects.create_user(username='pero', email='pero@test.com', password='lozinka123')
        response = self.client.post('/api/auth/registracija/', {
            'ime': 'Pero Perić',
            'email': 'pero@test.com',
            'password': 'lozinka123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# Testovi koji provjeravaju API endpoint za prijavu korisnika
class PrijavaAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='marko', email='marko@test.com', password='lozinka123')

    # Provjera da prijava s ispravnim podacima vraca token i status 200
    def test_prijava_uspjesna(self):
        response = self.client.post('/api/auth/prijava/', {
            'email': 'marko@test.com',
            'password': 'lozinka123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)

    # Provjera da prijava s pogresnom lozinkom vraca gresku 400
    def test_prijava_pogresna_lozinka(self):
        response = self.client.post('/api/auth/prijava/', {
            'email': 'marko@test.com',
            'password': 'krivlozinka',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# Testovi koji provjeravaju API endpointe za upravljanje salonima
class SalonAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.korisnik = User.objects.create_user(username='obicniuser', email='u@test.com', password='test1234')
        self.admin = User.objects.create_user(username='adminuser', email='a@test.com', password='test1234', is_staff=True)
        Salon.objects.create(naziv='Salon A', adresa='Adresa A', vlasnik=self.admin, radno_od=time(8, 0), radno_do=time(16, 0))
        Salon.objects.create(naziv='Salon B', adresa='Adresa B', vlasnik=self.admin, radno_od=time(8, 0), radno_do=time(16, 0))

    # Provjera da prijavljeni korisnik moze dohvatiti listu salona
    def test_dohvat_salona(self):
        self.client.force_authenticate(user=self.korisnik)
        response = self.client.get('/api/saloni/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # Provjera da pretraga salona po nazivu ispravno radi
    def test_pretraga_salona(self):
        self.client.force_authenticate(user=self.korisnik)
        response = self.client.get('/api/saloni/?q=Salon A')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # Provjera da obican korisnik ne moze kreirati novi salon (samo admin smije)
    def test_kreiranje_salona_bez_autorizacije(self):
        self.client.force_authenticate(user=self.korisnik)
        response = self.client.post('/api/saloni/', {
            'naziv': 'Novi Salon',
            'adresa': 'Nova Adresa',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
