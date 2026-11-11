import React from "react";
import { Link } from "react-router-dom";

// Javni pravni strani (brez prijave): /pogoji in /zasebnost.
// Besedilo opisuje DEJANSKO delovanje aplikacije (brez prikrivanja). Ob vsaki bistveni spremembi
// povečaj TERMS_VERSION — vsi uporabniki morajo nove pogoje ob naslednji prijavi znova sprejeti (TermsGate).
// Pred javno prodajo naj besedilo pregleda pravnik.

export const TERMS_VERSION = "2026-11-11";
export const TERMS_DATE = "11. 11. 2026";

const P = {
  naziv: "Spletni Marketing, Tihomir Matijevic s.p.",
  naslov: "Letoviška cesta 32, 1000 Ljubljana",
  telefon: "030 301 300",
  app: "AI Aristotle",
};

const H = ({ children }) => <h2 className="text-lg font-semibold text-foreground pt-4">{children}</h2>;
const Ul = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
);

// Kratek povzetek — prikazan v uvodu in ob ponovnem sprejemu. Ne nadomešča celotnih pogojev.
export const KRATKO = [
  "Prvih 14 dni je brezplačnih, brez kartice. Med preizkusom velja omejena poraba in največ 20 poslanih sporočil.",
  "Aplikacija bere vaš e-poštni predal (vsakih 10 minut), da najde povpraševanja, odgovore in račune. Vsebino sporočil obdela AI.",
  "Vsebina, ki jo obdela AI, gre ponudniku Anthropic (ZDA). Aplikacija in baza tečeta na platformi Base44 (strežniki privzeto v ZDA).",
  "Privzeto nič ne gre ven brez vašega klika. Samodejno pošiljanje vklopite sami; e-poštne kampanje s seznama po zagonu pošiljajo same.",
  "AI se lahko zmoti — tudi pri cenah v ponudbah. Za vse, kar pošljete strankam, odgovarjate vi.",
  "Gesla e-poštnih predalov so v bazi shranjena šifrirano (AES-256). Ker mora aplikacija s predalom delati sama, jih naš strežnik ob uporabi odšifrira.",
  "Skrbnik aplikacije (ponudnik) ima tehnični dostop do vaših podatkov — uporablja ga samo za podporo, vzdrževanje in odpravo napak.",
  "Naročnino lahko prekinete kadar koli. Podatke lahko izvozite in zahtevate izbris.",
];

