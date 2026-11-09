// Dejavnosti za izbiro (iskanje). `t` = predloga tona za AI (Business.industry_template).
export const INDUSTRIES = [
  // Lepota in zdravje
  ["Frizerski salon", "salon_barber"], ["Brivnica", "salon_barber"], ["Kozmetični salon", "salon_barber"], ["Manikura in pedikura", "salon_barber"], ["Masaže in wellness", "gym"],
  ["Zobozdravstvo", "dental_medspa"], ["Estetska medicina", "dental_medspa"], ["Fizioterapija", "dental_medspa"], ["Zasebna zdravniška ordinacija", "dental_medspa"], ["Optika", "dental_medspa"], ["Psihoterapija in svetovanje", "dental_medspa"], ["Veterinarska ambulanta", "dental_medspa"],
  ["Fitnes", "gym"], ["Osebni trener", "gym"], ["Joga in pilates", "gym"], ["Športni klub / šola", "gym"],
  // Dom in gradnja
  ["Gradbeništvo", "home_services"], ["Elektroinštalacije", "home_services"], ["Vodovod in ogrevanje", "home_services"], ["Klimatske naprave in toplotne črpalke", "home_services"], ["Mizarstvo", "home_services"], ["Kleparstvo in krovstvo", "home_services"], ["Slikopleskarstvo", "home_services"], ["Keramika in tlaki", "home_services"], ["Okna in vrata", "home_services"], ["Sončne elektrarne", "home_services"], ["Čiščenje", "home_services"], ["Vrtnarstvo in urejanje okolice", "home_services"], ["Selitve in prevozi", "home_services"], ["Arhitektura in notranje oblikovanje", "home_services"], ["Nepremičnine", "home_services"],
  // Gostinstvo in turizem
  ["Restavracija / gostilna", "restaurant"], ["Kavarna / bar", "restaurant"], ["Catering", "restaurant"], ["Pekarna / slaščičarna", "restaurant"], ["Turistična kmetija", "restaurant"], ["Apartmaji / nastanitve", "restaurant"], ["Hotel", "restaurant"], ["Turistična agencija", "restaurant"],
  // Vozila
  ["Avtoservis", "auto"], ["Vulkanizerstvo", "auto"], ["Avtoličarstvo", "auto"], ["Prodaja vozil", "auto"], ["Avtopralnica", "auto"], ["Avtošola", "auto"],
  // Poslovne storitve
  ["Marketing in oglaševanje", "other"], ["Izdelava spletnih strani", "other"], ["IT in programiranje", "other"], ["Računovodstvo", "other"], ["Odvetništvo in pravne storitve", "other"], ["Poslovno svetovanje", "other"], ["Zavarovalno zastopništvo", "other"], ["Fotografija in video", "other"], ["Grafično oblikovanje", "other"], ["Prevajanje", "other"], ["Izobraževanje in tečaji", "other"], ["Inštrukcije", "other"], ["Organizacija dogodkov", "other"], ["Tisk in reklamni materiali", "other"],
  // Trgovina in proizvodnja
  ["Spletna trgovina", "other"], ["Trgovina", "other"], ["Proizvodnja", "other"], ["Kmetijstvo", "other"], ["Cvetličarna", "other"], ["Hišni ljubljenčki (salon, oskrba)", "other"],
].map(([label, t]) => ({ label, t }));

export const templateFor = (label) => INDUSTRIES.find((i) => i.label === label)?.t || "other";
// Za stare zapise brez `industry`: prikaži približno ime glede na predlogo.
export const LEGACY_LABEL = { gym: "Fitnes", dental_medspa: "Zobozdravstvo", home_services: "Gradbeništvo", restaurant: "Restavracija / gostilna", salon_barber: "Frizerski salon", auto: "Avtoservis", other: "" };
