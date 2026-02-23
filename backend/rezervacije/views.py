from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count
from datetime import datetime, timedelta
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Salon, Frizer, Termin, Rezervacija
from .permissions import IsAdminOrReadOnly
from .serializers import (
    UserRegisterSerializer,
    SalonSerializer,
    FrizerSerializer,
    TerminSerializer,
    RezervacijaSerializer,
)

 
@api_view(['POST'])
@permission_classes([AllowAny])
def registracija(request):
    serializer = UserRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'token': token.key,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'ime': user.first_name or user.username,
                    'email': user.email,
                    'is_staff': user.is_staff,
                },
            },
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def prijava(request):
    email = request.data.get('email', '').strip()
    password = request.data.get('password')
    user = User.objects.filter(email__iexact=email).first() if email else None
    user = authenticate(username=user.username, password=password) if user else None

    if not user:
        return Response({'error': 'Neispravni podaci za prijavu.'}, status=status.HTTP_400_BAD_REQUEST)

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'ime': user.first_name or user.username,
                'email': user.email,
                'is_staff': user.is_staff,
            },
        }
    )


class SalonViewSet(viewsets.ModelViewSet):
    queryset = Salon.objects.all().order_by('naziv')
    serializer_class = SalonSerializer

    # Samo admin može mijenjati podatke, ostali mogu samo čitati
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_authenticated and self.request.user.is_staff:

            # Admin vidi samo svoje salone
            queryset = queryset.filter(vlasnik=self.request.user)
        else:

            # Obični korisnik vidi samo aktivne salone
            queryset = queryset.filter(aktivan=True)

        q = self.request.query_params.get('q')
        if q:
            queryset = queryset.filter(naziv__icontains=q)
        return queryset

    def perform_create(self, serializer):
        # Automatski postavi trenutnog korisnika kao vlasnika salona
        serializer.save(vlasnik=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if not request.user.is_staff:
        return Response({'error': 'Samo admin može pristupiti.'}, status=status.HTTP_403_FORBIDDEN)

    rezervacije = Rezervacija.objects.select_related('korisnik', 'termin', 'termin__salon').filter(
        termin__salon__vlasnik=request.user
    )
    serializer = RezervacijaSerializer(rezervacije, many=True)
    return Response(serializer.data)


class FrizerViewSet(viewsets.ModelViewSet):
    queryset = Frizer.objects.all().order_by('ime_prezime')
    serializer_class = FrizerSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Ako je admin, vidi samo frizere koji rade u njegovim salonima
        if self.request.user.is_authenticated and self.request.user.is_staff:
            queryset = queryset.filter(salon__vlasnik=self.request.user)

        # Mogućnost filtriranja frizera po ID-u salona (?salon=1)
        salon_id = self.request.query_params.get('salon')
        if salon_id:
            queryset = queryset.filter(salon_id=salon_id)
        return queryset

    def perform_create(self, serializer):
        # Provjera integriteta: Admin smije dodati frizera samo u svoj salon
        salon = serializer.validated_data['salon']
        if salon.vlasnik_id != self.request.user.id:
            raise ValidationError('Ne možeš dodavati frizera u tuđi salon.')
        serializer.save()


class TerminViewSet(viewsets.ModelViewSet):
    queryset = Termin.objects.select_related('salon', 'frizer').all()
    serializer_class = TerminSerializer
    permission_classes = [IsAdminOrReadOnly]

    def list(self, request, *args, **kwargs):
        salon_id = request.query_params.get('salon')
        datum = request.query_params.get('datum')
        samo_slobodni = request.query_params.get('samo_slobodni')

        if samo_slobodni == 'true' and salon_id and datum:
            salon_queryset = Salon.objects.filter(id=salon_id)
            if request.user.is_authenticated and request.user.is_staff:
                salon_queryset = salon_queryset.filter(vlasnik=request.user)
            else:
                salon_queryset = salon_queryset.filter(aktivan=True)
            salon = salon_queryset.first()
            if not salon:
                return Response([], status=status.HTTP_200_OK)

            try:
                datum_obj = datetime.strptime(datum, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Datum nije ispravan.'}, status=status.HTTP_400_BAD_REQUEST)

            broj_aktivnih_frizera = Frizer.objects.filter(salon=salon, aktivan=True).count()
            if broj_aktivnih_frizera == 0:
                return Response([], status=status.HTTP_200_OK)

            zauzeca = (
                Termin.objects.filter(
                    salon_id=salon.id,
                    datum=datum_obj,
                    slobodan=False,
                )
                .values('vrijeme_od', 'vrijeme_do')
                .annotate(ukupno=Count('id'))
            )
            zauzeca_po_slotu = {
                (zauzece['vrijeme_od'], zauzece['vrijeme_do']): zauzece['ukupno'] for zauzece in zauzeca
            }

            rezultat = []
            trajanje = timedelta(minutes=salon.trajanje_termina_min)
            trenutno = datetime.combine(datum_obj, salon.radno_od)
            kraj = datetime.combine(datum_obj, salon.radno_do)

            while trenutno + trajanje <= kraj:
                vrijeme_od = trenutno.time().strftime('%H:%M')
                vrijeme_do_obj = (trenutno + trajanje).time()
                vrijeme_do = vrijeme_do_obj.strftime('%H:%M')
                zauzeto = zauzeca_po_slotu.get((trenutno.time(), vrijeme_do_obj), 0)
                slobodnih_mjesta = max(broj_aktivnih_frizera - zauzeto, 0)
                rezultat.append(
                    {
                        'id': f'{datum}-{vrijeme_od}-{vrijeme_do}',
                        'salon': salon.id,
                        'salon_naziv': salon.naziv,
                        'datum': datum,
                        'vrijeme_od': vrijeme_od,
                        'vrijeme_do': vrijeme_do,
                        'slobodan': slobodnih_mjesta > 0,
                        'slobodnih_mjesta': slobodnih_mjesta,
                        'ukupno_mjesta': broj_aktivnih_frizera,
                    }
                )
                trenutno += trajanje

            return Response(rezultat, status=status.HTTP_200_OK)

        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_authenticated and self.request.user.is_staff:
            queryset = queryset.filter(salon__vlasnik=self.request.user)

        salon_id = self.request.query_params.get('salon')
        datum = self.request.query_params.get('datum')
        samo_slobodni = self.request.query_params.get('samo_slobodni')

        if salon_id:
            queryset = queryset.filter(salon_id=salon_id)
        if datum:
            queryset = queryset.filter(datum=datum)
        if samo_slobodni == 'true':
            queryset = queryset.filter(slobodan=True)

        return queryset.order_by('datum', 'vrijeme_od')

    def perform_create(self, serializer):
        salon = serializer.validated_data['salon']
        frizer = serializer.validated_data['frizer']

        if salon.vlasnik_id != self.request.user.id:
            raise ValidationError('Ne možeš dodavati termin u tuđi salon.')
        if frizer.salon_id != salon.id:
            raise ValidationError('Odabrani frizer ne pripada ovom salonu.')

        serializer.save()


class RezervacijaViewSet(viewsets.ModelViewSet):
    serializer_class = RezervacijaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Rezervacija.objects.select_related('korisnik', 'termin', 'termin__salon').all()
        if self.request.user.is_staff:
            return queryset.filter(termin__salon__vlasnik=self.request.user)
        return queryset.filter(korisnik=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        termin = serializer.validated_data.get('termin')

        if not termin:
            salon = serializer.validated_data.get('salon')
            datum = serializer.validated_data.get('datum')
            vrijeme_od = serializer.validated_data.get('vrijeme_od')
            vrijeme_do = serializer.validated_data.get('vrijeme_do')

            if not salon or not datum or not vrijeme_od or not vrijeme_do:
                return Response({'error': 'Nedostaju podaci za rezervaciju.'}, status=status.HTTP_400_BAD_REQUEST)

            if vrijeme_od >= vrijeme_do:
                return Response({'error': 'Vrijeme početka mora biti prije kraja.'}, status=status.HTTP_400_BAD_REQUEST)
            if vrijeme_od < salon.radno_od or vrijeme_do > salon.radno_do:
                return Response({'error': 'Termin mora biti unutar radnog vremena salona.'}, status=status.HTTP_400_BAD_REQUEST)

            trajanje = int((datetime.combine(datum, vrijeme_do) - datetime.combine(datum, vrijeme_od)).seconds / 60)
            if trajanje != salon.trajanje_termina_min:
                return Response({'error': 'Termin mora odgovarati trajanju salona.'}, status=status.HTTP_400_BAD_REQUEST)

            aktivni_frizeri = list(Frizer.objects.filter(salon=salon, aktivan=True).order_by('id'))
            if not aktivni_frizeri:
                return Response({'error': 'Salon nema aktivnih zaposlenika.'}, status=status.HTTP_400_BAD_REQUEST)

            zauzeti_frizeri = set(
                Termin.objects.filter(
                    salon=salon,
                    datum=datum,
                    vrijeme_od=vrijeme_od,
                    vrijeme_do=vrijeme_do,
                    slobodan=False,
                ).values_list('frizer_id', flat=True)
            )
            slobodni_frizer = next((frizer for frizer in aktivni_frizeri if frizer.id not in zauzeti_frizeri), None)
            if not slobodni_frizer:
                return Response({'error': 'Termin više nije slobodan.'}, status=status.HTTP_400_BAD_REQUEST)

            termin, _ = Termin.objects.get_or_create(
                salon=salon,
                frizer=slobodni_frizer,
                datum=datum,
                vrijeme_od=vrijeme_od,
                vrijeme_do=vrijeme_do,
                defaults={'slobodan': True},
            )

        with transaction.atomic():
            termin = Termin.objects.select_for_update().get(pk=termin.pk)

            postojeca_rezervacija_korisnika = Rezervacija.objects.filter(
                korisnik=request.user,
                termin__salon=termin.salon,
                termin__datum=termin.datum,
                termin__vrijeme_od=termin.vrijeme_od,
                status='potvrdena'
            ).exists()

            if postojeca_rezervacija_korisnika:
                return Response({'error': 'Već imate rezervaciju u ovom salonu za odabrano vrijeme.'}, status=status.HTTP_400_BAD_REQUEST)

            if not termin.slobodan:
                return Response({'error': 'Termin više nije slobodan.'}, status=status.HTTP_400_BAD_REQUEST)

            postojeca_rezervacija = Rezervacija.objects.select_for_update().filter(termin=termin).first()
            if postojeca_rezervacija:
                if postojeca_rezervacija.status != 'otkazana':
                    return Response({'error': 'Termin više nije slobodan.'}, status=status.HTTP_400_BAD_REQUEST)

                postojeca_rezervacija.korisnik = request.user
                postojeca_rezervacija.status = 'potvrdena'
                postojeca_rezervacija.napomena = serializer.validated_data.get('napomena', '')
                postojeca_rezervacija.save(update_fields=['korisnik', 'status', 'napomena'])
                rezervacija = postojeca_rezervacija
            else:
                rezervacija = Rezervacija.objects.create(
                    korisnik=request.user,
                    termin=termin,
                    status='potvrdena',
                    napomena=serializer.validated_data.get('napomena', ''),
                )

            termin.slobodan = False
            termin.save(update_fields=['slobodan'])

        out_serializer = self.get_serializer(rezervacija)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        termin = instance.termin
        instance.delete()
        termin.slobodan = True
        termin.save(update_fields=['slobodan'])

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_staff and instance.korisnik != request.user:
            return Response({'error': 'Nemaš pravo na ovu akciju.'}, status=status.HTTP_403_FORBIDDEN)

        response = super().partial_update(request, *args, **kwargs)
        instance.refresh_from_db()
        if instance.status == 'otkazana':
            termin = instance.termin
            termin.slobodan = True
            termin.save(update_fields=['slobodan'])
        return response

    @action(detail=True, methods=['post'])
    def otkazi(self, request, pk=None):
        rezervacija = self.get_object()
        if not request.user.is_staff and rezervacija.korisnik != request.user:
            return Response({'error': 'Nemaš pravo na ovu akciju.'}, status=status.HTTP_403_FORBIDDEN)

        rezervacija.status = 'otkazana'
        rezervacija.save(update_fields=['status'])
        termin = rezervacija.termin
        termin.slobodan = True
        termin.save(update_fields=['slobodan'])
        return Response({'success': 'Rezervacija je otkazana.'})
