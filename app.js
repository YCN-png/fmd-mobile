// FMD Mobile V2 (25/11/2026) — appli web installable pour iPhone, Android et tablette (demande : « je veux que ça soit
// disponible sur Android comme sur iOS, que tout soit synchro avec le PC, en version téléphone, sur mon iPhone ce soir »).
// Mêmes comptes, mêmes données que le logiciel FMD sur PC (Supabase) : rien n'est gardé sur le téléphone à part la session.
// Écrans : Accueil (widgets), Agenda, Tâches, Messages. Le CRM est lu en lecture seule (chiffre du mois, commandes).
// D.A. FMD Signature (maquette V2 : https://claude.ai/artifact/6T9TEbxaE1DHg7L7GVLF56). Détail : cerveau/Mobile.md.
(function () {
  'use strict';
  const VERSION = "0.4.145"; // remplacé à la fabrication (mobile/construire.js) par la version du logiciel FMD
  const C = window.FMD_CONFIG || {};
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fmd-mobile-session' } });
  const app = document.getElementById('app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const jourISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const aujISO = () => jourISO(new Date());
  const heureFR = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const euros = (n) => (+n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: (+n || 0) >= 1000 ? 0 : 2 });
  const nomDe = (p) => (p ? (p.nom || `${p.prenom || ''} ${p.nom_famille || ''}`.trim() || p.email || 'Collègue') : 'Collègue');
  const ESPACE = 'messagerie';
  // Installer l'appli (24/11/2026) : APK Android « coquille » (release fixe « android », jamais la « latest » des PC) ;
  // iPhone : Safari › Partager › Sur l'écran d'accueil. Rien n'est proposé quand l'appli est déjà installée / ouverte dans l'APK.
  const LIEN_APK = 'https://github.com/YCN-png/fmd-telechargement/releases/download/android/FMD-android.apk';
  const dansApk = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const installee = () => dansApk() || window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const estIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function blocInstaller() {
    if (installee()) return '';
    return `<div class="installer"><b>Installer l’appli FMD</b>
      ${estIOS() ? '' : `<a class="btn-verre" href="${LIEN_APK}">⬇ Télécharger l’appli Android (APK)</a>`}
      <small>iPhone / iPad : dans Safari, touchez <b>Partager</b> puis <b>« Sur l’écran d’accueil »</b>.</small>
      ${estIOS() ? '' : '<small>Android : ouvrez le fichier téléchargé puis « Installer » (une seule fois : ensuite l’appli se met à jour toute seule).</small>'}</div>`;
  }

  const ICO = {
    oeil: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
    oeilBarre: '<path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6A16.5 16.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>',
    accueil: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
    taches: '<path d="M9 11l3 3 8-8"></path><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"></path>',
    messages: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path>',
    compte: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    retour: '<path d="M15 18l-6-6 6-6"></path>',
    envoyer: '<path d="M5 12h14M13 6l6 6-6 6"></path>',
    trombone: '<path d="M21 12.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"></path>',
    photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>',
    coche: '<path d="M5 12l5 5 9-10"></path>',
    clients: '<circle cx="9" cy="8" r="4"></circle><path d="M2 21a7 7 0 0 1 14 0"></path><path d="M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"></path>',
    stock: '<path d="M12 2l9 5v10l-9 5-9-5V7z"></path><path d="M3 7l9 5 9-5M12 12v10"></path>',
    commande: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6"></path><circle cx="10" cy="20" r="1.4"></circle><circle cx="17" cy="20" r="1.4"></circle>',
    devis: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><path d="M14 3v6h6M12 12v6M9 15h6"></path>',
    tel: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"></path>',
    carte: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"></path><circle cx="12" cy="10" r="2.5"></circle>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path>',
    cherche: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>',
    clientPlus: '<circle cx="9" cy="8" r="4"></circle><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"></path>',
    alerte: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4M12 17h.01"></path>',
    camion: '<path d="M1 4h14v12H1zM15 8h4l4 4v4h-8z"></path><circle cx="6" cy="18.5" r="2.5"></circle><circle cx="18" cy="18.5" r="2.5"></circle>',
    codebarre: '<path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3"></path><path d="M7 8v8M10 8v8M13 8v8M16 8v8"></path>',
    crayon: '<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path>',
  };
  const ico = (n, t = 22, w = 2) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n] || ''}</svg>`;

  const S = { user: null, profil: null, profils: [], route: 'accueil', conv: null, messages: [], taches: [], evts: [], crm: null, jour: aujISO(), canal: null, urls: {}, feuille: null,
    client: null, rechClients: '', rechStock: '', produits: [], produitsCharges: false, produitsCache: {}, devis: null,
    couts: {}, rechAccueil: '', accProduits: [], rechCollegues: '', enLigne: new Set(), devisCat: 'tout' };
  // Cacher la marge (25/11/2026, demande : « sur l'application il faut un bouton qui cache la marge ») : pour montrer l'écran
  // à un client. Choix gardé sur l'appareil (préférence d'affichage, pas une donnée).
  const CLE_MARGE = 'fmd-mobile-marge-cachee';
  let margeCachee = (() => { try { return localStorage.getItem(CLE_MARGE) === '1'; } catch { return false; } })();
  const boutonMarge = () => `<button type="button" class="oeil-marge" data-marge aria-pressed="${margeCachee}" aria-label="${margeCachee ? 'Afficher la marge' : 'Cacher la marge'}" title="${margeCachee ? 'Afficher la marge' : 'Cacher la marge'}">${ico(margeCachee ? 'oeilBarre' : 'oeil', 18)}</button>`;
  const blocMarge = (v) => `<span class="marge">${margeCachee ? '' : `Marge <b>${euros(v)}</b>`}${boutonMarge()}</span>`;
  const ROUTES = /^(accueil|agenda|taches|messages|clients|stock|devis)$/;
  const moi = () => (S.user ? S.user.id : null);
  const profil = (id) => S.profils.find((p) => p.id === id);
  const visible = (m) => !((m.de === moi() && m.masque_de) || (m.a === moi() && m.masque_a));
  const nonLus = (id) => S.messages.filter((m) => m.a === moi() && !m.lu_le && visible(m) && (!id || m.de === id)).length;
  const tablette = () => window.matchMedia('(min-width: 900px)').matches;

  function toast(t) { const el = document.getElementById('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.m); toast.m = setTimeout(() => { el.hidden = true; }, 3500); }

  // ================= connexion =================
  function ecranConnexion(msg = '') {
    app.innerHTML = `<div class="connexion"><form data-connexion>
      <div class="marque">F</div><h1>FMD</h1><p>Connectez-vous avec votre compte FMD (le même que sur le PC).</p>
      <label class="champ">Adresse e-mail<input name="email" type="email" autocomplete="username" required inputmode="email"></label>
      <label class="champ">Mot de passe<input name="mdp" type="password" autocomplete="current-password" required></label>
      <div class="erreur" data-erreur>${esc(msg)}</div>
      <button class="btn-metal" type="submit">Se connecter</button>${blocInstaller()}</form></div>`;
    app.querySelector('[data-connexion]').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Connexion…';
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.mdp.value });
      if (error) { b.disabled = false; b.textContent = 'Se connecter'; f.querySelector('[data-erreur]').textContent = /invalid/i.test(error.message) ? 'E-mail ou mot de passe incorrect.' : error.message; }
    });
  }

  async function demarrer(session) {
    S.user = session.user;
    const { data: p } = await sb.from('profils').select('*').eq('id', S.user.id).maybeSingle();
    S.profil = p || null;
    if (!p || p.statut !== 'valide' || p.actif === false) { app.innerHTML = `<div class="connexion"><form><div class="marque">F</div><h1>Compte en attente</h1><p>Votre compte doit être validé par l’administrateur dans le logiciel FMD.</p><button class="btn-verre" type="button" data-deco>Se déconnecter</button></form></div>`; app.querySelector('[data-deco]').onclick = () => sb.auth.signOut(); return; }
    app.innerHTML = '<div class="chargement"><span class="spin" aria-hidden="true"></span>Chargement depuis le serveur…</div>';
    await Promise.all([chargerProfils(), chargerMessages(), chargerTaches(), chargerAgenda(), chargerCRM()]);
    ecouter(); demarrerPresence();
    const h = location.hash.slice(1); if (ROUTES.test(h) && h !== 'devis') S.route = h;
    rendre();
  }

  // ================= données (toujours lues sur le serveur) =================
  async function chargerProfils() { const { data } = await sb.from('profils').select('id, nom, prenom, nom_famille, email, statut, actif').eq('statut', 'valide'); S.profils = (data || []).filter((p) => p.actif !== false); }
  async function chargerMessages() { const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: true }).limit(3000); S.messages = error ? [] : (data || []).filter((m) => m.de === moi() || m.a === moi()); }
  async function chargerTaches() { const { data } = await sb.from('taches').select('*').eq('pour', moi()).order('date_prevue', { ascending: true }).limit(400); const auj = aujISO(); S.taches = (data || []).filter((t) => !t.fait || String(t.fait_le || '').slice(0, 10) === auj); }
  async function chargerAgenda() {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi de cette semaine
    const fin = new Date(d); fin.setDate(fin.getDate() + 21);
    const { data, error } = await sb.rpc('agenda_voir', { p_debut: d.toISOString(), p_fin: fin.toISOString(), p_qui: moi() });
    S.evts = error ? [] : (data || []).sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  }
  async function chargerCRM() {
    try { const { data, error } = await sb.storage.from('donnees-fmd').download('crm/crm.json'); S.crm = error || !data ? null : JSON.parse(await data.text()); } catch { S.crm = null; }
  }
  function ecouter() {
    if (S.canal) sb.removeChannel(S.canal);
    S.canal = sb.channel('mobile-' + moi())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => { const m = p.new; if ((m.de === moi() || m.a === moi()) && !S.messages.some((x) => x.id === m.id)) { S.messages.push(m); if (m.a === moi() && S.route === 'conv' && S.conv === m.de) marquerLus(m.de); rendre(true); } })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => { const m = S.messages.find((x) => x.id === p.new.id); if (m) { Object.assign(m, { lu_le: p.new.lu_le, masque_de: p.new.masque_de, masque_a: p.new.masque_a }); rendre(true); } })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => { S.messages = S.messages.filter((x) => x.id !== (p.old || {}).id); rendre(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taches' }, () => chargerTaches().then(() => rendre(true)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda' }, () => chargerAgenda().then(() => rendre(true)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evenements' }, (p) => { if (p.new && p.new.module === 'crm') chargerCRM().then(() => { if (S.route === 'accueil') rendre(true); }); })
      .subscribe();
  }
  // Retour dans l'appli (iPhone : appli en arrière-plan) → tout est relu sur le serveur
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.user && S.profil) Promise.all([chargerMessages(), chargerTaches(), chargerAgenda(), chargerCRM()]).then(() => rendre(true)); });

  // ================= CRM (lecture seule) =================
  const htDoc = (d) => (d.lignes || []).reduce((s, l) => s + Math.round((+l.qte || 0) * (+l.pu || 0) * (1 - (+l.remise || 0) / 100) * 100) / 100, 0);
  const ETAT_CMD = { brouillon: ['Brouillon', ''], validee: ['Validée', ''], en_cours: ['En cours', 'bleu'], livree: ['Livrée', 'vert'], facturee: ['Facturée', 'vert'], annulee: ['Annulée', ''] };
  function ventes() {
    const db = S.crm; if (!db) return null;
    const cle = aujISO().slice(0, 7);
    const cmds = (db.commandes || []).filter((c) => c.etat !== 'brouillon' && c.etat !== 'annulee' && String(c.date || '').slice(0, 7) === cle);
    const ca = cmds.reduce((s, c) => s + htDoc(c), 0);
    const o = (db.objectifs && db.objectifs.ca) || {}; const om = o.mois && o.mois[cle];
    const objectif = om !== undefined && om !== null && om !== '' ? +om || 0 : +o.defaut || 0;
    return { ca, nb: cmds.length, cmds, objectif, pc: objectif > 0 ? Math.round((ca / objectif) * 100) : null };
  }
  function commandesASuivre(toutes) {
    const db = S.crm; if (!db) return [];
    const l = (db.commandes || []).filter((c) => ['validee', 'en_cours'].includes(c.etat)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return (toutes ? l : l.slice(0, 3)).map((c) => ({ ...c, nomTiers: ((db.tiers || []).find((t) => t.id === c.tiers) || {}).nom || '—', ht: htDoc(c), etat: ETAT_CMD[c.etat] || [c.etat, ''] }));
  }

  // ================= rendu =================
  // Champ en cours de saisie (hors message et recherche, déjà gérés) : repéré par son nom ou son attribut data-*, pour le
  // retrouver après un nouveau dessin de l'écran (événement en direct, retour dans l'appli…) avec sa valeur et le clavier ouvert.
  const champActif = () => { const a = document.activeElement; return a && app.contains(a) && a.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select') ? a : null; };
  const cleChamp = (el) => { if (el.name && el.type === 'radio') return `[name="${CSS.escape(el.name)}"][value="${CSS.escape(el.value)}"]`; if (el.name) return `[name="${CSS.escape(el.name)}"]`; const d = [...el.attributes].find((x) => x.name.startsWith('data-')); return d ? `[${d.name}${d.value ? `="${CSS.escape(d.value)}"` : ''}]` : null; };
  function rendre(garderDefilement) {
    const actif = champActif(); const cleActif = actif && !actif.matches('[data-texte], [data-recherche]') ? cleChamp(actif) : null;
    const memo = cleActif ? { v: actif.value, deb: actif.selectionStart, fin: actif.selectionEnd } : null;
    const champsFeuille = S.feuille ? [...app.querySelectorAll('.feuille input:not([type=file]), .feuille textarea, .feuille select')].map((el) => [cleChamp(el), el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value]).filter((x) => x[0]) : [];
    const y = window.scrollY; const fil = app.querySelector('.fil'); const yFil = fil ? fil.scrollTop : null; const enBas = fil ? fil.scrollHeight - fil.scrollTop - fil.clientHeight < 80 : true;
    const saisie = app.querySelector('[data-texte]'); const brouillon = saisie ? saisie.value : ''; const focus = saisie && document.activeElement === saisie;
    const r = S.route;
    const page = r === 'agenda' ? pageAgenda() : r === 'taches' ? pageTaches() : (r === 'messages' || r === 'conv') ? pageMessages() : r === 'clients' ? pageClients() : r === 'client' ? pageClient() : r === 'stock' ? pageStock() : r === 'devis' ? pageDevis() : pageAccueil();
    app.classList.toggle('en-conversation', r === 'conv' || r === 'devis');
    const fl = r === 'taches' ? 'Nouvelle tâche' : r === 'clients' ? 'Nouveau devis' : ''; // maquette V2 : l'agenda et la fiche client ont leur bouton en haut
    const champRech = app.querySelector('[data-recherche]'); const rech = champRech && document.activeElement === champRech ? { n: champRech.dataset.recherche, pos: champRech.selectionStart } : null;
    app.innerHTML = `<div class="coquille">${page}</div>${dock()}${fl ? `<button type="button" class="flottant" data-ajouter aria-label="${fl}">${ico('plus', 26, 2.4)}</button>` : ''}${S.feuille ? S.feuille : ''}`;
    if (rech) { const c = app.querySelector(`[data-recherche="${rech.n}"]`); if (c) { c.focus(); try { c.setSelectionRange(rech.pos, rech.pos); } catch { /* */ } } }
    const t = app.querySelector('[data-texte]'); if (t) { t.value = brouillon; if (focus) t.focus(); }
    if (S.feuille) champsFeuille.forEach(([k, v]) => { const el = app.querySelector('.feuille ' + k); if (el) { if (el.type === 'checkbox' || el.type === 'radio') el.checked = v; else el.value = v; } });
    if (cleActif) { const el = app.querySelector(cleActif); if (el) { el.value = memo.v; el.focus({ preventScroll: true }); try { el.setSelectionRange(memo.deb, memo.fin); } catch { /* champ nombre */ } } }
    const f2 = app.querySelector('.fil'); if (f2) f2.scrollTop = garderDefilement && yFil !== null && !enBas ? yFil : f2.scrollHeight;
    if (garderDefilement) window.scrollTo(0, y);
    chargerImages();
    if (S.route === 'conv' && S.conv && document.visibilityState === 'visible') marquerLus(S.conv);
    const hRoute = S.route === 'client' ? 'clients' : S.route === 'conv' ? 'messages' : S.route;
    if (location.hash.slice(1) !== hRoute && ROUTES.test(hRoute)) history.replaceState(null, '', '#' + hRoute);
  }
  function aller(r) { S.route = r; S.feuille = null; rendre(); window.scrollTo(0, 0); }

  function dock() {
    const n = nonLus();
    const b = (r, nom, lib, autres = [], attr = '') => `<button type="button" ${attr || `data-aller="${r}"`} class="${S.route === r || autres.includes(S.route) ? 'actif' : ''}" aria-label="${lib}" title="${lib}">${ico(nom, 22)}<span>${lib}</span>${r === 'messages' && n ? `<span class="badge">${n}</span>` : ''}</button>`;
    return `<nav class="dock" aria-label="Navigation">${b('accueil', 'accueil', 'Accueil')}${b('clients', 'clients', 'Clients', ['client'])}${b('devis', 'devis', 'Devis', [], 'data-dock-devis')}${b('stock', 'stock', 'Stock')}${b('agenda', 'agenda', 'Agenda', ['taches'])}${b('messages', 'messages', 'Messages', ['conv'])}</nav>`;
  }
  const entete = (petit, titre, retour) => `<header class="entete"><div style="display:flex;align-items:flex-end;gap:12px">${retour ? `<button type="button" class="retour" data-aller="${retour}" aria-label="Retour">${ico('retour', 20, 2.2)}</button>` : ''}<div><small>${esc(petit)}</small><h1>${titre}</h1></div></div><button type="button" class="avatar" data-compte aria-label="Mon compte">${esc(nomDe(S.profil).charAt(0).toUpperCase())}</button></header>`;

  // ---------- accueil (maquette V2, page 1 du PDF « FMD Tablette V2 ») ----------
  // Recherche « Client, produit, commande… », anneau des ventes du mois (objectif de Farid, marge, commandes), aujourd'hui,
  // messages (+ documents en attente de contrôle), tâches, commandes à suivre (cartes avec photo), 4 actions rapides.
  let coutsEnCours = false;
  // Prix de revient (PMP, sinon meilleur prix fournisseur) et photo des produits des documents affichés : lus une fois.
  async function chargerCouts(ids) {
    const manque = [...new Set(ids)].filter((id) => id && !(id in S.couts)); if (!manque.length || coutsEnCours) return; coutsEnCours = true;
    try { for (let i = 0; i < manque.length; i += 150) { const { data } = await sb.from('crm_produits').select('id,data').in('id', manque.slice(i, i + 150)); (data || []).forEach((x) => { if (x.data && x.data.id) S.produitsCache[x.data.id] = x.data; }); } } catch { /* sans marge */ }
    manque.forEach((id) => { const p = S.produitsCache[id]; S.couts[id] = p ? prixRevient(p) : 0; });
    coutsEnCours = false; rendre(true);
  }
  // Marge HT d'une liste de documents (null tant que les prix de revient ne sont pas lus)
  const margeDocs = (docs) => { let cout = 0; for (const d of docs) for (const l of d.lignes || []) { if (!l.produit) continue; if (!(l.produit in S.couts)) return null; cout += S.couts[l.produit] * (+l.qte || 0); } return { ht: rond2(docs.reduce((s, d) => s + htD(d), 0)), cout: rond2(cout) }; };
  const idsLignes = (docs) => docs.flatMap((d) => (d.lignes || []).map((l) => l.produit)).filter(Boolean);
  // Photo d'un document : image du premier article qui en a une, sinon fond « studio » (comme la maquette)
  const photoDoc = (d, cls = '') => { const p = (d.lignes || []).map((l) => S.produitsCache[l.produit]).find((x) => x && x.image && /^(data:image|https:)/.test(x.image));
    return `<span class="photo-doc ${cls}">${p ? `<img src="${esc(p.image)}" alt="">` : ''}</span>`; };
  const anneauSVG = (pct, centre, sous, taille = 150, id = 'anneau') => { const circ = 2 * Math.PI * 82; const v = Math.max(0, Math.min(100, pct || 0));
    return `<svg width="${taille}" height="${taille}" viewBox="0 0 200 200" role="img" aria-label="${esc(centre + ' ' + sous)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7DAC5"></stop><stop offset=".5" stop-color="#C9987D"></stop><stop offset="1" stop-color="#6F4A3C"></stop></linearGradient></defs><circle cx="100" cy="100" r="82" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="14"></circle>${v ? `<circle cx="100" cy="100" r="82" fill="none" stroke="url(#${id})" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(circ * v) / 100} ${circ}" transform="rotate(-90 100 100)"></circle>` : ''}<text x="100" y="${sous ? 104 : 112}" text-anchor="middle" fill="#F5EFEA" font-family="Montserrat Alternates, Montserrat, sans-serif" font-size="${String(centre).length > 7 ? 28 : 38}" font-weight="700">${esc(centre)}</text>${sous ? `<text x="100" y="130" text-anchor="middle" fill="#C9AFA0" font-family="Montserrat, sans-serif" font-size="13">${esc(sous)}</text>` : ''}</svg>`; };
  // Documents envoyés pour contrôle et pas encore contrôlés (par moi ou pour moi)
  function enAttenteControle() {
    const repondu = (m) => S.messages.some((x) => x.de === m.a && x.a === m.de && x.lien && x.lien.reponse && x.lien.route === m.lien.route && x.created_at >= m.created_at);
    const envoyes = S.messages.filter((m) => m.de === moi() && m.lien && m.lien.controle && !repondu(m));
    const recus = S.messages.filter((m) => m.a === moi() && m.lien && m.lien.controle && !dejaControle(m));
    const nom = (l) => { const t = new Set(l.map((m) => (m.lien.apercu || {}).type)); return t.size === 1 && t.has('prop') ? 'devis' : t.size === 1 && t.has('cmd') ? (l.length > 1 ? 'commandes' : 'commande') : (l.length > 1 ? 'documents' : 'document'); };
    return { envoyes, recus, nom };
  }
  let minuteurAcc = null;
  function rechercheAccueil(q) {
    S.rechAccueil = q; clearTimeout(minuteurAcc);
    if (!q.trim()) { S.accProduits = []; rendre(true); return; }
    rendre(true);
    minuteurAcc = setTimeout(async () => { try { S.accProduits = await chercherProduits(q, 8); } catch { S.accProduits = []; } if (S.route === 'accueil' && S.rechAccueil === q) rendre(true); }, 300);
  }
  const ETAT_DOC_TXT = (d) => (d._t === 'Devis' && d.etat === 'ouvert' ? ['Devis ouvert', 'bleu'] : ETATS_DOC[d.etat] || [d.etat || '', '']);
  function resultatsAccueil() {
    const q = normaliser(S.rechAccueil.trim()); const db = S.crm || {};
    const clients = (db.tiers || []).filter((t) => (t.client || t.prospect) && normaliser([t.nom, t.alt, t.ville, t.code_client, t.tel].join(' ')).includes(q)).slice(0, 6);
    const docs = [...(db.commandes || []).map((d) => ({ ...d, _t: 'Commande' })), ...(db.propositions || []).map((d) => ({ ...d, _t: 'Devis' }))]
      .filter((d) => normaliser([d.ref, (tiersDe(d.tiers) || {}).nom].join(' ')).includes(q)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
    const prods = S.accProduits || [];
    return `<div class="grille acc-resultats">
      <section class="widget"><div class="tete"><h2>Clients</h2><small>${clients.length}</small></div>${clients.length ? `<div class="convs">${clients.map((t) => `<button type="button" class="conv" data-fiche-client="${esc(t.id)}">${avatarTiers(t, 44)}<span class="txt"><b>${esc(t.nom)}</b><small>${esc([t.cp, t.ville].filter(Boolean).join(' ') || (t.prospect && !t.client ? 'Prospect' : 'Client'))}</small></span><span class="droite">›</span></button>`).join('')}</div>` : '<p class="vide">Aucun client.</p>'}</section>
      <section class="widget"><div class="tete"><h2>Commandes et devis</h2><small>${docs.length}</small></div>${docs.length ? `<div class="convs">${docs.map((d) => { const e = ETAT_DOC_TXT(d); return `<button type="button" class="conv" data-fiche-client="${esc(d.tiers)}"><span class="txt"><b>${esc(d.ref)}</b><small>${esc(d._t)} · ${esc((tiersDe(d.tiers) || {}).nom || '—')} · ${euros(htD(d))} HT</small></span><span class="etat ${e[1]}">${esc(e[0])}</span></button>`; }).join('')}</div>` : '<p class="vide">Aucun document.</p>'}</section>
      <section class="widget"><div class="tete"><h2>Produits</h2><small>${prods.length}</small></div>${prods.length ? prods.map((p) => `<button type="button" class="ligne-produit" data-acc-produit="${esc(p.id)}">${imageProduit(p, 44)}<span class="txt"><b>${esc(p.libelle || p.ref)}</b><small>${esc(p.ref || '')}${emplacements(p)[0] ? ' · ' + esc(emplacements(p)[0]) : ''}</small></span><span class="droite"><b>${(+p.stock || 0).toLocaleString('fr-FR')}</b><small>en stock</small></span></button>`).join('') : '<p class="vide">Aucun produit.</p>'}</section></div>`;
  }
  function pageAccueil() {
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const prenom = (S.profil.prenom || nomDe(S.profil).split(' ')[0]);
    const v = ventes(); const cmdsMois = v ? v.cmds : [];
    const evtsJour = S.evts.filter((e) => e.proprietaire === undefined || e.proprietaire === moi()).filter((e) => jourISO(new Date(e.debut)) === aujISO());
    const restantes = S.taches.filter((t) => !t.fait); const taches = restantes.slice(0, 4);
    const convs = conversations().filter((c) => c.dernier).slice(0, 2);
    const cmds = commandesASuivre();
    chargerCouts([...idsLignes(cmdsMois), ...idsLignes(cmds)]);
    const m = margeDocs(cmdsMois); const margePc = m && m.ht > 0 ? Math.round(((m.ht - m.cout) / m.ht) * 100) : null;
    const ctl = enAttenteControle();
    const pied = ctl.recus.length ? `<button type="button" class="pied-widget" data-conv="${esc(ctl.recus[0].de)}">${ctl.recus.length} ${ctl.nom(ctl.recus)} à contrôler ›</button>`
      : ctl.envoyes.length ? `<button type="button" class="pied-widget" data-conv="${esc(ctl.envoyes[0].a)}">${ctl.envoyes.length} ${ctl.nom(ctl.envoyes)} en attente de contrôle</button>` : '';
    const recherche = S.rechAccueil.trim();
    return `<header class="entete acc-entete"><div><small>${esc(date)}</small><h1>Bonjour ${esc(prenom)}<span>.</span></h1></div>
        <div class="entete-droite"><label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="accueil" value="${esc(S.rechAccueil)}" placeholder="Client, produit, commande…" aria-label="Chercher un client, un produit, une commande"></label><button type="button" class="avatar" data-compte aria-label="Mon compte">${esc(nomDe(S.profil).charAt(0).toUpperCase())}</button></div></header>
      ${recherche ? resultatsAccueil() : `<div class="grille accueil">
        <section class="widget chaud large" aria-label="Ventes du mois"><div class="ventes">${anneauSVG(v && v.pc !== null ? v.pc : 0, v && v.pc !== null ? v.pc + ' %' : '—', v && v.pc !== null ? 'de l’objectif' : 'sans objectif')}<div class="chiffres"><span class="eti">Ventes de ${esc(new Date().toLocaleDateString('fr-FR', { month: 'long' }))}</span><span class="gros">${v ? euros(v.ca) : '—'}</span><span class="sous">${v && v.objectif ? `Objectif fixé par Farid : ${euros(v.objectif)}` : 'Aucun objectif fixé pour ce mois'}</span><div class="pastilles">${margePc !== null && !margeCachee ? `<span class="pastille">Marge ${margePc} %</span>` : ''}<span class="pastille neutre">${v ? v.nb : 0} commande${v && v.nb > 1 ? 's' : ''}</span></div></div></div></section>
        <section class="widget" aria-label="Aujourd’hui"><div class="tete"><h2>Aujourd’hui</h2><small>${evtsJour.length} rendez-vous</small></div>${evtsJour.length ? evtsJour.slice(0, 3).map(ligneEvt).join('') : '<p class="vide">Rien de prévu aujourd’hui.</p>'}</section>
        <section class="widget chaud widget-messages" aria-label="Messages"><div class="tete"><h2>Messages</h2>${nonLus() ? `<span class="compteur">${nonLus()}</span>` : ''}</div>${convs.length ? convs.map(ligneConv).join('') : '<p class="vide">Aucun message.</p>'}${pied}</section>
        <section class="widget" aria-label="Tâches"><div class="tete"><h2>Tâches</h2><button type="button" class="lien" data-aller="taches">${restantes.length} restante${restantes.length > 1 ? 's' : ''} ›</button></div>${taches.length ? taches.map((t) => ligneTache(t, true)).join('') : '<p class="vide">Tout est fait.</p>'}</section>
        <section class="widget large" aria-label="Commandes à suivre"><div class="tete"><h2>Commandes à suivre</h2>${cmds.length ? '<button type="button" class="lien-tout" data-toutes-commandes>Tout voir</button>' : ''}</div>${cmds.length ? `<div class="cartes-cmd">${cmds.slice(0, 3).map((c) => `<button type="button" class="carte-cmd" data-fiche-client="${esc(c.tiers)}">${photoDoc(c)}<span class="l1"><b>${esc(c.nomTiers)}</b><span class="etat ${c.etat[1]}">${esc(c.etat[0])}</span></span><small>${esc(c.ref)} · ${euros(c.ht)} HT</small></button>`).join('')}</div>` : '<p class="vide">Aucune commande en cours.</p>'}</section>
        <section class="widget" aria-label="Actions rapides"><div class="actions">
          <button type="button" class="action metal" data-nouveau-devis>${ico('devis', 24)}Nouveau devis</button>
          <button type="button" class="action" data-nouvelle-commande>${ico('commande', 24)}Commande</button>
          <button type="button" class="action" data-aller="clients">${ico('clientPlus', 24)}Client</button>
          <button type="button" class="action" data-scanner-accueil>${ico('codebarre', 24)}Scanner</button></div></section>
      </div>`}`;
  }
  function feuilleCommandes() {
    const l = commandesASuivre(true);
    ouvrirFeuille(`<h3>Commandes à suivre</h3><div class="liste-feuille">${l.length ? l.map((c) => `<button type="button" class="conv" data-fiche-client="${esc(c.tiers)}"><span class="txt"><b>${esc(c.nomTiers)}</b><small>${esc(c.ref)} · ${euros(c.ht)} HT · ${c.date ? new Date(c.date + 'T12:00:00').toLocaleDateString('fr-FR') : ''}</small></span><span class="etat ${c.etat[1]}">${esc(c.etat[0])}</span></button>`).join('') : '<p class="vide">Aucune commande en cours.</p>'}</div><button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }
  const couleurEvt = (e) => (e.masque ? 'gris' : e.couleur === 'bleu' ? 'bleu' : e.couleur === 'vert' ? 'vert' : '');
  const ligneEvt = (e) => `<div class="ligne-evt"><span class="barre ${couleurEvt(e)}"></span><div><b>${esc(e.titre)}</b><span>${e.journee ? 'Toute la journée' : heureFR(e.debut)}${e.lieu ? ' · ' + esc(e.lieu) : ''}</span></div></div>`;
  function ligneTache(t, simple) {
    const d = t.date_prevue ? new Date(t.date_prevue + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const de = t.de && t.de !== moi() ? 'de ' + nomDe(profil(t.de)) : '';
    return `<div class="tache ${t.fait ? 'faite' : ''}"><button type="button" class="coche ${t.fait ? 'faite' : ''}" data-cocher="${t.id}" aria-label="${t.fait ? 'Marquer à faire' : 'Marquer fait'} : ${esc(t.titre)}">${t.fait ? ico('coche', 16, 3) : ''}</button><div class="txt"><b>${t.priorite === 'urgente' ? '<span class="urgent">Urgent</span>' : ''}${esc(t.titre)}</b>${!simple && (d || de || t.heure) ? `<small>${[d, t.heure ? String(t.heure).slice(0, 5) : '', de].filter(Boolean).join(' · ')}</small>` : ''}</div></div>`;
  }

  // ---------- agenda (maquette V2, page 5 du PDF) : Jour / Semaine / Mois, mini-calendrier, agendas des collègues ----------
  // Données : RPC agenda_voir (événements privés des autres = « Occupé », hachurés), lue pour la période affichée et chaque
  // agenda coché. Tablette : colonne de gauche (mois, agendas, tâches du jour) + grille. Téléphone : vue Jour par défaut.
  const COUL_AG = { rg: '#C9987D', vert: '#86c39f', bleu: '#7fa7d9', ambre: '#e0b45c', rouge: '#e8806d' };
  const COUL_QUI = ['#C9987D', '#7fa7d9', '#86c39f', '#e0b45c', '#e8806d', '#b89ad9'];
  const AG = { vue: null, ref: aujISO(), qui: null, evts: [], cle: '', charge: false, mois: null };
  try { const q = JSON.parse(localStorage.getItem('fmd-agenda-qui') || 'null'); if (Array.isArray(q)) AG.qui = q; } catch { /* moi seul */ }
  const dISO = (iso) => new Date(iso + 'T12:00:00');
  const plusJours = (iso, n) => { const d = dISO(iso); d.setDate(d.getDate() + n); return jourISO(d); };
  const lundiDe = (iso) => { const d = dISO(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return jourISO(d); };
  const couleurQui = (id) => { const l = [moi(), ...S.profils.filter((p) => p.id !== moi()).map((p) => p.id)]; return COUL_QUI[Math.max(0, l.indexOf(id)) % COUL_QUI.length]; };
  function periodeAgenda() {
    const v = AG.vue;
    if (v === 'jour') { const l = lundiDe(AG.ref); return { debut: l, n: 7, jours: [AG.ref] }; }
    if (v === 'semaine') { const l = lundiDe(AG.ref); return { debut: l, n: 7, jours: Array.from({ length: 7 }, (_, i) => plusJours(l, i)) }; }
    const p = AG.ref.slice(0, 7) + '-01'; const l = lundiDe(p); return { debut: l, n: 42, jours: Array.from({ length: 42 }, (_, i) => plusJours(l, i)) };
  }
  async function chargerVueAgenda() {
    const per = periodeAgenda(); const qui = AG.qui; const cle = per.debut + per.n + qui.join(',');
    if (AG.cle === cle || AG.charge === cle) return; AG.charge = cle;
    const debut = dISO(per.debut); debut.setHours(0, 0, 0, 0); const fin = new Date(debut); fin.setDate(fin.getDate() + per.n);
    const l = [];
    await Promise.all(qui.map(async (q) => { const { data, error } = await sb.rpc('agenda_voir', { p_debut: debut.toISOString(), p_fin: fin.toISOString(), p_qui: q }); if (!error) (data || []).forEach((e) => l.push({ ...e, _qui: q })); }));
    if (AG.charge !== cle) return;
    AG.evts = l.sort((a, b) => String(a.debut).localeCompare(String(b.debut))); AG.cle = cle; AG.charge = false;
    if (S.route === 'agenda') rendre(true);
  }
  const evtsDuJour = (iso) => AG.evts.filter((e) => { const d = new Date(e.debut), f = new Date(e.fin); const j0 = dISO(iso); j0.setHours(0, 0, 0, 0); const j1 = new Date(j0); j1.setDate(j1.getDate() + 1); return d < j1 && f > j0; });
  const styleEvt = (e) => (e.masque ? '' : `--c:${e._qui && e._qui !== moi() ? couleurQui(e._qui) : COUL_AG[e.couleur] || COUL_AG.rg}`);
  const classeEvt = (e) => `ag-evt${e.masque ? ' masque' : ''}${!e.masque && (!e._qui || e._qui === moi()) && (!e.couleur || e.couleur === 'rg') ? ' metal' : ''}`;
  // Grille horaire (1 jour ou 7 jours) : événements placés à l'heure, chevauchements côte à côte, trait « maintenant »
  function grilleHoraire(jours) {
    const PX = 56; const ev = jours.map((j) => evtsDuJour(j).filter((e) => !e.journee));
    const heures = ev.flat().flatMap((e) => [new Date(e.debut).getHours(), new Date(e.fin).getHours() + (new Date(e.fin).getMinutes() ? 1 : 0)]);
    const h0 = Math.max(0, Math.min(8, ...heures)), h1 = Math.min(24, Math.max(18, ...heures));
    const auj = aujISO(); const now = new Date(); const minNow = (now.getHours() - h0) * 60 + now.getMinutes();
    const journees = jours.map((j) => evtsDuJour(j).filter((e) => e.journee));
    const colonnes = jours.map((j, k) => {
      const l = ev[k].map((e) => { const d = new Date(e.debut), f = new Date(e.fin); const j0 = dISO(j); j0.setHours(h0, 0, 0, 0);
        return { e, s: Math.max(0, (d - j0) / 60000), f: Math.min((h1 - h0) * 60, (f - j0) / 60000) }; }).filter((x) => x.f > x.s).sort((a, b) => a.s - b.s);
      const fins = []; l.forEach((x) => { let c = fins.findIndex((fn) => fn <= x.s); if (c < 0) { c = fins.length; fins.push(0); } fins[c] = x.f; x.c = c; }); const n = Math.max(1, fins.length);
      return `<div class="ag-col${j === auj ? ' auj' : ''}" data-ag-creneau="${j}" data-h0="${h0}">${l.map((x) => { const e = x.e; const court = x.f - x.s < 45;
        return `<button type="button" class="${classeEvt(e)}${court ? ' court' : ''}" data-ag-evt="${esc(e.id)}" style="${styleEvt(e)};top:${(x.s / 60) * PX}px;height:${Math.max(22, ((x.f - x.s) / 60) * PX - 3)}px;left:calc(${(x.c / n) * 100}% + 3px);width:calc(${100 / n}% - 6px)"><b>${esc(e.titre || 'Sans titre')}</b>${court ? ` <small>${heureFR(e.debut)}</small>` : `<small>${heureFR(e.debut)}${x.f - x.s >= 75 ? ' – ' + heureFR(e.fin) : ''}${e.masque && e._qui ? ' · ' + esc(nomDe(profil(e._qui)).split(' ')[0]) + ' (privé)' : e.lieu ? ' · ' + esc(e.lieu) : ''}</small>`}</button>`; }).join('')}
        ${j === auj && minNow > 0 && minNow < (h1 - h0) * 60 ? `<span class="ag-maintenant" style="top:${(minNow / 60) * PX}px"></span>` : ''}</div>`; }).join('');
    const tete = jours.length > 1 ? `<div class="ag-tete" style="--n:${jours.length}"><span></span>${jours.map((j) => { const d = dISO(j); const we = d.getDay() === 0 || d.getDay() === 6;
      return `<button type="button" data-ag-jour="${j}" data-ag-vers="jour" class="${j === auj ? 'auj' : ''}${we ? ' we' : ''}"><small>${d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</small><b>${d.getDate()}</b></button>`; }).join('')}</div>` : '';
    const jt = journees.some((x) => x.length) ? `<div class="ag-journee" style="--n:${jours.length}"><span>Journée</span>${journees.map((x) => `<div>${x.map((e) => `<button type="button" class="${classeEvt(e)} puce" data-ag-evt="${esc(e.id)}" style="${styleEvt(e)}">${esc(e.titre)}</button>`).join('')}</div>`).join('')}</div>` : '';
    return `<div class="ag-grille" style="--n:${jours.length};--px:${PX}px">${tete}${jt}<div class="ag-corps"><div class="ag-heures">${Array.from({ length: h1 - h0 }, (_, i) => `<span style="top:${i * PX}px">${h0 + i}h</span>`).join('')}</div><div class="ag-cols" style="height:${(h1 - h0) * PX}px">${colonnes}</div></div></div>`;
  }
  function vueMois() {
    const per = periodeAgenda(); const m = AG.ref.slice(0, 7); const auj = aujISO();
    return `<div class="ag-mois"><div class="ag-mois-tete">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((x) => `<span>${x}</span>`).join('')}</div><div class="ag-mois-grille">${per.jours.map((j) => { const l = evtsDuJour(j);
      return `<button type="button" class="ag-case${j.slice(0, 7) !== m ? ' hors' : ''}${j === auj ? ' auj' : ''}" data-ag-jour="${j}" data-ag-vers="jour"><b>${dISO(j).getDate()}</b>${l.slice(0, 3).map((e) => `<span class="${classeEvt(e)} puce" style="${styleEvt(e)}">${esc(e.journee ? e.titre : heureFR(e.debut) + ' ' + (e.titre || ''))}</span>`).join('')}${l.length > 3 ? `<small>+${l.length - 3}</small>` : ''}</button>`; }).join('')}</div></div>`;
  }
  function miniCalendrier() {
    const m = AG.mois || AG.ref.slice(0, 7); const p = lundiDe(m + '-01'); const sem = lundiDe(AG.ref); const auj = aujISO();
    const jours = Array.from({ length: 42 }, (_, i) => plusJours(p, i)).filter((j, i) => i < 35 || j.slice(0, 7) === m);
    const titre = dISO(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `<section class="widget ag-mini"><div class="tete"><h2>${esc(titre.charAt(0).toUpperCase() + titre.slice(1))}</h2><span class="nav"><button type="button" data-ag-mois="-1" aria-label="Mois précédent">‹</button><button type="button" data-ag-mois="1" aria-label="Mois suivant">›</button></span></div>
      <div class="ag-mini-grille">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<small>${x}</small>`).join('')}${jours.map((j) => { const dans = AG.vue === 'semaine' ? lundiDe(j) === sem : AG.vue === 'jour' ? j === AG.ref : j.slice(0, 7) === AG.ref.slice(0, 7);
        return `<button type="button" data-ag-jour="${j}" class="${j.slice(0, 7) !== m ? 'hors' : ''}${dans && j.slice(0, 7) === m ? ' sel' : ''}${j === auj ? ' auj' : ''}">${j.slice(0, 7) === m ? dISO(j).getDate() : ''}</button>`; }).join('')}</div></section>`;
  }
  function blocAgendas() {
    const l = [{ id: moi(), nom: 'Moi' }, ...S.profils.filter((p) => p.id !== moi()).map((p) => ({ id: p.id, nom: nomDe(p) }))];
    return `<section class="widget ag-qui"><div class="tete"><h2>Agendas</h2></div>${l.map((p) => `<label class="case-qui" style="--c:${couleurQui(p.id)}"><input type="checkbox" data-ag-qui="${esc(p.id)}" ${AG.qui.includes(p.id) ? 'checked' : ''}><i>${ico('coche', 14, 3)}</i>${esc(p.nom)}</label>`).join('')}</section>`;
  }
  function pageAgenda() {
    if (!AG.vue) AG.vue = tablette() ? 'semaine' : 'jour';
    if (!AG.qui) AG.qui = [moi()];
    chargerVueAgenda();
    const per = periodeAgenda(); const v = AG.vue;
    const fmt = (iso, o) => dISO(iso).toLocaleDateString('fr-FR', o);
    const periode = v === 'jour' ? fmt(AG.ref, { weekday: 'long', day: 'numeric', month: 'long' }) : v === 'semaine' ? `Semaine du ${fmt(per.jours[0], { day: 'numeric', ...(per.jours[0].slice(5, 7) !== per.jours[6].slice(5, 7) ? { month: 'long' } : {}) })} au ${fmt(per.jours[6], { day: 'numeric', month: 'long' })}` : fmt(AG.ref, { month: 'long', year: 'numeric' });
    const tachesJour = S.taches.filter((t) => !t.fait && t.date_prevue && t.date_prevue <= aujISO());
    const bandeau = v === 'jour' ? `<div class="jours" role="group" aria-label="Choisir un jour">${Array.from({ length: 7 }, (_, i) => plusJours(lundiDe(AG.ref), i)).map((j) => { const d = dISO(j); const n = evtsDuJour(j).length;
      return `<button type="button" data-ag-jour="${j}" class="${j === AG.ref ? 'actif' : ''}"><span>${d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span><b>${d.getDate()}</b><i class="${n ? 'pt' : ''}"></i></button>`; }).join('')}</div>` : '';
    const vue = v === 'mois' ? vueMois() : grilleHoraire(per.jours);
    const cote = `${tablette() ? miniCalendrier() : ''}${blocAgendas()}<section class="widget ag-taches chaud"><div class="tete"><h2>Tâches d’aujourd’hui</h2><button type="button" class="lien" data-aller="taches">Toutes ›</button></div>${tachesJour.length ? tachesJour.slice(0, 5).map((t) => ligneTache(t, true)).join('') : '<p class="vide">Rien à faire aujourd’hui.</p>'}</section>`;
    return `<header class="entete ag-entete"><div class="gauche"><button type="button" class="retour" data-aller="accueil" aria-label="Retour">${ico('retour', 20, 2.2)}</button><h1>Agenda</h1><span class="periode"><button type="button" data-ag-dec="-1" aria-label="Période précédente">‹</button>${esc(periode.charAt(0).toUpperCase() + periode.slice(1))}<button type="button" data-ag-dec="1" aria-label="Période suivante">›</button></span></div>
        <div class="droite"><div class="bascule" role="group" aria-label="Vue">${[['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois']].map(([k, t]) => `<button type="button" data-ag-vue="${k}" class="${v === k ? 'actif' : ''}">${t}</button>`).join('')}</div><button type="button" class="btn-metal" data-nouveau-rdv>${ico('plus', 18, 2.4)}Événement</button></div></header>
      <div class="ag-page"><aside class="ag-cote">${cote}</aside><section class="widget ag-vue">${bandeau}${vue}${AG.cle ? '' : '<p class="vide ag-charge">Chargement…</p>'}</section></div>`;
  }
  function feuilleEvt(id) {
    const e = AG.evts.find((x) => x.id === id) || S.evts.find((x) => x.id === id); if (!e) return;
    const d = new Date(e.debut), f = new Date(e.fin); const qui = e._qui || e.proprietaire;
    ouvrirFeuille(`<h3>${esc(e.titre || 'Sans titre')}</h3><p class="vide" style="padding:0">${esc(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} · ${e.journee ? 'Toute la journée' : `${heureFR(e.debut)} – ${heureFR(f.toISOString())}`}</p>
      ${e.lieu ? `<a class="btn-verre" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.lieu)}" target="_blank" rel="noopener">${ico('carte', 18)}${esc(e.lieu)}</a>` : ''}
      ${e.description ? `<p style="margin:0;white-space:pre-wrap">${esc(e.description)}</p>` : ''}${qui && qui !== moi() ? `<p class="vide" style="padding:0">Agenda de ${esc(nomDe(profil(qui)))}${e.masque ? ' (événement privé)' : ''}</p>` : ''}
      <button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }
  function clicAgenda(t, e) {
    if (S.route !== 'agenda') return false;
    const vv = t.closest('[data-ag-vue]'); if (vv) { AG.vue = vv.dataset.agVue; AG.mois = null; rendre(true); return true; }
    const ev = t.closest('[data-ag-evt]'); if (ev) { feuilleEvt(ev.dataset.agEvt); return true; }
    const j = t.closest('[data-ag-jour]'); if (j) { AG.ref = j.dataset.agJour; AG.mois = null; if (j.dataset.agVers && !tablette()) AG.vue = 'jour'; else if (j.dataset.agVers === 'jour' && AG.vue === 'mois') AG.vue = 'jour'; rendre(true); return true; }
    const dc = t.closest('[data-ag-dec]'); if (dc) { const s = +dc.dataset.agDec; if (AG.vue === 'jour') AG.ref = plusJours(AG.ref, s); else if (AG.vue === 'semaine') AG.ref = plusJours(AG.ref, 7 * s); else { const d = dISO(AG.ref.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + s); AG.ref = jourISO(d); } AG.mois = null; rendre(true); return true; }
    const mm = t.closest('[data-ag-mois]'); if (mm) { const d = dISO((AG.mois || AG.ref.slice(0, 7)) + '-01'); d.setMonth(d.getMonth() + +mm.dataset.agMois); AG.mois = jourISO(d).slice(0, 7); rendre(true); return true; }
    const cr = t.closest('[data-ag-creneau]'); if (cr && t === cr) { const y = e.offsetY; const h = +cr.dataset.h0 + Math.floor(y / 56); feuilleRdv(cr.dataset.agCreneau, Math.min(22, h)); return true; }
    return false;
  }

  // ---------- tâches ----------
  function pageTaches() {
    const auj = aujISO(); const l = S.taches;
    const retard = l.filter((t) => !t.fait && t.date_prevue && t.date_prevue < auj), jour = l.filter((t) => t.date_prevue === auj), venir = l.filter((t) => !t.fait && t.date_prevue && t.date_prevue > auj), sans = l.filter((t) => !t.fait && !t.date_prevue);
    const g = (titre, x, cls = '') => (x.length ? `<div class="groupe ${cls}">${titre} ${x.length}</div><section class="widget">${x.map(ligneTache).join('')}</section>` : '');
    return `${entete('Mes tâches', 'Tâches')}${g('En retard', retard, 'retard')}${g('Aujourd’hui', jour)}${g('À venir', venir)}${g('Sans date', sans)}${!l.length ? '<section class="widget"><p class="vide">Aucune tâche. Touchez + pour en ajouter une.</p></section>' : ''}`;
  }

  // ---------- messages ----------
  function conversations() {
    const derniers = {}; S.messages.forEach((m) => { if (visible(m)) derniers[m.de === moi() ? m.a : m.de] = m; });
    return S.profils.filter((p) => p.id !== moi()).map((p) => ({ p, dernier: derniers[p.id] || null, n: nonLus(p.id) }))
      .sort((a, b) => (b.dernier ? b.dernier.created_at : '').localeCompare(a.dernier ? a.dernier.created_at : '') || nomDe(a.p).localeCompare(nomDe(b.p), 'fr'));
  }
  const resume = (m) => (m.texte || (m.piece ? '📎 ' + m.piece.nom : ''));
  // ---------- messages (maquette V2, page 6 du PDF) ----------
  // Présence en direct (même canal que le PC, js/presence.js « presence-fmd ») : point vert + « En ligne ». Rien d'enregistré.
  let canalPresence = null;
  function demarrerPresence() {
    try {
      if (canalPresence) sb.removeChannel(canalPresence);
      const cle = moi() + ':mobile-' + Math.random().toString(36).slice(2, 7);
      canalPresence = sb.channel('presence-fmd', { config: { presence: { key: cle } } });
      const lire = () => { const st = (canalPresence.presenceState && canalPresence.presenceState()) || {}; const l = new Set(); Object.values(st).forEach((m) => (m || []).forEach((x) => { if (x && x.id && x.id !== moi()) l.add(x.id); })); S.enLigne = l; if (S.route === 'messages' || S.route === 'conv' || S.route === 'accueil') rendre(true); };
      canalPresence.on('presence', { event: 'sync' }, lire).on('presence', { event: 'join' }, lire).on('presence', { event: 'leave' }, lire)
        .subscribe((st) => { if (st === 'SUBSCRIBED') { try { const r = canalPresence.track({ id: moi(), nom: nomDe(S.profil), crm: null, studio: null, depuis: new Date().toISOString() }); if (r && r.catch) r.catch(() => {}); } catch { /* sans présence */ } } });
    } catch { /* sans présence */ }
  }
  const enLigne = (id) => !!(S.enLigne && S.enLigne.has(id));
  const rondPersonne = (p, t = 48) => `<span class="rond${enLigne(p && p.id) ? ' en-ligne' : ''}" style="width:${t}px;height:${t}px;font-size:${Math.round(t / 2.7)}px">${esc(nomDe(p).charAt(0).toUpperCase())}</span>`;
  function ligneConv(c) {
    const d = c.dernier;
    const apercu = !d ? 'Aucun message' : `${d.de === moi() ? (d.lu_le ? '✓✓ Vu · ' : '✓ ') : ''}${d.lien && d.lien.controle ? '🔎 À contrôler : ' + ((d.lien.apercu || {}).ref || '') : resume(d)}`;
    return `<button type="button" class="conv ${S.conv === c.p.id && S.route === 'conv' ? 'actif' : ''}" data-conv="${c.p.id}">${rondPersonne(c.p)}<span class="txt"><b>${esc(nomDe(c.p))}</b><small>${esc(apercu)}</small></span><span class="droite">${d ? heureFR(d.created_at) : ''}${c.n ? `<span class="compteur">${c.n}</span>` : ''}</span></button>`;
  }
  function pageMessages() {
    const q = normaliser(S.rechCollegues || '');
    const l = conversations().filter((c) => !q || normaliser(nomDe(c.p)).includes(q));
    const liste = `<label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="collegues" value="${esc(S.rechCollegues || '')}" placeholder="Rechercher un collègue" aria-label="Rechercher un collègue"></label><div class="convs">${l.map(ligneConv).join('') || '<p class="vide">Aucun collègue.</p>'}</div>`;
    if (tablette()) {
      return `<div class="messages-split"><section class="widget panneau-convs"><div class="tete-convs"><button type="button" class="retour" data-aller="accueil" aria-label="Retour">${ico('retour', 20, 2.2)}</button><h1>Messages</h1></div>${liste}</section>
        <section class="widget panneau-fil">${S.route === 'conv' && S.conv ? pageFil() : '<p class="vide" style="margin:auto">Choisissez un collègue.</p>'}</section></div>`;
    }
    if (S.route === 'conv' && S.conv) return pageFil();
    return `${entete('Messagerie', 'Messages')}<section class="widget">${liste}</section>`;
  }
  const jourLib = (iso) => { const d = new Date(iso); const a = new Date(); const h = new Date(); h.setDate(h.getDate() - 1);
    return d.toDateString() === a.toDateString() ? 'Aujourd’hui' : d.toDateString() === h.toDateString() ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
  function pageFil() {
    const p = profil(S.conv); const fil = S.messages.filter((m) => (m.de === S.conv || m.a === S.conv) && visible(m));
    const dernierMoi = [...fil].reverse().find((m) => m.de === moi());
    chargerCouts(fil.filter((m) => m.lien && m.lien.apercu).map((m) => docDeLien(m.lien)).filter(Boolean).flatMap((d) => idsLignes([d])));
    let jour = '';
    const bulles = fil.map((m) => {
      const j = jourLib(m.created_at); const sep = j !== jour ? `<div class="jour">${esc(j)}</div>` : ''; jour = j;
      const mien = m.de === moi();
      const etat = mien ? (m.lu_le ? ` · <b>✓✓ Vu à ${heureFR(m.lu_le)}</b>` : ` · ✓ Envoyé${m === dernierMoi ? ', pas encore vu' : ''}`) : '';
      const a = m.lien && m.lien.apercu;
      if (a) return `${sep}<div class="bulle bulle-carte ${mien ? 'moi' : 'lui'}" data-msg="${m.id}">${carteControle(m, a)}<div class="meta">${heureFR(m.created_at)}${etat}</div></div>`;
      const seulFichier = m.piece && !m.texte && !estImage(m.piece);
      return `${sep}<div class="bulle ${mien ? 'moi' : 'lui'}${seulFichier ? ' bulle-fichier' : ''}" data-msg="${m.id}">${piece(m.piece)}${m.texte ? esc(m.texte).replace(/\n/g, '<br>') : ''}${m.lien && m.lien.controle && !mien && !dejaControle(m) ? `<div class="actions-carte"><button type="button" class="btn-verre" data-controle="${m.id}">✓ Contrôlé</button></div>` : ''}<div class="meta">${heureFR(m.created_at)}${etat}</div></div>`;
    }).join('');
    const prenom = nomDe(p).split(' ')[0];
    return `<div class="fil-page"><div class="fil-tete">${tablette() ? '' : `<button type="button" class="retour" data-aller="messages" aria-label="Retour">${ico('retour', 20, 2.2)}</button>`}${rondPersonne(p, 46)}<div><b>${esc(nomDe(p))}</b>${enLigne(S.conv) ? '<small class="statut">En ligne</small>' : ''}</div></div>
      <div class="fil">${bulles || `<p class="vide" style="align-self:center">Écrivez votre premier message à ${esc(nomDe(p))}.</p>`}</div>
      <form class="saisie" data-envoi><button type="button" class="rond-btn" data-joindre aria-label="Joindre un fichier">${ico('trombone', 20)}</button><button type="button" class="rond-btn" data-photo aria-label="Envoyer une photo">${ico('photo', 20)}</button>
        <input type="file" hidden data-fichier multiple><input type="file" hidden data-fichier-photo accept="image/*">
        <textarea data-texte rows="1" placeholder="Écrire à ${esc(prenom)}…" aria-label="Message"></textarea><button type="submit" class="rond-btn metal" aria-label="Envoyer">${ico('envoyer', 20, 2.2)}</button></form></div>`;
  }
  const dejaControle = (m) => S.messages.some((x) => x.de === moi() && x.a === m.de && x.lien && x.lien.reponse && x.lien.route === m.lien.route && x.created_at >= m.created_at);
  const reponseControle = (m) => S.messages.find((x) => x.de === m.a && x.a === m.de && x.lien && x.lien.reponse && x.lien.route === m.lien.route && x.created_at >= m.created_at);
  // Document du CRM désigné par un lien de message (route « cmd/fiche/<id> », « prop/fiche/<id> »)
  const docDeLien = (lien) => { const r = /^(cmd|prop)\/fiche\/(.+)$/.exec((lien && lien.route) || ''); if (!r || !S.crm) return null; return ((r[1] === 'cmd' ? S.crm.commandes : S.crm.propositions) || []).find((d) => d.id === r[2]) || null; };
  function carteControle(m, a) {
    const auteur = nomDe(profil(m.de)).split(' ')[0];
    if (a.type === 'tiers') return `<div class="controle-quoi">🔎 À contrôler · ${esc(a.titre)} — ${esc(auteur)}</div><div class="carte-controle"><div class="l1"><span class="rond carre">${esc(String(a.ref || '?').charAt(0))}</span><div><small>${esc(a.titre)}</small><b>${esc(a.ref)}</b></div></div><small>${esc([a.adresse, a.ville].filter(Boolean).join(', '))}${a.tel ? ' · ' + esc(a.tel) : ''}</small></div>${actionsControle(m)}`;
    const doc = docDeLien(m.lien); const t = doc ? tiersDe(doc.tiers) : null;
    const e = doc ? (m.lien.route.startsWith('prop') ? ETAT_DOC_TXT({ ...doc, _t: 'Devis' }) : ETATS_DOC[doc.etat] || ['', '']) : null;
    const pieces = (a.lignes || []).reduce((s, l) => s + (+l.qte || 0), 0);
    return `<div class="controle-quoi">🔎 À contrôler · ${esc(a.titre)} — ${esc(auteur)}</div><div class="carte-controle"><div class="l1">${t ? avatarTiers(t, 42) : `<span class="rond carre">${esc(String(a.tiers || '?').charAt(0))}</span>`}<div class="qui"><small>${esc(a.ref)}</small><b>${esc(a.tiers || '—')}</b></div>${e && e[0] ? `<span class="etat ${e[1]}">${esc(e[0])}</span>` : ''}</div>
      ${doc ? photoDoc(doc, 'large') : '<span class="photo-doc large"></span>'}<div class="bas"><small>${a.nb || (a.lignes || []).length} article${(a.nb || 0) > 1 ? 's' : ''} · ${pieces.toLocaleString('fr-FR')} pièce${pieces > 1 ? 's' : ''}</small><b>${euros(a.ht)} HT</b></div></div>${actionsControle(m)}`;
  }
  function actionsControle(m) {
    const ouvrir = docDeLien(m.lien) ? `<button type="button" class="btn-verre petit" data-ouvrir-doc="${esc(m.lien.route)}">Ouvrir ›</button>` : '';
    let ctrl = '';
    if (m.lien.controle && m.a === moi()) ctrl = dejaControle(m) ? '<span class="ok-controle">✓ Contrôlé</span>' : `<button type="button" class="btn-verre petit" data-controle="${m.id}">✓ Contrôlé</button>`;
    else if (m.lien.controle && m.de === moi()) { const r = reponseControle(m); ctrl = r ? `<span class="ok-controle">✓ Contrôlé par ${esc(nomDe(profil(m.a)).split(' ')[0])}</span>` : '<span class="attente-controle">En attente de contrôle</span>'; }
    return ouvrir || ctrl ? `<div class="actions-carte">${ouvrir}${ctrl}</div>` : '';
  }
  const estImage = (pc) => !!pc && /^image\//i.test(pc.type || '');
  function piece(pc) {
    if (!pc) return '';
    if (estImage(pc)) return `<img class="photo" alt="${esc(pc.nom)}" data-img="${esc(pc.chemin)}" data-ouvrir="${esc(pc.chemin)}">`;
    const ext = (String(pc.nom).match(/\.([A-Za-z0-9]{1,5})$/) || [, ''])[1].toUpperCase() || 'FICHIER';
    const t = pc.taille || 0; const taille = t < 1048576 ? Math.round(t / 1024) + ' Ko' : (t / 1048576).toFixed(1).replace('.', ',') + ' Mo';
    return `<button type="button" class="fichier" data-telecharger="${esc(pc.chemin)}" data-nom="${esc(pc.nom)}"><span class="ext">${esc(ext)}</span><span><b>${esc(pc.nom)}</b><small>${taille} · Ouvrir</small></span></button>`;
  }
  async function lienFichier(chemin, nom) {
    const k = chemin + '|' + (nom || ''); const c = S.urls[k]; if (c && c.fin > Date.now()) return c.url;
    const { data, error } = await sb.storage.from(ESPACE).createSignedUrl(chemin, 600, nom ? { download: nom } : undefined);
    if (error || !data) throw new Error(error ? error.message : 'lien indisponible');
    S.urls[k] = { url: data.signedUrl, fin: Date.now() + 8 * 60000 }; return data.signedUrl;
  }
  function chargerImages() { app.querySelectorAll('img[data-img]:not([src])').forEach((img) => { lienFichier(img.dataset.img).then((u) => { img.src = u; }).catch(() => { img.alt = 'Image indisponible'; }); }); }
  async function marquerLus(id) {
    const a = S.messages.filter((m) => m.a === moi() && m.de === id && !m.lu_le); if (!a.length) return;
    const t = new Date().toISOString(); a.forEach((m) => { m.lu_le = t; });
    rendre(true); // compteurs à zéro tout de suite
    await sb.from('messages').update({ lu_le: t }).eq('a', moi()).eq('de', id).is('lu_le', null);
  }
  async function inserer(ligne) {
    const { data, error } = await sb.from('messages').insert(ligne).select().single();
    if (error) throw new Error(error.message);
    if (data && !S.messages.some((x) => x.id === data.id)) S.messages.push(data);
    rendre(); return data;
  }
  const nomPropre = (n) => String(n || 'fichier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'fichier';
  async function envoyerFichiers(fichiers) {
    for (const f of fichiers) {
      if (f.size > 50 * 1024 * 1024) { toast(`« ${f.name} » dépasse 50 Mo.`); continue; }
      toast(`Envoi de ${f.name}…`);
      const nom = f.name && f.name !== 'image.jpg' ? f.name : `photo-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.jpg`;
      const chemin = `${moi()}/${S.conv}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${nomPropre(nom)}`;
      const { error } = await sb.storage.from(ESPACE).upload(chemin, f, { upsert: false, contentType: f.type || 'application/octet-stream' });
      if (error) { toast('Envoi impossible : ' + error.message); continue; }
      try { await inserer({ de: moi(), a: S.conv, texte: '', piece: { chemin, nom, taille: f.size, type: f.type || '' } }); } catch (e) { toast('Envoi impossible : ' + e.message); }
    }
  }

  // ================= CRM : clients, stock, devis (24/11/2026) =================
  const tiersDe = (id) => ((S.crm && S.crm.tiers) || []).find((t) => t.id === id) || null;
  const rond2 = (n) => Math.round((+n || 0) * 100) / 100;
  const htL = (l) => rond2((+l.qte || 0) * (+l.pu || 0) * (1 - (+l.remise || 0) / 100));
  const htD = (d) => rond2((d.lignes || []).reduce((s, l) => s + htL(l), 0));
  const ttcD = (d) => rond2(htD(d) + (d.lignes || []).reduce((s, l) => s + htL(l) * ((l.tva ?? 20) / 100), 0));
  const avatarTiers = (t, taille = 48) => (t && t.logo && /^(data:image|https:)/.test(t.logo) ? `<span class="rond" style="width:${taille}px;height:${taille}px;background:#fff;overflow:hidden"><img src="${esc(t.logo)}" alt="" style="width:100%;height:100%;object-fit:contain"></span>` : `<span class="rond" style="width:${taille}px;height:${taille}px;background:linear-gradient(135deg,#9CC3E8,#4A78D0)">${esc(String((t && t.nom) || '?').charAt(0).toUpperCase())}</span>`);
  const normaliser = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ETATS_DOC = { brouillon: ['Brouillon', ''], ouvert: ['Ouvert', 'bleu'], signee: ['Signée', 'vert'], non_signee: ['Non signée', ''], facturee: ['Facturée', 'vert'], validee: ['Validée', ''], en_cours: ['En cours', 'bleu'], livree: ['Livrée', 'vert'], annulee: ['Annulée', ''], payee: ['Payée', 'vert'], impayee: ['À payer', ''] };

  // ---------- clients ----------
  function pageClients() {
    const q = normaliser(S.rechClients);
    const l = ((S.crm && S.crm.tiers) || []).filter((t) => (t.client || t.prospect) && (!q || normaliser([t.nom, t.alt, t.ville, t.code_client, t.tel].join(' ')).includes(q)))
      .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr')).slice(0, 80);
    return `${entete('CRM', 'Clients')}
      ${boutonsNouveauTiers()}
      <label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="clients" value="${esc(S.rechClients)}" placeholder="Nom, ville, téléphone…" aria-label="Rechercher un client"></label>
      <section class="widget">${!S.crm ? '<p class="vide">CRM indisponible (pas de connexion au serveur).</p>' : l.length ? `<div class="convs">${l.map((t) => `<button type="button" class="conv" data-fiche-client="${esc(t.id)}">${avatarTiers(t)}<span class="txt"><b>${esc(t.nom)}</b><small>${esc([t.prospect && !t.client ? 'Prospect' : 'Client', t.ville, t.tel].filter(Boolean).join(' · '))}</small></span><span class="droite">›</span></button>`).join('')}</div>` : '<p class="vide">Aucun client trouvé.</p>'}</section>`;
  }
  function pageClient() {
    const t = tiersDe(S.client); if (!t) return `${entete('CRM', 'Client', 'clients')}<section class="widget"><p class="vide">Fiche introuvable.</p></section>`;
    const db = S.crm; const an = aujISO().slice(0, 4);
    const docs = [...(db.propositions || []).map((d) => ({ ...d, _t: 'Devis', _k: 'propositions' })), ...(db.commandes || []).map((d) => ({ ...d, _t: 'Commande', _k: 'commandes' })), ...(db.factures || []).map((d) => ({ ...d, _t: 'Facture', _k: 'factures', etat: d.payee ? 'payee' : 'impayee' }))]
      .filter((d) => d.tiers === t.id && d.etat !== 'annulee').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const vendues = (db.commandes || []).filter((c) => c.tiers === t.id && c.etat !== 'brouillon' && c.etat !== 'annulee');
    const cmdsAn = vendues.filter((c) => String(c.date).slice(0, 4) === an);
    const prods = produitsDuClient(t.id, docs);
    chargerCouts([...idsLignes(cmdsAn), ...idsLignes(docs.slice(0, 40)), ...prods.map((x) => x.id)]);
    const filtre = S.docsFiltre || 'tous'; const docsVus = filtre === 'tous' ? docs : docs.filter((d) => d._k === filtre);
    const ca = rond2(cmdsAn.reduce((s, c) => s + htD(c), 0)); const m = margeDocs(cmdsAn);
    const mois = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return jourISO(d).slice(0, 7); });
    const parMois = mois.map((k) => vendues.filter((c) => String(c.date).slice(0, 7) === k).reduce((s, c) => s + htD(c), 0)); const mx = Math.max(...parMois, 1);
    // Encours (comme le PC, js/erp-encours.js) : factures non payées + commandes validées non facturées, TTC
    const nonFact = (c) => ['validee', 'en_cours', 'livree'].includes(c.etat) && !c.facturee && !(c.liens || []).some((x) => x.type === 'fact');
    const encours = rond2((db.factures || []).filter((f) => f.tiers === t.id && !f.payee).reduce((s, f) => s + ttcD(f), 0) + vendues.filter(nonFact).reduce((s, c) => s + ttcD(c), 0));
    const plafond = +t.encours_max || 0;
    const adresse = [t.adresse, t.cp, t.ville].filter(Boolean).join(' ');
    const contact = (db.contacts || []).find((k) => k.tiers === t.id) || null;
    const nomContact = contact ? [contact.prenom, contact.nom].filter(Boolean).join(' ') : '';
    const tel = (contact && (contact.tel || contact.portable)) || t.tel || t.portable; const mail = (contact && contact.email) || t.email;
    const niveaux = ['Prix net']; const niv = Math.max(1, +t.niveau || 1);
    const carteDoc = (d) => { const e = ETAT_DOC_TXT(d); const l = d.lignes || []; const pieces = l.reduce((s, x) => s + (+x.qte || 0), 0);
      return `<button type="button" class="carte-doc" data-voir-doc="${esc(d._k)}:${esc(d.id)}">${photoDoc(d)}<span class="txt"><b>${esc(d.ref)}</b><small>${esc((l[0] || {}).desc || d._t)} · ${l.length} article${l.length > 1 ? 's' : ''} · ${pieces.toLocaleString('fr-FR')} pièce${pieces > 1 ? 's' : ''}</small><small class="disc">${d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR') : ''}${d.auteur ? ' · ' + esc(String(d.auteur).split(' ')[0]) : ''}</small></span><span class="droite"><span class="etat ${e[1]}">${esc(e[0])}</span><b>${euros(htD(d))}</b></span></button>`; };
    return `<header class="entete fiche-entete"><div class="gauche"><button type="button" class="retour" data-aller="clients" aria-label="Retour">${ico('retour', 20, 2.2)}</button><span class="avatar-carre">${avatarTiers(t, 76)}</span><div class="nom"><h1>${esc(t.nom)}</h1><div class="sous"><span class="pastille neutre">${t.prospect && !t.client ? 'Prospect' : 'Client'}</span>${esc([[t.cp, t.ville].filter(Boolean).join(' '), t.code_client].filter(Boolean).join(' · '))}</div></div></div>
        <div class="boutons">${tel ? `<a class="btn-verre" href="tel:${esc(String(tel).replace(/\s/g, ''))}">${ico('tel', 18)}Appeler</a>` : ''}${adresse ? `<a class="btn-verre" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}" target="_blank" rel="noopener">${ico('carte', 18)}Itinéraire</a>` : ''}<button type="button" class="btn-verre" data-modifier-tiers="${esc(t.id)}">${ico('crayon', 18)}Modifier</button><button type="button" class="btn-verre" data-nouvelle-commande="${esc(t.id)}">${ico('commande', 18)}Commande</button><button type="button" class="btn-metal" data-nouveau-devis="${esc(t.id)}">${ico('plus', 18, 2.4)}Nouveau devis</button></div></header>
      <div class="grille fiche-client">
        <section class="widget w-encours"><div class="tete"><h2>Encours</h2></div><div class="centre">${anneauSVG(plafond ? (encours / plafond) * 100 : 0, euros(encours), '', 150, 'anneau-encours')}<small>${plafond ? `Plafond ${euros(plafond)}` : 'Sans plafond'}</small></div></section>
        <section class="widget w-annee"><div class="tete"><h2>Cette année</h2></div><b class="gros">${euros(ca)}</b><small class="sous">${m && !margeCachee ? `Marge ${euros(m.ht - m.cout)}${m.cout > 0 ? ` · coef. ${(m.ht / m.cout).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}` : ''}` : 'CA HT des commandes'}</small>
          <div class="barres" role="img" aria-label="CA des 6 derniers mois">${parMois.map((x, i) => `<i class="${i === 5 ? 'actuel' : ''}" style="height:${Math.max(10, Math.round((x / mx) * 100))}%" title="${esc(new Date(mois[i] + '-15').toLocaleDateString('fr-FR', { month: 'long' }))} : ${euros(x)}"></i>`).join('')}</div></section>
        <section class="widget w-docs"><div class="tete"><h2>Devis, commandes et factures</h2><small class="compte-docs">${docs.length}</small></div>
          <div class="puces puces-docs" role="group" aria-label="Filtrer les documents">${[['tous', 'Tous'], ['propositions', 'Devis'], ['commandes', 'Commandes'], ['factures', 'Factures']].map(([k, n]) => { const nb = k === 'tous' ? docs.length : docs.filter((d) => d._k === k).length; return `<button type="button" data-docs-filtre="${k}" class="${filtre === k ? 'actif' : ''}">${n} · ${nb}</button>`; }).join('')}</div>
          ${docsVus.length ? `<div class="docs docs-tous">${docsVus.slice(0, 200).map(carteDoc).join('')}</div>${docsVus.length > 200 ? `<p class="vide">200 plus récents affichés sur ${docsVus.length} : le reste sur le PC.</p>` : ''}` : '<p class="vide">Aucun document.</p>'}</section>
        <section class="widget w-contact"><div class="tete"><h2>Contact</h2></div>${nomContact || tel || mail ? `${nomContact ? `<div class="contact"><span class="rond">${esc(nomContact.charAt(0).toUpperCase())}</span><div><b>${esc(nomContact)}</b>${contact.poste ? `<small>${esc(contact.poste)}</small>` : ''}</div></div>` : ''}${tel ? `<a class="lien-contact" href="tel:${esc(String(tel).replace(/\s/g, ''))}">${esc(tel)}</a>` : ''}${mail ? `<a class="lien-contact" href="mailto:${esc(mail)}">${esc(mail)}</a>` : ''}` : '<p class="vide">Aucun contact.</p>'}</section>
        <section class="widget w-conditions"><div class="tete"><h2>Conditions</h2></div><dl class="conditions"><dt>Niveau de prix</dt><dd>${niv} · ${esc(niveaux[niv - 1] || 'Prix ' + niv)}</dd><dt>Remise</dt><dd>${+t.remise ? `${t.remise} %` : 'Aucune'}</dd><dt>Paiement</dt><dd>${esc([t.cond, t.mode].filter(Boolean).join(' · ') || '—')}</dd></dl></section>
        <section class="widget w-produits"><div class="tete"><h2>Produits du client</h2><button type="button" class="btn-verre petit" data-prix-client="">${ico('plus', 16, 2.4)}Prix client</button></div>
          ${prods.length ? `<div class="convs">${prods.map(ligneProduitClient).join('')}</div>` : '<p class="vide">Aucun produit acheté ni prix client pour l’instant.</p>'}</section>
      </div>`;
  }
  function feuilleDoc(cle) {
    const [k, id] = cle.split(':'); const d = ((S.crm && S.crm[k]) || []).find((x) => x.id === id); if (!d) return;
    const t = tiersDe(d.tiers) || {}; const type = { propositions: 'Devis', commandes: 'Commande', factures: 'Facture' }[k];
    const e = ETAT_DOC_TXT({ ...d, _t: type, etat: k === 'factures' ? (d.payee ? 'payee' : 'impayee') : d.etat });
    ouvrirFeuille(`<h3>${esc(type)} ${esc(d.ref)}</h3><p class="vide" style="padding:0">${esc(t.nom || '')} · ${d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR') : ''}${d.auteur ? ' · ' + esc(d.auteur) : ''} <span class="etat ${e[1]}">${esc(e[0])}</span></p>
      <div class="liste-feuille">${(d.lignes || []).map((l) => `<div class="ligne-devis"><span class="txt"><b>${esc(l.desc || '')}</b><small>${l.qte} × ${euros(l.pu)}${+l.remise ? ` −${pc(l.remise)}` : ''}</small></span><b>${euros(htL(l))}</b></div>`).join('')}</div>
      <div class="totaux"><span>Total HT <b>${euros(htD(d))}</b></span><span class="ttc">TTC <b>${euros(ttcD(d))}</b></span></div><button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }
  // ---------- produits du client + prix clients (25/11/2026, demande : « sur la fiche client, toutes les commandes et devis
  // effectués, tous les produits reliés au client, pouvoir faire un prix condition client, et voir le prix minimal accepté ») ----------
  // Produits reliés = lignes de ses devis / commandes / factures (hors annulés) + ses prix clients (crm.prixClients, comme le PC :
  // { id, tiers, produit, pu, depuis, par }). Prix minimum accepté = le plus haut entre « prix de référence (promo sinon net) −
  // remise maximale autorisée » (règles de app/js/erp-prix.js) et le « prix de vente minimum HT » de la fiche produit (p.prix_min).
  // En dessous : impossible sur le téléphone (sur le PC : accord de Farid).
  const plancherPrix = (p, qte = 1) => { if (!p) return 0; const ref = prixReference(p); return rond2(Math.max(ref ? ref * (1 - remiseAutorisee(p, qte) / 100) : 0, +p.prix_min || 0)); };
  const prixClientDe = (tiersId, prodId) => ((S.crm && S.crm.prixClients) || []).find((x) => x.tiers === tiersId && x.produit === prodId) || null;
  function produitsDuClient(tiersId, docs) {
    const m = new Map(); const ajoute = (id, desc) => { if (!m.has(id)) m.set(id, { id, desc: desc || '', qteCmd: 0, nbDevis: 0, dernier: null }); return m.get(id); };
    [...docs].reverse().forEach((d) => (d.lignes || []).forEach((l) => { if (!l.produit) return; const x = ajoute(l.produit, l.desc);
      if (d._k === 'commandes' && d.etat !== 'brouillon') x.qteCmd += +l.qte || 0; if (d._k === 'propositions') x.nbDevis += 1;
      x.dernier = { pu: rond2((+l.pu || 0) * (1 - (+l.remise || 0) / 100)), ref: d.ref, date: d.date }; if (l.desc) x.desc = l.desc; }));
    ((S.crm && S.crm.prixClients) || []).filter((x) => x.tiers === tiersId).forEach((x) => { ajoute(x.produit).prixClient = x; });
    m.forEach((x) => { if (!x.prixClient) x.prixClient = prixClientDe(tiersId, x.id); });
    return [...m.values()].sort((a, b) => (b.qteCmd - a.qteCmd) || String((b.dernier || {}).date || '').localeCompare(String((a.dernier || {}).date || '')));
  }
  function ligneProduitClient(x) {
    const p = S.produitsCache[x.id]; const nom = (p && (p.libelle || p.ref)) || x.desc || 'Produit';
    const infos = [p && p.ref, x.qteCmd ? `${x.qteCmd.toLocaleString('fr-FR')} commandé${x.qteCmd > 1 ? 's' : ''}` : '', x.nbDevis ? `${x.nbDevis} devis` : '', x.dernier ? `dernier prix ${euros(x.dernier.pu)}` : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="conv" data-prix-client="${esc(x.id)}">${p ? imageProduit(p, 44) : `<span class="rond">${ico('stock', 18)}</span>`}<span class="txt"><b>${esc(nom)}</b><small>${esc(infos)}</small></span><span class="droite">${x.prixClient ? `<span class="etat ok">Prix client ${euros(x.prixClient.pu)}</span>` : '<small>Prix client ›</small>'}</span></button>`;
  }
  // Feuille « Prix client » : choisir le produit (si besoin), voir prix net / promo / remise max / prix minimum, saisir le prix.
  async function feuillePrixClient(prodId) {
    const t = tiersDe(S.client); if (!t) return;
    if (!prodId) {
      ouvrirFeuille(`<h3>Prix client · ${esc(t.nom)}</h3><label class="recherche">${ico('cherche', 18)}<input type="search" data-pxc-recherche placeholder="Réf., libellé, code-barres…" aria-label="Chercher un produit"></label>
        <div class="liste-feuille" data-pxc-res><p class="vide">Tapez au moins 2 caractères.</p></div><button class="btn-verre" type="button" data-fermer>Annuler</button>`);
      return;
    }
    let p = S.produitsCache[prodId];
    if (!p) { try { const { data } = await sb.from('crm_produits').select('id,data').eq('id', prodId).maybeSingle(); if (data && data.data) { p = data.data; S.produitsCache[p.id] = p; } } catch { /* */ } }
    if (!p) { toast('Produit introuvable dans le catalogue.'); return; }
    const pxc = prixClientDe(t.id, p.id); const net = prixNet(p); const min = plancherPrix(p, 1);
    ouvrirFeuille(`<h3>Prix client · ${esc(t.nom)}</h3>
      <div class="pxc-produit">${imageProduit(p, 56)}<div><b>${esc(p.libelle || p.ref)}</b><small>${esc([p.ref, p.marque].filter(Boolean).join(' · '))}</small></div></div>
      <dl class="conditions"><dt>Prix net HT</dt><dd>${euros(net)}</dd>${promoActive(p) ? `<dt>Prix promo HT</dt><dd>${euros(+p.prix_promo)}</dd>` : ''}<dt>Remise max autorisée</dt><dd>${pc(remiseMaxUnite(p))}</dd>${+p.prix_min > 0 ? `<dt>Prix de vente minimum (fiche)</dt><dd>${euros(+p.prix_min)}</dd>` : ''}<dt class="fort">Prix minimum accepté HT</dt><dd class="fort">${euros(min)}</dd>${pxc ? `<dt>Prix client actuel</dt><dd>${euros(pxc.pu)}${pxc.depuis ? ` <small>(depuis le ${new Date(pxc.depuis + 'T12:00:00').toLocaleDateString('fr-FR')})</small>` : ''}</dd>` : ''}</dl>
      <form class="form-tiers" data-form-pxc="${esc(p.id)}" data-min="${min}">
        <label class="champ">Prix client HT (€)<input name="pu" type="number" inputmode="decimal" min="${min}" step="0.01" required value="${pxc ? pxc.pu : ''}" placeholder="${esc(String(net).replace('.', ','))}" data-pxc-prix></label>
        <p class="aide" data-pxc-info>${net ? 'Remise sur le prix net : —' : ''}</p>
        <p class="erreur-remise" data-pxc-erreur hidden>Prix inférieur au minimum accepté (${euros(min)}) : impossible. Au-delà, l’accord de Farid se fait sur le PC.</p>
        <button class="btn-metal" type="submit">${pxc ? 'Modifier le prix client' : 'Enregistrer le prix client'}</button>
        ${pxc ? '<button class="btn-verre danger" type="button" data-pxc-supprimer>Supprimer ce prix client</button>' : ''}
        <button class="btn-verre" type="button" data-fermer>Annuler</button></form>`);
    majPrixClient();
  }
  function majPrixClient() {
    const f = app.querySelector('[data-form-pxc]'); if (!f) return; const p = S.produitsCache[f.dataset.formPxc]; const min = +f.dataset.min || 0; const net = prixNet(p);
    const v = parseFloat(String(f.pu.value).replace(',', '.')); const ok = Number.isFinite(v) && v > 0; const trop = ok && v < min - 0.005;
    f.querySelector('[data-pxc-erreur]').hidden = !trop; f.pu.classList.toggle('trop', trop); f.querySelector('[type=submit]').disabled = !ok || trop;
    const i = f.querySelector('[data-pxc-info]'); if (i && net) i.textContent = ok ? `Remise sur le prix net : ${pc(Math.max(0, (1 - v / net) * 100))}${v > net ? ' (au-dessus du prix net)' : ''}` : 'Remise sur le prix net : —';
  }
  let minuteurPxc = null;
  function chercherPrixClient(q) {
    clearTimeout(minuteurPxc); const z = app.querySelector('[data-pxc-res]'); if (!z) return;
    if (String(q).trim().length < 2) { z.innerHTML = '<p class="vide">Tapez au moins 2 caractères.</p>'; return; }
    minuteurPxc = setTimeout(async () => { let l = []; try { l = await chercherProduits(q, 30); } catch (e) { z.innerHTML = `<p class="vide">${esc(e.message)}</p>`; return; }
      const z2 = app.querySelector('[data-pxc-res]'); if (!z2) return; const t = tiersDe(S.client);
      z2.innerHTML = l.length ? l.map((p) => { const x = t && prixClientDe(t.id, p.id); return `<button type="button" class="conv" data-pxc-choisir="${esc(p.id)}">${imageProduit(p, 40)}<span class="txt"><b>${esc(p.libelle || p.ref)}</b><small>${esc([p.ref, `net ${euros(prixNet(p))}`, `min ${euros(plancherPrix(p))}`].filter(Boolean).join(' · '))}</small></span><span class="droite">${x ? `<span class="etat ok">${euros(x.pu)}</span>` : '›'}</span></button>`; }).join('') : '<p class="vide">Aucun produit trouvé.</p>'; }, 300);
  }
  // Écrit dans crm/crm.json comme le PC (relecture avant envoi, _rev / _parent, événement crm pour que les PC relisent).
  async function modifierCRM(maj) {
    for (let essai = 0; essai < 4; essai++) {
      const { data: blob, error } = await sb.storage.from('donnees-fmd').download('crm/crm.json'); if (error || !blob) throw new Error('CRM illisible (' + ((error && error.message) || 'vide') + ')');
      const db = JSON.parse(await blob.text()); const rev = db._rev; ['evenements', 'prixClients', 'tiers'].forEach((k) => { if (!Array.isArray(db[k])) db[k] = []; });
      const r = maj(db); if (db.evenements.length > 600) db.evenements.length = 600;
      db._parent = rev || null; db._rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const { data: b2 } = await sb.storage.from('donnees-fmd').download('crm/crm.json');
      if (b2) { try { if (JSON.parse(await b2.text())._rev !== rev) continue; } catch { /* relu au prochain essai */ } }
      const { error: e2 } = await sb.storage.from('donnees-fmd').upload('crm/crm.json', new Blob([JSON.stringify(db)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' });
      if (e2) throw new Error(e2.message);
      try { await sb.from('evenements').insert({ module: 'crm', cle: 'donnees', poste: 'mobile-' + moi() }); } catch { /* les PC relisent toutes les minutes */ }
      S.crm = db; return r;
    }
    throw new Error('le CRM change en ce moment sur un autre poste, réessayez dans quelques secondes');
  }
  async function enregistrerPrixClient(tiersId, prodId, pu) {
    const p = S.produitsCache[prodId]; const min = plancherPrix(p, 1); if (!(pu > 0)) throw new Error('prix invalide');
    if (pu < min - 0.005) throw new Error(`prix inférieur au minimum accepté (${euros(min)})`);
    const auteur = nomDe(S.profil); const maintenant = new Date().toISOString();
    return modifierCRM((db) => {
      db.prixClients = db.prixClients.filter((x) => !(x.tiers === tiersId && x.produit === prodId));
      if (pu != null) db.prixClients.push({ id: 'px' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tiers: tiersId, produit: prodId, pu: rond2(pu), depuis: aujISO(), par: auteur });
      db.evenements.unshift({ id: 'ev' + Date.now().toString(36), d: maintenant, par: auteur, tiers: tiersId, objet: { type: 'produit', id: prodId }, titre: `Prix client ajouté pour ${(p && p.ref) || 'un produit'} : ${euros(rond2(pu))} HT (téléphone)`, texte: '', type: 'auto' });
    });
  }
  async function supprimerPrixClient(tiersId, prodId) {
    const p = S.produitsCache[prodId]; const auteur = nomDe(S.profil);
    return modifierCRM((db) => { db.prixClients = db.prixClients.filter((x) => !(x.tiers === tiersId && x.produit === prodId));
      db.evenements.unshift({ id: 'ev' + Date.now().toString(36), d: new Date().toISOString(), par: auteur, tiers: tiersId, objet: { type: 'produit', id: prodId }, titre: `Prix client supprimé pour ${(p && p.ref) || 'un produit'} (téléphone)`, texte: '', type: 'auto' }); });
  }
  function feuilleDocsClient() {
    const t = tiersDe(S.client); if (!t) return; const db = S.crm;
    const docs = [...(db.propositions || []).map((d) => ({ ...d, _t: 'Devis', _k: 'propositions' })), ...(db.commandes || []).map((d) => ({ ...d, _t: 'Commande', _k: 'commandes' })), ...(db.factures || []).map((d) => ({ ...d, _t: 'Facture', _k: 'factures', etat: d.payee ? 'payee' : 'impayee' }))]
      .filter((d) => d.tiers === t.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    ouvrirFeuille(`<h3>Documents de ${esc(t.nom)}</h3><div class="liste-feuille">${docs.map((d) => { const e = ETAT_DOC_TXT(d); return `<button type="button" class="conv" data-voir-doc="${esc(d._k)}:${esc(d.id)}"><span class="txt"><b>${esc(d.ref)}</b><small>${esc(d._t)} · ${d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR') : ''} · ${euros(htD(d))} HT</small></span><span class="etat ${e[1]}">${esc(e[0])}</span></button>`; }).join('')}</div><button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }

  // ---------- stock (produits : table crm_produits) ----------
  const prixNet = (p) => +((p && p.prix) || [])[0] || 0;
  const emplacements = (p) => (p.emplacements3d || []).filter((e) => e && e.rayon).map((e) => `${e.rayon} · niv. ${e.niveau || 1} · case ${e.case || 1}${e.qte ? ` (${e.qte})` : ''}`);
  const imageProduit = (p, t = 64) => (p.image && /^(data:image|https:)/.test(p.image) ? `<img src="${esc(p.image)}" alt="" style="width:${t}px;height:${t}px;object-fit:contain;border-radius:14px;background:#fff">` : `<span style="width:${t}px;height:${t}px;flex:none;border-radius:14px;background:radial-gradient(120% 90% at 50% 15%,#fff,#f3ece7 45%,#d9cbc2);display:grid;place-items:center;color:#6F4A3C">${ico('stock', Math.round(t / 2.6))}</span>`);
  // Familles du devis (puces de la maquette) → catégories de l'arborescence du PC (app/js/erp-arbo.js)
  const FAMILLES_DEVIS = [['tout', 'Tout'], ['fixation', 'Fixation', ['visserie']], ['outillage', 'Outillage', ['outillage', 'electroportatif']], ['chimie', 'Chimie', ['collage', 'masquage']], ['genie', 'Génie climatique', ['genie_climatique']], ['vendus', 'Les + vendus']];
  const plusVendus = () => { const n = {}; ((S.crm && S.crm.commandes) || []).filter((c) => c.etat !== 'brouillon' && c.etat !== 'annulee').forEach((c) => (c.lignes || []).forEach((l) => { if (l.produit) n[l.produit] = (n[l.produit] || 0) + (+l.qte || 0); }));
    return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 60); };
  async function chercherProduits(q, limite = 60, famille = 'tout') {
    const propre = String(q || '').replace(/[,()*%\\]/g, ' ').trim();
    let r = sb.from('crm_produits').select('id,data').eq('supprime', false).limit(limite);
    const fam = FAMILLES_DEVIS.find((x) => x[0] === famille); let ordre = null;
    if (fam && fam[2]) r = r.in('data->>categorie', fam[2]);
    if (famille === 'vendus') { ordre = plusVendus(); if (!ordre.length) return []; r = r.in('id', ordre); }
    if (propre) r = r.or(`ref.ilike.%${propre}%,ean.ilike.%${propre}%,data->>libelle.ilike.%${propre}%,marque.ilike.%${propre}%`);
    const { data, error } = await r; if (error) throw new Error(error.message);
    const l = (data || []).map((x) => x.data).filter((p) => p && p.id && p.en_vente !== false);
    l.forEach((p) => { S.produitsCache[p.id] = p; }); if (ordre) l.sort((a, b) => ordre.indexOf(a.id) - ordre.indexOf(b.id)); return l;
  }
  let minuteurStock = null;
  function lancerRechercheStock() {
    clearTimeout(minuteurStock);
    minuteurStock = setTimeout(async () => { try { const fam = S.route === 'devis' ? S.devisCat : 'tout'; S.produits = await chercherProduits(S.rechStock, S.rechStock ? 60 : 400, fam); S.produitsFam = fam; S.produitsCharges = true; } catch (e) { S.produits = []; S.produitsCharges = 'erreur'; toast('Catalogue : ' + e.message); } if (S.route === 'stock' || (S.route === 'devis' && S.devis && S.devis.etape === 2)) rendre(true); }, 300);
  }
  // ---------- page Stock (25/11/2026) : même écran que la maquette tablette — chiffres, magasin 3D / plan, à réapprovisionner,
  // derniers mouvements, puis tout le catalogue. Données : crm_produits (stock, pmp, alerte, emplacements3d) + crm.json
  // (planMagasin, mouvements, achats, livraisonsMagasin). Sur téléphone, les blocs s'empilent dans le même ordre.
  const ECH_PLAN = 0.015, PX0 = 75, PY0 = 150, PX1 = 1245, PY1 = 1915;
  const LARG_MAG = (PX1 - PX0) * ECH_PLAN, PROF_MAG = (PY1 - PY0) * ECH_PLAN;
  const rayonDefaut = (id, x, y, w, h, face, haut = 1.8) => { const ns = face === 'n' || face === 's';
    return { id, x: (x + w / 2 - PX0) * ECH_PLAN - LARG_MAG / 2, z: (y + h / 2 - PY0) * ECH_PLAN - PROF_MAG / 2, rot: { s: 0, n: 180, e: 90, o: -90 }[face], long: (ns ? w : h) * ECH_PLAN, prof: (ns ? h : w) * ECH_PLAN, haut }; };
  // plan d'origine du magasin (même que le module Stock du PC) quand aucun plan n'a été enregistré dans le CRM
  const PLAN_DEFAUT = [['A1', 418, 282, 184, 100, 's'], ['B1', 203, 392, 97, 95, 's'], ['B2', 310, 392, 99, 95, 's'], ['C1', 203, 568, 63, 62, 'n'], ['C2', 275, 568, 133, 62, 'n'],
    ['C3', 417, 568, 85, 62, 'n'], ['C4', 511, 568, 69, 62, 'n'], ['C5', 589, 568, 75, 62, 'n'], ['C6', 203, 638, 133, 75, 's'], ['C7', 344, 638, 158, 75, 's'], ['C8', 511, 638, 153, 75, 's'],
    ['D1', 953, 158, 85, 164, 'o', 2.4], ['D2', 953, 330, 85, 163, 'o', 2.4], ['D3', 953, 502, 85, 233, 'o', 2.4], ['D4', 953, 743, 85, 275, 'o', 2.4], ['E1', 822, 843, 42, 112, 'o', 1.6],
    ['E2', 822, 963, 123, 55, 'n', 1.6], ['F1', 83, 999, 77, 93, 'n'], ['F2', 170, 999, 75, 93, 'n'], ['F3', 255, 999, 93, 93, 'n'], ['F4', 357, 999, 69, 93, 'n'], ['F5', 435, 999, 132, 93, 'n'],
    ['T1', 400, 813, 198, 124, 's', 0.9], ['T2', 942, 1120, 108, 238, 'o', 0.9], ['K1', 577, 1092, 166, 28, 's', 1.05], ['S1', 1150, 170, 80, 270, 'o', 3], ['S2', 1150, 450, 80, 270, 'o', 3],
    ['S3', 1150, 730, 80, 280, 'o', 3], ['P1', 1150, 1420, 80, 220, 'o', 3], ['P2', 1150, 1660, 80, 220, 'o', 3], ['R1', 95, 1570, 420, 55, 's', 2.5], ['R2', 95, 1842, 420, 55, 'n', 2.5]].map((a) => rayonDefaut(...a));
  const planMagasin = () => { const p = S.crm && S.crm.planMagasin; const l = Array.isArray(p) ? p.filter((r) => r && r.id && Number.isFinite(+r.x) && Number.isFinite(+r.z)) : [];
    return (l.length ? l : PLAN_DEFAUT).map((r) => ({ id: String(r.id), nom: r.nom || '', x: +r.x, z: +r.z, rot: +r.rot || 0, long: Math.max(0.2, +r.long || 2), prof: Math.max(0.2, +r.prof || 0.6), haut: Math.max(0.3, +r.haut || 1.8) })); };
  const enAlerte = (p) => +p.alerte > 0 && (+p.stock || 0) < +p.alerte;
  const STK = { stats: null, chargement: false, sel: null, rayon: null, vue: '3d', flux: null };
  try { if (localStorage.getItem('fmd-stock-vue') === 'plan') STK.vue = 'plan'; } catch { /* vue 3D */ }

  // Chiffres sur TOUT le catalogue (pas seulement les 400 produits affichés) : lecture légère, par paquets de 1000.
  async function chargerStatsStock(force) {
    if (STK.chargement || (STK.stats && !force)) return; STK.chargement = true;
    try {
      const l = [];
      for (let i = 0; i < 30000; i += 1000) {
        const { data, error } = await sb.from('crm_produits').select('id,stock:data->stock,pmp:data->pmp,alerte:data->alerte,ev:data->en_vente,pu:data->fournisseurs->0->pu').eq('supprime', false).range(i, i + 999);
        if (error) throw new Error(error.message); l.push(...(data || [])); if (!data || data.length < 1000) break;
      }
      const prods = l.filter((x) => x.ev !== false);
      const valeur = prods.reduce((s, x) => s + Math.max(0, +x.stock || 0) * (+x.pmp || +x.pu || 0), 0);
      const bas = prods.filter((x) => +x.alerte > 0 && (+x.stock || 0) < +x.alerte).sort((a, b) => (+a.stock || 0) / +a.alerte - (+b.stock || 0) / +b.alerte);
      // fiches complètes des produits à afficher (à réapprovisionner + derniers mouvements)
      const ids = [...new Set([...bas.slice(0, 12).map((x) => x.id), ...((S.crm && S.crm.mouvements) || []).slice(0, 8).map((m) => m.produit)])].filter((id) => id && !S.produitsCache[id]);
      if (ids.length) { const { data } = await sb.from('crm_produits').select('id,data').in('id', ids); (data || []).forEach((x) => { if (x.data && x.data.id) S.produitsCache[x.data.id] = x.data; }); }
      STK.stats = { valeur, refs: prods.length, bas: bas.map((x) => x.id) };
    } catch (e) { STK.stats = STK.stats || { erreur: e.message }; }
    STK.chargement = false; if (S.route === 'stock') rendre(true);
  }
  const commandesEnRoute = () => { const db = S.crm || {};
    return (db.achats || []).filter((a) => ['commande', 'ar_recu', 'recue_partiel'].includes(a.etat)).length
      + (db.livraisonsMagasin || []).filter((l) => l.sens === 'entrante' && l.statut !== 'livree' && l.statut !== 'annulee').length; };

  // Magasin : vue 3D isométrique (rayons en volumes) ou plan vu de dessus ; les rayons du produit choisi s'allument.
  function dessinMagasin(allumes, choisi) {
    const plan = planMagasin(); const iso = STK.vue === '3d'; const C = Math.cos(Math.PI / 6), SN = 0.5, H = 1.15;
    const P = (x, z, y = 0) => (iso ? [(x - z) * C, (x + z) * SN - y * H] : [x, z]);
    const coins = (r) => { const a = (r.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), L = r.long / 2, W = r.prof / 2;
      return [[-L, -W], [L, -W], [L, W], [-L, W]].map(([u, v]) => [r.x + u * c - v * s, r.z + u * s + v * c]); };
    const pts = (l) => l.map((p) => p.map((n) => n.toFixed(2)).join(',')).join(' ');
    const sol = [[-LARG_MAG / 2, -PROF_MAG / 2], [LARG_MAG / 2, -PROF_MAG / 2], [LARG_MAG / 2, PROF_MAG / 2], [-LARG_MAG / 2, PROF_MAG / 2]];
    const tous = [...sol.map(([x, z]) => P(x, z)), ...plan.flatMap((r) => coins(r).map(([x, z]) => P(x, z, r.haut)))];
    const mnX = Math.min(...tous.map((p) => p[0])) - 1.2, mxX = Math.max(...tous.map((p) => p[0])) + 1.2, mnY = Math.min(...tous.map((p) => p[1])) - 2.2, mxY = Math.max(...tous.map((p) => p[1])) + 1;
    const ordre = (iso ? [...plan].sort((a, b) => a.x + a.z - (b.x + b.z)) : [...plan]).sort((a, b) => allumes.has(a.id) - allumes.has(b.id)); // le rayon allumé passe devant
    let svg = `<polygon points="${pts(sol.map(([x, z]) => P(x, z)))}" class="mg-sol"/>`; let etiquettes = '';
    for (const r of ordre) {
      const k = coins(r); const on = allumes.has(r.id); const cl = `mg-r${on ? ' on' : ''}${STK.rayon === r.id ? ' choisi' : ''}`;
      let g = '';
      if (iso) {
        for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4]; const nx = b[1] - a[1], nz = -(b[0] - a[0]); // normale extérieure (sens horaire)
          const cx = (a[0] + b[0]) / 2 - r.x, cz = (a[1] + b[1]) / 2 - r.z; const sens = nx * cx + nz * cz > 0 ? 1 : -1;
          if ((nx + nz) * sens > 0) g += `<polygon points="${pts([P(a[0], a[1]), P(b[0], b[1]), P(b[0], b[1], r.haut), P(a[0], a[1], r.haut)])}" class="mg-cote${Math.abs(nx * sens) > Math.abs(nz * sens) ? ' d' : ''}"/>`; }
        g += `<polygon points="${pts(k.map(([x, z]) => P(x, z, r.haut)))}" class="mg-dessus"/>`;
      } else g += `<polygon points="${pts(k.map(([x, z]) => P(x, z)))}" class="mg-dessus"/>`;
      svg += `<g class="${cl}" data-rayon="${esc(r.id)}"><title>${esc(r.id + (r.nom ? ' — ' + r.nom : ''))}</title>${g}</g>`;
      const [ex, ey] = P(r.x, r.z, iso ? r.haut : 0);
      if (on && r.id === choisi) etiquettes += `<g class="mg-bulle" transform="translate(${ex.toFixed(2)} ${(ey - (iso ? 1.3 : 1.1)).toFixed(2)})"><rect x="-1.5" y="-0.62" width="3" height="1.24" rx="0.62"/><text y="0.32">${esc(r.id)}</text></g>`;
      else if (!iso || /1$/.test(r.id)) etiquettes += `<text class="mg-id" x="${ex.toFixed(2)}" y="${(iso ? P(r.x, r.z)[1] + 0.9 : ey + 0.3).toFixed(2)}">${esc(r.id)}</text>`;
    }
    return `<svg class="magasin-svg" viewBox="${mnX.toFixed(1)} ${mnY.toFixed(1)} ${(mxX - mnX).toFixed(1)} ${(mxY - mnY).toFixed(1)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plan du magasin">
      <defs><linearGradient id="mg-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE6D6"/><stop offset="1" stop-color="#E2B497"/></linearGradient>
      <radialGradient id="mg-solg" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#6F4A3C" stop-opacity="0.35"/><stop offset="1" stop-color="#6F4A3C" stop-opacity="0.08"/></radialGradient>
      <filter id="mg-halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.45" result="f"/><feMerge><feMergeNode in="f"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${svg}${etiquettes}</svg>`;
  }
  const lieuTexte = (e) => `rayon ${e.rayon} · niveau ${e.niveau || 1} · case ${e.case || 1}`;
  function blocMagasin() {
    const l = S.produits; let p = STK.sel && S.produitsCache[STK.sel];
    if (S.rechStock && S.produitsCharges === true && l.length && !(p && l.includes(p))) p = l.find((x) => emplacements(x).length) || l[0];
    if (!p && !S.rechStock) p = l.find((x) => emplacements(x).length && +x.stock > 0) || null;
    const empl = p ? (p.emplacements3d || []).filter((e) => e && e.rayon) : [];
    const allumes = new Set(STK.rayon ? [STK.rayon] : empl.map((e) => e.rayon));
    const choisi = STK.rayon || (empl[0] && empl[0].rayon);
    let barre;
    if (STK.rayon) { const n = l.filter((x) => (x.emplacements3d || []).some((e) => e && e.rayon === STK.rayon)).length; const r = planMagasin().find((x) => x.id === STK.rayon);
      barre = `<button type="button" class="mg-barre" data-voir-rayon="${esc(STK.rayon)}"><span class="pt"></span><span class="txt"><b>Rayon ${esc(STK.rayon)}</b>${r && r.nom ? ' · ' + esc(r.nom) : ''}</span><span class="nb">${n} produit${n > 1 ? 's' : ''}</span></button>`; }
    else if (p) barre = `<button type="button" class="mg-barre" data-fiche-produit="${esc(p.id)}"><span class="pt"></span><span class="txt"><b>${esc(p.libelle || p.ref)}</b> · ${empl.length ? esc(lieuTexte(empl[0])) + (empl.length > 1 ? ` (+${empl.length - 1})` : '') : 'pas encore rangé'}</span><span class="nb">${(+p.stock || 0).toLocaleString('fr-FR')} en stock</span></button>`;
    else barre = `<div class="mg-barre"><span class="txt">${S.rechStock ? (S.produitsCharges === true ? 'Aucun produit trouvé.' : 'Recherche…') : 'Cherchez un produit pour le voir dans le magasin.'}</span></div>`;
    return `<section class="widget stk-magasin"><div class="tete"><h2>Magasin 3D</h2><div class="bascule" role="group" aria-label="Vue">${[['3d', '3D'], ['plan', 'Plan']].map(([k, t]) => `<button type="button" data-vue-magasin="${k}" class="${STK.vue === k ? 'actif' : ''}">${t}</button>`).join('')}</div></div>
      <div class="mg-zone">${dessinMagasin(allumes, choisi)}</div>${barre}</section>`;
  }
  function blocReappro() {
    const st = STK.stats; const ids = st && st.bas ? st.bas : S.produits.filter(enAlerte).map((p) => p.id);
    const l = ids.map((id) => S.produitsCache[id]).filter(Boolean).slice(0, window.innerWidth >= 900 ? 3 : 4);
    const carte = (p) => { const s = Math.max(0, +p.stock || 0), a = +p.alerte || 1; const pct = Math.min(100, Math.round((s / a) * 100));
      return `<div class="reappro"><button type="button" class="photo" data-fiche-produit="${esc(p.id)}" aria-label="Voir ${esc(p.libelle || p.ref)}">${imageProduit(p, 58)}</button><div class="txt"><b>${esc(p.libelle || p.ref)}</b><span class="jauge"><i style="width:${Math.max(4, pct)}%" class="${pct < 50 ? 'rouge' : ''}"></i></span><small>${s.toLocaleString('fr-FR')} en stock · seuil ${p.alerte}</small></div><button type="button" class="commander" data-commander="${esc(p.id)}">Commander</button></div>`; };
    return `<div class="tete"><h2>À réapprovisionner</h2>${ids.length > l.length ? `<button type="button" class="lien-tout" data-tout-reappro>Tout voir (${ids.length})</button>` : ''}</div>
      ${l.length ? l.map(carte).join('') : `<p class="vide">${!st && STK.chargement ? 'Chargement…' : st && st.erreur ? 'Indisponible : ' + esc(st.erreur) : 'Rien sous le seuil d’alerte.'}</p>`}`;
  }
  function blocMouvements() {
    const l = ((S.crm && S.crm.mouvements) || []).slice(0, 4); if (!l.length) return '';
    const heure = (d) => { const x = new Date(d); if (isNaN(x)) return ''; return x.toDateString() === new Date().toDateString() ? x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
    return `<div class="mouvements"><b class="titre">Derniers mouvements</b>${l.map((m) => { const p = S.produitsCache[m.produit]; const q = +m.qte || 0;
      const nom = m.produit_nom || (p && (p.libelle || p.ref)) || 'Produit'; const mo = String(m.motif || ''); const refDoc = (/\b(?:CO|PO|AV|FA|RF|PR)-\d+/.exec(mo) || [])[0];
      const quoi = /^réception|commande fournisseur/i.test(mo) || m.nature === 'commande' ? 'réception' : refDoc || mo;
      return `<div class="mv"><span><b class="${q >= 0 ? 'plus' : 'moins'}">${q > 0 ? '+' : q < 0 ? '−' : ''}${Math.abs(q).toLocaleString('fr-FR')}</b> ${esc(nom)}${quoi ? ' · ' + esc(quoi) : ''}</span><small>${esc(String(m.par || '').split(' ')[0])}${m.par ? ' · ' : ''}${heure(m.d)}</small></div>`; }).join('')}</div>`;
  }
  function pageStock() {
    if (!S.produitsCharges || (S.produitsFam && S.produitsFam !== 'tout')) { if (S.produitsFam !== 'tout') { S.produitsFam = 'tout'; S.produitsCharges = false; } lancerRechercheStock(); }
    chargerStatsStock();
    const l = S.produits; const st = STK.stats || {};
    const carte = (p) => `<button type="button" class="ligne-produit${STK.sel === p.id ? ' choisie' : ''}" data-produit="${esc(p.id)}">${imageProduit(p)}<span class="txt"><b>${esc(p.libelle || p.ref)}</b><small>${esc(p.ref || '')}${emplacements(p)[0] ? ' · ' + esc(emplacements(p)[0]) : ''}</small></span><span class="droite"><b class="${enAlerte(p) ? 'bas' : ''}">${(+p.stock || 0).toLocaleString('fr-FR')}</b><small>en stock</small></span></button>`;
    const nb = (v) => (STK.stats && !st.erreur ? String(v) : '…');
    const kpis = `<div class="stk-kpis">
        <section class="widget chaud kpi valeur"><small class="etq">Valeur du stock</small><b class="gros">${STK.stats && !st.erreur ? euros(st.valeur) : '…'}</b><small>au prix de revient · ${nb((st.refs || 0).toLocaleString('fr-FR'))} références</small></section>
        <section class="widget kpi"><span class="ic alerte">${ico('alerte', 20)}</span><div><b class="gros">${nb((st.bas || []).length)}</b><small>produits sous le seuil d’alerte</small></div></section>
        <section class="widget kpi"><span class="ic route">${ico('camion', 20)}</span><div><b class="gros">${S.crm ? commandesEnRoute() : '—'}</b><small>commandes fournisseurs en route</small></div></section></div>`;
    const liste = `<div class="groupe">${S.rechStock ? 'Résultats' : 'Produits'} ${S.produitsCharges === true ? l.length : ''}</div>
      <section class="widget">${S.produitsCharges === true ? (l.length ? l.slice(0, 60).map(carte).join('') : '<p class="vide">Aucun produit trouvé.</p>') : S.produitsCharges === 'erreur' ? '<p class="vide">Catalogue indisponible.</p>' : '<p class="vide">Chargement du catalogue…</p>'}</section>`;
    return `<header class="entete stk-entete"><div class="titre-stk"><button type="button" class="retour" data-aller="accueil" aria-label="Retour">${ico('retour', 20, 2.2)}</button><h1>Stock</h1></div>
        <div class="stk-cherche"><label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="stock" value="${esc(S.rechStock)}" placeholder="Où est ce produit ? (réf., nom, code-barres)" aria-label="Chercher un produit"></label>
        <button type="button" class="scan" data-scanner aria-label="Scanner un code-barres">${ico('codebarre', 22)}</button></div></header>
      ${S.rechStock ? '' : kpis}
      <div class="stk-grille">${blocMagasin()}${S.rechStock ? '' : `<section class="widget stk-reappro">${blocReappro()}${blocMouvements()}</section>`}</div>
      ${S.rechStock ? liste : ''}`;
  }
  function feuilleProduit(id) {
    const p = S.produitsCache[id]; if (!p) return;
    const empl = emplacements(p);
    ouvrirFeuille(`<div style="display:flex;gap:14px;align-items:center">${imageProduit(p, 84)}<div><h3>${esc(p.libelle || p.ref)}</h3><p class="vide" style="padding:0">${esc([p.ref, p.marque, p.code_barres].filter(Boolean).join(' · '))}</p></div></div>
      <div class="pastilles"><span class="pastille">${(+p.stock || 0).toLocaleString('fr-FR')} en stock</span>${+p.alerte ? `<span class="pastille neutre">seuil ${p.alerte}</span>` : ''}<span class="pastille neutre">${euros(prixNet(p))} HT</span></div>
      <div><b style="font-size:14px">Emplacement</b><p class="vide" style="padding:4px 0">${empl.length ? empl.map(esc).join('<br>') : 'Pas encore rangé dans le magasin 3D.'}</p></div>
      ${enAlerte(p) ? `<button class="btn-metal" type="button" data-commander="${esc(p.id)}">Commander</button>` : ''}<button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }
  // « Commander » : fournisseur principal de la fiche (Tiers du CRM), quantité conseillée, appel ou e-mail prérempli.
  // La commande fournisseur (PO) elle-même reste créée sur le PC.
  function feuilleCommander(id) {
    const p = S.produitsCache[id]; if (!p) return;
    const f = (p.fournisseurs || [])[0] || {}; const t = tiersDe(f.tiers) || ((S.crm && S.crm.tiers) || []).find((x) => x.fournisseur && p.marque && normaliser(x.nom) === normaliser(p.marque)) || null;
    const qte = Math.max(+f.qte_min || 1, Math.ceil((+p.alerte || 0) * 2 - Math.max(0, +p.stock || 0)));
    const corps = `Bonjour,\n\nMerci de nous livrer :\n- ${qte} × ${p.libelle || ''} (réf. ${f.ref || p.ref || ''})\n\nCordialement,\n${nomDe(S.profil)}\nFMD`;
    const tel = t && (t.tel || t.portable);
    ouvrirFeuille(`<h3>Commander</h3><p class="vide" style="padding:0">${esc(p.libelle || p.ref)} · ${(+p.stock || 0).toLocaleString('fr-FR')} en stock · seuil ${esc(p.alerte || 0)}</p>
      <div class="pastilles"><span class="pastille">Quantité conseillée : ${qte}</span>${+f.pu ? `<span class="pastille neutre">${euros(f.pu)} HT l’unité</span>` : ''}${+f.delai ? `<span class="pastille neutre">délai ${f.delai} j</span>` : ''}</div>
      <p class="vide" style="padding:0">Fournisseur : <b>${t ? esc(t.nom) : 'non renseigné sur la fiche'}</b></p>
      ${tel ? `<a class="btn-verre" href="tel:${esc(String(tel).replace(/\s/g, ''))}">${ico('tel', 18)}Appeler ${esc(t.nom)}</a>` : ''}
      ${t && t.email ? `<a class="btn-verre" href="mailto:${esc(t.email)}?subject=${encodeURIComponent('Commande FMD — ' + (p.ref || p.libelle || ''))}&body=${encodeURIComponent(corps)}">${ico('mail', 18)}Envoyer la commande par e-mail</a>` : ''}
      <p class="vide" style="padding:0;font-size:12px">Le bon de commande fournisseur se crée dans le CRM sur le PC.</p>
      <button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }
  function feuilleListe(titre, ids) {
    const l = ids.map((id) => S.produitsCache[id]).filter(Boolean);
    ouvrirFeuille(`<h3>${esc(titre)}</h3><div class="liste-feuille">${l.length ? l.map((p) => `<button type="button" class="ligne-produit" data-fiche-produit="${esc(p.id)}">${imageProduit(p, 44)}<span class="txt"><b>${esc(p.libelle || p.ref)}</b><small>${esc(p.ref || '')}</small></span><span class="droite"><b class="${enAlerte(p) ? 'bas' : ''}">${(+p.stock || 0).toLocaleString('fr-FR')}</b><small>${+p.alerte ? 'seuil ' + p.alerte : 'en stock'}</small></span></button>`).join('') : '<p class="vide">Aucun produit.</p>'}</div><button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }
  // Scanner : lecteur de code-barres du navigateur (Chrome Android…) ; sinon le champ de recherche (clavier du téléphone).
  function arreterScan() { if (STK.flux) { STK.flux.getTracks().forEach((t) => t.stop()); STK.flux = null; } }
  async function ouvrirScanner() {
    const champ = () => app.querySelector('[data-recherche="stock"]');
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices) { const c = champ(); if (c) { c.focus(); c.select(); } toast('Lecteur de code-barres non disponible sur ce navigateur : tapez ou collez le code.'); return; }
    let det; try { det = new window.BarcodeDetector(); } catch { toast('Lecteur de code-barres indisponible.'); return; }
    try { STK.flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); } catch { toast('Caméra refusée : autorisez-la dans les réglages du navigateur.'); return; }
    ouvrirFeuille('<h3>Scanner un code-barres</h3><video class="video-scan" playsinline muted autoplay></video><button class="btn-verre" type="button" data-fermer>Annuler</button>');
    const v = app.querySelector('.video-scan'); if (!v) { arreterScan(); return; } v.srcObject = STK.flux;
    const boucle = async () => { if (!STK.flux) return; const v2 = app.querySelector('.video-scan'); if (!v2) { arreterScan(); return; }
      try { const r = await det.detect(v2); if (r && r[0] && r[0].rawValue) { arreterScan(); S.rechStock = r[0].rawValue; STK.sel = null; STK.rayon = null; S.feuille = null; lancerRechercheStock(); rendre(true); return; } } catch { /* image suivante */ }
      setTimeout(boucle, 250); };
    v.onloadedmetadata = () => { v.play().catch(() => {}); boucle(); };
  }
  function clicStock(t) {
    if (S.route !== 'stock') return false;
    const vm = t.closest('[data-vue-magasin]'); if (vm) { STK.vue = vm.dataset.vueMagasin; try { localStorage.setItem('fmd-stock-vue', STK.vue); } catch { /* */ } rendre(true); return true; }
    const ry = t.closest('[data-rayon]'); if (ry) { STK.rayon = STK.rayon === ry.dataset.rayon ? null : ry.dataset.rayon; rendre(true); return true; }
    const vr = t.closest('[data-voir-rayon]'); if (vr) { const id = vr.dataset.voirRayon; feuilleListe('Rayon ' + id, S.produits.filter((p) => (p.emplacements3d || []).some((e) => e && e.rayon === id)).map((p) => p.id)); return true; }
    const fp = t.closest('[data-produit]'); if (fp) { STK.sel = fp.dataset.produit; STK.rayon = null; rendre(true); const m = app.querySelector('.stk-magasin'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    if (t.closest('[data-tout-reappro]')) { feuilleListe('À réapprovisionner', (STK.stats && STK.stats.bas) || []); return true; }
    if (t.closest('[data-scanner]')) { ouvrirScanner(); return true; }
    return false;
  }

  // ---------- devis en 3 étapes (même logique que le CRM du PC : js/erp-commerce.js, erp-donnees.js, erp-prix.js) ----------
  function nouveauDevis(tiersId, type = 'prop') { if (S.devisCat !== 'tout') { S.devisCat = 'tout'; S.produitsCharges = false; } S.devis = { type, etape: tiersId ? 2 : 1, tiers: tiersId || null, lignes: [], note: '', article: null, saisie: null }; if (!S.produitsCharges) lancerRechercheStock(); S.route = 'devis'; S.feuille = null; rendre(); window.scrollTo(0, 0); }
  function prixPour(tiersId, p) { // D.prixPour : prix négocié client > prix promo en cours > prix net (+ remise client)
    const t = tiersDe(tiersId) || {}; const remise = +t.remise || 0; const j = aujISO();
    const spec = ((S.crm && S.crm.prixClients) || []).find((x) => x.tiers === tiersId && x.produit === p.id);
    if (spec) return { pu: +spec.pu, remise, auto: 'prix client' };
    if (+p.prix_promo > 0 && (!p.promo_du || p.promo_du <= j) && (!p.promo_au || p.promo_au >= j)) return { pu: +p.prix_promo, remise: 0, auto: 'prix promo' };
    return { pu: prixNet(p), remise, auto: 'prix net' };
  }
  // ---------- remises autorisées (mêmes règles que le PC : app/js/erp-prix.js) ----------
  // Demande du 25/11/2026 : « en cliquant sur l'article, une page avec le prix net et pouvoir saisir une remise jusqu'à la remise
  // maximale, bloquer la remise supérieure au maximum autorisé ». Remise max = p.remise_max (vide = 40 %) ou plus selon la quantité
  // (p.remises_qte), comptée sur le prix promo s'il y en a un, sinon sur le prix net. Au-delà : impossible sur le téléphone.
  const REMISE_MAX_DEFAUT = 40;
  const remiseMaxUnite = (p) => (p && p.remise_max !== undefined && p.remise_max !== null && p.remise_max !== '' ? +p.remise_max : REMISE_MAX_DEFAUT);
  const remiseAutorisee = (p, qte) => ((p && p.remises_qte) || []).filter((x) => +qte >= +x.qte && +x.qte > 0).reduce((m, x) => Math.max(m, +x.remise || 0), remiseMaxUnite(p));
  const promoActive = (p) => { const j = aujISO(); return !!(p && +p.prix_promo > 0 && (!p.promo_du || p.promo_du <= j) && (!p.promo_au || p.promo_au >= j)); };
  const prixReference = (p) => { const net = prixNet(p); const promo = promoActive(p) ? +p.prix_promo : 0; return promo && promo < net ? promo : net; };
  // Remise maximale (%) possible sur le prix unitaire de la ligne (prix net, promo ou prix client) : le prix remisé ne descend
  // jamais sous « prix de référence − remise autorisée ».
  const remiseMaxLigne = (p, pu, qte) => { if (!p || !(+pu > 0)) return 0; const plancher = plancherPrix(p, qte); if (!plancher) return 0; return Math.max(0, Math.floor((1 - plancher / pu) * 1000 + 1e-6) / 10); };
  // Type de prix figé à la validation (comme D.figerPrix du PC : commissions)
  function typePrix(l) { const p = S.produitsCache[l.produit]; if (!p) return null; const net = prixNet(p); const eff = (+l.pu || 0) * (1 - (+l.remise || 0) / 100); const autorise = remiseAutorisee(p, l.qte);
    if (!net) return { type: 'net', remise: 0, autorise, net };
    const promo = promoActive(p) ? +p.prix_promo : 0;
    if (promo && eff >= promo - 0.005 && eff < net - 0.005) return { type: 'promo', remise: (1 - eff / net) * 100, autorise, net };
    if (eff >= net - 0.005) return { type: 'net', remise: 0, autorise, net };
    const remise = (1 - eff / net) * 100; const base = promo && promo < net ? (1 - eff / promo) * 100 : remise;
    return { type: base <= autorise + 0.05 ? 'reduction' : 'hors', remise, autorise, net }; }
  const pc = (x) => `${(Math.round((+x || 0) * 10) / 10).toLocaleString('fr-FR')} %`;
  const prixRevient = (p) => { if (!p) return 0; if (+p.pmp > 0) return +p.pmp; const f = (p.fournisseurs || []).map((x) => (+x.pu || 0) * (1 - (+x.remise || 0) / 100)).filter((x) => x > 0); return f.length ? rond2(Math.min(...f)) : 0; };
  function pageDevis() {
    const d = S.devis; if (!d) return pageAccueil();
    if (d.article && S.produitsCache[d.article]) return pageArticle(d);
    const t = tiersDe(d.tiers); const cmd = d.type === 'cmd';
    const etapes = `<ol class="etapes" aria-label="Étapes">${['Client', 'Produits', 'Envoyer'].map((n, i) => `<li class="${d.etape === i + 1 ? 'actif' : d.etape > i + 1 ? 'fait' : ''}"><i>${d.etape > i + 1 ? '✓' : i + 1}</i><span>${n}</span></li>`).join('')}</ol>`;
    const tete = `<header class="entete devis-entete"><div class="gauche"><button type="button" class="retour" data-devis-retour aria-label="Retour">${ico('retour', 20, 2.2)}</button><h1>${cmd ? 'Nouvelle commande' : 'Nouveau devis'}</h1></div>${etapes}</header>`;
    const total = { ht: htD(d), ttc: ttcD(d), marge: rond2(htD(d) - d.lignes.reduce((s, l) => s + prixRevient(S.produitsCache[l.produit]) * l.qte, 0)) };
    if (d.etape === 1) {
      const q = normaliser(S.rechClients);
      const l = ((S.crm && S.crm.tiers) || []).filter((x) => (x.client || x.prospect) && (!q || normaliser([x.nom, x.ville, x.code_client].join(' ')).includes(q))).sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr')).slice(0, 60);
      return `${tete}<label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="clients" value="${esc(S.rechClients)}" placeholder="Choisir le client…" aria-label="Choisir le client"></label>${boutonsNouveauTiers(true)}
        <section class="widget"><div class="convs">${l.map((x) => `<button type="button" class="conv" data-devis-client="${esc(x.id)}">${avatarTiers(x)}<span class="txt"><b>${esc(x.nom)}</b><small>${esc([x.ville, x.remise ? `remise ${x.remise} %` : 'prix net'].filter(Boolean).join(' · '))}</small></span><span class="droite">›</span></button>`).join('') || '<p class="vide">Aucun client.</p>'}</div></section>`;
    }
    const controleur = S.profil && S.profil.controle_par && profil(S.profil.controle_par);
    const libValider = controleur ? `Valider et envoyer à ${esc(nomDe(controleur).split(' ')[0])}` : cmd ? 'Valider la commande' : 'Valider le devis';
    const recap = `<section class="widget panier"><div class="client-devis">${avatarTiers(t, 46)}<div style="flex:1;min-width:0"><b>${esc(t ? t.nom : '—')}</b><small>${esc([t && t.ville, `niveau de prix ${(t && +t.niveau) || 1}`, t && +t.remise ? `remise ${t.remise} %` : ''].filter(Boolean).join(' · '))}</small></div>${d.etape === 2 ? '<button type="button" class="btn-verre petit" data-devis-etape="1">Changer</button>' : ''}</div><div class="lignes-panier">
      ${d.lignes.map((l, i) => `<div class="ligne-devis"><button type="button" class="txt" data-voir-article="${esc(l.produit)}" title="Prix et remise"><b>${esc(l.desc)}</b><small>${euros(l.pu)}${l.remise ? ` −${pc(l.remise)}` : ''} · ${esc(l.auto)}${l.remise ? '' : ' · remise ›'}</small></button><div class="stepper" role="group" aria-label="Quantité"><button type="button" data-qte="${i}" data-pas="-1" aria-label="Retirer un">−</button><span>${l.qte}</span><button type="button" data-qte="${i}" data-pas="1" aria-label="Ajouter un">+</button></div></div>`).join('') || '<p class="vide">Ajoutez des produits.</p>'}</div>
      <div class="totaux-devis"><div><span>Total HT</span><b>${euros(total.ht)}</b></div><div class="ligne-marge">${blocMarge(total.marge)}</div><div class="ttc"><span>Total TTC</span><b>${euros(total.ttc)}</b></div></div>
      ${d.etape === 2 ? `<button type="button" class="btn-metal plein" data-devis-valider ${d.lignes.length ? '' : 'disabled'}>${libValider} ${ico('envoyer', 18, 2.2)}</button><button type="button" class="lien plein" data-devis-etape="3" ${d.lignes.length ? '' : 'disabled'}>Ajouter une note ou enregistrer en brouillon ›</button>` : ''}</section>`;
    if (d.etape === 2) {
      if (!S.produitsCharges) lancerRechercheStock();
      const dans = new Map(d.lignes.map((l) => [l.produit, l.qte]));
      // Articles en widgets (25/11/2026) : toucher l'article = page article (prix net, remise) ; « + » = ajout direct
      const prods = S.produitsCharges === true ? S.produits.slice(0, 40).map((p) => { const px = prixPour(d.tiers, p); const st = +p.stock || 0; return `<div class="widget-produit" data-voir-article="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(p.libelle || p.ref)} : prix et remise"><div class="visuel"><span class="photo-doc">${p.image && /^(data:image|https:)/.test(p.image) ? `<img src="${esc(p.image)}" alt="">` : ''}</span>${promoActive(p) ? '<span class="badge-promo">Promo</span>' : ''}</div><b class="nom">${esc(p.libelle || p.ref)}</b><small>${esc(p.ref || '')} · <span class="${st > 0 ? 'en-stock' : 'rupture'}">${st > 0 ? `stock ${st.toLocaleString('fr-FR')}` : 'rupture'}</span></small><div class="bas"><b class="prix">${euros(px.pu)}</b><button type="button" class="ajout ${dans.has(p.id) ? 'dans' : ''}" data-ajout-produit="${esc(p.id)}" aria-label="Ajouter ${esc(p.libelle || p.ref)}">${dans.has(p.id) ? `× ${dans.get(p.id)} ajouté${dans.get(p.id) > 1 ? 's' : ''}` : '+'}</button></div></div>`; }).join('') : '<p class="vide">Chargement du catalogue…</p>';
      return `${tete}<div class="devis-grille"><div><div class="stk-cherche"><label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="stock" value="${esc(S.rechStock)}" placeholder="Chercher un produit ou scanner un code-barres" aria-label="Chercher un produit"></label><button type="button" class="scan verre" data-scanner-devis aria-label="Scanner un code-barres">${ico('codebarre', 22)}</button></div>
        <div class="puces" role="group" aria-label="Familles">${FAMILLES_DEVIS.map(([k, n]) => `<button type="button" data-famille="${k}" class="${S.devisCat === k ? 'actif' : ''}">${n}</button>`).join('')}</div>
        <div class="produits-widgets">${prods || '<p class="vide">Aucun produit dans cette famille.</p>'}</div></div>
        <div class="colonne-panier">${recap}</div></div>`;
    }
    return `${tete}${recap}
      <section class="widget"><label class="champ">Note sur ${cmd ? 'la commande' : 'le devis'} (visible par le client)<textarea data-devis-note rows="3" maxlength="2000">${esc(d.note)}</textarea></label><p class="vide">${cmd ? 'Commande client : préparation et livraison suivies sur le PC.' : 'Valable 15 jours.'} ${t && t.cond ? 'Paiement : ' + esc(t.cond) + '.' : ''}</p></section>
      <button type="button" class="btn-metal plein" data-devis-valider>${controleur ? `Valider et envoyer à ${esc(nomDe(controleur))}` : cmd ? 'Valider la commande' : 'Valider le devis'}</button>
      <button type="button" class="btn-verre plein" data-devis-brouillon>Enregistrer en brouillon</button>`;
  }
  // Page article (25/11/2026) : prix net, prix de la ligne, quantité, remise (bloquée au maximum autorisé)
  function saisieArticle(d) {
    const p = S.produitsCache[d.article]; const l = d.lignes.find((x) => x.produit === p.id);
    if (!d.saisie || d.saisie.produit !== p.id) { const px = l ? { pu: l.pu, auto: l.auto, remise: l.remise } : prixPour(d.tiers, p); const q = l ? l.qte : 1;
      d.saisie = { produit: p.id, pu: +px.pu || 0, auto: px.auto, qte: q, remise: String(Math.min(+px.remise || 0, remiseMaxLigne(p, px.pu, q)) || '') }; }
    const x = d.saisie; const max = remiseMaxLigne(p, x.pu, x.qte); const r = x.remise === '' ? 0 : Number(String(x.remise).replace(',', '.'));
    const invalide = !Number.isFinite(r) || r < 0; const trop = !invalide && r > max + 1e-9;
    const pu = rond2(x.pu * (1 - (invalide || trop ? 0 : r) / 100));
    return { p, l, x, max, r, invalide, trop, pu, ht: rond2(pu * x.qte), ttc: rond2(pu * x.qte * 1.2) };
  }
  function pageArticle(d) {
    const a = saisieArticle(d); const { p, l, x } = a; const net = prixNet(p); const cmd = d.type === 'cmd';
    const paliers = (p.remises_qte || []).filter((q) => +q.qte > 0 && +q.remise > remiseMaxUnite(p)).sort((m, n) => m.qte - n.qte);
    const st = +p.stock || 0; const emp = emplacements(p);
    return `<div class="fil-tete" style="border:0;padding:0 0 8px"><button type="button" class="retour" data-article-retour aria-label="Retour">${ico('retour', 20, 2.2)}</button><b style="font:700 20px var(--titre)">Article</b></div>
      <div class="article-grille"><section class="widget article-fiche"><div class="visuel">${imageProduit(p, 180)}</div><h2>${esc(p.libelle || p.ref)}</h2>
        <small>${esc([p.ref, p.marque].filter(Boolean).join(' · '))}</small><small class="${st > 0 ? 'en-stock' : 'rupture'}">${st > 0 ? `${st.toLocaleString('fr-FR')} en stock` : 'Rupture de stock'}${emp.length ? ' · ' + esc(emp[0]) : ''}</small></section>
      <section class="widget chaud article-prix">
        <div class="ligne-prix"><span>Prix net HT</span><b>${euros(net)}</b></div>
        ${promoActive(p) ? `<div class="ligne-prix"><span>Prix promo HT</span><b>${euros(+p.prix_promo)}</b></div>` : ''}
        ${x.auto === 'prix client' ? `<div class="ligne-prix"><span>Prix négocié pour ce client</span><b>${euros(x.pu)}</b></div>` : ''}
        <div class="ligne-prix"><span>Quantité</span><div class="stepper" role="group" aria-label="Quantité"><button type="button" data-art-qte="-1" aria-label="Retirer un">−</button><span data-art-q>${x.qte}</span><button type="button" data-art-qte="1" aria-label="Ajouter un">+</button></div></div>
        <label class="champ">Remise (%)<input type="number" inputmode="decimal" min="0" max="${a.max}" step="0.5" data-art-remise value="${esc(x.remise)}" placeholder="0"></label>
        <label class="champ">ou prix unitaire HT souhaité (€)<input type="number" inputmode="decimal" min="0" step="0.01" data-art-prix value="${a.r > 0 && !a.trop && !a.invalide ? a.pu : ''}" placeholder="${esc(String(x.pu).replace('.', ','))}"></label>
        <p class="aide-remise" data-art-min>Prix minimum accepté HT : <b>${euros(plancherPrix(p, x.qte))}</b></p>
        <p class="aide-remise" data-art-max>Remise maximale autorisée : <b>${pc(a.max)}</b>${paliers.length ? ` · ${paliers.map((q) => `${pc(q.remise)} dès ${q.qte} unités`).join(', ')}` : ''}</p>
        <p class="erreur-remise" data-art-erreur ${a.trop || a.invalide ? '' : 'hidden'}>${a.invalide ? 'Remise invalide.' : `Prix sous le minimum accepté (remise maximale ${pc(a.max)}) : impossible.`}</p>
        <div class="totaux"><span>Prix unitaire HT <b data-art-pu>${euros(a.pu)}</b></span><span>Total HT <b data-art-ht>${euros(a.ht)}</b></span><span class="ttc">TTC <b data-art-ttc>${euros(a.ttc)}</b></span></div>
        <button type="button" class="btn-metal plein" data-art-ok ${a.trop || a.invalide ? 'disabled' : ''}>${l ? 'Mettre à jour la ligne' : cmd ? 'Ajouter à la commande' : 'Ajouter au devis'}</button>
        ${l ? '<button type="button" class="btn-verre plein danger" data-art-retirer>Retirer cet article</button>' : ''}</section></div>`;
  }
  // Mise à jour en direct pendant la saisie de la remise (sans redessiner l'écran : le clavier reste ouvert)
  function majArticle() {
    const d = S.devis; if (!d || !d.article) return; const a = saisieArticle(d);
    const q = (s2) => app.querySelector(s2);
    const e = q('[data-art-erreur]'); if (e) { e.hidden = !(a.trop || a.invalide); e.textContent = a.invalide ? 'Remise invalide.' : `Prix sous le minimum accepté (remise maximale ${pc(a.max)}) : impossible.`; }
    const ch = q('[data-art-remise]'); if (ch) { ch.max = a.max; ch.classList.toggle('trop', a.trop || a.invalide); ch.setAttribute('aria-invalid', String(a.trop || a.invalide)); }
    const b = q('[data-art-ok]'); if (b) b.disabled = a.trop || a.invalide;
    const m = q('[data-art-max] b'); if (m) m.textContent = pc(a.max);
    const mn = q('[data-art-min] b'); if (mn) mn.textContent = euros(plancherPrix(a.p, a.x.qte));
    const px = q('[data-art-prix]'); if (px && document.activeElement !== px) px.value = a.r > 0 && !a.trop && !a.invalide ? a.pu : '';
    [['[data-art-pu]', a.pu], ['[data-art-ht]', a.ht], ['[data-art-ttc]', a.ttc]].forEach(([k, v]) => { const el = q(k); if (el) el.textContent = euros(v); });
  }
  async function clicDevis(t) {
    const d = S.devis; if (!d) return false;
    const va = t.closest('[data-voir-article]'); if (va && !t.closest('[data-ajout-produit]')) { if (!S.produitsCache[va.dataset.voirArticle]) return true; d.article = va.dataset.voirArticle; d.saisie = null; rendre(); window.scrollTo(0, 0); return true; }
    const fa = t.closest('[data-famille]'); if (fa) { S.devisCat = fa.dataset.famille; S.produitsCharges = false; S.produits = []; lancerRechercheStock(); rendre(true); return true; }
    if (t.closest('[data-scanner-devis]')) { ouvrirScanner(); return true; }
    if (t.closest('[data-article-retour]')) { d.article = null; d.saisie = null; rendre(); return true; }
    const aq = t.closest('[data-art-qte]'); if (aq && d.saisie) { d.saisie.qte = Math.max(1, d.saisie.qte + +aq.dataset.artQte); const sp = app.querySelector('[data-art-q]'); if (sp) sp.textContent = d.saisie.qte; majArticle(); return true; }
    if (t.closest('[data-art-ok]') && d.saisie) { const a = saisieArticle(d); if (a.trop || a.invalide) { toast(`Remise bloquée : maximum autorisé ${pc(a.max)}.`); return true; }
      const val = { produit: a.p.id, desc: a.p.libelle || [a.p.modele, a.p.couleur, a.p.taille].filter(Boolean).join(' ') || a.p.ref, tva: 20, qte: a.x.qte, pu: a.x.pu, remise: Math.round(a.r * 10) / 10, auto: a.x.auto };
      if (a.l) Object.assign(a.l, val); else d.lignes.push(val); d.article = null; d.saisie = null; rendre(); toast(a.l ? 'Ligne mise à jour.' : 'Article ajouté.'); return true; }
    if (t.closest('[data-art-retirer]') && d.saisie) { const i = d.lignes.findIndex((x) => x.produit === d.saisie.produit); if (i >= 0) d.lignes.splice(i, 1); d.article = null; d.saisie = null; rendre(); toast('Article retiré.'); return true; }
    if (t.closest('[data-devis-retour]')) { if (d.etape > 1) d.etape -= 1; else if (!d.lignes.length || window.confirm(d.type === 'cmd' ? 'Abandonner cette commande ?' : 'Abandonner ce devis ?')) { S.devis = null; S.route = 'accueil'; } rendre(); return true; }
    const c = t.closest('[data-devis-client]'); if (c) { d.tiers = c.dataset.devisClient; d.lignes.forEach((l) => { const p = S.produitsCache[l.produit]; if (p) Object.assign(l, prixPour(d.tiers, p)); }); d.etape = 2; S.rechStock = ''; lancerRechercheStock(); rendre(); return true; }
    const e = t.closest('[data-devis-etape]'); if (e) { d.etape = +e.dataset.devisEtape; rendre(); window.scrollTo(0, 0); return true; }
    const a = t.closest('[data-ajout-produit]');
    if (a) { const p = S.produitsCache[a.dataset.ajoutProduit]; if (!p) return true; const l = d.lignes.find((x) => x.produit === p.id);
      if (l) l.qte += 1; else { const px = prixPour(d.tiers, p); d.lignes.push({ produit: p.id, desc: p.libelle || [p.modele, p.couleur, p.taille].filter(Boolean).join(' ') || p.ref, tva: 20, qte: 1, ...px, remise: Math.min(+px.remise || 0, remiseMaxLigne(p, px.pu, 1)) }); }
      rendre(true); return true; }
    const q = t.closest('[data-qte]'); if (q) { const l = d.lignes[+q.dataset.qte]; if (!l) return true; l.qte += +q.dataset.pas; if (l.qte <= 0) d.lignes.splice(+q.dataset.qte, 1);
      else { const p = S.produitsCache[l.produit]; const mx = p ? remiseMaxLigne(p, l.pu, l.qte) : +l.remise || 0; if ((+l.remise || 0) > mx) { l.remise = mx; toast(`Remise ramenée à ${pc(mx)} (maximum pour ${l.qte} unité${l.qte > 1 ? 's' : ''}).`); } }
      rendre(true); return true; }
    if (t.closest('[data-devis-valider]') || t.closest('[data-devis-brouillon]')) { const b = t.closest('button'); b.disabled = true; const valider = !!t.closest('[data-devis-valider]');
      const n = app.querySelector('[data-devis-note]'); if (n) d.note = n.value;
      try { const r = await enregistrerDevis(d, valider); S.devis = null; S.route = 'client'; S.client = r.tiers; rendre(); toast(valider ? `${r.cmd ? 'Commande' : 'Devis'} ${r.ref} validé${r.cmd ? 'e' : ''}${r.envoye ? ' et envoyé' + (r.cmd ? 'e' : '') + ' pour contrôle' : ''} : visible sur le PC.` : `Brouillon ${r.ref} enregistré : à finir sur le PC.`); }
      catch (er) { b.disabled = false; toast((d.type === 'cmd' ? 'Commande' : 'Devis') + ' non enregistré' + (d.type === 'cmd' ? 'e' : '') + ' : ' + er.message); } return true; }
    return false;
  }
  // Enregistrement dans le CRM en ligne (donnees-fmd/crm/crm.json), comme un PC : lecture de la dernière version du serveur,
  // ajout du devis, nouvelle révision (_rev / _parent) → les PC la fusionnent. Si un PC enregistre entre la lecture et l'envoi,
  // le téléphone relit et recommence (jamais d'écrasement). Puis signal « crm » aux PC ouverts et carte « À contrôler ».
  async function enregistrerDevis(d, valider) {
    const auteur = nomDe(S.profil); const pad = (n, l) => String(n).padStart(l, '0'); const cmd = d.type === 'cmd';
    // Contrôle avant validation (comme le PC) : remise au-delà de l'autorisé (ex. prix négocié trop bas) → accord de Farid sur le PC
    if (valider) { const hors = d.lignes.filter((l) => { const x = typePrix(l); return x && x.type === 'hors'; });
      if (hors.length) throw new Error(`remise au-delà de l’autorisé sur ${hors.map((l) => l.desc).join(', ')} : enregistrez en brouillon, l’accord de Farid se fait sur le PC`); }
    for (let essai = 0; essai < 4; essai++) {
      const { data: blob, error } = await sb.storage.from('donnees-fmd').download('crm/crm.json'); if (error || !blob) throw new Error('CRM illisible (' + ((error && error.message) || 'vide') + ')');
      const db = JSON.parse(await blob.text()); const rev = db._rev;
      ['propositions', 'commandes', 'factures', 'evenements', 'tiers'].forEach((k) => { if (!Array.isArray(db[k])) db[k] = []; }); db.compteurs = db.compteurs || {};
      const date = aujISO(); const maintenant = new Date().toISOString(); const id = (cmd ? 'cmd' : 'prop') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const prov = (db.compteurs.prov || 0) + 1; let ref;
      const cle = cmd ? 'co' : 'pr'; const pre = cmd ? 'CO' : 'PR';
      if (valider) { db.compteurs[cle] = (db.compteurs[cle] || 0) + 1; ref = pre + '-' + pad(db.compteurs[cle], 8); } else { db.compteurs.prov = prov; ref = `(PROV-${pre}${prov})`; }
      const t = db.tiers.find((x) => x.id === d.tiers) || {};
      // Encours client (commande validée, comme le PC js/erp-encours.js) : > +5 % du maximum = accord de Farid sur le PC
      if (cmd && valider && +t.encours_max > 0) {
        const nonFact = (c) => ['validee', 'en_cours', 'livree'].includes(c.etat) && !c.facturee && !(c.liens || []).some((x) => x.type === 'fact');
        const avant = db.factures.filter((x) => x.tiers === t.id && !x.payee).reduce((s2, x) => s2 + ttcD(x), 0) + db.commandes.filter((x) => x.tiers === t.id && nonFact(x)).reduce((s2, x) => s2 + ttcD(x), 0);
        const apres = rond2(avant + ttcD(d)); const dep = (apres - t.encours_max) / t.encours_max;
        if (dep > 0.05) throw new Error(`encours du client dépassé (${euros(apres)} pour ${euros(t.encours_max)} autorisés) : enregistrez en brouillon, l’accord de Farid se fait sur le PC`);
        if (dep > 0 && essai === 0 && !window.confirm(`Encours après cette commande : ${euros(apres)} pour ${euros(t.encours_max)} autorisés. Valider quand même ?`)) throw new Error('validation annulée');
      }
      const fin = new Date(date + 'T12:00:00'); fin.setDate(fin.getDate() + 15);
      const lignes = d.lignes.map((l) => { const x = { produit: l.produit, desc: l.desc, tva: 20, pu: rond2(l.pu), qte: l.qte, remise: +l.remise || 0, auto: l.auto };
        if (valider) { const tp = typePrix(l); if (tp) Object.assign(x, { prix_net: rond2(tp.net), type_prix: tp.type, remise_eff: rond2(tp.remise), remise_autorisee: tp.autorise }); } return x; });
      const o = cmd
        ? { id, ref, tiers: d.tiers, ref_client: '', date, livraison: '', cond: t.cond || '', mode: t.mode || '', expedition: '', origine: 'Mobile', etat: valider ? 'validee' : 'brouillon', facturee: false,
          lignes, note_pub: d.note || '', note_priv: '', auteur, liens: [], cree: maintenant, modifie: maintenant }
        : { id, ref, tiers: d.tiers, ref_client: '', ref_fourn: '', date, cond: t.cond || '', mode: t.mode || '', expedition: '', origine: 'Mobile', delai: '', livraison: '',
          note_pub: d.note || '', note_priv: '', etat: valider ? 'ouvert' : 'brouillon', lignes, liens: [], auteur, cree: maintenant, validite: 15, fin: jourISO(fin), modifie: maintenant };
      (cmd ? db.commandes : db.propositions).push(o);
      if (cmd && valider && t.id && t.prospect) { t.prospect = false; t.client = true; t.statut_prospect = 'fait'; } // première commande d'un prospect → client
      db.evenements.unshift({ id: 'ev' + Date.now().toString(36), d: maintenant, par: auteur, tiers: o.tiers, objet: { type: cmd ? 'cmd' : 'prop', id }, titre: valider ? `${cmd ? 'Commande client' : 'Proposition commerciale'} ${ref} validée (téléphone)` : `${cmd ? 'Commande client' : 'Proposition commerciale'} ${ref} créée (brouillon, téléphone)`, texte: '', type: 'auto' });
      if (db.evenements.length > 600) db.evenements.length = 600;
      db._parent = rev || null; db._rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      // Personne n'a enregistré entre-temps ? (sinon on recommence sur la nouvelle version)
      const { data: b2 } = await sb.storage.from('donnees-fmd').download('crm/crm.json');
      if (b2) { try { if (JSON.parse(await b2.text())._rev !== rev) continue; } catch { /* relu au prochain essai */ } }
      const { error: e2 } = await sb.storage.from('donnees-fmd').upload('crm/crm.json', new Blob([JSON.stringify(db)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' });
      if (e2) throw new Error(e2.message);
      try { await sb.from('evenements').insert({ module: 'crm', cle: 'donnees', poste: 'mobile-' + moi() }); } catch { /* les PC relisent toutes les minutes */ }
      S.crm = db;
      let envoye = false;
      if (valider && S.profil && S.profil.controle_par && S.profil.controle_par !== moi()) {
        const lignes = o.lignes.map((l) => { const p = S.produitsCache[l.produit]; return { ref: p ? p.ref : '', desc: l.desc, qte: l.qte, pu: l.pu, remise: l.remise, ht: htL(l) }; });
        const apercu = { type: cmd ? 'cmd' : 'prop', titre: cmd ? 'Commande client' : 'Proposition commerciale', ref, role: 'Client', tiers: t.nom || '', ville: [t.cp, t.ville].filter(Boolean).join(' '), date, lignes: lignes.slice(0, 25), nb: lignes.length, ht: htD(o), ttc: ttcD(o), marge: rond2(htD(o) - o.lignes.reduce((s, l) => s + prixRevient(S.produitsCache[l.produit]) * l.qte, 0)) };
        const libelle = cmd ? `La commande client ${ref}` : `La proposition commerciale ${ref}`;
        try { await sb.from('messages').insert({ de: moi(), a: S.profil.controle_par, texte: `🔎 À contrôler : ${auteur} vient de valider ${libelle.toLowerCase()} (${t.nom || ''}) — ${lignes.length} ligne${lignes.length > 1 ? 's' : ''}, ${euros(apercu.ht)} HT.`, lien: { module: 'crm', route: `${cmd ? 'cmd' : 'prop'}/fiche/${id}`, libelle, controle: true, apercu } }); envoye = true; } catch { /* devis enregistré quand même */ }
      }
      return { ref, tiers: o.tiers, envoye, cmd };
    }
    throw new Error('le CRM change en ce moment sur un autre poste, réessayez dans quelques secondes');
  }

  // ---------- feuilles (formulaires et menus) ----------
  function ouvrirFeuille(html) { S.feuille = `<div class="feuille" data-fermer-feuille><div class="panneau" role="dialog" aria-modal="true">${html}</div></div>`; rendre(true); const i = app.querySelector('.panneau input'); if (i) i.focus(); }
  function fermerFeuille() { arreterScan(); S.feuille = null; rendre(true); }
  function feuilleRdv(jour, heure) {
    const d = jour || (S.route === 'agenda' ? AG.ref : aujISO()); const h = Number.isFinite(heure) ? heure : 9;
    ouvrirFeuille(`<h3>Nouveau rendez-vous</h3><form data-form-rdv style="display:flex;flex-direction:column;gap:10px">
      <label class="champ">Titre<input name="titre" required maxlength="200"></label>
      <label class="champ">Date<input name="date" type="date" value="${d}" required></label>
      <div style="display:flex;gap:10px"><label class="champ" style="flex:1">Début<input name="debut" type="time" value="${pad(h)}:00" required></label><label class="champ" style="flex:1">Fin<input name="fin" type="time" value="${pad(Math.min(23, h + 1))}:00" required></label></div>
      <label class="champ">Lieu<input name="lieu" maxlength="300"></label>
      <button class="btn-metal" type="submit">Ajouter à mon agenda</button><button class="btn-verre" type="button" data-fermer>Annuler</button></form>`);
  }
  function feuilleTache() {
    ouvrirFeuille(`<h3>Nouvelle tâche</h3><form data-form-tache style="display:flex;flex-direction:column;gap:10px">
      <label class="champ">Tâche<input name="titre" required maxlength="300"></label>
      <label class="champ">Pour le<input name="date" type="date" value="${S.route === 'agenda' ? S.jour : aujISO()}"></label>
      <label style="display:flex;align-items:center;gap:10px;min-height:44px"><input type="checkbox" name="urgente" style="width:22px;height:22px;accent-color:#C9987D"> Urgente</label>
      <button class="btn-metal" type="submit">Ajouter</button><button class="btn-verre" type="button" data-fermer>Annuler</button></form>`);
  }
  function feuilleCompte() {
    ouvrirFeuille(`<h3>${esc(nomDe(S.profil))}</h3><p class="vide" style="padding:0">${esc(S.user.email || '')}</p><p class="vide" style="padding:0">Données synchronisées avec le logiciel FMD sur PC.</p><p class="vide" style="padding:0">Version FMD ${esc(VERSION)}</p><button class="btn-verre" type="button" data-marge>${margeCachee ? 'Afficher la marge' : 'Cacher la marge'}</button><button class="btn-verre" type="button" data-chercher-maj>Rechercher une mise à jour</button>${blocInstaller()}
      <button class="btn-verre" type="button" data-actualiser>Tout relire sur le serveur</button><button class="btn-verre danger" type="button" data-deconnexion>Se déconnecter</button><button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }
  // ---------- nouveau client / prospect + modifier (25/11/2026, demande : « sur la version web je ne peux pas créer un
  // nouveau client ou un nouveau prospect, il me faudrait les mêmes fonctions que sur le logiciel PC ») ----------
  // Mêmes champs et mêmes règles que le PC (app/js/erp-tiers.js, formTiers) : code client CUaamm-nnnnn (compteurs.cu,
  // comme D.prochaineRef), compte 411 + 5 lettres du nom, événement « Tiers … créé / modifié », carte « À contrôler » au
  // contrôleur (comme FMDMessagerie.signalerCreation). Écrit dans crm/crm.json comme un devis (relecture avant envoi).
  // Listes recopiées d'app/js/erp-donnees.js (D.TYPES_TIERS…) : à garder identiques.
  const TL = {
    types: ['TPE', 'PME/PMI', 'Grand compte', 'Particulier', 'Administration'],
    statuts: [['jamais', 'Jamais contacté'], ['a_contacter', 'À contacter'], ['en_cours', 'Contact en cours'], ['fait', 'Contact réalisé'], ['ne_pas', 'Ne pas contacter']],
    potentiels: ['—', 'Faible', 'Moyen', 'Fort'],
    conditions: ['À réception', '30 jours', '30 jours fin de mois', '45 jours fin de mois', '60 jours'],
    modes: ['Virement', 'Chèque', 'Carte bancaire', 'Prélèvement', 'Espèces'],
    commerciaux: ['Farid MEDEGUEB', 'Benoît CRASNIER'],
    effectifs: ['', '1-5', '6-10', '11-50', '51-100', '100+'],
  };
  const boutonsNouveauTiers = (pourDevis) => (S.crm ? `<div class="actions-tiers"><button type="button" class="btn-verre" data-nouveau-tiers="C"${pourDevis ? ' data-pour-devis' : ''}>${ico('clientPlus', 18)}Nouveau client</button><button type="button" class="btn-verre" data-nouveau-tiers="P"${pourDevis ? ' data-pour-devis' : ''}>${ico('plus', 18, 2.4)}Nouveau prospect</button></div>` : '');
  const optionsSel = (l, v) => l.map((x) => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(t || '—')}</option>`; }).join('');
  const normNom = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function feuilleTiers(id, nat, pourDevis) {
    const t0 = id ? tiersDe(id) : null; if (id && !t0) { toast('Fiche introuvable.'); return; }
    const moiNom = nomDe(S.profil); const moiCom = TL.commerciaux.find((c) => normNom(c) === normNom(moiNom)) || TL.commerciaux[0];
    const t = t0 || { nom: '', alt: '', prospect: nat !== 'C', client: nat === 'C', adresse: '', cp: '', ville: '', pays: 'France', tel: '', portable: '', email: '', web: '', siren: '', siret: '', tva_num: '', assujetti: true,
      type: 'TPE', effectif: '', commercial: moiCom, statut_prospect: 'jamais', potentiel: 0, remise: 0, cond: '30 jours', mode: 'Virement', encours_max: 0, tags: [] };
    const estClient = !!t.client; const coms = [...new Set([...TL.commerciaux, ...(t.commercial ? [t.commercial] : [])])];
    const ch = (lib, nom, v, o = {}) => `<label class="champ">${lib}<input name="${nom}" value="${esc(v == null ? '' : v)}"${o.type ? ` type="${o.type}"` : ''}${o.req ? ' required' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.mode ? ` inputmode="${o.mode}"` : ''}${o.type === 'number' ? ' min="0" step="any"' : ''} maxlength="300"></label>`;
    const sel = (lib, nom, l, v) => `<label class="champ">${lib}<select name="${nom}">${optionsSel(l, v)}</select></label>`;
    ouvrirFeuille(`<h3>${t0 ? `Modifier ${esc(t0.nom)}` : estClient ? 'Nouveau client' : 'Nouveau prospect'}</h3>
      <form class="form-tiers" data-form-tiers="${esc(t0 ? t0.id : '')}"${pourDevis ? ' data-pour-devis' : ''}>
      <div class="nature" role="radiogroup" aria-label="Nature"><label><input type="radio" name="nature" value="P"${estClient ? '' : ' checked'}><span>Prospect</span></label><label><input type="radio" name="nature" value="C"${estClient ? ' checked' : ''}><span>Client</span></label></div>
      ${t0 && t0.code_client ? `<p class="aide">Code client ${esc(t0.code_client)}</p>` : '<p class="aide">Code client attribué automatiquement.</p>'}
      <h4>Identité</h4>
      ${ch('Nom du tiers *', 'nom', t.nom, { req: true })}${ch('Nom alternatif', 'alt', t.alt, { ph: 'Nom commercial, marque…' })}
      <h4>Coordonnées</h4>
      <label class="champ">Adresse<textarea name="adresse" rows="2" maxlength="500">${esc(t.adresse || '')}</textarea></label>
      <div class="deux">${ch('Code postal', 'cp', t.cp, { mode: 'numeric' })}${ch('Ville', 'ville', t.ville)}</div>
      ${ch('Pays', 'pays', t.pays || 'France')}
      <div class="deux">${ch('Téléphone', 'tel', t.tel, { type: 'tel' })}${ch('Portable', 'portable', t.portable, { type: 'tel' })}</div>
      ${ch('E-mail', 'email', t.email, { type: 'email' })}${ch('Site web', 'web', t.web, { mode: 'url' })}
      <h4>Identifiants professionnels</h4>
      <div class="deux">${ch('SIREN', 'siren', t.siren, { mode: 'numeric' })}${ch('SIRET', 'siret', t.siret, { mode: 'numeric' })}</div>
      <div class="deux">${sel('Assujetti à la TVA', 'assujetti', [['1', 'Oui'], ['', 'Non']], t.assujetti ? '1' : '')}${ch('N° de TVA', 'tva_num', t.tva_num, { ph: 'FR…' })}</div>
      <h4>Suivi commercial</h4>
      <div class="deux">${sel('Type', 'type', TL.types, t.type)}${sel('Effectif', 'effectif', TL.effectifs, t.effectif)}</div>
      ${sel('Commercial', 'commercial', coms, t.commercial)}
      <div class="deux">${sel('Statut de prospection', 'statut_prospect', TL.statuts, t.statut_prospect || 'jamais')}${sel('Potentiel', 'potentiel', TL.potentiels.map((x, i) => [i, x]), +t.potentiel || 0)}</div>
      ${ch('Tags / catégories', 'tags', (t.tags || []).join(', '), { ph: 'Ex. : chantier, VIP' })}
      ${ch('Remise client (%)', 'remise', t.remise || '', { type: 'number', mode: 'decimal' })}<p class="aide">Appliquée sur le prix net ; compte comme une réduction (commission 12 %).</p>
      <div class="deux">${sel('Conditions de règlement', 'cond', TL.conditions, t.cond || '30 jours')}${sel('Mode de règlement', 'mode', TL.modes, t.mode || 'Virement')}</div>
      ${ch('Encours autorisé (€)', 'encours_max', t.encours_max || '', { type: 'number', mode: 'decimal' })}
      <button class="btn-metal" type="submit">${t0 ? 'Enregistrer' : 'Créer le tiers'}</button><button class="btn-verre" type="button" data-fermer>Annuler</button></form>`);
  }
  async function enregistrerTiers(id, f) {
    const auteur = nomDe(S.profil); const nom = f.nom.value.trim(); if (!nom) throw new Error('le nom est obligatoire');
    const client = f.querySelector('[name="nature"]:checked').value === 'C';
    const num = (n) => { const x = parseFloat(String(f[n].value).replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : 0; };
    const champs = { nom, alt: f.alt.value.trim(), prospect: !client, client, adresse: f.adresse.value.trim(), cp: f.cp.value.trim(), ville: f.ville.value.trim(), pays: f.pays.value.trim() || 'France',
      tel: f.tel.value.trim(), portable: f.portable.value.trim(), email: f.email.value.trim(), web: f.web.value.trim(), siren: f.siren.value.trim(), siret: f.siret.value.trim(), assujetti: f.assujetti.value === '1',
      tva_num: f.tva_num.value.trim(), type: f.type.value, effectif: f.effectif.value, commercial: f.commercial.value, statut_prospect: f.statut_prospect.value, potentiel: +f.potentiel.value || 0,
      tags: f.tags.value.split(',').map((s) => s.trim()).filter(Boolean), remise: num('remise'), cond: f.cond.value, mode: f.mode.value, encours_max: num('encours_max') };
    const compta = (n) => n.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase();
    for (let essai = 0; essai < 4; essai++) {
      const { data: blob, error } = await sb.storage.from('donnees-fmd').download('crm/crm.json'); if (error || !blob) throw new Error('CRM illisible (' + ((error && error.message) || 'vide') + ')');
      const db = JSON.parse(await blob.text()); const rev = db._rev;
      ['tiers', 'evenements'].forEach((k) => { if (!Array.isArray(db[k])) db[k] = []; }); db.compteurs = db.compteurs || {};
      const maintenant = new Date().toISOString(); const neuf = !id;
      let o = neuf ? null : db.tiers.find((x) => x.id === id); if (!neuf && !o) throw new Error('fiche introuvable (supprimée sur un PC ?)');
      if (neuf) {
        const doublon = db.tiers.find((x) => normNom(x.nom) === normNom(nom) && (x.client || x.prospect));
        if (doublon && essai === 0 && !window.confirm(`« ${doublon.nom} » existe déjà${doublon.ville ? ` (${doublon.ville})` : ''}. Créer quand même un nouveau tiers ?`)) throw new Error('création annulée');
        o = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), contacts: [], comptes: [], note_pub: '', note_priv: '', etat: 'ouvert', cree: maintenant, code_client: '', code_fourn: '', compta_client: '', compta_fourn: '',
          fournisseur: false, fax: '', pas_mail: false, naf: '', rcs: '', niveau: 1, logo: '' };
        db.tiers.push(o);
      }
      Object.assign(o, champs);
      if (o.client) o.prospect = false;
      if (!o.code_client) { const d = new Date(); db.compteurs.cu = (db.compteurs.cu || 0) + 1;
        o.code_client = `CU${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(db.compteurs.cu).padStart(5, '0')}`; o.compta_client = o.compta_client || '411' + compta(o.nom); }
      o.modifie = maintenant;
      db.evenements.unshift({ id: 'ev' + Date.now().toString(36), d: maintenant, par: auteur, tiers: o.id, objet: { type: 'tiers', id: o.id }, titre: `Tiers ${o.nom} ${neuf ? 'créé' : 'modifié'} (téléphone)`, texte: '', type: 'auto' });
      if (db.evenements.length > 600) db.evenements.length = 600;
      db._parent = rev || null; db._rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const { data: b2 } = await sb.storage.from('donnees-fmd').download('crm/crm.json');
      if (b2) { try { if (JSON.parse(await b2.text())._rev !== rev) continue; } catch { /* relu au prochain essai */ } }
      const { error: e2 } = await sb.storage.from('donnees-fmd').upload('crm/crm.json', new Blob([JSON.stringify(db)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' });
      if (e2) throw new Error(e2.message);
      try { await sb.from('evenements').insert({ module: 'crm', cle: 'donnees', poste: 'mobile-' + moi() }); } catch { /* les PC relisent toutes les minutes */ }
      S.crm = db;
      if (neuf && S.profil && S.profil.controle_par && S.profil.controle_par !== moi()) {
        const quoi = o.client ? 'le client' : 'le prospect'; const libelle = `${quoi} ${o.nom}`;
        const apercu = { type: 'tiers', titre: o.client ? 'Client' : 'Prospect', ref: o.nom, adresse: o.adresse || '', ville: [o.cp, o.ville].filter(Boolean).join(' '), tel: o.tel || o.portable || '', email: o.email || '', siret: o.siret || '', code: o.code_client || '' };
        try { await sb.from('messages').insert({ de: moi(), a: S.profil.controle_par, texte: `🔎 À contrôler : ${auteur} vient de créer ${libelle}.`, lien: { module: 'crm', route: `tiers/fiche/${o.id}`, libelle: libelle.charAt(0).toUpperCase() + libelle.slice(1), controle: true, apercu } }); } catch { /* fiche créée quand même */ }
      }
      return o;
    }
    throw new Error('le CRM change en ce moment sur un autre poste, réessayez dans quelques secondes');
  }
  function feuilleMessage(m) {
    const mien = m.de === moi();
    ouvrirFeuille(`<h3>Message</h3>${m.texte ? '<button class="btn-verre" type="button" data-copier="' + m.id + '">Copier le texte</button>' : ''}<button class="btn-verre" type="button" data-masquer="${m.id}">Supprimer pour moi</button>${mien ? `<button class="btn-verre danger" type="button" data-supprimer="${m.id}">Supprimer pour tout le monde</button>` : ''}<button class="btn-verre" type="button" data-fermer>Annuler</button>`);
  }

  // ================= actions =================
  app.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-fermer]') || t.matches('[data-fermer-feuille]')) { fermerFeuille(); return; }
    const al = t.closest('[data-aller]'); if (al) { aller(al.dataset.aller); return; }
    if (t.closest('[data-compte]')) { feuilleCompte(); return; }
    if (t.closest('[data-marge]')) { margeCachee = !margeCachee; try { localStorage.setItem(CLE_MARGE, margeCachee ? '1' : '0'); } catch { /* préférence non gardée */ } if (S.feuille) feuilleCompte(); else rendre(true); toast(margeCachee ? 'Marge cachée.' : 'Marge affichée.'); return; }
    if (t.closest('[data-deconnexion]')) { S.feuille = null; if (S.canal) sb.removeChannel(S.canal); await sb.auth.signOut(); return; }
    if (t.closest('[data-chercher-maj]')) { const b = t.closest('[data-chercher-maj]'); b.disabled = true; b.textContent = 'Recherche…'; const r = await rechargerSiNouvelle(null, true); S.feuille = null; rendre(true); if (!r) toast(`FMD est à jour (version ${VERSION}).`); return; }
    if (t.closest('[data-actualiser]')) { S.feuille = null; await Promise.all([chargerProfils(), chargerMessages(), chargerTaches(), chargerAgenda(), chargerCRM()]); STK.stats = null; S.produitsCharges = false; rendre(); toast('À jour avec le serveur.'); return; }
    if (t.closest('[data-ajouter]')) { if (S.route === 'agenda') feuilleRdv(); else if (S.route === 'clients' || S.route === 'client') nouveauDevis(S.route === 'client' ? S.client : null); else feuilleTache(); return; }
    if (t.closest('[data-dock-devis]')) { if (S.devis) { S.route = 'devis'; S.feuille = null; rendre(); window.scrollTo(0, 0); } else nouveauDevis(null); return; }
    if (clicAgenda(t, e)) return;
    const ap = t.closest('[data-acc-produit]'); if (ap) { S.route = 'stock'; S.rechStock = ''; STK.sel = ap.dataset.accProduit; STK.rayon = null; S.produitsCharges = false; S.rechAccueil = ''; rendre(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-toutes-commandes]')) { feuilleCommandes(); return; }
    if (t.closest('[data-scanner-accueil]')) { S.route = 'stock'; rendre(); ouvrirScanner(); return; }
    const vd = t.closest('[data-voir-doc]'); if (vd) { feuilleDoc(vd.dataset.voirDoc); return; }
    if (t.closest('[data-tous-docs]')) { feuilleDocsClient(); return; }
    const od = t.closest('[data-ouvrir-doc]'); if (od) { const doc = docDeLien({ route: od.dataset.ouvrirDoc }); if (doc) { S.client = doc.tiers; S.route = 'client'; S.feuille = null; rendre(); window.scrollTo(0, 0); feuilleDoc((od.dataset.ouvrirDoc.startsWith('cmd') ? 'commandes:' : 'propositions:') + doc.id); } return; }
    if (t.closest('[data-nouveau-devis]')) { nouveauDevis(t.closest('[data-nouveau-devis]').dataset.nouveauDevis || null); return; }
    if (t.closest('[data-nouvelle-commande]')) { nouveauDevis(t.closest('[data-nouvelle-commande]').dataset.nouvelleCommande || null, 'cmd'); return; }
    const nt = t.closest('[data-nouveau-tiers]'); if (nt) { feuilleTiers(null, nt.dataset.nouveauTiers, nt.hasAttribute('data-pour-devis')); return; }
    const mt = t.closest('[data-modifier-tiers]'); if (mt) { feuilleTiers(mt.dataset.modifierTiers); return; }
    const dfl = t.closest('[data-docs-filtre]'); if (dfl) { S.docsFiltre = dfl.dataset.docsFiltre; rendre(true); return; }
    const pxb = t.closest('[data-prix-client]'); if (pxb) { feuillePrixClient(pxb.dataset.prixClient || null); return; }
    const pxch = t.closest('[data-pxc-choisir]'); if (pxch) { feuillePrixClient(pxch.dataset.pxcChoisir); return; }
    if (t.closest('[data-pxc-supprimer]')) { const f = app.querySelector('[data-form-pxc]'); if (!f || !window.confirm('Supprimer ce prix client ? Les prochains devis reprendront le prix net (ou la promo).')) return;
      try { await supprimerPrixClient(S.client, f.dataset.formPxc); S.feuille = null; rendre(true); toast('Prix client supprimé (aussi sur le PC).'); } catch (er) { toast('Non supprimé : ' + er.message); } return; }
    const fc = t.closest('[data-fiche-client]'); if (fc) { S.client = fc.dataset.ficheClient; S.route = 'client'; rendre(); window.scrollTo(0, 0); return; }
    if (clicStock(t)) return;
    const fo = t.closest('[data-fiche-produit]'); if (fo) { feuilleProduit(fo.dataset.ficheProduit); return; }
    const cm = t.closest('[data-commander]'); if (cm) { feuilleCommander(cm.dataset.commander); return; }
    if (await clicDevis(t)) return;
    if (t.closest('[data-nouveau-rdv]')) { feuilleRdv(); return; }
    if (t.closest('[data-nouvelle-tache]')) { feuilleTache(); return; }
    const j = t.closest('[data-jour]'); if (j) { S.jour = j.dataset.jour; rendre(true); return; }
    const cv = t.closest('[data-conv]'); if (cv) { S.conv = cv.dataset.conv; S.route = 'conv'; rendre(); marquerLus(S.conv); return; }
    const co = t.closest('[data-cocher]');
    if (co) {
      const ta = S.taches.find((x) => x.id === co.dataset.cocher); if (!ta) return;
      const fait = !ta.fait; ta.fait = fait; ta.fait_le = fait ? new Date().toISOString() : null; rendre(true);
      const { error } = await sb.from('taches').update({ fait, fait_le: ta.fait_le }).eq('id', ta.id);
      if (error) { ta.fait = !fait; rendre(true); toast('Non enregistré : ' + error.message); } return;
    }
    if (t.closest('[data-joindre]')) { app.querySelector('[data-fichier]').click(); return; }
    if (t.closest('[data-photo]')) { app.querySelector('[data-fichier-photo]').click(); return; }
    const ct = t.closest('[data-controle]');
    if (ct) { const m = S.messages.find((x) => x.id === ct.dataset.controle); if (!m) return; ct.disabled = true;
      try { await inserer({ de: moi(), a: m.de, texte: `✅ Contrôlé : ${m.lien.libelle || 'votre création'}. Merci !`, lien: { module: m.lien.module, route: m.lien.route, libelle: m.lien.libelle, reponse: true } }); } catch (er) { ct.disabled = false; toast('Non envoyé : ' + er.message); } return; }
    const o = t.closest('[data-ouvrir], [data-telecharger]');
    if (o) { try { const u = o.dataset.ouvrir ? await lienFichier(o.dataset.ouvrir) : await lienFichier(o.dataset.telecharger, o.dataset.nom); window.open(u, '_blank'); } catch (er) { toast('Fichier indisponible : ' + er.message); } return; }
    const cp = t.closest('[data-copier]'); if (cp) { const m = S.messages.find((x) => x.id === cp.dataset.copier); try { await navigator.clipboard.writeText(m.texte); toast('Texte copié.'); } catch { toast('Copie impossible.'); } fermerFeuille(); return; }
    const ms = t.closest('[data-masquer]');
    if (ms) { const m = S.messages.find((x) => x.id === ms.dataset.masquer); if (!m) return; const champ = m.de === moi() ? 'masque_de' : 'masque_a'; m[champ] = true; S.feuille = null; rendre(true);
      const { error } = await sb.from('messages').update({ [champ]: true }).eq('id', m.id); if (error) { m[champ] = false; rendre(true); toast('Non supprimé : ' + error.message); } return; }
    const sp = t.closest('[data-supprimer]');
    if (sp) { const m = S.messages.find((x) => x.id === sp.dataset.supprimer); if (!m || m.de !== moi()) return; if (!window.confirm('Supprimer ce message pour tout le monde ?')) return;
      const { error } = await sb.from('messages').delete().eq('id', m.id); if (error) { toast('Non supprimé : ' + error.message); return; }
      if (m.piece && m.piece.chemin) sb.storage.from(ESPACE).remove([m.piece.chemin]).catch(() => {});
      S.messages = S.messages.filter((x) => x.id !== m.id); S.feuille = null; rendre(true); return; }
  });
  // Appui long sur un message → menu (copier, supprimer pour moi / pour tout le monde)
  let appui = null;
  app.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-msg]'); if (!b) return; clearTimeout(appui); appui = setTimeout(() => { const m = S.messages.find((x) => x.id === b.dataset.msg); if (m) feuilleMessage(m); }, 550); });
  ['pointerup', 'pointercancel', 'pointermove'].forEach((ev) => app.addEventListener(ev, () => clearTimeout(appui)));
  app.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-msg]')) e.preventDefault(); });

  app.addEventListener('input', (e) => {
    if (e.target.matches('[data-art-remise]') && S.devis && S.devis.saisie) { S.devis.saisie.remise = e.target.value; majArticle(); return; }
    // Prix souhaité (25/11/2026) : converti en remise sur le prix de la ligne, même blocage au prix minimum accepté
    if (e.target.matches('[data-art-prix]') && S.devis && S.devis.saisie) { const s = S.devis.saisie; const v = parseFloat(String(e.target.value).replace(',', '.'));
      s.remise = Number.isFinite(v) && v > 0 && s.pu > 0 ? String(Math.max(0, Math.round((1 - v / s.pu) * 10000) / 100)) : ''; const r = app.querySelector('[data-art-remise]'); if (r) r.value = s.remise; majArticle(); return; }
    if (e.target.matches('[data-pxc-prix]')) { majPrixClient(); return; }
    if (e.target.matches('[data-pxc-recherche]')) { chercherPrixClient(e.target.value); return; }
    const r = e.target.closest('[data-recherche]'); if (!r) return;
    if (r.dataset.recherche === 'clients') { S.rechClients = r.value; rendre(true); }
    if (r.dataset.recherche === 'accueil') rechercheAccueil(r.value);
    if (r.dataset.recherche === 'collegues') { S.rechCollegues = r.value; rendre(true); }
    if (r.dataset.recherche === 'stock') { S.rechStock = r.value; STK.sel = null; STK.rayon = null; lancerRechercheStock(); }
  });
  app.addEventListener('change', (e) => {
    const aq = e.target.closest('[data-ag-qui]'); if (aq) { const id = aq.dataset.agQui; AG.qui = aq.checked ? [...new Set([...AG.qui, id])] : AG.qui.filter((x) => x !== id); if (!AG.qui.length) AG.qui = [moi()]; try { localStorage.setItem('fmd-agenda-qui', JSON.stringify(AG.qui)); } catch { /* */ } AG.cle = ''; rendre(true); return; }
    if (e.target.matches('[data-fichier], [data-fichier-photo]')) { const f = [...e.target.files]; e.target.value = ''; envoyerFichiers(f); } });
  app.addEventListener('keydown', (e) => { if (e.target.matches('[data-texte]') && e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); e.target.form.requestSubmit(); } });
  app.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    if (f.matches('[data-envoi]')) {
      const t = f.querySelector('[data-texte]'); const texte = t.value.trim(); if (!texte || !S.conv) return;
      t.value = ''; try { await inserer({ de: moi(), a: S.conv, texte }); } catch (er) { t.value = texte; toast('Non envoyé : ' + er.message); } return;
    }
    if (f.matches('[data-form-rdv]')) {
      const debut = new Date(`${f.date.value}T${f.debut.value}`); let fin = new Date(`${f.date.value}T${f.fin.value}`); if (fin <= debut) fin = new Date(debut.getTime() + 3600000);
      const { error } = await sb.from('agenda').insert({ titre: f.titre.value.trim(), lieu: f.lieu.value.trim() || null, debut: debut.toISOString(), fin: fin.toISOString(), journee: false, couleur: 'rg' });
      if (error) { toast('Non enregistré : ' + error.message); return; }
      S.feuille = null; await chargerAgenda(); AG.cle = ''; AG.ref = f.date.value; rendre(); toast('Rendez-vous ajouté (visible aussi sur le PC).'); return;
    }
    if (f.matches('[data-form-pxc]')) {
      const b = f.querySelector('[type=submit]'); if (b.disabled) return; const lib = b.textContent; b.disabled = true; b.textContent = 'Enregistrement…';
      const pu = parseFloat(String(f.pu.value).replace(',', '.'));
      try { await enregistrerPrixClient(S.client, f.dataset.formPxc, pu); S.feuille = null; rendre(true); toast(`Prix client enregistré : ${euros(rond2(pu))} HT (aussi sur le PC).`); }
      catch (er) { b.disabled = false; b.textContent = lib; toast('Non enregistré : ' + er.message); }
      return;
    }
    if (f.matches('[data-form-tiers]')) {
      const b = f.querySelector('[type=submit]'); if (b.disabled) return; const lib = b.textContent; b.disabled = true; b.textContent = 'Enregistrement…';
      try {
        const id = f.dataset.formTiers || null; const o = await enregistrerTiers(id, f); S.feuille = null;
        if (f.hasAttribute('data-pour-devis') && S.devis) { const d = S.devis; d.tiers = o.id; d.lignes.forEach((l) => { const p = S.produitsCache[l.produit]; if (p) Object.assign(l, prixPour(d.tiers, p)); }); d.etape = 2; S.rechStock = ''; lancerRechercheStock(); S.route = 'devis'; }
        else { S.client = o.id; S.route = 'client'; }
        rendre(); window.scrollTo(0, 0); toast(id ? 'Modifications enregistrées (visibles aussi sur le PC).' : `${o.client ? 'Client' : 'Prospect'} ${o.nom} créé (${o.code_client}), visible aussi sur le PC.`);
      } catch (er) { b.disabled = false; b.textContent = lib; toast('Non enregistré : ' + er.message); }
      return;
    }
    if (f.matches('[data-form-tache]')) {
      const { error } = await sb.from('taches').insert({ titre: f.titre.value.trim(), date_prevue: f.date.value || null, priorite: f.urgente.checked ? 'urgente' : 'normale', pour: moi() });
      if (error) { toast('Non enregistré : ' + error.message); return; }
      S.feuille = null; await chargerTaches(); rendre(); toast('Tâche ajoutée.'); return;
    }
  });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (S.profil && ROUTES.test(h) && h !== 'devis' && h !== S.route) aller(h); });
  // Clavier du téléphone (25/11/2026, bug : « le clavier s'ouvre et se referme aussitôt » sur la remise) : ouvrir le clavier change
  // la HAUTEUR de la fenêtre ; on ne redessine que si la LARGEUR change (rotation, fenêtre) et jamais pendant une saisie.
  let largeurVue = window.innerWidth;
  window.addEventListener('resize', () => { if (!S.profil || window.innerWidth === largeurVue || champActif()) return; largeurVue = window.innerWidth; rendre(true); });

  // ================= mises à jour (même version que le logiciel FMD sur PC) =================
  // outils/deployer.ps1 publie le PC ET cette appli avec le même numéro, puis envoie le signal « nouvelle-version » (canal
  // fmd-deploiement). L'appli attend que la nouvelle version soit en ligne (version.json) puis se recharge toute seule —
  // jamais pendant une saisie. Au retour dans l'appli, version.json est aussi vérifié (signal manqué, téléphone en veille).
  let versionAttendue = null; let surveillance = null;
  async function versionEnLigne() { try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); return r.ok ? (await r.json()).version : null; } catch { return null; } }
  const occupe = () => { const t = app.querySelector('[data-texte]'); return !!S.feuille || !!champActif() || !!(t && t.value.trim()); };
  // Comme sur PC : alerte « Nouvelle mise à jour » (Mettre à jour / Plus tard), installée toute seule après 30 s si on ne
  // touche à rien et qu'aucune saisie n'est en cours. « Plus tard » : rappel 30 min plus tard (ou au retour dans l'appli).
  let alerteMaj = null; let reporteJusqua = 0;
  async function installerMaj(v) {
    const b = document.getElementById('alerte-maj'); if (b) b.querySelector('[data-maj-texte]').textContent = `Installation de FMD ${v}…`;
    try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch { /* rechargement simple */ }
    setTimeout(() => location.reload(), 800);
  }
  function montrerAlerteMaj(v) {
    if (document.getElementById('alerte-maj')) return;
    const b = document.createElement('div'); b.id = 'alerte-maj'; b.className = 'alerte-maj'; b.setAttribute('role', 'alertdialog'); b.setAttribute('aria-label', 'Nouvelle mise à jour');
    b.innerHTML = `<div><b data-maj-texte>Nouvelle mise à jour : FMD ${esc(v)}</b><small data-maj-compte>Installation automatique dans 30 s</small></div><div class="alerte-maj-boutons"><button type="button" class="btn-verre" data-maj-plus-tard>Plus tard</button><button type="button" class="btn-metal" data-maj-ok>Mettre à jour</button></div>`;
    document.body.appendChild(b);
    let reste = 30;
    alerteMaj = setInterval(() => { reste--; const c = b.querySelector('[data-maj-compte]'); if (occupe()) { if (c) c.textContent = 'Installation à la fin de votre saisie'; reste = Math.max(reste, 5); return; }
      if (c) c.textContent = `Installation automatique dans ${reste} s`; if (reste <= 0) { clearInterval(alerteMaj); installerMaj(v); } }, 1000);
    b.querySelector('[data-maj-ok]').onclick = () => { clearInterval(alerteMaj); installerMaj(v); };
    b.querySelector('[data-maj-plus-tard]').onclick = () => { clearInterval(alerteMaj); b.remove(); reporteJusqua = Date.now() + 30 * 60000; };
  }
  async function rechargerSiNouvelle(attendue, bouton) {
    const v = await versionEnLigne(); if (!v || v === VERSION || (attendue && v !== attendue)) return false;
    if (!bouton && Date.now() < reporteJusqua) return true;
    montrerAlerteMaj(v); return true;
  }
  function attendreVersion(v) {
    versionAttendue = v; clearInterval(surveillance); let n = 0;
    surveillance = setInterval(async () => { n++; if (await rechargerSiNouvelle(versionAttendue) || n > 40) clearInterval(surveillance); }, 15000);
    rechargerSiNouvelle(v);
  }
  sb.channel('fmd-deploiement').on('broadcast', { event: 'nouvelle-version' }, (m) => { const v = m && m.payload && m.payload.version; if (v && v !== VERSION) attendreVersion(v); }).subscribe();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rechargerSiNouvelle(null); });
  window.FMDMobile = { version: VERSION, rechargerSiNouvelle };

  // ================= démarrage =================
  let demarre = null;
  sb.auth.onAuthStateChange((evt, session) => {
    if (session && session.user) { if (demarre !== session.user.id) { demarre = session.user.id; demarrer(session).catch((e) => { console.error(e); ecranConnexion('Erreur de chargement : ' + e.message); }); } }
    else { demarre = null; S.user = null; S.profil = null; ecranConnexion(); }
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
