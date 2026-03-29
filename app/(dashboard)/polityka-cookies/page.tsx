import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PolitykaCookies() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-foreground mb-8">Polityka Cookies</h1>

      <Card className="mb-6">
        <CardHeader><CardTitle>1. Czym są pliki cookies?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Pliki cookies (tzw. &quot;ciasteczka&quot;) to małe pliki tekstowe zapisywane na urządzeniu użytkownika
            podczas przeglądania stron internetowych. Zawierają informacje niezbędne do prawidłowego
            funkcjonowania strony lub służące do zbierania statystyk.
          </p>
          <p className="text-muted-foreground">
            Właścicielem serwisu jest:{' '}
            <strong className="text-foreground">Sparrow Labs - NWD.pl usługi internetowe</strong>, ul. Bogusławskiego 11B, 05-092 Łomianki.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>2. Jakie pliki cookies wykorzystujemy?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Niezbędne pliki cookies</h4>
              <p className="text-muted-foreground">Są niezbędne do prawidłowego funkcjonowania serwisu. Umożliwiają podstawowe funkcje, takie jak nawigacja po stronie, dostęp do bezpiecznych obszarów oraz zarządzanie sesją użytkownika.</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                <li>Pliki sesji użytkownika</li>
                <li>Pliki uwierzytelniania</li>
                <li>Pliki zabezpieczeń</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Funkcjonalne pliki cookies</h4>
              <p className="text-muted-foreground">Pozwalają na zapamiętanie wyborów dokonanych przez użytkownika (np. język, region) oraz zapewniają ulepszone, bardziej spersonalizowane funkcje.</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                <li>Preferencje użytkownika</li>
                <li>Ustawienia wyświetlania</li>
                <li>Zapamiętane wybory</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Analityczne pliki cookies</h4>
              <p className="text-muted-foreground">Służą do zbierania informacji o sposobie korzystania z serwisu. Pomagają nam zrozumieć, jak użytkownicy korzystają ze strony, co pozwala nam na jej ulepszanie.</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                <li>Statystyki odwiedzin</li>
                <li>Analiza zachowań użytkowników</li>
                <li>Pomiary wydajności</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>3. Cel wykorzystywania plików cookies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Wykorzystujemy pliki cookies w następujących celach:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Zapewnienie prawidłowego funkcjonowania serwisu</li>
            <li>Uwierzytelnianie użytkowników i zarządzanie sesjami</li>
            <li>Zapamiętanie preferencji i ustawień użytkownika</li>
            <li>Analiza ruchu i zachowań użytkowników w celu ulepszania serwisu</li>
            <li>Zapewnienie bezpieczeństwa i ochrony przed nadużyciami</li>
            <li>Optymalizacja wydajności serwisu</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>4. Zarządzanie plikami cookies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Większość przeglądarek internetowych akceptuje pliki cookies automatycznie. Użytkownik może w dowolnym momencie zmienić ustawienia swojej przeglądarki, aby blokować lub usuwać pliki cookies.</p>
          <div className="space-y-3 mt-4">
            <h4 className="font-semibold text-foreground">Jak zarządzać cookies w różnych przeglądarkach:</h4>
            <div className="space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Google Chrome:</strong> Ustawienia → Prywatność i bezpieczeństwo → Pliki cookie i inne dane witryn</p>
              <p><strong className="text-foreground">Mozilla Firefox:</strong> Opcje → Prywatność i bezpieczeństwo → Pliki cookie i dane stron</p>
              <p><strong className="text-foreground">Microsoft Edge:</strong> Ustawienia → Pliki cookie i uprawnienia witryny → Zarządzaj plikami cookie i danymi witryny oraz usuń je</p>
              <p><strong className="text-foreground">Safari:</strong> Preferencje → Prywatność → Zarządzaj danymi witryn</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>5. Wyłączenie plików cookies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Użytkownik może w dowolnej chwili wyłączyć lub usunąć pliki cookies za pomocą ustawień przeglądarki. Należy jednak pamiętać, że wyłączenie plików cookies może wpłynąć na funkcjonalność serwisu i uniemożliwić korzystanie z niektórych funkcji.</p>
          <p className="text-muted-foreground">W szczególności, wyłączenie niezbędnych plików cookies uniemożliwi logowanie do konta oraz korzystanie z funkcji wymagających uwierzytelnienia.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>6. Pliki cookies stron trzecich</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Nasz serwis może wykorzystywać usługi podmiotów trzecich (np. narzędzia analityczne), które również mogą instalować własne pliki cookies. Zachęcamy do zapoznania się z politykami prywatności tych podmiotów.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>7. Zmiany w polityce cookies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Zastrzegamy sobie prawo do wprowadzania zmian w niniejszej Polityce Cookies. O wszelkich istotnych zmianach będziemy informować użytkowników poprzez komunikaty w serwisie.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>8. Kontakt</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">W przypadku pytań dotyczących naszej Polityki Cookies, prosimy o kontakt za pośrednictwem formularza kontaktowego dostępnego w serwisie.</p>
        </CardContent>
      </Card>
    </main>
  )
}