export function PogojiVsebina() {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
      <H>1. Kdo smo in kaj je {P.app}</H>
      <p>{P.app} (v nadaljevanju »aplikacija«) ponuja {P.naziv}, {P.naslov}, tel. {P.telefon} (v nadaljevanju »ponudnik« ali »mi«). Aplikacija pomaga podjetjem odgovarjati na povpraševanja, voditi stranke in opravila, pripravljati ponudbe, pošiljati e-poštne kampanje, prositi za Google ocene, zbirati prejete račune ter z umetno inteligenco (AI) pripravljati besedila. Uporabnik je podjetje oziroma oseba, ki ustvari račun (v nadaljevanju »vi«).</p>
      <p>S klikom »Sprejemam« v aplikaciji potrdite, da ste pogoje prebrali in jih sprejemate. Pogoji veljajo skupaj s <Link to="/zasebnost" className="underline">Politiko zasebnosti</Link>.</p>

      <H>2. Preizkusno obdobje</H>
      <Ul items={[
        "Preizkus traja 14 dni od zaključka uvoda in je brezplačen. Kartice ne potrebujete.",
        "Med preizkusom velja omejena poraba AI (manjši, hitrejši model in omejen znesek porabe) in največ 20 poslanih sporočil skupaj.",
        "Med preizkusom AI odgovorov, ponudb in prošenj za oceno ne pošlje sam, tudi če je samodejno pošiljanje vklopljeno — vse čaka na vaš pregled. E-poštna kampanja na seznam naslovov, ki jo sami zaženete, pošilja sama (v okviru 20 sporočil).",
        "Za ponudbe velja omejeno število brezplačnih ponudb, ki je prikazano v aplikaciji.",
        "Po poteku preizkusa je za nadaljnjo uporabo potrebna naročnina. Vaši podatki ob poteku preizkusa ostanejo shranjeni (glej točko 13).",
      ]} />

      <H>3. Naročnina, cena in plačilo</H>
      <Ul items={[
        "Veljavni cenik je objavljen v aplikaciji (Nastavitve → Naročnina). Cene so brez DDV, če ni navedeno drugače.",
        "Naročnina se obračuna mesečno vnaprej po predračunu.",
        "V ceno je vključena običajna poraba AI za posamezne pomočnike. Če poraba izrazito presega običajno (npr. več tisoč AI besedil na mesec), vas na to opozorimo in predlagamo ustrezen paket; brez vašega soglasja ne zaračunamo ničesar dodatno.",
        "O spremembi cene vas obvestimo po e-pošti vsaj 30 dni vnaprej. Do konca že plačanega obdobja velja stara cena.",
        "Naročnino lahko prekinete kadar koli, brez odpovednega roka. Velja do konca plačanega meseca; vračila za del meseca ni.",
      ]} />

      <H>4. Vaš e-poštni predal — kaj točno počne aplikacija</H>
      <p>Ko povežete e-poštni predal (e-naslov in geslo), aplikacija:</p>
      <Ul items={[
        "vsakih približno 10 minut prebere nova sporočila v mapi Prejeto (ob prvi povezavi sporočila zadnjih 7 dni, največ 40 na en pregled);",
        "vsebino novih sporočil pošlje AI, ki presodi, ali gre za povpraševanje, odgovor stranke ali račun; iz sporočila izlušči ime, e-naslov, telefon in kaj stranka želi;",
        "za povpraševanja ustvari stranko in pripravi predlog odgovora; priloge z računi (PDF, XML, slike) shrani med prejete račune; bere tudi mapo za račune (npr. »racuni«), če jo uporabljate;",
        "pošilja sporočila z vašega naslova prek vašega strežnika (SMTP) in kopijo shrani v vašo mapo Poslano;",
        "sporočil v vašem predalu ne briše in ne premika.",
      ]} />
      <p>Enako velja za dodatne naslove, ki jih povežete za e-poštne kampanje; tam aplikacija bere tudi vrnjena sporočila (neobstoječi naslovi) in odgovore na kampanje. Povezavo lahko kadar koli prekinete v Nastavitvah ali tako, da spremenite geslo predala.</p>

      <H>5. Umetna inteligenca</H>
      <Ul items={[
        "Besedila, ki jih pripravi AI (odgovori, sporočila kampanj, prošnje za oceno, ponudbe, povzetki, odgovori spletnega klepeta), so predlogi in lahko vsebujejo napake, tudi napačne cene, datume ali obljube.",
        "Ponudbe AI pripravi na podlagi cenika in pravil, ki jih vpišete vi. Če cenika ni, lahko ponudba ostane brez cen. Pred pošiljanjem ponudbo preverite.",
        "AI se uči iz vaših popravkov in zavrnitev: iz njih izpelje kratka pravila, ki so shranjena samo v vašem računu. Vidite jih v Nastavitve → Glas znamke in jih lahko spremenite ali izbrišete.",
        "Pred pošiljanjem drugi AI preveri kakovost besedila in mu dodeli oceno. Ocena ni jamstvo pravilnosti.",
        "Vaši podatki se ne uporabljajo za učenje AI modelov ponudnikov in jih ne vidijo druga podjetja v aplikaciji.",
      ]} />

      <H>6. Samodejno pošiljanje in e-poštne kampanje</H>
      <Ul items={[
        "Privzeto vsako sporočilo čaka na vaš pregled in se pošlje šele, ko kliknete »Pošlji«.",
        "Samodejno pošiljanje vklopite sami, po vrstah sporočil (npr. odgovori na obrazec, prošnje za oceno, samodejne ponudbe). Takrat AI pošlje besedilo brez vašega pregleda, če ga preverjanje oceni kot dovolj dobro.",
        "Kampanja na seznam naslovov po vašem kliku »Zaženi« pošilja sama, po korakih sekvence, ob delavnikih med 8. in 17. uro. Za nov naslov velja meja 20 sporočil na dan prva 2 tedna, nato 50 (mejo lahko spremenite na lastno odgovornost).",
        "Kampanja se sama ustavi, če se vrne preveč sporočil (neobstoječi naslovi), in o tem dobite e-pošto. Sporočila kampanj s seznama vsebujejo povezavo za odjavo; odjavljenim aplikacija ne pošilja več.",
        "Za zakonitost pošiljanja (GDPR, ZEKom-2) in za izvor naslovov na seznamih odgovarjate vi. Neželena pošta lahko škoduje ugledu vaše domene; priporočamo ločen naslov za kampanje.",
        "Dostave e-pošte ne moremo zagotoviti — sporočilo lahko konča med neželeno pošto ali ga strežnik prejemnika zavrne.",
      ]} />

      <H>7. Računi in računovodja</H>
      <p>Če vklopite samodejno pošiljanje računovodji, aplikacija vsakega 1. v mesecu pošlje vse prejete račune prejšnjega meseca s stanjem »Čaka na pošiljanje«. Računov, ki jih označite z »Ne pošiljaj računovodji«, ne pošlje nikoli. Zneske in dobavitelje AI prebere iz sporočila; lahko se zmoti, zato jih preverite.</p>

      <H>8. Spletni klepet in glas</H>
      <Ul items={[
        "Spletni klepet na vaši strani odgovarja obiskovalcem z AI na podlagi znanja, ki ste ga vnesli ali ga je aplikacija prebrala z vaše strani. Pogovori in kontakti, ki jih obiskovalci pustijo, se shranijo v vašem računu. Obiskovalce morate v svoji politiki zasebnosti obvestiti, da odgovarja AI.",
        "Glasovni vnos v Asistentu: posnetek vašega glasu gre ponudniku ElevenLabs (ZDA) v prepis, branje odgovorov na glas pa ustvari isti ponudnik. Posnetkov ne shranjujemo.",
      ]} />

      <H>9. Kje so podatki in kdo jih obdeluje</H>
      <p>Pri delovanju aplikacije sodelujejo ti zunanji ponudniki (podobdelovalci):</p>
      <Ul items={[
        "Base44 — gostovanje aplikacije, baza podatkov, shramba datotek in pošiljanje sistemske e-pošte. Strežniki so privzeto v ZDA.",
        "Anthropic (ZDA) — AI modeli. Prejme vsebino, ki jo AI obdela (npr. prejeto sporočilo, podatke o stranki, vaš cenik).",
        "ElevenLabs (ZDA) — samo če uporabljate glasovni vnos ali branje na glas.",
        "Google — samo če povežete Google Koledar (termini in razpoložljivost).",
        "Cloudflare — ob uvozu seznama naslovov preverimo, ali domena e-naslova sprejema pošto; pošlje se samo ime domene (npr. »podjetje.si«).",
        "Vaš ponudnik e-pošte — prek njegovih strežnikov aplikacija bere in pošilja vašo pošto.",
      ]} />
      <p>Ker del ponudnikov podatke obdeluje v ZDA, gre za prenos v tretjo državo. Pogodbe o obdelavi s temi ponudniki urejamo; na zahtevo vam pošljemo seznam in stanje teh pogodb.</p>

      <H>10. Varnost — kako je zdaj</H>
      <Ul items={[
        "Povezava do aplikacije in do e-poštnih strežnikov je šifrirana (HTTPS/TLS).",
        "Vsako podjetje vidi samo svoje podatke (pravila dostopa v bazi).",
        "Skrbnik aplikacije (ponudnik) ima tehnični dostop do vseh podatkov. Uporablja ga samo za podporo, vzdrževanje, odpravo napak in na vašo zahtevo.",
        "Gesla e-poštnih predalov so v bazi shranjena šifrirano (AES-256-GCM); ključ je shranjen ločeno od baze. Ker aplikacija bere in pošilja pošto namesto vas, mora geslo ob uporabi odšifrirati — to naredi samo naš strežnik, nikoli vaš brskalnik. Priporočamo, da za aplikacijo uporabite geslo, ki ga ne uporabljate drugje.",
        "Dostopni ključi za Google Koledar so shranjeni šifrirano.",
        "Za vsako uporabo AI beležimo čas, vrsto opravila, model, število žetonov in strošek (brez vsebine) — za omejitve in obračun.",
      ]} />

      <H>11. Obdelava osebnih podatkov v vašem imenu</H>
      <p>Za podatke vaših strank ste upravljavec vi, ponudnik pa je obdelovalec (člen 28 GDPR). Ponudnik se zavezuje, da bo: podatke obdeloval samo za delovanje aplikacije po vaših navodilih; zagotovil zaupnost oseb z dostopom; uporabljal samo podobdelovalce iz točke 9 in vas o novih obvestil vnaprej; vam pomagal pri uresničevanju pravic posameznikov; vas o kršitvi varnosti obvestil brez nepotrebnega odlašanja; po prenehanju podatke izbrisal po točki 13.</p>

      <H>12. Vaše obveznosti</H>
      <Ul items={[
        "Strankam pišete le, če imate pravno podlago (soglasje, obstoječe poslovno razmerje ali so vam pisale same).",
        "Vnesete točne podatke o podjetju, cenah in storitvah.",
        "Ne pošiljate neželene pošte, zavajajočih ali nezakonitih vsebin.",
        "Varujete dostop do svojega računa in predala.",
      ]} />

      <H>13. Prekinitev, izvoz in izbris podatkov</H>
      <Ul items={[
        "Stranke lahko kadar koli izvozite (Stranke → Izvozi). Za izvoz drugih podatkov nam pišite.",
        "Izbris računa in vseh podatkov lahko zahtevate kadar koli; izvedemo ga v 30 dneh.",
        "Po prenehanju naročnine podatke hranimo največ 12 mesecev (da lahko naročnino obnovite), nato jih izbrišemo, razen podatkov, ki jih moramo hraniti po zakonu (npr. računovodski).",
        "Račun lahko zapremo ob hujši kršitvi teh pogojev, zlasti ob pošiljanju neželene pošte; o tem vas obvestimo.",
      ]} />

      <H>14. Odgovornost</H>
      <p>Aplikacija je na voljo »takšna, kot je«. Ne jamčimo neprekinjenega delovanja, pravilnosti besedil AI ali dostave e-pošte. Ne odgovarjamo za posredno škodo ali izgubljeni dobiček zaradi uporabe ali nedelovanja aplikacije ali zunanjih storitev (točka 9), razen kadar zakon odgovornosti ne dopušča izključiti. Skupna odgovornost ponudnika je omejena na znesek, ki ste ga plačali v zadnjih 12 mesecih.</p>

      <H>15. Spremembe pogojev in aplikacije</H>
      <p>Aplikacijo stalno izboljšujemo, zato se funkcije lahko spremenijo. O bistvenih spremembah pogojev vas obvestimo; ob naslednji prijavi jih morate znova potrditi. Če z novimi pogoji ne soglašate, lahko naročnino prekinete.</p>

      <H>16. Pravo in kontakt</H>
      <p>Velja pravo Republike Slovenije; za spore je pristojno sodišče v Ljubljani. Vprašanja in zahteve: {P.naziv}, {P.naslov}, tel. {P.telefon}.</p>
    </div>
  );
}

