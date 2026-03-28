import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PolitykaPrywatnosci() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-foreground">Polityka Prywatności</h1>

      <Card>
        <CardHeader><CardTitle>1. Administrator danych</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Administratorem danych osobowych zbieranych za pośrednictwem serwisu CateringMonitor jest: <strong className="text-foreground">Sparrow Labs - NWD.pl usługi internetowe</strong>, ul. Bogusławskiego 11B, 05-092 Łomianki.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Zakres zbieranych danych</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Serwis zbiera dane osobowe podane dobrowolnie przez użytkownika podczas rejestracji oraz korzystania z serwisu, w tym:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Adres e-mail</li>
            <li>Dane techniczne (adres IP, typ przeglądarki, system operacyjny)</li>
            <li>Informacje o aktywności w serwisie</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Cel przetwarzania danych</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Dane osobowe są przetwarzane w następujących celach:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Świadczenie usług dostępnych w serwisie</li>
            <li>Zarządzanie kontem użytkownika</li>
            <li>Komunikacja z użytkownikami</li>
            <li>Zapewnienie bezpieczeństwa i wykrywanie nadużyć</li>
            <li>Analiza statystyczna i doskonalenie serwisu</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4. Podstawa prawna przetwarzania</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Przetwarzanie danych osobowych odbywa się na podstawie:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Zgody użytkownika (art. 6 ust. 1 lit. a RODO)</li>
            <li>Realizacji umowy (art. 6 ust. 1 lit. b RODO)</li>
            <li>Prawnie uzasadnionego interesu administratora (art. 6 ust. 1 lit. f RODO)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>5. Okres przechowywania danych</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Dane osobowe są przechowywane przez okres niezbędny do realizacji celów, dla których zostały zebrane, a po tym czasie przez okres wymagany przez przepisy prawa lub dla dochodzenia roszczeń.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>6. Prawa użytkownika</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Użytkownik ma prawo do:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Dostępu do swoich danych osobowych</li>
            <li>Sprostowania (poprawiania) danych</li>
            <li>Usunięcia danych (&quot;prawo do bycia zapomnianym&quot;)</li>
            <li>Ograniczenia przetwarzania danych</li>
            <li>Przenoszenia danych</li>
            <li>Wniesienia sprzeciwu wobec przetwarzania</li>
            <li>Cofnięcia zgody w dowolnym momencie</li>
            <li>Wniesienia skargi do organu nadzorczego (UODO)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>7. Pliki cookies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Serwis wykorzystuje pliki cookies w celu zapewnienia prawidłowego działania strony, personalizacji treści oraz analizy ruchu. Szczegółowe informacje dostępne są w{" "}
            <Link href="/polityka-cookies" className="text-primary hover:underline">Polityce Cookies</Link>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>8. Bezpieczeństwo danych</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Administrator stosuje odpowiednie środki techniczne i organizacyjne zapewniające ochronę przetwarzanych danych osobowych, w tym szyfrowanie połączenia SSL/TLS, zabezpieczenia serwerów oraz regularne audyty bezpieczeństwa.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>9. Zmiany w polityce prywatności</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Administrator zastrzega sobie prawo do wprowadzania zmian w niniejszej Polityce Prywatności. O wszelkich zmianach użytkownicy będą informowani poprzez komunikaty w serwisie.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>10. Kontakt</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            W sprawach związanych z ochroną danych osobowych można kontaktować się za pośrednictwem formularza kontaktowego dostępnego w serwisie.
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
      </p>
    </div>
  );
}
