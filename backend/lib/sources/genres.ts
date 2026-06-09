/**
 * Choisit les domaines de presse spécialisée à interroger (via Tavily)
 * en fonction du genre détecté à partir des tags + pays de l'artiste.
 */

const DEFAULT_DOMAINS = [
  "pitchfork.com",
  "rollingstone.com",
  "lesinrocks.com",
  "nme.com",
  "stereogum.com",
  "consequence.net",
];

export function pickDomains(signals: string): {
  label: string;
  domains: string[];
} {
  const s = signals.toLowerCase();
  const isFrench =
    /\bfrench\b|fran[çc]ais|fran[çc]aise|\bfr\b|paris|marseille/.test(s);

  if (/\bjazz\b|bebop|swing|fusion|be-bop/.test(s)) {
    return {
      label: "jazz",
      domains: [
        "citizenjazz.com",
        "jazzmagazine.com",
        "downbeat.com",
        "pitchfork.com",
        "rollingstone.com",
      ],
    };
  }

  if (
    /classical|classique|orchestr|baroque|symphon|op[ée]ra|concerto/.test(s)
  ) {
    return {
      label: "classique",
      domains: [
        "francemusique.fr",
        "gramophone.co.uk",
        "classicfm.com",
        "diapasonmag.fr",
      ],
    };
  }

  if (
    /metal|metalcore|deathcore|grindcore|black metal|death metal|doom/.test(s)
  ) {
    return {
      label: "métal",
      domains: [
        "metal-archives.com",
        "metalinjection.net",
        "loudwire.com",
        "blabbermouth.net",
        "vs-webzine.com",
      ],
    };
  }

  if (
    /techno|house|electro|\bedm\b|drum and bass|dubstep|ambient|trance|deep house|garage/.test(
      s,
    )
  ) {
    return {
      label: "électronique",
      domains: [
        "residentadvisor.net",
        "mixmag.net",
        "factmag.com",
        "xlr8r.com",
        "tsugi.fr",
        "pitchfork.com",
      ],
    };
  }

  if (/rap|hip.?hop|trap|drill|grime/.test(s)) {
    if (isFrench) {
      return {
        label: "rap FR",
        domains: [
          "abcdrduson.com",
          "booska-p.com",
          "yard.media",
          "raplume.fr",
          "konbini.com",
          "lesinrocks.com",
          "mouv.fr",
        ],
      };
    }
    return {
      label: "rap/hip-hop",
      domains: [
        "complex.com",
        "thefader.com",
        "xxlmag.com",
        "pitchfork.com",
        "hotnewhiphop.com",
      ],
    };
  }

  if (isFrench) {
    return {
      label: "chanson/pop FR",
      domains: [
        "lesinrocks.com",
        "telerama.fr",
        "rollingstone.fr",
        "tsugi.fr",
        "pitchfork.com",
      ],
    };
  }

  return { label: "rock/indie/pop", domains: DEFAULT_DOMAINS };
}