export function ZasebnostVsebina() {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
      <H>1. Upravljavec</H>
      <p>Za podatke uporabnikov aplikacije {P.app} je upravljavec {P.naziv}, {P.naslov}, tel. {P.telefon}. Za podatke strank naših uporabnikov je upravljavec uporabnik, mi smo obdelovalec (glej Splošne pogoje, točka 11).</p>

      <H>2. Katere podatke obdelujemo</H>
      <Ul items={[
        "Podatki uporabnika: ime, e-naslov, podatki o podjetju (naziv, naslov, telefon, spletna stran, storitve, cenik), nastavitve, podatki o naročnini in porabi.",
        "Podatki iz povezanega e-poštnega predala: vsebina in pošiljatelji novih sporočil, priloge z računi, geslo in nastavitve strežnika.",
        "Podatki strank uporabnika: ime, e-naslov, telefon, podjetje, vsebina povpraševanj in sporočil, opombe, opravila, termini, ponudbe, oznake, pogovori s spletnim klepetom, seznami naslovov za kampanje (vključno z odjavami in vrnjenimi sporočili).",
        "Google Koledar (če ga povežete): dogodki in razpoložljivost; ustvarimo dogodke za potrjene termine.",
        "Glas (če ga uporabite): posnetek se pošlje v prepis in se ne shrani.",
      ]} />

      <H>3. Namen in pravna podlaga</H>
      <p>Delovanje aplikacije (izvajanje pogodbe), obdelava podatkov strank v imenu uporabnika (pogodba o obdelavi), obračun in podpora (pogodba, zakoniti interes), izpolnjevanje zakonskih obveznosti (računovodstvo).</p>

      <H>4. Umetna inteligenca</H>
      <p>Za pripravo besedil uporabljamo modele ponudnika Anthropic (ZDA). Posredujemo vsebino, potrebno za posamezno opravilo (npr. prejeto sporočilo, podatke o stranki, cenik). Po pogojih ponudnika se podatki iz API ne uporabljajo za učenje modelov.</p>

      <H>5. Podobdelovalci in prenos v tretje države</H>
      <p>Base44 (gostovanje, baza, datoteke, sistemska e-pošta; strežniki privzeto v ZDA), Anthropic (AI, ZDA), ElevenLabs (glas, ZDA; samo ob uporabi), Google (Koledar; samo ob povezavi), Cloudflare (preverjanje domen e-naslovov; samo ime domene), ponudnik e-pošte uporabnika. Pogodbe o obdelavi s temi ponudniki urejamo; seznam in stanje pošljemo na zahtevo.</p>

      <H>6. Podatki iz Googlovih storitev</H>
      <p>Uporaba in prenos podatkov, prejetih iz Googlovih API-jev, sta skladna s politiko Google API Services User Data Policy, vključno z zahtevami o omejeni uporabi (Limited Use). Podatkov iz Google Koledarja ne prodajamo, ne uporabljamo za oglaševanje in jih ne posredujemo tretjim osebam, razen kot je potrebno za delovanje funkcije, ki jo je uporabnik vklopil.</p>

      <H>7. Varnost</H>
      <p>Šifrirana povezava (HTTPS/TLS), ločen dostop po podjetjih, šifrirani ključi Google Koledarja in šifrirana gesla e-poštnih predalov (AES-256-GCM). Skrbnik aplikacije ima tehnični dostop do podatkov za podporo in vzdrževanje.</p>

      <H>8. Hramba</H>
      <p>Dokler uporabljate aplikacijo in največ 12 mesecev po prenehanju naročnine, razen kadar zakon zahteva daljšo hrambo. Izbris lahko zahtevate kadar koli; izvedemo ga v 30 dneh.</p>

      <H>9. Vaše pravice</H>
      <p>Pravica do dostopa, popravka, izbrisa, omejitve obdelave, prenosljivosti in ugovora. Zahtevo pošljite upravljavcu. Pritožbo lahko vložite pri Informacijskem pooblaščencu Republike Slovenije.</p>

      <H>10. Odjava od sporočil</H>
      <p>Sporočila e-poštnih kampanj, poslana na sezname naslovov, vsebujejo povezavo za odjavo; odjavljenim naslovom aplikacija ne pošilja več. Na druga sporočila (npr. odgovore na povpraševanja) lahko prejemnik odgovori, da sporočil ne želi več, in uporabnik ga mora upoštevati.</p>
    </div>
  );
}

function Okvir({ naslov, children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-6">
          <Link to="/" className="text-sm text-muted-foreground hover:underline">← {P.app}</Link>
          <h1 className="text-3xl font-bold mt-3">{naslov}</h1>
          <p className="text-sm text-muted-foreground mt-1">Velja od: {TERMS_DATE}</p>
        </div>
        {children}
        <div className="mt-12 pt-6 border-t text-xs text-muted-foreground flex gap-4">
          <Link to="/pogoji" className="hover:underline">Splošni pogoji</Link>
          <Link to="/zasebnost" className="hover:underline">Politika zasebnosti</Link>
        </div>
      </div>
    </div>
  );
}

export function Pogoji() {
  return (
    <Okvir naslov="Splošni pogoji uporabe">
      <div className="rounded-xl border bg-muted/40 p-5 mb-6">
        <p className="font-semibold mb-2">Na kratko</p>
        <Ul items={KRATKO} />
      </div>
      <PogojiVsebina />
    </Okvir>
  );
}

export function Zasebnost() {
  return (
    <Okvir naslov="Politika zasebnosti">
      <ZasebnostVsebina />
    </Okvir>
  );
}
