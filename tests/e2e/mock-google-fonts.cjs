/**
 * Fausses réponses Google Fonts pour la CI (NEXT_FONT_GOOGLE_MOCKED_RESPONSES,
 * prévu par next/font pour les tests). La compilation sur GitHub ne contacte plus
 * Google : une adresse de police sans extension l'a fait échouer deux fois le
 * 01/11/2026 (« Cannot read properties of null (reading '1') »).
 * Vercel ne définit pas cette variable : la production garde les vraies polices.
 */
module.exports = new Proxy(
  {},
  {
    get(_, url) {
      const family = /family=([^:&]+)/.exec(String(url))?.[1].replace(/\+/g, " ");
      return `/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/ci/${encodeURIComponent(family)}.woff2) format('woff2');
}
`;
    },
  }
);
