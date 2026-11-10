import { Inbox, MessageSquare, Star, Megaphone, FileSignature, FileText } from "lucide-react";

// Pomočniki, ki si jih stranka izbere sama. »Odgovori na povpraševanja« so jedro in vedno vklopljeni.
export const CORE_FEATURE = { key: "inbox", title: "Odgovori na povpraševanja", desc: "AI v vaši pošti najde povpraševanja in pripravi odgovor. Vi ga pregledate in pošljete.", icon: Inbox };
export const FEATURES = [
  { key: "chat", title: "Spletni klepet", desc: "Klepet na vaši strani odgovarja obiskovalcem tudi ponoči in zbere njihov kontakt.", icon: MessageSquare, path: "/klepet" },
  { key: "reviews", title: "Google ocene", desc: "Po opravljenem delu stranko vljudno prosi za oceno.", icon: Star, path: "/ocene" },
  { key: "campaigns", title: "Vračanje strank", desc: "Občasno pošlje sporočilo strankam, ki se dolgo niso oglasile.", icon: Megaphone, path: "/kampanje" },
  { key: "offers", title: "Ponudbe", desc: "Ponudbo v PDF pripravi v nekaj minutah po vašem vzorcu.", icon: FileSignature, path: "/ponudbe" },
  { key: "invoices", title: "Računi za računovodjo", desc: "Prejete račune zbere iz pošte in jih mesečno pošlje računovodji.", icon: FileText, path: "/racuni" },
];
// Starejši računi (brez izbire) vidijo vse.
// Prazen seznam = vse vidno: platforma je ob objavi 10. 11. starejšim računom nastavila [] (prej skrilo vse pomočnike).
export const featureOn = (business, key) => !Array.isArray(business?.enabled_features) || business.enabled_features.length === 0 || business.enabled_features.includes(key);
