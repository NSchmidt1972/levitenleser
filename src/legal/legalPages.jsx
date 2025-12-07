export const legalPages = {
  impressum: {
    overline: "Impressum",
    title: "Angaben gemäß § 5 TMG",
    content: (
      <div className="grid md:grid-cols-2 gap-8 text-sm font-sans text-ink/80 leading-relaxed">
        <div className="space-y-2">
          <p>Verantwortlich für Inhalte dieser Seite:</p>
          <p className="font-serif text-lg">Der Levitenleser</p>
          <p>
            Brehmstr. 45
            <br />
            40239 Düsseldorf
            <br />
            Deutschland
          </p>
          <p>E-Mail: mail@levitenleser.de</p>
        </div>
        <div className="space-y-2">
          <p className="uppercase text-[11px] tracking-wideish text-ink/70">Haftungsausschluss</p>
          <p>
            Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für externe Links. Für den Inhalt
            verlinkter Seiten sind ausschließlich deren Betreiber verantwortlich.
          </p>
          <p className="uppercase text-[11px] tracking-wideish text-ink/70">Urheberrecht</p>
          <p>
            Alle Inhalte und Texte unterliegen dem Urheberrecht. Eine Nutzung außerhalb des persönlichen Gebrauchs
            bedarf der vorherigen Zustimmung.
          </p>
        </div>
      </div>
    )
  },
  datenschutz: {
    overline: "Datenschutz",
    title: "Hinweise nach DSGVO",
    content: (
      <div className="space-y-4 text-sm font-sans text-ink/80 leading-relaxed">
        <p>
          Wir verarbeiten personenbezogene Daten (E-Mail-Adresse) nur zum Versand des Newsletters. Die Angabe ist
          freiwillig. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
        </p>
        <p>
          Speicherung: Supabase (EU-Region), Tabelle <code>newsletter_signups</code>. Die Daten werden gelöscht, sobald
          du den Newsletter abbestellst oder wir den Versand einstellen.
        </p>
        <p>
          Du kannst der Nutzung jederzeit widersprechen und die Löschung verlangen. Schreibe dazu eine E-Mail an
          kontakt@levitenleser.de. Beim Versand nutzen wir den Dienst Resend; die E-Mail-Adresse wird für den
          Zustellvorgang an Resend übermittelt.
        </p>
        <p>
          Optional nutzen wir Google Analytics 4 zur Besuchsstatistik, aber erst nach deiner ausdrücklichen Einwilligung
          über das Cookie-Banner. Dabei ist IP-Anonymisierung aktiviert; es werden keine individuellen Profile
          erstellt. Anbieter: Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Irland. Rechtsgrundlage:
          Art. 6 Abs. 1 lit. a DSGVO. Widerruf jederzeit über die Cookie-Einstellungen (Banner erneut öffnen) möglich.
        </p>
        <p>
          Zugriff auf analytische Daten erfolgt in aggregierter Form. Daten für den Newsletter werden gelöscht, sobald
          der Zweck entfällt oder du die Einwilligung widerrufst.
        </p>
      </div>
    )
  }
};
