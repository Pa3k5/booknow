from django.contrib import admin
from .models import Salon, Frizer, Termin, Rezervacija


@admin.register(Salon)
class SalonAdmin(admin.ModelAdmin):
    list_display = ('naziv', 'vlasnik', 'adresa', 'aktivan')
    search_fields = ('naziv', 'adresa')
    list_filter = ('aktivan', 'vlasnik')


@admin.register(Frizer)
class FrizerAdmin(admin.ModelAdmin):
    list_display = ('ime_prezime', 'salon', 'aktivan')
    list_filter = ('salon', 'aktivan')
    search_fields = ('ime_prezime',)


@admin.register(Termin)
class TerminAdmin(admin.ModelAdmin):
    list_display = ('salon', 'frizer', 'datum', 'vrijeme_od', 'vrijeme_do', 'slobodan')
    list_filter = ('salon', 'datum', 'slobodan')
    search_fields = ('salon__naziv', 'frizer__ime_prezime')


@admin.register(Rezervacija)
class RezervacijaAdmin(admin.ModelAdmin):
    list_display = ('korisnik', 'korisnik_email', 'salon_naziv', 'termin', 'status', 'kreirano')
    list_filter = ('status', 'termin__salon', 'termin__datum')
    search_fields = ('korisnik__username', 'korisnik__email', 'termin__salon__naziv')

    def korisnik_email(self, obj):
        return obj.korisnik.email

    def salon_naziv(self, obj):
        return obj.termin.salon.naziv
