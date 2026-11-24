// FMD — CRM : enregistrement EN LIGNE et partage en direct entre les PC (11 nov. 2026).
// Toutes les données du CRM (tiers, produits, variantes, documents, stock…) sont enregistrées sur le serveur
// (Supabase Storage, espace privé « donnees-fmd », fichier crm/crm.json), 1 s après chaque modification.
// La copie du PC (localStorage « fmd-crm-demo-v3 ») ne sert plus que de cache (ouverture rapide, coupure Internet).
//
// Plusieurs postes en même temps : les modifications sont FUSIONNÉES fiche par fiche (par identifiant) au lieu de
// s'écraser. Même champ modifié des deux côtés : la modification de ce poste gagne. Compteurs de références
// (PR, CO, FA…) : les créations des deux postes s'additionnent. Après chaque enregistrement, une ligne est ajoutée
// dans la table « evenements » (module « crm ») : les autres postes relisent le serveur tout de suite.
//
// Utilisé par js/app.js : FMDERPNuage.demarrer({ sb, poste }), arreter(), changementDistant(), surMaj(cb), surEtat(cb).
//
// 25/11/2026 — TOUT SUR LE SERVEUR (demande : « toutes les données sur le serveur, rien chargé à partir d'un PC, pour éviter
// toute confusion ou collision ») :
// • À la connexion, la copie du PC n'est PAS fusionnée : la version du serveur la remplace. Si cette copie contenait des
//   modifications jamais envoyées, elle est d'abord rangée en ligne (crm/postes/<date>-<poste>-non-envoye.json, récupérable).
// • Les modules qui lisent ces données (CRM, Compta, Notes de frais, FM'RENOV, FM'PAREBRISE, site) ne s'ouvrent qu'une fois
//   la version du serveur lue (FMDERPNuage.pret / attendrePret, js/app.js).
// • Même champ modifié sur deux postes en même temps : le SERVEUR gagne (avant : ce poste gagnait).
(function () {
  'use strict';
  const D = window.FMDERP;
  if (!D) return;

  const BUCKET = 'donnees-fmd';
  const CHEMIN = 'crm/crm.json';
  const CLE_LOCALE = 'fmd-crm-demo-v3';
  const CLE_BASE = 'fmd-crm-base';

  let sb = null;
  let poste = '';
  let actif = false;
  let file = Promise.resolve();     // une seule synchronisation à la fois
  let minuteur = null;
  let reessai = null;
  let aEnvoyer = null;              // dernier objet enregistré par le CRM, pas encore envoyé
  const derive = new WeakMap();     // objet db -> version du serveur dont il est parti (point commun pour la fusion)
  const abonnesMaj = new Set();
  const abonnesEtat = new Set();
  let etat = { statut: 'local', texte: 'Enregistré sur ce PC', heure: '' };

  const lireLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ecrireLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage plein ou indisponible */ } };
  const heure = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  function changerEtat(statut, texte) {
    etat = { statut, texte, heure: heure() };
    abonnesEtat.forEach((f) => { try { f(etat); } catch (e) { console.error(e); } });
  }

  // Texte canonique (clés triées) : deux contenus identiques donnent toujours le même texte.
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canon(x))).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  const lire = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

  /* ---------- Fusion à trois : base (version commune), mien (ce poste), leur (serveur) ---------- */
  const egal = (a, b) => canon(a) === canon(b);
  const objet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const listeIds = (v) => Array.isArray(v) && v.every((x) => objet(x) && x.id !== undefined && x.id !== null);

  function fusion3(b, m, t) {
    if (egal(m, b)) return t;
    if (egal(t, b)) return m;
    if (egal(m, t)) return m;
    if (listeIds(m) && listeIds(t)) { // listes de fiches : fusion fiche par fiche
      const carte = (l) => new Map((Array.isArray(l) ? l : []).filter(objet).map((x) => [String(x.id), x]));
      const B = listeIds(b) ? carte(b) : new Map(), Mi = carte(m), T = carte(t);
      const res = [];
      for (const id of new Set([...T.keys(), ...Mi.keys()])) {
        const bi = B.get(id), mi = Mi.get(id), ti = T.get(id);
        if (mi === undefined) { if (bi !== undefined && egal(ti, bi)) continue; res.push(ti); continue; }  // supprimée ici
        if (ti === undefined) { if (bi !== undefined && egal(mi, bi)) continue; res.push(mi); continue; }  // supprimée ailleurs
        res.push(fusion3(bi, mi, ti));
      }
      return res;
    }
    if (objet(m) && objet(t)) { // fiche : champ par champ
      const bo = objet(b) ? b : {};
      const res = {};
      for (const k of new Set([...Object.keys(t), ...Object.keys(m)])) {
        const v = fusion3(bo[k], m[k], t[k]);
        if (v !== undefined) res[k] = v;
      }
      return res;
    }
    return t; // même valeur modifiée des deux côtés : le serveur gagne (25/11, « le serveur a raison »)
  }

  function fusionner(b, m, t) {
    const res = fusion3(b, m, t);
    // Compteurs de références : on additionne ce que chaque poste a créé depuis la version commune.
    // Seuls comptent les compteurs de la même « époque » que le résultat (18 nov. 2026 : numérotation repartie de zéro
    // après le retrait de la démo ; les anciens compteurs de la démo ne doivent pas revenir par la fusion).
    const ep = (res && res.epoque) || '';
    const cpt = (x) => (x && ((x.epoque || '') === ep) && x.compteurs) || null;
    const mc = cpt(m) || {}, tc = cpt(t) || {};
    let bc = cpt(b);
    if (!bc) { bc = {}; for (const k of new Set([...Object.keys(mc), ...Object.keys(tc)])) bc[k] = Math.min(+mc[k] || 0, +tc[k] || 0); }
    const c = {};
    for (const k of new Set([...Object.keys(bc), ...Object.keys(mc), ...Object.keys(tc)])) {
      const base = +bc[k] || 0, mv = +mc[k] || 0, tv = +tc[k] || 0;
      c[k] = Math.max(mv, tv, base + (mv - base) + (tv - base));
    }
    res.compteurs = c;
    return res;
  }

  /* ---------- Serveur ---------- */
  async function lireServeur() {
    const { data, error } = await sb.storage.from(BUCKET).download(CHEMIN);
    if (error) {
      const code = String(error.statusCode || error.status || '');
      if (code === '400' || code === '404' || /not.?found|introuvable/i.test(error.message || '')) return null;
      throw new Error(error.message || 'lecture impossible');
    }
    return data ? await data.text() : null;
  }
  async function ecrireServeur(texte) {
    const { error } = await sb.storage.from(BUCKET).upload(CHEMIN, new Blob([texte], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' });
    if (error) throw new Error(error.message || 'enregistrement impossible');
  }
  function signaler() {
    try { sb.from('evenements').insert({ module: 'crm', cle: 'donnees', poste }).then(() => {}, () => {}); } catch { /* sans direct */ }
  }

  /* ---------- Synchronisation ----------
     Chaque version enregistrée sur le serveur porte _rev (son identifiant) et _parent (la version du serveur sur laquelle
     elle a été fusionnée). Si deux postes enregistrent exactement en même temps, le second écrase le premier : le premier
     le voit (la nouvelle version ne descend pas de la sienne), retrouve leur version commune et refusionne → rien ne se perd. */
  const META = ['_rev', '_parent'];
  const donnees = (doc) => { if (!doc) return null; const d = { ...doc }; META.forEach((k) => delete d[k]); return d; };
  const nouvelleRev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const hist = new Map(); // rev -> { data, parent } des versions du serveur vues ou écrites (30 dernières)
  function retenir(doc) {
    if (!doc || !doc._rev) return;
    hist.set(doc._rev, { data: donnees(doc), parent: doc._parent || null });
    while (hist.size > 30) hist.delete(hist.keys().next().value);
  }
  function ancetres(rev) { const s = []; let r = rev, n = 0; while (r && n++ < 60) { s.push(r); r = hist.has(r) ? hist.get(r).parent : null; } return s; }
  function ancetreCommun(revA, revB, defaut) {
    const a = new Set(ancetres(revA));
    for (const r of ancetres(revB)) if (a.has(r) && hist.has(r)) return hist.get(r).data;
    return defaut;
  }

  function publier(nv, rev) { // nouvelle version (fusionnée ou venue d'un autre poste) : cache du PC + écran du CRM
    if (D.attacherProduits) D.attacherProduits(nv, true); // catalogue : toujours le tableau de js/erp-produits.js
    ecrireLS(CLE_LOCALE, JSON.stringify(nv));
    derive.set(nv, { data: lire(JSON.stringify(nv)), rev });
    abonnesMaj.forEach((f) => { try { f(nv); } catch (e) { console.error(e); } });
  }

  // Première lecture de la séance : la version du serveur remplace la copie du PC (voir en-tête).
  let premiere = true;
  let pret = false;
  const attentesPret = new Set();
  let produitsPrets = Promise.resolve();
  function marquerPret() { if (pret) return; produitsPrets.then(() => { if (pret || !actif) return; pret = true; attentesPret.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); attentesPret.clear(); }); }
  async function rangerCopieDuPC(texte) {
    const d = new Date().toISOString().replace(/[:.]/g, '-');
    const chemin = `crm/postes/${d}-${String(poste || 'poste').replace(/[^A-Za-z0-9-]+/g, '-')}-non-envoye.json`;
    const { error } = await sb.storage.from(BUCKET).upload(chemin, new Blob([texte], { type: 'application/json' }), { upsert: false, contentType: 'application/json' });
    if (error) throw new Error('copie du PC non rangée (' + error.message + ')');
  }

  function synchroniser() {
    if (!actif) return Promise.resolve();
    file = file.then(async () => {
      clearTimeout(reessai);
      const baseDoc = lire(lireLS(CLE_BASE));
      retenir(baseDoc);
      const baseData = donnees(baseDoc);
      let obj = aEnvoyer; aEnvoyer = null;
      let M, mb; // M = données de ce poste ; mb = { data, rev } : ce que ces données contenaient et la version du serveur d'alors
      if (obj) { M = lire(JSON.stringify(obj)); mb = derive.get(obj) || { data: baseData, rev: baseDoc && baseDoc._rev }; }
      else {
        const loc = lire(lireLS(CLE_LOCALE));
        M = loc && loc.version === 3 ? loc : baseData;
        mb = { data: baseData, rev: baseDoc && baseDoc._rev };
      }
      const aModifs = !!M && (!mb.data || canon(M) !== canon(mb.data));
      changerEtat('envoi', aModifs ? 'Enregistrement en ligne…' : 'Lecture du serveur…');
      let L;
      try { L = lire(await lireServeur()); }
      catch (e) { if (obj) aEnvoyer = aEnvoyer || obj; changerEtat('erreur', premiere ? 'Serveur injoignable : les données ne s’affichent qu’une fois lues sur le serveur' : 'Hors ligne : modification gardée, envoi dès le retour d’Internet'); reessai = setTimeout(synchroniser, premiere ? 10000 : 30000); return; }
      try {
        let doc;
        if (premiere && L && !obj) {
          // 25/11 : la copie du PC n'est jamais fusionnée à l'ouverture. Modifications jamais envoyées → rangées en ligne.
          if (aModifs && M) await rangerCopieDuPC(canon(M));
          premiere = false;
          retenir(L);
          ecrireLS(CLE_BASE, canon(L));
          publier(lire(JSON.stringify(donnees(L))), L._rev);
          changerEtat('ok', aModifs ? 'Version du serveur chargée (ancienne copie du PC rangée en ligne)' : 'À jour avec le serveur');
          marquerPret();
          return;
        }
        premiere = false;
        if (!L) { // 1er poste : le serveur est vide → on envoie ce PC
          const d = M || lire(JSON.stringify(D.charger()));
          doc = { ...d, _rev: nouvelleRev(), _parent: null };
          await ecrireServeur(canon(doc)); signaler();
        } else {
          retenir(L);
          const Ld = donnees(L);
          // 20 nov. 2026 : produits dans la table crm_produits (js/erp-produits.js) → ce poste ne touche plus aux produits du fichier
          // (ils y restent tels quels pour les PC pas encore mis à jour ; aucune suppression ne part d'ici).
          if (M && D.produitsEnTable && D.produitsEnTable()) M.produits = Ld.produits;
          const fus = !M ? lire(JSON.stringify(Ld))
            : L._rev === mb.rev ? M
            : fusionner(ancetres(L._rev).includes(mb.rev) ? mb.data : ancetreCommun(mb.rev, L._rev, mb.data), M, Ld);
          // 18 nov. 2026 : la démo ne doit jamais revenir (fusion avec un poste qui l'avait encore). Avant le tout premier
          // retrait sur le serveur, copie de sécurité « crm/sauvegarde-avant-retrait-demo.json » (jamais écrasée ensuite).
          if (D.retirerDemo) D.retirerDemo(fus);
          if (D.typerBrouillons) D.typerBrouillons(fus); // anciens brouillons (PROVn) → (PROV-PRn / -COn / -POn)
          if (D.appliquerTva) D.appliquerTva(fus); // TVA : 20 % à la vente, 20 % / 0 % à l’achat selon le pays du fournisseur
          if (D.migrerAchats) D.migrerAchats(fus); // anciens états « Validé / Approuvé » des commandes fournisseurs
          if (D.natureClients) D.natureClients(fus); // jamais prospect et client à la fois ; prospect qui a commandé → client
          if (D.retirerDemo && D.retirerDemo(lire(JSON.stringify(Ld))) && canon(fus) !== canon(Ld)) { // le serveur a encore la démo
            const { error: errSauv } = await sb.storage.from(BUCKET).upload('crm/sauvegarde-avant-retrait-demo.json', new Blob([canon(L)], { type: 'application/json' }), { upsert: false, contentType: 'application/json' });
            if (errSauv && !/exist|duplicate|409/i.test(`${errSauv.message} ${errSauv.statusCode || ''}`)) throw new Error('copie de sécurité impossible (' + errSauv.message + ')');
          }
          if (canon(fus) !== canon(Ld)) { doc = { ...fus, _rev: nouvelleRev(), _parent: L._rev }; await ecrireServeur(canon(doc)); signaler(); }
          else doc = L;
        }
        retenir(doc);
        ecrireLS(CLE_BASE, canon(doc));
        const fusData = donnees(doc);
        if (obj) derive.set(obj, { data: M, rev: doc._rev }); // cet objet, s'il est encore modifié, repartira de ce qu'il contenait
        if (!M || canon(fusData) !== canon(M)) publier(lire(JSON.stringify(fusData)), doc._rev);
        else ecrireLS(CLE_LOCALE, JSON.stringify(obj || fusData));
        changerEtat('ok', !aModifs ? 'À jour avec le serveur' : (M && canon(fusData) !== canon(M)) ? 'Enregistré en ligne (fusionné avec un autre poste)' : 'Enregistré en ligne');
        marquerPret();
      } catch (e) {
        if (obj) aEnvoyer = aEnvoyer || obj;
        changerEtat('erreur', 'Enregistrement en ligne impossible : ' + e.message + ' (nouvel essai dans 30 s)');
        reessai = setTimeout(synchroniser, 30000);
      }
    }).catch((e) => console.error('CRM en ligne :', e));
    return file;
  }


  // Le CRM enregistre (D.sauver) : copie du PC tout de suite, serveur 1 s après la dernière modification.
  const sauverLocal = D.sauver;
  D.sauver = (db) => {
    sauverLocal(db);
    if (!actif) return;
    aEnvoyer = db;
    clearTimeout(minuteur);
    changerEtat('attente', 'Modification à enregistrer…');
    minuteur = setTimeout(synchroniser, 1000);
  };
  const chargerLocal = D.charger;
  D.charger = () => { const db = chargerLocal(); if (!derive.has(db)) { const b = lire(lireLS(CLE_BASE)); derive.set(db, { data: donnees(b), rev: b && b._rev }); } return db; };

  window.FMDERPNuage = {
    demarrer(o) {
      if (!o || !o.sb || !o.sb.storage) return; // fausse base de test : reste sur le PC
      sb = o.sb; poste = o.poste || ''; actif = true; premiere = true; pret = false;
      produitsPrets = window.FMDERPProduits ? window.FMDERPProduits.demarrer(o).catch((e) => console.error('Catalogue :', e)) : Promise.resolve();
      synchroniser();
    },
    arreter() { actif = false; premiere = true; pret = false; clearTimeout(minuteur); clearTimeout(reessai); sb = null; changerEtat('local', 'Enregistré sur ce PC'); },
    changementDistant() { if (actif) synchroniser(); if (window.FMDERPProduits) window.FMDERPProduits.lire(); },
    // catalogue (js/erp-produits.js) : écrans à redessiner, état affiché
    rafraichir() { const db = D.charger(); abonnesMaj.forEach((f) => { try { f(db); } catch (e) { console.error(e); } }); },
    etatProduits(t) { changerEtat(/impossible/.test(t) ? 'erreur' : /…$/.test(t) ? 'envoi' : 'ok', t); },
    synchroniser,
    // Pièces jointes (21 nov. 2026 : AR et factures des commandes fournisseurs) : espace privé donnees-fmd, dossier crm/pieces/.
    // Lien d'ouverture signé, valable 10 minutes (ouvert dans le navigateur de l'utilisateur).
    async envoyerPiece(chemin, fichier) {
      if (!actif || !sb) throw new Error('hors ligne');
      const { error } = await sb.storage.from(BUCKET).upload(chemin, fichier, { upsert: false, contentType: fichier.type || 'application/octet-stream' });
      if (error) throw new Error(error.message);
      return chemin;
    },
    // Sauvegarde d'un fichier JSON dans l'espace privé (ex. avant la remise à zéro des documents de test, js/erp-purge.js)
    async sauvegarder(chemin, texte) {
      if (!actif || !sb) throw new Error('CRM pas en ligne');
      const { error } = await sb.storage.from(BUCKET).upload(chemin, new Blob([texte], { type: 'application/json' }), { upsert: false, contentType: 'application/json' });
      if (error) throw new Error(error.message);
      return chemin;
    },
    async lienPiece(chemin) {
      if (!sb) throw new Error('hors ligne : connectez-vous pour ouvrir la pièce');
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(chemin, 600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    surMaj(f) { abonnesMaj.add(f); return () => abonnesMaj.delete(f); },
    // 25/11 : vrai quand la version du serveur a été lue dans cette séance (ou quand le CRM n'est pas en ligne : fausse base).
    get pret() { return !actif || pret; },
    attendrePret() { return new Promise((r) => { if (!actif || pret) r(); else attentesPret.add(r); }); },
    surEtat(f) { abonnesEtat.add(f); f(etat); return () => abonnesEtat.delete(f); },
    get etat() { return etat; },
    get actif() { return actif; },
    _fusionner: fusionner, _canon: canon, // tests
  };
})();
