from django.contrib.auth.models import User
from django.utils.text import slugify
from django.utils import timezone
from rest_framework import serializers

from .models import Salon, Frizer, Termin, Rezervacija


# Pretvara ime korisnika u sigurni format prikladan za username (bez dijakritika i posebnih znakova)
def normaliziraj_ime_u_username(ime):
    baza = slugify(ime).replace('-', '')
    if not baza:
        baza = 'korisnik'
    return baza


# Generira jedinstveni username dodavanjem broja ako vec postoji korisnik s istim imenom
def generiraj_korisnicko_ime(ime):
    baza = normaliziraj_ime_u_username(ime)

    kandidat = baza
    broj = 1
    while User.objects.filter(username=kandidat).exists():
        kandidat = f'{baza}{broj}'
        broj += 1
    return kandidat


# Serijalizator za registraciju novog korisnika
# Prima ime, email i lozinku, a automatski generira jedinstveni username
class UserRegisterSerializer(serializers.ModelSerializer):
    ime = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True)
    is_vlasnik = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = User
        fields = ['id', 'ime', 'email', 'password', 'is_vlasnik']

    # Provjera da isti email nije vec registriran u sustavu
    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Korisnik s ovim emailom već postoji.')
        return email

    # Kreiranje korisnika uz automatski generirani username na temelju unesenog imena
    def create(self, validated_data):
        ime = validated_data.pop('ime')
        is_staff = validated_data.pop('is_vlasnik', False)
        korisnicko_ime = generiraj_korisnicko_ime(ime)
        return User.objects.create_user(
            username=korisnicko_ime,
            first_name=ime,
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            is_staff=is_staff,
        )


# Serijalizator za model Salon
# Uz standardne podatke o salonu, izlozuje i ime vlasnika kao citljivo polje
class SalonSerializer(serializers.ModelSerializer):
    vlasnik_ime = serializers.CharField(source='vlasnik.first_name', read_only=True)

    class Meta:
        model = Salon
        fields = [
            'id',
            'vlasnik',
            'vlasnik_ime',
            'naziv',
            'adresa',
            'opis',
            'aktivan',
            'radno_od',
            'radno_do',
            'trajanje_termina_min',
        ]
        read_only_fields = ['vlasnik', 'vlasnik_ime']

    # Provjera da je radno vrijeme logicno i da trajanje termina nije izvan dopustenog raspona
    def validate(self, attrs):
        radno_od = attrs.get('radno_od', getattr(self.instance, 'radno_od', None))
        radno_do = attrs.get('radno_do', getattr(self.instance, 'radno_do', None))
        trajanje = attrs.get('trajanje_termina_min', getattr(self.instance, 'trajanje_termina_min', None))

        if radno_od and radno_do and radno_od >= radno_do:
            raise serializers.ValidationError('Radno vrijeme nije ispravno.')
        if trajanje and (trajanje < 5 or trajanje > 180):
            raise serializers.ValidationError('Trajanje termina mora biti između 5 i 180 minuta.')
        return attrs


# Serijalizator za model Frizer, izlaze sve stupce iz tablice
class FrizerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Frizer
        fields = '__all__'


# Serijalizator za model Termin
# Uz ID-ove salona i frizera, dodaje i njihova citljiva imena radi lakseg prikaza na frontendu
class TerminSerializer(serializers.ModelSerializer):
    salon_naziv = serializers.CharField(source='salon.naziv', read_only=True)
    frizer_ime = serializers.CharField(source='frizer.ime_prezime', read_only=True)

    class Meta:
        model = Termin
        fields = [
            'id',
            'salon',
            'salon_naziv',
            'frizer',
            'frizer_ime',
            'datum',
            'vrijeme_od',
            'vrijeme_do',
            'slobodan',
        ]

    # Provjera da je vrijeme pocetka termina prije vremena zavrsetka
    def validate(self, attrs):
        vrijeme_od = attrs.get('vrijeme_od', getattr(self.instance, 'vrijeme_od', None))
        vrijeme_do = attrs.get('vrijeme_do', getattr(self.instance, 'vrijeme_do', None))
        if vrijeme_od and vrijeme_do and vrijeme_od >= vrijeme_do:
            raise serializers.ValidationError('Vrijeme početka mora biti prije kraja.')
        return attrs


# Serijalizator za model Rezervacija
# Kombinira podatke o korisniku, terminu i salonu u jedan odgovor pogodan za frontend
class RezervacijaSerializer(serializers.ModelSerializer):
    termin = serializers.PrimaryKeyRelatedField(
        queryset=Termin.objects.select_related('salon', 'frizer').all(),
        required=False,
    )
    korisnik_username = serializers.CharField(source='korisnik.username', read_only=True)
    korisnik_email = serializers.CharField(source='korisnik.email', read_only=True)
    salon_naziv = serializers.CharField(source='termin.salon.naziv', read_only=True)
    termin_datum = serializers.DateField(source='termin.datum', read_only=True)
    termin_od = serializers.TimeField(source='termin.vrijeme_od', read_only=True)
    termin_do = serializers.TimeField(source='termin.vrijeme_do', read_only=True)
    salon = serializers.PrimaryKeyRelatedField(
        queryset=Salon.objects.filter(aktivan=True),
        write_only=True,
        required=False,
    )
    datum = serializers.DateField(write_only=True, required=False)
    vrijeme_od = serializers.TimeField(write_only=True, required=False)
    vrijeme_do = serializers.TimeField(write_only=True, required=False)

    class Meta:
        model = Rezervacija
        fields = [
            'id',
            'korisnik',
            'korisnik_username',
            'korisnik_email',
            'termin',
            'salon_naziv',
            'termin_datum',
            'termin_od',
            'termin_do',
            'status',
            'napomena',
            'kreirano',
            'salon',
            'datum',
            'vrijeme_od',
            'vrijeme_do',
        ]
        read_only_fields = ['korisnik', 'status', 'kreirano']

    # Provjera da korisnik ne pokusava rezervirati termin koji je vec u proslosti
    def validate(self, attrs):
        datum = attrs.get('datum')
        vrijeme_od = attrs.get('vrijeme_od')
        if datum and vrijeme_od:
            import datetime
            termin_dt = timezone.make_aware(datetime.datetime.combine(datum, vrijeme_od))
            if termin_dt < timezone.now():
                raise serializers.ValidationError('Ne možete rezervirati termin u prošlosti.')
        return attrs
