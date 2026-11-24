// FMD — Présence en direct (25/11/2026, demande : « quand un projet est en cours sur un autre PC, moi et mon patron sur le
// même projet en même temps, je veux que ça note : l'utilisateur X est déjà sur le projet »).
// Supabase Realtime « presence » (canal presence-fmd) : aucune table, rien d'enregistré. Chaque poste annonce ce qu'il a
// ouvert : { crm: 'cmd/abc123' | null, studio: '<id du projet>' | null }. Les autres postes voient qui est sur la même fiche.
// Utilisé par : js/app.js (demarrer / arreter), js/crm.js (fiches tiers et documents), le Studio (via le lanceur :
// launcher/main.js studio:presence ↔ presence:vers-studio).
// API : FMDPresence.demarrer(sb, { id, nom }), arreter(), etre(espace, objet|null), autres(espace, objet) → [{ id, nom }],
//       surChange(cb) → désabonnement.
(function () {
  'use strict';
  const S = { sb: null, canal: null, moi: null, cle: '', etat: { crm: null, studio: null }, liste: [], abonnes: new Set(), pret: false };

  function lirePresences() {
    if (!S.canal || typeof S.canal.presenceState !== 'function') { S.liste = []; return; }
    const st = S.canal.presenceState() || {};
    const l = [];
    Object.entries(st).forEach(([cle, metas]) => { if (cle === S.cle) return; (metas || []).forEach((m) => { if (m && m.id) l.push({ cle, id: m.id, nom: m.nom || 'Un collègue', crm: m.crm || null, studio: m.studio || null }); }); });
    S.liste = l;
    S.abonnes.forEach((f) => { try { f(); } catch (e) { console.error('Présence :', e); } });
  }
  function annoncer() {
    if (!S.canal || !S.pret || typeof S.canal.track !== 'function') return;
    try { const r = S.canal.track({ id: S.moi.id, nom: S.moi.nom, crm: S.etat.crm, studio: S.etat.studio, depuis: new Date().toISOString() }); if (r && r.catch) r.catch(() => {}); } catch { /* sans direct */ }
  }

  window.FMDPresence = {
    demarrer(sb, moi) {
      this.arreter();
      if (!sb || !sb.channel || !moi || !moi.id) return;
      S.sb = sb; S.moi = moi; S.cle = moi.id + ':' + Math.random().toString(36).slice(2, 8);
      S.canal = sb.channel('presence-fmd', { config: { presence: { key: S.cle } } });
      S.canal.on('presence', { event: 'sync' }, lirePresences)
        .on('presence', { event: 'join' }, lirePresences)
        .on('presence', { event: 'leave' }, lirePresences)
        .subscribe((statut) => { if (statut === 'SUBSCRIBED') { S.pret = true; annoncer(); lirePresences(); } });
    },
    arreter() {
      if (S.canal && S.sb) { try { if (S.canal.untrack) S.canal.untrack(); S.sb.removeChannel(S.canal); } catch { /* déjà fermé */ } }
      S.canal = null; S.pret = false; S.liste = []; S.etat = { crm: null, studio: null };
    },
    // espace : 'crm' | 'studio' ; objet : identifiant de la fiche / du projet ouvert, ou null en la quittant
    etre(espace, objet) {
      if (!(espace in S.etat)) return;
      const v = objet ? String(objet) : null;
      if (S.etat[espace] === v) return;
      S.etat[espace] = v; annoncer();
    },
    // Collègues (autres que moi sur ce poste) sur la même fiche. Mon propre compte sur un AUTRE PC compte aussi.
    autres(espace, objet) {
      if (!objet) return [];
      const vus = new Set();
      return S.liste.filter((p) => p[espace] === String(objet)).filter((p) => { const k = p.id + (p.id === (S.moi && S.moi.id) ? ':' + p.cle : ''); if (vus.has(k)) return false; vus.add(k); return true; })
        .map((p) => ({ id: p.id, nom: p.id === (S.moi && S.moi.id) ? 'Vous (sur un autre PC)' : p.nom }));
    },
    surChange(f) { S.abonnes.add(f); return () => S.abonnes.delete(f); },
    // Pour le Studio (autre fenêtre) : [{ nom, studio }] des autres postes
    autresTous() { return S.liste.map((p) => ({ nom: p.id === (S.moi && S.moi.id) ? 'Vous (sur un autre PC)' : p.nom, studio: p.studio })); },
    // Texte prêt à afficher : « Farid Medegueb est déjà sur ce document » / « Farid et Benoit sont déjà… »
    phrase(espace, objet, quoi = 'cette fiche') {
      const l = window.FMDPresence.autres(espace, objet); if (!l.length) return '';
      const noms = l.map((p) => p.nom); const qui = noms.length === 1 ? noms[0] : noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1];
      return `${qui} ${noms.length === 1 ? 'est' : 'sont'} déjà sur ${quoi}`;
    },
  };
})();
