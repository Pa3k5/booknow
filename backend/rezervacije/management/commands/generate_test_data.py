import random
from datetime import datetime, timedelta, time
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from rezervacije.models import Salon, Frizer, Termin, Rezervacija
from faker import Faker
import unicodedata

def remove_accents(input_str):
    return ''.join(c for c in unicodedata.normalize('NFD', input_str)
                  if unicodedata.category(c) != 'Mn').replace('đ', 'd').replace('Đ', 'D')

class Command(BaseCommand):
    help = 'Generira testne podatke za aplikaciju rezervacije'

    def handle(self, *args, **kwargs):
        self.stdout.write("Brisanje starih podataka...")
        Rezervacija.objects.all().delete()
        Termin.objects.all().delete()
        Frizer.objects.all().delete()
        Salon.objects.all().delete()
        
        fake = Faker('hr_HR')
        
        self.stdout.write("Generiranje testnih korisnika...")
        admin_usernames = ['admin_marko', 'admin_ana']
        admins = []
        for username in admin_usernames:
            user, created = User.objects.get_or_create(username=username)
            user.email = f"{username}@gmail.com"
            user.set_password("12345678")
            user.is_staff = True
            user.is_superuser = True
            user.save()
            admins.append(user)

        users = []
        for _ in range(5):
            first = fake.first_name()
            last = fake.last_name()
            username = remove_accents(f"{first.lower()}_{last.lower()}_{random.randint(10, 99)}").replace(' ', '')
            email = remove_accents(f"{first.lower()}.{last.lower()}@gmail.com").replace(' ', '')
            user, created = User.objects.get_or_create(username=username)
            user.first_name = first
            user.last_name = last
            user.email = email
            user.set_password("12345678")
            user.is_staff = False
            user.is_superuser = False
            user.save()
            users.append(user)

        self.stdout.write("Generiranje salona...")
        salon_data = [
            {'naziv': 'Frizerski salon IN', 'adresa': 'Ilica 10, Zagreb', 'opis': 'Moderno uređen salon za sve generacije.', 'vlasnik': admins[0]},
            {'naziv': 'Barber Shop Classic', 'adresa': 'Savska 50, Zagreb', 'opis': 'Tradicija i kvaliteta.', 'vlasnik': admins[1]},
            {'naziv': 'Hair Studio Beauty', 'adresa': 'Vukovarska 100, Zagreb', 'opis': 'Vaša ljepota na prvom mjestu.', 'vlasnik': None},
            {'naziv': 'Salon Elegance', 'adresa': 'Maksimirska 22, Zagreb', 'opis': 'Ekskluzivni salon za posebne prilike.', 'vlasnik': None},
        ]
        
        saloni = []
        for s_data in salon_data:
            salon = Salon.objects.create(
                naziv=s_data['naziv'],
                adresa=s_data['adresa'],
                opis=s_data['opis'],
                vlasnik=s_data['vlasnik'],
                aktivan=True,
                radno_od=time(8, 0),
                radno_do=time(16, 0),
                trajanje_termina_min=30
            )
            saloni.append(salon)

        self.stdout.write("Generiranje frizera...")
        frizer_imena = [fake.name() for _ in range(11)]
        
        frizeri = []
        frizer_idx = 0
        for i, salon in enumerate(saloni):
            num_frizers = [3, 1, 2, 1][i]
            for _ in range(num_frizers):
                if frizer_idx < len(frizer_imena):
                    f = Frizer.objects.create(
                        salon=salon,
                        ime_prezime=frizer_imena[frizer_idx],
                        aktivan=True
                    )
                    frizeri.append(f)
                    frizer_idx += 1
                
        self.stdout.write("Generiranje termina...")
        termini = []
        today = datetime.now().date()
        for frizer in frizeri:
            for day_offset in range(7):  # Idućih 7 dana
                current_date = today + timedelta(days=day_offset)
                
                # Nekoliko termina po danu
                slots = [
                    (time(8, 0), time(8, 30)),
                    (time(9, 0), time(9, 30)),
                    (time(10, 0), time(10, 30)),
                    (time(12, 0), time(12, 30)),
                    (time(14, 0), time(14, 30)),
                ]
                
                for od, do in slots:
                    t = Termin.objects.create(
                        salon=frizer.salon,
                        frizer=frizer,
                        datum=current_date,
                        vrijeme_od=od,
                        vrijeme_do=do,
                        slobodan=True
                    )
                    termini.append(t)
                    
        self.stdout.write("Generiranje rezervacija...")
        # Nasumično dodijeli nekoliko termina korisnicima
        random.shuffle(termini)
        to_reserve = termini[:20]  # rezerviraj 20 termina od svih generiranih
        
        for t in to_reserve:
            user = random.choice(users)
            status = random.choices(['potvrdena', 'otkazana'], weights=[80, 20], k=1)[0]
            Rezervacija.objects.create(
                korisnik=user,
                termin=t,
                status=status,
                napomena="Trebao bih pranje i šišanje."
            )
            t.slobodan = False
            t.save()
            
        self.stdout.write(self.style.SUCCESS('\nUspješno generirani testni podaci!\n'))
        
        self.stdout.write("--- GENERIRANI EMAILOVI (Lozinka za sve je: 12345678) ---")
        self.stdout.write("Admini:")
        self.stdout.write(", ".join([admin.email for admin in admins]))
            
        self.stdout.write("\nKorisnici:")
        self.stdout.write(", ".join([user.email for user in users]))
        self.stdout.write("---------------------------------------------------------")
