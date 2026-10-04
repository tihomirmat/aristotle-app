import React from "react";
import { Link } from "react-router-dom";

// Javni pravni strani (brez prijave): /zasebnost in /pogoji.
// OSNUTEK — pred javno objavo mora besedilo pregledati pravnik. Podatke upravljavca dopolni lastnik.

const UPRAVLJAVEC = {
  naziv: "Spletni Marketing, Tihomir Matijevic s.p.",
  naslov: "Letoviška cesta 32, 1000 Ljubljana",
  telefon: "030 301 300",
  app: "AI Aristotle",
};

function Okvir({ naslov, posodobljeno, children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link to="/" className="text-sm text-muted-foreground hover:underline">← {UPRAVLJAVEC.app}</Link>
          <h1 className="text-3xl font-bold mt-3">{naslov}</h1>
          <p className="text-sm text-muted-foreground mt-1">Zadnja posodobitev: {posodobljeno}</p>
        </div>
        <div className="prose prose-sm max-w-none space-y-4 text-[15px] leading-relaxed">{children}</div>
        <div className="mt-12 pt-6 border-t text-xs text-muted-foreground flex gap-4">
          <Link to="/zasebnost" className="hover:underline">Politika zasebnosti</Link>
          <Link to="/pogoji" className="hover:underline">Pogoji uporabe</Link>
        </div>
      </div>
    </div>
  );
}

export function Zasebnost() {
  return (
    <Okvir naslov="Politika zasebnosti" posodobljeno="4. 10. 2026">
      <h2 className="text-xl font-semibold">1. Upravljavec</h2>
      <p>Upravljavec osebnih podatkov v aplikaciji {UPRAVLJAVEC.app} je {UPRAVLJAVEC.naziv}, {UPRAVLJAVEC.naslov}, telefon {UPRAVLJAVEC.telefon} (v nadaljevanju »mi«).</p>

      <h2 className="text-xl font-semibold">2. Katere podatke obdelujemo</h2>
      <p><strong>Podatki uporabnikov aplikacije:</strong> ime, e-poštni naslov, podatki o podjetju (naziv, naslov, telefon, spletna stran, storitve), nastavitve aplikacije in podatki o naročnini.</p>
      <p><strong>Podatki strank naših uporabnikov:</strong> ime, e-poštni naslov, telefon, vsebina povpraševanj, prepisi pogovorov s spletnim klepetalnikom, poslana in prejeta sporočila, termini in ponudbe. Te podatke obdelujemo v imenu uporabnika aplikacije kot obdelovalec.</p>
      <p><strong>Podatki iz povezanih računov:</strong> če uporabnik poveže Google Koledar, dostopamo do razpoložljivosti in dogodkov v koledarju ter ustvarjamo dogodke za potrjene termine. Dostopni žetoni so shranjeni šifrirano. Dostop lahko uporabnik kadar koli prekliče v aplikaciji ali v nastavitvah svojega Google računa.</p>

      <h2 className="text-xl font-semibold">3. Namen in pravna podlaga</h2>
      <p>Podatke obdelujemo za delovanje aplikacije (izvajanje pogodbe), za pošiljanje sporočil strankam uporabnika na podlagi soglasja, ki ga je pridobil uporabnik, ter za zaračunavanje in podporo (pogodba in zakoniti interes).</p>

      <h2 className="text-xl font-semibold">4. Umetna inteligenca</h2>
      <p>Za pripravo osnutkov sporočil, odgovorov klepetalnika in ponudb uporabljamo jezikovne modele ponudnika Anthropic. Ponudniku posredujemo samo podatke, potrebne za posamezen osnutek. Podatki se ne uporabljajo za učenje modelov.</p>

      <h2 className="text-xl font-semibold">5. Podatki iz Googlovih storitev</h2>
      <p>Uporaba in prenos podatkov, prejetih iz Googlovih API-jev, sta skladna s politiko Google API Services User Data Policy, vključno z zahtevami o omejeni uporabi (Limited Use). Podatkov iz Google Koledarja ne prodajamo, ne uporabljamo za oglaševanje in jih ne posredujemo tretjim osebam, razen kot je potrebno za delovanje funkcije, ki jo je uporabnik vklopil.</p>

      <h2 className="text-xl font-semibold">6. Hramba</h2>
      <p>Podatke hranimo, dokler uporabnik uporablja aplikacijo, in največ 12 mesecev po prenehanju naročnine, razen kadar zakon zahteva daljšo hrambo (računovodski podatki). Uporabnik lahko kadar koli zahteva izbris.</p>

      <h2 className="text-xl font-semibold">7. Obdelovalci</h2>
      <p>Za gostovanje in bazo podatkov uporabljamo platformo Base44, za jezikovne modele Anthropic, za pošiljanje e-pošte pa ponudnika, ki ga izbere uporabnik (lastni SMTP strežnik ali platformski pošiljatelj).</p>

      <h2 className="text-xl font-semibold">8. Vaše pravice</h2>
      <p>Imate pravico do dostopa, popravka, izbrisa, omejitve obdelave, prenosljivosti in ugovora. Zahtevo pošljite na kontaktne podatke upravljavca. Pritožbo lahko vložite pri Informacijskem pooblaščencu Republike Slovenije.</p>

      <h2 className="text-xl font-semibold">9. Odjava od sporočil</h2>
      <p>Vsako sporočilo, poslano prek aplikacije, vsebuje povezavo za odjavo. Po odjavi stranka ne prejema več sporočil tega podjetja.</p>
    </Okvir>
  );
}

