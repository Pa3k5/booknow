from django.db import models
from django.contrib.auth.models import User


class Salon(models.Model):
    vlasnik = models.ForeignKey(User, on_delete=models.CASCADE, related_name='moji_saloni', null=True, blank=True)
    naziv = models.CharField(max_length=120)
    adresa = models.CharField(max_length=200)
    opis = models.TextField(blank=True)
    aktivan = models.BooleanField(default=True)
    radno_od = models.TimeField(default='08:00')
    radno_do = models.TimeField(default='16:00')
    trajanje_termina_min = models.PositiveSmallIntegerField(default=30)

    def __str__(self):
        return self.naziv

# frizer = zaposlenik
class Frizer(models.Model):
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='frizeri')
    ime_prezime = models.CharField(max_length=120)
    aktivan = models.BooleanField(default=True)

    def __str__(self):
        return self.ime_prezime


class Termin(models.Model):
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='termini')
    frizer = models.ForeignKey(Frizer, on_delete=models.CASCADE, related_name='termini')
    datum = models.DateField()
    vrijeme_od = models.TimeField()
    vrijeme_do = models.TimeField()
    slobodan = models.BooleanField(default=True)

    class Meta:
        ordering = ['datum', 'vrijeme_od']
        constraints = [
            models.UniqueConstraint(
                fields=['frizer', 'datum', 'vrijeme_od', 'vrijeme_do'],
                name='jedinstven_termin_po_frizeru',
            ),
            models.CheckConstraint(
                check=models.Q(vrijeme_od__lt=models.F('vrijeme_do')),
                name='termin_pocetak_prije_kraja',
            ),
        ]

    def __str__(self):
        return f'{self.salon.naziv} | {self.datum} {self.vrijeme_od}'


class Rezervacija(models.Model):
    STATUSI = [
        ('potvrdena', 'Potvrđena'),
        ('otkazana', 'Otkazana'),
    ]

    korisnik = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rezervacije')
    termin = models.OneToOneField(Termin, on_delete=models.CASCADE, related_name='rezervacija')
    status = models.CharField(max_length=20, choices=STATUSI, default='potvrdena')
    napomena = models.CharField(max_length=250, blank=True)
    kreirano = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-kreirano']

    def __str__(self):
        return f'{self.korisnik.username} | {self.termin}'
