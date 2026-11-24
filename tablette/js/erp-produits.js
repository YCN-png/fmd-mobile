// FMD — CRM : le catalogue PRODUITS dans une vraie table (20 nov. 2026, demande : « j'ai besoin d'une base de données pour
// mes produits (jusqu'à 500 000 références), mais tout doit être relié »). SQL : supabase/crm-produits.sql.
//
// Principe — RIEN ne change pour les écrans : db.produits reste UN tableau en mémoire (le même pour le CRM, FM'STUDIO,
// le site, la Compta…), les devis / commandes / factures / stock désignent toujours un produit par son identifiant.
// Ce qui change, c'est l'enregistrement :
//   • chaque produit = une ligne de public.crm_produits (fiche complète en jsonb) ; FMD n'envoie que les produits modifiés
//     (D.toucher → p.modifie), et ne relit que ceux modifiés depuis sa dernière lecture (heure du serveur) ;
//   • copie sur le PC dans IndexedDB (base « fmd-crm », sans limite pratique) : ouverture rapide, travail hors ligne ;
//   • le fichier du CRM (localStorage + Storage crm/crm.json, js/erp-nuage.js) ne contient plus les produits.
// Tant que la table n'existe pas (SQL pas encore exécuté) ou avant la première connexion : ancien fonctionnement
// (produits dans le fichier du CRM). Première connexion avec la table : migration automatique des produits du PC.
// Conflit (même produit modifié sur deux PC avant synchronisation) : la fiche la plus récemment envoyée gagne ;
// une modification pas encore envoyée de ce PC n'est jamais écrasée par une lecture.
// Sécurité : un produit modifié sans D.toucher est quand même détecté (empreinte de chaque fiche, vérifiée en tâche de fond).
// Utilisé par js/erp-nuage.js (démarrage, relecture, fichier sans produits) ; API : window.FMDERPProduits.
// 25/11/2026 — TOUT SUR LE SERVEUR : les produits modifiés sur ce PC mais pas encore envoyés sont notés (meta « enAttente »).
// À la connexion suivante, ils ne sont JAMAIS envoyés : la fiche du serveur les remplace, l'ancienne version du PC est
// rangée en ligne (donnees-fmd/crm/postes/<date>-<poste>-produits-non-envoyes.json). Avant, ils étaient considérés comme
// envoyés et restaient différents du serveur sans que personne le sache.
(function () {
  'use strict';
  const D = window.FMDERP; if (!D) return;
  const TABLE = 'crm_produits';
  const CLE_TABLE = 'fmd-produits-table';      // '1' : ce PC enregistre les produits dans la table
  const LOT = 500;                             // lignes par envoi / lecture

  const LISTE = [];                            // le catalogue : MÊME tableau pour tous les écrans
  let enTable = false;
  try { enTable = localStorage.getItem(CLE_TABLE) === '1'; } catch { /* stockage indisponible */ }
  // Dans la table : jamais dans le fichier du CRM (JSON.stringify(db) omet « produits »). Sinon : comme avant.
  Object.defineProperty(LISTE, 'toJSON', { value: () => (enTable ? undefined : Array.from(LISTE)), enumerable: false });

  let sb = null; let poste = ''; let pret = false;
  const connus = new Map();                    // id → p.modifie déjà enregistré (serveur si table, sinon PC)
  const empreintes = new Map();                // id → empreinte de la fiche (détection des modifications sans D.toucher)
  let derniere = '';                           // heure serveur de la dernière ligne lue
  const attente = new Set();                   // ids modifiés sur ce PC, pas encore confirmés par le serveur (25/11)
  let minuteur = null; let reessai = null; let file = Promise.resolve();
  const abonnes = new Set();
  const etat = (t) => { if (window.FMDERPNuage && window.FMDERPNuage.etatProduits) window.FMDERPNuage.etatProduits(t); };

  // ---------- IndexedDB ----------
  let ouverture = null;
  const base = () => ouverture || (ouverture = new Promise((ok, ko) => {
    const r = indexedDB.open('fmd-crm', 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('produits')) d.createObjectStore('produits', { keyPath: 'id' }); if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  }));
  const tx = async (stores, mode, f) => { const d = await base(); return new Promise((ok, ko) => { const t = d.transaction(stores, mode); let res; const r = f(t); if (r && 'onsuccess' in r) r.onsuccess = () => { res = r.result; }; t.oncomplete = () => ok(res); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error); }); };
  const idbTous = () => tx(['produits'], 'readonly', (t) => t.objectStore('produits').getAll());
  const idbMeta = (k) => tx(['meta'], 'readonly', (t) => t.objectStore('meta').get(k));
  const idbEcrire = (mettre, retirer, meta) => tx(['produits', 'meta'], 'readwrite', (t) => { const s = t.objectStore('produits'); mettre.forEach((p) => s.put(p)); retirer.forEach((id) => s.delete(id)); if (meta) Object.entries(meta).forEach(([k, v]) => t.objectStore('meta').put(v, k)); });

  // ---------- empreinte (FNV-1a 32 bits du JSON de la fiche) ----------
  const empreinte = (p) => { const s = JSON.stringify(p); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
  function remplacer(l) { LISTE.length = 0; for (let i = 0; i < l.length; i++) LISTE.push(l[i]); }
  // avecEmpreinte = false au démarrage (100 000 fiches) : l'empreinte est alors calculée plus tard, en tâche de fond
  function memoriser(p, avecEmpreinte = true) { connus.set(p.id, p.modifie || ''); if (avecEmpreinte) empreintes.set(p.id, empreinte(p)); else empreintes.delete(p.id); }

  // ---------- chargement au démarrage (copie du PC) ----------
  const chargement = (async () => {
    try {
      const l = await idbTous();
      if (l && l.length) { remplacer(l); l.forEach((p) => memoriser(p, false)); derniere = (await idbMeta('derniere')) || ''; }
      ((await idbMeta('enAttente')) || []).forEach((id) => attente.add(id));
    } catch (e) { console.warn('Catalogue : copie du PC illisible', e); }
    if (!LISTE.length) { // ancien format : produits dans le cache du CRM
      try { const db = JSON.parse(localStorage.getItem('fmd-crm-demo-v3') || 'null'); if (db && Array.isArray(db.produits) && db.produits.length) { remplacer(db.produits); if (!enTable) LISTE.forEach((p) => memoriser(p, false)); } } catch { /* rien */ }
    }
    pret = true; avertir();
  })();

  // Le CRM (et tous les modules) obtient TOUJOURS ce tableau dans db.produits.
  // depuisServeur : version du fichier du CRM venue du serveur (js/erp-nuage.js). Hors table, elle fait foi pour les produits.
  // Jamais une copie du PC (elle peut être plus ancienne que la mémoire), jamais pendant le passage à la table.
  let migration = false;
  const lies = new WeakSet(); // objets « db » donnés aux écrans
  function attacher(db, depuisServeur = false) {
    if (!db || typeof db !== 'object') return db;
    lies.add(db);
    if (db.produits !== LISTE) {
      if (depuisServeur && !enTable && !migration && Array.isArray(db.produits)) remplacer(db.produits);
      db.produits = LISTE;
    }
    return db;
  }
  const chargerAvant = D.charger;
  D.charger = () => attacher(chargerAvant());
  const sauverAvant = D.sauver;
  // Un écran qui REMPLACE le tableau (ex. db.produits = db.produits.filter(…) pour supprimer) : le catalogue reprend ce
  // nouveau contenu (la suppression part vers la base) et l'écran retrouve le tableau commun.
  D.sauver = (db) => { if (db && lies.has(db) && db.produits !== LISTE && Array.isArray(db.produits)) { remplacer(db.produits); db.produits = LISTE; }
    sauverAvant(db); if (db && db.produits === LISTE) planifier(); };
  D.attacherProduits = attacher;
  D.produitsEnTable = () => enTable;

  function avertir() { abonnes.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); if (window.FMDERPNuage && window.FMDERPNuage.rafraichir) window.FMDERPNuage.rafraichir(); }
  const planifier = (ms = 1200) => { clearTimeout(minuteur); minuteur = setTimeout(() => { file = file.then(pousser).catch((e) => console.error('Catalogue :', e)); }, ms); };

  // ---------- produits modifiés depuis le dernier enregistrement ----------
  function aEnvoyer() {
    const ids = new Set(); const changes = []; const retires = [];
    for (const p of LISTE) { if (!p || p.id == null) continue; ids.add(p.id); if (!connus.has(p.id) || (p.modifie || '') !== connus.get(p.id)) changes.push(p); }
    for (const id of connus.keys()) if (!ids.has(id)) retires.push(id);
    return { changes, retires };
  }
  async function pousser() {
    const { changes, retires } = aEnvoyer(); if (!changes.length && !retires.length) return;
    if (sb && enTable) { changes.forEach((p) => attente.add(p.id)); retires.forEach((id) => attente.add(id)); }
    try { await idbEcrire(changes, retires, { enAttente: [...attente] }); } catch (e) { console.warn('Catalogue : copie du PC impossible', e); }
    if (!sb || !enTable) { changes.forEach(memoriser); retires.forEach((id) => { connus.delete(id); empreintes.delete(id); }); return; }
    try {
      const lignes = [...changes.map((p) => ({ id: String(p.id), data: p, supprime: false, poste })), ...retires.map((id) => ({ id: String(id), data: { id }, supprime: true, poste }))];
      for (let i = 0; i < lignes.length; i += LOT) {
        const { error } = await sb.from(TABLE).upsert(lignes.slice(i, i + LOT), { onConflict: 'id' });
        if (error) throw new Error(error.message);
        if (lignes.length > LOT) etat(`Catalogue : envoi ${Math.min(i + LOT, lignes.length)} / ${lignes.length} produits…`);
      }
      changes.forEach(memoriser); retires.forEach((id) => { connus.delete(id); empreintes.delete(id); });
      changes.forEach((p) => attente.delete(p.id)); retires.forEach((id) => attente.delete(id));
      try { await idbEcrire([], [], { enAttente: [...attente] }); } catch { /* relu au prochain envoi */ }
      try { sb.from('evenements').insert({ module: 'crm', cle: 'produits', poste }).then(() => {}, () => {}); } catch { /* sans direct */ }
      if (lignes.length > LOT) etat(`Catalogue enregistré en ligne (${LISTE.length} produits)`);
    } catch (e) {
      etat('Catalogue : enregistrement en ligne impossible (' + e.message + '), nouvel essai dans 30 s');
      clearTimeout(reessai); reessai = setTimeout(() => planifier(0), 30000);
    }
  }

  // ---------- lecture des produits modifiés ailleurs ----------
  async function lire() {
    if (!sb || !enTable) return;
    await chargement;
    let n = 0; const index = new Map(LISTE.map((p, i) => [p.id, i]));
    let depuis = derniere ? new Date(Date.parse(derniere) - 120000).toISOString() : '';
    const { changes } = aEnvoyer(); const enCours = new Set(changes.map((p) => p.id)); // pas encore envoyés ici : jamais écrasés
    const mettre = []; const retirer = [];
    for (;;) {
      let q = sb.from(TABLE).select('id,data,supprime,modifie').order('modifie', { ascending: true }).limit(LOT * 2);
      // 2 minutes de marge : une modification enregistrée en même temps sur un autre PC (heure serveur un peu antérieure,
      // transaction terminée après notre lecture) est quand même relue ; relire une fiche déjà connue ne change rien.
      if (derniere) q = q.gt('modifie', depuis);
      const { data, error } = await q; if (error) throw new Error(error.message);
      if (!data || !data.length) break;
      for (const r of data) {
        if (r.modifie > derniere) derniere = r.modifie; depuis = r.modifie; if (enCours.has(r.id)) continue;
        const i = index.get(r.id);
        if (r.supprime) { if (i !== undefined) { LISTE[i] = null; retirer.push(r.id); } connus.delete(r.id); empreintes.delete(r.id); continue; }
        const p = r.data; if (!p || typeof p !== 'object') continue;
        if (i !== undefined) LISTE[i] = p; else { index.set(r.id, LISTE.length); LISTE.push(p); }
        memoriser(p); mettre.push(p);
      }
      n += data.length; if (n > LOT * 4) etat(`Catalogue : lecture ${n} produits…`);
      if (data.length < LOT * 2) break;
    }
    if (retirer.length) { const garde = LISTE.filter(Boolean); remplacer(garde); }
    if (mettre.length || retirer.length) { try { await idbEcrire(mettre, retirer, { derniere }); } catch { /* copie du PC */ } avertir(); }
    else try { await idbEcrire([], [], { derniere }); } catch { /* rien */ }
    if (n > LOT * 4) etat(`Catalogue à jour (${LISTE.length} produits)`);
  }

  // ---------- démarrage avec le serveur (appelé par erp-nuage.js) ----------
  async function demarrer(o) {
    if (!o || !o.sb || !o.sb.from) return;
    sb = o.sb; poste = o.poste || '';
    await chargement;
    const { count, error } = await sb.from(TABLE).select('id', { count: 'exact', head: true });
    if (error) { console.info('Catalogue : table crm_produits indisponible, produits dans le fichier du CRM (', error.message, ')'); return; }
    if (!enTable) { // migration de ce PC : la table devient la référence
      migration = true;
      etat('Catalogue : passage à la base de données…');
      derniere = '';
      if (count) await lireDepuisZero(); // table déjà remplie (autre PC) : on la lit d'abord
      connus.clear(); // tout ce qui est sur ce PC et pas (ou plus récent) sur le serveur sera envoyé
      for (const p of LISTE) if (p && serveurConnu.has(p.id) && serveurConnu.get(p.id) === (p.modifie || '')) connus.set(p.id, p.modifie || '');
      enTable = true; try { localStorage.setItem(CLE_TABLE, '1'); } catch { /* rien */ }
      await pousser();
      try { await idbEcrire(LISTE, [], { derniere }); } catch { /* rien */ }
      etat(`Catalogue dans la base de données (${LISTE.length} produits)`);
      migration = false;
      try { D.sauver(D.charger()); } catch { /* copie du PC sans les produits */ }
    }
    else await reprendreDuServeur().catch((e) => etat('Catalogue : reprise du serveur impossible (' + e.message + ')'));
    await lire().catch((e) => etat('Catalogue : lecture impossible (' + e.message + ')'));
    planifier(); surveiller();
  }
  // 25/11 : produits modifiés sur ce PC lors d'une séance précédente et jamais confirmés par le serveur → version du serveur.
  async function reprendreDuServeur() {
    const ids = [...attente].map(String); if (!ids.length) return;
    const index = new Map(LISTE.map((p, i) => [String(p && p.id), i]));
    const locaux = ids.map((id) => LISTE[index.get(id)]).filter(Boolean);
    const d = new Date().toISOString().replace(/[:.]/g, '-');
    const chemin = `crm/postes/${d}-${String(poste || 'poste').replace(/[^A-Za-z0-9-]+/g, '-')}-produits-non-envoyes.json`;
    const { error: errR } = await sb.storage.from('donnees-fmd').upload(chemin, new Blob([JSON.stringify({ produits: locaux, ids })], { type: 'application/json' }), { upsert: false, contentType: 'application/json' });
    if (errR) throw new Error('copie du PC non rangée : ' + errR.message);
    const serveur = new Map();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await sb.from(TABLE).select('id,data,supprime').in('id', ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      (data || []).forEach((r) => serveur.set(String(r.id), r));
    }
    const mettre = []; const retirer = [];
    for (const id of ids) {
      const r = serveur.get(id); const i = index.get(id);
      if (r && !r.supprime && r.data && typeof r.data === 'object') { if (i !== undefined) LISTE[i] = r.data; else LISTE.push(r.data); memoriser(r.data); mettre.push(r.data); }
      else { if (i !== undefined) LISTE[i] = null; connus.delete(id); empreintes.delete(id); retirer.push(id); }
    }
    if (retirer.length) remplacer(LISTE.filter(Boolean));
    attente.clear();
    try { await idbEcrire(mettre, retirer, { enAttente: [] }); } catch { /* copie du PC */ }
    etat(`Catalogue : ${ids.length} produit${ids.length > 1 ? 's' : ''} pas envoyé${ids.length > 1 ? 's' : ''} d'une séance précédente → version du serveur (ancienne copie rangée en ligne)`);
    avertir();
  }
  const serveurConnu = new Map();
  async function lireDepuisZero() { // migration : produits déjà sur le serveur (venus d'un autre PC) fusionnés avec ceux du PC
    const index = new Map(LISTE.map((p, i) => [p.id, i]));
    for (let depuis = ''; ;) {
      let q = sb.from(TABLE).select('id,data,supprime,modifie').order('modifie', { ascending: true }).limit(LOT * 2); if (depuis) q = q.gt('modifie', depuis);
      const { data, error } = await q; if (error) throw new Error(error.message); if (!data || !data.length) break;
      for (const r of data) { depuis = r.modifie; derniere = r.modifie; if (r.supprime) continue; serveurConnu.set(r.id, (r.data && r.data.modifie) || '');
        const i = index.get(r.id); const loc = i !== undefined ? LISTE[i] : null;
        if (!loc) { index.set(r.id, LISTE.length); LISTE.push(r.data); } else if ((r.data.modifie || '') >= (loc.modifie || '')) LISTE[i] = r.data; }
      etat(`Catalogue : lecture ${serveurConnu.size} produits…`);
      if (data.length < LOT * 2) break;
    }
  }

  // ---------- filet de sécurité : fiches modifiées sans D.toucher (vérifiées par petits paquets, en tâche de fond) ----------
  let curseur = 0; let veille = null;
  function surveiller() {
    clearTimeout(veille);
    veille = setTimeout(() => {
      const fin = Math.min(LISTE.length, curseur + 3000); let vus = 0;
      for (; curseur < fin; curseur++) { const p = LISTE[curseur]; if (!p) continue; const h = empreinte(p); const avant = empreintes.get(p.id);
        if (avant === undefined) { if ((p.modifie || '') === connus.get(p.id)) empreintes.set(p.id, h); continue; } // première empreinte
        if (avant !== h && (p.modifie || '') === connus.get(p.id)) { D.toucher(p); vus++; } }
      if (curseur >= LISTE.length) curseur = 0;
      if (vus) planifier(0);
      surveiller();
    }, 4000);
  }

  window.FMDERPProduits = {
    demarrer, lire: () => { file = file.then(lire).catch((e) => console.error('Catalogue :', e)); return file; },
    pousser: () => { file = file.then(pousser); return file; }, pret: () => chargement, liste: LISTE,
    surMaj(f) { abonnes.add(f); return () => abonnes.delete(f); },
    get enTable() { return enTable; }, get nombre() { return LISTE.length; },
  };
})();