export function Pogoji() {
  return (
    <Okvir naslov="Pogoji uporabe" posodobljeno="4. 10. 2026">
      <h2 className="text-xl font-semibold">1. Ponudnik in storitev</h2>
      <p>{UPRAVLJAVEC.app} je spletna aplikacija, ki jo ponuja {UPRAVLJAVEC.naziv}, {UPRAVLJAVEC.naslov}. Namenjena je podjetjem za avtomatizacijo komunikacije s strankami, pripravo ponudb in upravljanje terminov.</p>

      <h2 className="text-xl font-semibold">2. Račun in preizkus</h2>
      <p>Za uporabo je potreben uporabniški račun. Novi uporabniki imajo 14-dnevno brezplačno preizkusno obdobje z omejeno porabo. Po poteku je za nadaljnjo uporabo potrebna naročnina.</p>

      <h2 className="text-xl font-semibold">3. Naročnina in plačilo</h2>
      <p>Naročnina se zaračunava mesečno vnaprej po veljavnem ceniku. Uporabnik lahko naročnino kadar koli prekliče; velja do konca plačanega obdobja. Cene so navedene brez DDV, če ni drugače določeno.</p>

      <h2 className="text-xl font-semibold">4. Odgovornosti uporabnika</h2>
      <p>Uporabnik zagotavlja, da ima veljavno soglasje svojih strank za pošiljanje sporočil (ZEPT-1, GDPR) in da so podatki, ki jih vnese v aplikacijo, točni. Uporabnik pregleda in odobri sporočila, ki jih pripravi umetna inteligenca, razen če je sam vklopil samodejno pošiljanje. Za vsebino poslanih sporočil in ponudb odgovarja uporabnik.</p>

      <h2 className="text-xl font-semibold">5. Umetna inteligenca</h2>
      <p>Besedila, ki jih pripravi umetna inteligenca, so osnutki in lahko vsebujejo napake. Ponudnik ne jamči za pravilnost, popolnost ali pravno ustreznost teh besedil.</p>

      <h2 className="text-xl font-semibold">6. Povezane storitve</h2>
      <p>Uporabnik lahko poveže zunanje storitve (Google Koledar, e-poštni strežnik). Za te storitve veljajo pogoji njihovih ponudnikov. Ponudnik ne odgovarja za nedelovanje zunanjih storitev.</p>

      <h2 className="text-xl font-semibold">7. Omejitev odgovornosti</h2>
      <p>Storitev je na voljo »takšna, kot je«. Ponudnik ne odgovarja za posredno škodo, izgubljeni dobiček ali izgubo podatkov, ki bi nastala zaradi uporabe ali nedelovanja aplikacije, razen v primerih, ko zakon odgovornosti ne dopušča izključiti.</p>

      <h2 className="text-xl font-semibold">8. Prekinitev</h2>
      <p>Ponudnik lahko račun zapre ob kršitvi teh pogojev, zlasti ob pošiljanju nezaželene pošte. Uporabnik lahko kadar koli zahteva izbris računa in podatkov.</p>

      <h2 className="text-xl font-semibold">9. Pravo in spori</h2>
      <p>Velja pravo Republike Slovenije. Za spore je pristojno sodišče v Ljubljani.</p>
    </Okvir>
  );
}
