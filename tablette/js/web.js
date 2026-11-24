// FMD — VERSION WEB : remplace le launcher (.exe) dans le navigateur.
// Dans le logiciel, window.lanceur est fourni par le launcher et ce fichier ne fait rien. Sur le web, il fournit la
// MÊME interface (window.lanceurWeb) à la coquille FMD (js/app.js) :
//   - modules FM'STUDIO et FM'RADAR affichés dans des cadres posés exactement sur la zone du module (comme les vues
//     du logiciel), gardés ouverts quand on change de page ;
//   - session : jeton de connexion recopié dans un cookie du site (le serveur FMD s'en sert pour le Radar) ;
//   - événements en direct des autres postes (logiciel ou web) transmis aux modules ;
//   - mises à jour : nouvelle version du site détectée (signal en direct + vérification toutes les 5 min) → alerte,
//     « Mettre à jour maintenant » recharge la page.
(function () {
  'use strict';
  if (window.lanceur) return; // logiciel FMD (.exe)

  const POSTE = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
  const URLS = { studio: 'modules/studio/Ouvrir%20fmd%20studio.html', radar: '/radar/' };
  const cadres = {};
  let actif = null, superpose = false;
  let zone = { x: 0, y: 0, width: 0, height: 0 };

  const conteneur = document.createElement('div');
  conteneur.id = 'modules-web';
  document.body.appendChild(conteneur);

  function placer() {
    for (const [nom, c] of Object.entries(cadres)) {
      const visible = nom === actif && !superpose;
      c.style.display = visible ? 'block' : 'none';
      if (visible) Object.assign(c.style, { left: zone.x + 'px', top: zone.y + 'px', width: zone.width + 'px', height: zone.height + 'px' });
    }
  }
  function fermerModules() {
    for (const n of Object.keys(cadres)) { cadres[n].remove(); delete cadres[n]; }
    actif = null;
  }

  // Les cadres sont du même site : la page FMD peut leur parler directement.
  const fenetreDe = (nom) => { try { return cadres[nom] && cadres[nom].contentWindow; } catch { return null; } };

  window.FMDWeb = {
    sb: null, // client Supabase de la coquille (posé par js/app.js), partagé avec les modules
    poste: POSTE,
    signaler(module, cle) {
      if (!this.sb) return;
      this.sb.from('evenements').insert({ module, cle: cle || '', poste: POSTE }).then(({ error }) => { if (error) console.warn('événement non envoyé', error.message); });
    },
  };

  // ---------- Mises à jour du site ----------
  let versionChargee = null;
  const etatMaj = { etat: 'inconnu', version: null, pourcent: 0, message: '', verifie: 0, installee: null };
  const rappelsMaj = [];
  const majEtat = (c) => { Object.assign(etatMaj, c); rappelsMaj.forEach((f) => f({ ...etatMaj })); };
  async function versionEnLigne() {
    const r = await fetch('version-web.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('version introuvable (' + r.status + ')');
    return String((await r.json()).version || '');
  }
  const pretVersion = versionEnLigne().then((v) => { versionChargee = v; etatMaj.installee = v; return v; }).catch(() => null);
  async function verifierMaj() {
    await pretVersion;
    majEtat({ etat: 'recherche', message: '' });
    try {
      const v = await versionEnLigne();
      if (versionChargee && v && v !== versionChargee) majEtat({ etat: 'prete', version: v, pourcent: 100, verifie: Date.now() });
      else majEtat({ etat: 'a-jour', version: v || versionChargee, verifie: Date.now() });
    } catch (e) {
      majEtat({ etat: 'erreur', message: 'Pas de connexion Internet ou serveur injoignable.', verifie: Date.now() });
    }
    return { ...etatMaj };
  }
  setInterval(verifierMaj, 5 * 60 * 1000);

  window.lanceurWeb = {
    web: true,
    async infos() {
      const v = (await pretVersion) || '?';
      return { version: v, launcher: v, origine: 'web', message: '', poste: POSTE };
    },
    relancer: () => location.reload(),
    session(jeton) {
      // Jeton de connexion pour le serveur FMD (Radar). Cookie du site uniquement, jamais envoyé ailleurs.
      if (jeton) document.cookie = `fmd_jeton=${encodeURIComponent(jeton)}; Path=/; Max-Age=86400; SameSite=Strict${location.protocol === 'https:' ? '; Secure' : ''}`;
      else { document.cookie = 'fmd_jeton=; Path=/; Max-Age=0; SameSite=Strict'; fermerModules(); }
    },
    evenement(evt) {
      if (!evt || evt.poste === POSTE) return;
      if (evt.module === 'studio' || evt.module === 'studio-reglages') {
        const w = fenetreDe('studio');
        if (w && w.__fmdChangement) w.__fmdChangement({ module: evt.module, cle: evt.cle });
      }
      // Radar : rechargé seulement pour un vrai changement d'un autre poste (pas à chaque reconnexion au direct).
      if (evt.module === 'radar' && evt.poste !== 'resynchronisation') {
        const w = fenetreDe('radar');
        if (w && w.FMDRadarRecharger) w.FMDRadarRecharger();
      }
    },
    async afficherModule(nom) {
      actif = nom === 'studio' || nom === 'radar' ? nom : null;
      if (actif && !cadres[actif]) {
        const c = document.createElement('iframe');
        c.className = 'cadre-module';
        c.title = actif === 'studio' ? 'FM’STUDIO' : 'FM’RADAR';
        c.src = URLS[actif];
        conteneur.appendChild(c);
        cadres[actif] = c;
      }
      placer();
      return { ok: true };
    },
    zoneModule(r) { zone = { x: r.x, y: r.y, width: Math.max(0, r.width), height: Math.max(0, r.height) }; placer(); },
    rechargerModule() { const w = fenetreDe(actif); if (w) w.location.reload(); },
    superposition(active) { superpose = Boolean(active); placer(); },
    radarClePresente: async () => true, // version web : la clé Sirene est rangée sur le serveur
    radarEnregistrerCle: async () => ({ ok: false, erreur: 'Sur le web, la clé Sirene est réglée sur le serveur.' }),
    verifierMaj: () => verifierMaj(),
    surMajEtat: (f) => rappelsMaj.push(f),
    majEtat: async () => { await pretVersion; return { ...etatMaj }; },
    installerMaj: () => location.reload(),
  };
})();
