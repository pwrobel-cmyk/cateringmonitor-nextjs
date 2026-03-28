import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Regulamin() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-foreground">Regulamin Serwisu</h1>

      <Card>
        <CardHeader><CardTitle>1. Postanowienia ogólne</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Niniejszy Regulamin określa zasady korzystania z serwisu internetowego CateringMonitor.</p>
          <p className="text-muted-foreground">
            Właścicielem i administratorem serwisu jest: <strong className="text-foreground">Sparrow Labs - NWD.pl usługi internetowe</strong>, ul. Bogusławskiego 11B, 05-092 Łomianki.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Definicje</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3 text-muted-foreground">
            <li><strong className="text-foreground">Serwis</strong> – serwis internetowy służący do monitorowania cen i analizy rynku cateringu dietetycznego.</li>
            <li><strong className="text-foreground">Użytkownik</strong> – każda osoba korzystająca z Serwisu.</li>
            <li><strong className="text-foreground">Konto</strong> – indywidualny profil użytkownika w Serwisie.</li>
            <li><strong className="text-foreground">Administrator</strong> – właściciel i operator Serwisu.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Warunki korzystania z serwisu</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Korzystanie z Serwisu jest dobrowolne i wymaga akceptacji niniejszego Regulaminu.</p>
          <p className="text-muted-foreground">Dostęp do pełnych funkcjonalności Serwisu wymaga rejestracji i utworzenia Konta.</p>
          <p className="text-muted-foreground">Użytkownik zobowiązuje się do korzystania z Serwisu w sposób zgodny z prawem, dobrymi obyczajami oraz postanowieniami Regulaminu.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4. Rejestracja i konto użytkownika</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Rejestracja w Serwisie jest bezpłatna i wymaga podania adresu e-mail oraz hasła.</p>
          <p className="text-muted-foreground">Użytkownik zobowiązany jest do podania prawdziwych danych podczas rejestracji.</p>
          <p className="text-muted-foreground">Użytkownik jest odpowiedzialny za zachowanie poufności danych logowania do Konta.</p>
          <p className="text-muted-foreground">Administrator zastrzega sobie prawo do usunięcia Konta w przypadku naruszenia Regulaminu.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>5. Prawa i obowiązki użytkownika</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Użytkownik ma prawo do:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Korzystania z funkcjonalności Serwisu zgodnie z jego przeznaczeniem</li>
            <li>Dostępu do danych i analiz dostępnych w Serwisie</li>
            <li>Usunięcia swojego Konta w dowolnym momencie</li>
          </ul>
          <p className="text-muted-foreground mt-4">Użytkownik zobowiązuje się do:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Przestrzegania postanowień Regulaminu</li>
            <li>Niepodejmowania działań mogących zakłócić działanie Serwisu</li>
            <li>Nieudostępniania danych logowania osobom trzecim</li>
            <li>Korzystania z Serwisu w sposób niezakłócający działania innych użytkowników</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>6. Odpowiedzialność</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Administrator dokłada wszelkich starań, aby informacje zawarte w Serwisie były aktualne i dokładne, jednak nie ponosi odpowiedzialności za decyzje biznesowe podjęte na ich podstawie.</p>
          <p className="text-muted-foreground">Administrator nie ponosi odpowiedzialności za przerwy w dostępie do Serwisu wynikające z przyczyn technicznych lub innych niezależnych od Administratora.</p>
          <p className="text-muted-foreground">Użytkownik korzysta z Serwisu na własną odpowiedzialność.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>7. Własność intelektualna</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Wszystkie treści zawarte w Serwisie, w tym grafiki, teksty, logo, bazy danych oraz ich układ, podlegają ochronie prawa autorskiego i są własnością Administratora lub innych podmiotów, które udzieliły Administratorowi licencji.</p>
          <p className="text-muted-foreground">Kopiowanie, modyfikowanie lub rozpowszechnianie treści Serwisu bez zgody Administratora jest zabronione.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>8. Reklamacje</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Reklamacje dotyczące funkcjonowania Serwisu można składać za pośrednictwem formularza kontaktowego.</p>
          <p className="text-muted-foreground">Reklamacje rozpatrywane są w terminie do 14 dni roboczych od daty ich otrzymania.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>9. Zmiany w regulaminie</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Administrator zastrzega sobie prawo do wprowadzania zmian w Regulaminie. O zmianach użytkownicy zostaną poinformowani poprzez komunikat w Serwisie.</p>
          <p className="text-muted-foreground">Zmiany wchodzą w życie w terminie wskazanym w komunikacie, nie krótszym niż 7 dni od daty publikacji.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>10. Postanowienia końcowe</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">W sprawach nieuregulowanych niniejszym Regulaminem mają zastosowanie przepisy prawa polskiego.</p>
          <p className="text-muted-foreground">Wszelkie spory rozstrzygane będą przez właściwe polskie sądy powszechne.</p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
      </p>
    </div>
  );
}
