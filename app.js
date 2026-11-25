// FMD Mobile V2 (25/11/2026) — appli web installable pour iPhone, Android et tablette (demande : « je veux que ça soit
// disponible sur Android comme sur iOS, que tout soit synchro avec le PC, en version téléphone, sur mon iPhone ce soir »).
// Mêmes comptes, mêmes données que le logiciel FMD sur PC (Supabase) : rien n'est gardé sur le téléphone à part la session.
// Écrans : Accueil (widgets), Agenda, Tâches, Messages. Le CRM est lu en lecture seule (chiffre du mois, commandes).
// D.A. FMD Signature (maquette V2 : https://claude.ai/artifact/6T9TEbxaE1DHg7L7GVLF56). Détail : cerveau/Mobile.md.
(function () {
  'use strict';
  const VERSION = "0.4.142"; // remplacé à la fabrication (mobile/construire.js) par la version du logiciel FMD
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
    devis: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><path d="M14 3v6h6M12 12v6M9 15h6"></path>',
    tel: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"></path>',
    carte: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"></path><circle cx="12" cy="10" r="2.5"></circle>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path>',
    cherche: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>',
  };
  const ico = (n, t = 22, w = 2) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n] || ''}</svg>`;

  const S = { user: null, profil: null, profils: [], route: 'accueil', conv: null, messages: [], taches: [], evts: [], crm: null, jour: aujISO(), canal: null, urls: {}, feuille: null,
    client: null, rechClients: '', rechStock: '', produits: [], produitsCharges: false, produitsCache: {}, devis: null };
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
    ecouter();
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
    return { ca, nb: cmds.length, objectif, pc: objectif > 0 ? Math.round((ca / objectif) * 100) : null };
  }
  function commandesASuivre() {
    const db = S.crm; if (!db) return [];
    return (db.commandes || []).filter((c) => ['validee', 'en_cours'].includes(c.etat)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3)
      .map((c) => ({ ref: c.ref, tiers: ((db.tiers || []).find((t) => t.id === c.tiers) || {}).nom || '—', ht: htDoc(c), etat: ETAT_CMD[c.etat] || [c.etat, ''] }));
  }

  // ================= rendu =================
  function rendre(garderDefilement) {
    const y = window.scrollY; const fil = app.querySelector('.fil'); const yFil = fil ? fil.scrollTop : null; const enBas = fil ? fil.scrollHeight - fil.scrollTop - fil.clientHeight < 80 : true;
    const saisie = app.querySelector('[data-texte]'); const brouillon = saisie ? saisie.value : ''; const focus = saisie && document.activeElement === saisie;
    const r = S.route;
    const page = r === 'agenda' ? pageAgenda() : r === 'taches' ? pageTaches() : (r === 'messages' || r === 'conv') ? pageMessages() : r === 'clients' ? pageClients() : r === 'client' ? pageClient() : r === 'stock' ? pageStock() : r === 'devis' ? pageDevis() : pageAccueil();
    app.classList.toggle('en-conversation', r === 'conv' || r === 'devis');
    const fl = r === 'agenda' ? 'Nouveau rendez-vous' : r === 'taches' ? 'Nouvelle tâche' : r === 'clients' || r === 'client' ? 'Nouveau devis' : '';
    const champRech = app.querySelector('[data-recherche]'); const rech = champRech && document.activeElement === champRech ? { n: champRech.dataset.recherche, pos: champRech.selectionStart } : null;
    app.innerHTML = `<div class="coquille">${page}</div>${dock()}${fl ? `<button type="button" class="flottant" data-ajouter aria-label="${fl}">${ico('plus', 26, 2.4)}</button>` : ''}${S.feuille ? S.feuille : ''}`;
    if (rech) { const c = app.querySelector(`[data-recherche="${rech.n}"]`); if (c) { c.focus(); try { c.setSelectionRange(rech.pos, rech.pos); } catch { /* */ } } }
    const t = app.querySelector('[data-texte]'); if (t) { t.value = brouillon; if (focus) t.focus(); }
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
    const b = (r, nom, lib) => `<button type="button" data-aller="${r}" class="${S.route === r || (r === 'messages' && S.route === 'conv') ? 'actif' : ''}" aria-label="${lib}">${ico(nom, 22)}<span>${lib}</span>${r === 'messages' && n ? `<span class="badge">${n}</span>` : ''}</button>`;
    const b2 = (r, nom, lib, autres) => b(r, nom, lib).replace(`class="${S.route === r ? 'actif' : ''}"`, `class="${S.route === r || (autres || []).includes(S.route) ? 'actif' : ''}"`);
    return `<nav class="dock" aria-label="Navigation">${b('accueil', 'accueil', 'Accueil')}${b2('clients', 'clients', 'Clients', ['client'])}${b('stock', 'stock', 'Stock')}${b2('agenda', 'agenda', 'Agenda', ['taches'])}${b('messages', 'messages', 'Messages')}</nav>`;
  }
  const entete = (petit, titre, retour) => `<header class="entete"><div style="display:flex;align-items:flex-end;gap:12px">${retour ? `<button type="button" class="retour" data-aller="${retour}" aria-label="Retour">${ico('retour', 20, 2.2)}</button>` : ''}<div><small>${esc(petit)}</small><h1>${titre}</h1></div></div><button type="button" class="avatar" data-compte aria-label="Mon compte">${esc(nomDe(S.profil).charAt(0).toUpperCase())}</button></header>`;

  // ---------- accueil ----------
  function pageAccueil() {
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const prenom = (S.profil.prenom || nomDe(S.profil).split(' ')[0]);
    const v = ventes();
    const pc = v && v.pc !== null ? Math.min(v.pc, 100) : 0; const circ = 2 * Math.PI * 82;
    const anneau = `<svg width="150" height="150" viewBox="0 0 200 200" role="img" aria-label="${v && v.pc !== null ? v.pc + ' % de l’objectif' : 'Objectif non défini'}"><defs><linearGradient id="anneau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7DAC5"></stop><stop offset=".5" stop-color="#C9987D"></stop><stop offset="1" stop-color="#6F4A3C"></stop></linearGradient></defs><circle cx="100" cy="100" r="82" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="16"></circle><circle cx="100" cy="100" r="82" fill="none" stroke="url(#anneau)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(circ * pc) / 100} ${circ}" transform="rotate(-90 100 100)"></circle><text x="100" y="98" text-anchor="middle" fill="#F5EFEA" font-family="Montserrat Alternates, Montserrat, sans-serif" font-size="38" font-weight="700">${v && v.pc !== null ? v.pc + ' %' : '—'}</text><text x="100" y="124" text-anchor="middle" fill="#C9AFA0" font-family="Montserrat, sans-serif" font-size="13">${v && v.pc !== null ? 'de l’objectif' : 'sans objectif'}</text></svg>`;
    const evtsJour = S.evts.filter((e) => jourISO(new Date(e.debut)) === aujISO());
    const taches = S.taches.filter((t) => !t.fait).slice(0, 4);
    const convs = conversations().filter((c) => c.dernier).slice(0, 2);
    const cmds = commandesASuivre();
    return `${entete(date, `Bonjour ${esc(prenom)}<span>.</span>`)}
      <div class="grille accueil">
        <section class="widget chaud large" aria-label="Ventes du mois"><div class="ventes">${anneau}<div class="chiffres"><span class="eti">Ventes de ${esc(new Date().toLocaleDateString('fr-FR', { month: 'long' }))}</span><span class="gros">${v ? euros(v.ca) : '—'}</span><div class="pastilles">${v && v.objectif ? `<span class="pastille">Objectif ${euros(v.objectif)}</span>` : ''}${v ? `<span class="pastille neutre">${v.nb} commande${v.nb > 1 ? 's' : ''}</span>` : '<span class="pastille neutre">CRM indisponible</span>'}</div></div></div></section>
        <section class="widget" aria-label="Aujourd’hui"><div class="tete"><h2>Aujourd’hui</h2><small>${evtsJour.length} rendez-vous</small></div>${evtsJour.length ? evtsJour.slice(0, 3).map(ligneEvt).join('') : '<p class="vide">Rien de prévu aujourd’hui.</p>'}</section>
        <section class="widget chaud" aria-label="Messages"><div class="tete"><h2>Messages</h2>${nonLus() ? `<span class="compteur">${nonLus()}</span>` : ''}</div>${convs.length ? convs.map(ligneConv).join('') : '<p class="vide">Aucun message.</p>'}</section>
        <section class="widget" aria-label="Tâches"><div class="tete"><h2>Tâches</h2><button type="button" class="lien" data-aller="taches">${S.taches.filter((t) => !t.fait).length} restantes ›</button></div>${taches.length ? taches.map(ligneTache).join('') : '<p class="vide">Tout est fait.</p>'}</section>
        <section class="widget large" aria-label="Commandes à suivre"><div class="tete"><h2>Commandes à suivre</h2><small>CRM</small></div>${cmds.length ? `<div class="cartes">${cmds.map((c) => `<div class="carte-blanche"><div class="l1"><b>${esc(c.tiers)}</b><span class="etat ${c.etat[1]}">${esc(c.etat[0])}</span></div><small>${esc(c.ref)} · ${euros(c.ht)} HT</small></div>`).join('')}</div>` : '<p class="vide">Aucune commande en cours.</p>'}</section>
        <section class="widget" aria-label="Actions rapides"><div class="actions">
          <button type="button" class="action metal" data-nouveau-devis>${ico('devis', 24)}Nouveau devis</button>
          <button type="button" class="action" data-nouveau-rdv>${ico('agenda', 24)}Rendez-vous</button>
          <button type="button" class="action" data-nouvelle-tache>${ico('taches', 24)}Tâche</button>
          <button type="button" class="action" data-aller="taches">${ico('taches', 24)}Mes tâches</button></div></section>
      </div>`;
  }
  const couleurEvt = (e) => (e.masque ? 'gris' : e.couleur === 'bleu' ? 'bleu' : e.couleur === 'vert' ? 'vert' : '');
  const ligneEvt = (e) => `<div class="ligne-evt"><span class="barre ${couleurEvt(e)}"></span><div><b>${esc(e.titre)}</b><span>${e.journee ? 'Toute la journée' : `${heureFR(e.debut)} – ${heureFR(e.fin)}`}${e.lieu ? ' · ' + esc(e.lieu) : ''}</span></div></div>`;
  function ligneTache(t) {
    const d = t.date_prevue ? new Date(t.date_prevue + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const de = t.de && t.de !== moi() ? 'de ' + nomDe(profil(t.de)) : '';
    return `<div class="tache ${t.fait ? 'faite' : ''}"><button type="button" class="coche ${t.fait ? 'faite' : ''}" data-cocher="${t.id}" aria-label="${t.fait ? 'Marquer à faire' : 'Marquer fait'} : ${esc(t.titre)}">${t.fait ? ico('coche', 16, 3) : ''}</button><div class="txt"><b>${t.priorite === 'urgente' ? '<span class="urgent">Urgent</span>' : ''}${esc(t.titre)}</b>${d || de || t.heure ? `<small>${[d, t.heure ? String(t.heure).slice(0, 5) : '', de].filter(Boolean).join(' · ')}</small>` : ''}</div></div>`;
  }

  // ---------- agenda ----------
  function pageAgenda() {
    const debut = new Date(); debut.setHours(12, 0, 0, 0); debut.setDate(debut.getDate() - ((debut.getDay() + 6) % 7));
    const jours = Array.from({ length: 14 }, (_, i) => { const d = new Date(debut); d.setDate(d.getDate() + i); return d; });
    const sel = S.jour; const evts = S.evts.filter((e) => jourISO(new Date(e.debut)) === sel);
    const taches = S.taches.filter((t) => t.date_prevue === sel);
    const titre = new Date(sel + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${entete('Agenda', esc(titre.charAt(0).toUpperCase() + titre.slice(1)))}
      <div class="jours" role="group" aria-label="Choisir un jour">${jours.map((d) => { const iso = jourISO(d); const n = S.evts.filter((e) => jourISO(new Date(e.debut)) === iso).length; return `<button type="button" data-jour="${iso}" class="${iso === sel ? 'actif' : ''}" aria-label="${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}">${d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}<b>${d.getDate()}</b>${n ? '•' : '&nbsp;'}</button>`; }).join('')}</div>
      <div class="grille"><section class="widget"><div class="tete"><h2>Rendez-vous</h2><small>${evts.length}</small></div>${evts.length ? evts.map(ligneEvt).join('') : '<p class="vide">Aucun rendez-vous ce jour-là.</p>'}</section>
      ${taches.length ? `<section class="widget"><div class="tete"><h2>Tâches du jour</h2></div>${taches.map(ligneTache).join('')}</section>` : ''}</div>`;
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
  function ligneConv(c) {
    const d = c.dernier;
    const apercu = !d ? 'Aucun message' : `${d.de === moi() ? (d.lu_le ? '✓✓ ' : '✓ ') : ''}${resume(d)}`;
    return `<button type="button" class="conv ${S.conv === c.p.id && S.route === 'conv' ? 'actif' : ''}" data-conv="${c.p.id}"><span class="rond">${esc(nomDe(c.p).charAt(0).toUpperCase())}</span><span class="txt"><b>${esc(nomDe(c.p))}</b><small>${esc(apercu)}</small></span><span class="droite">${d ? heureFR(d.created_at) : ''}${c.n ? `<span class="compteur">${c.n}</span>` : ''}</span></button>`;
  }
  function pageMessages() {
    const liste = `<section class="widget"><div class="convs">${conversations().map(ligneConv).join('') || '<p class="vide">Aucun collègue.</p>'}</div></section>`;
    if (S.route === 'conv' && S.conv) {
      const fil = pageFil();
      return tablette() ? `${entete('Messagerie', 'Messages')}<div class="messages-split">${liste}<section class="widget">${fil}</section></div>` : fil;
    }
    return `${entete('Messagerie', 'Messages')}${tablette() ? `<div class="messages-split">${liste}<section class="widget"><p class="vide">Choisissez un collègue.</p></section></div>` : liste}`;
  }
  function pageFil() {
    const p = profil(S.conv); const fil = S.messages.filter((m) => (m.de === S.conv || m.a === S.conv) && visible(m));
    const dernierMoi = [...fil].reverse().find((m) => m.de === moi());
    let jour = '';
    const bulles = fil.map((m) => {
      const j = new Date(m.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const sep = j !== jour ? `<div class="jour">${esc(j)}</div>` : ''; jour = j;
      const mien = m.de === moi();
      const etat = mien ? (m.lu_le ? ` · <b>✓✓ Vu à ${heureFR(m.lu_le)}</b>` : ` · ✓ Envoyé${m === dernierMoi ? ', pas encore vu' : ''}`) : '';
      const a = m.lien && m.lien.apercu;
      if (a) return `${sep}<div class="bulle bulle-carte ${mien ? 'moi' : 'lui'}" data-msg="${m.id}" style="align-self:${mien ? 'flex-end' : 'flex-start'}">${carteControle(m, a)}<div class="meta">${heureFR(m.created_at)}${etat}</div></div>`;
      return `${sep}<div class="bulle ${mien ? 'moi' : 'lui'}" data-msg="${m.id}">${piece(m.piece)}${m.texte ? esc(m.texte).replace(/\n/g, '<br>') : ''}${m.lien && m.lien.controle && !mien && !dejaControle(m) ? `<div class="actions-carte"><button type="button" class="btn-verre" data-controle="${m.id}">✓ Contrôlé</button></div>` : ''}<div class="meta">${heureFR(m.created_at)}${etat}</div></div>`;
    }).join('');
    return `<div class="fil-page"><div class="fil-tete">${tablette() ? '' : `<button type="button" class="retour" data-aller="messages" aria-label="Retour">${ico('retour', 20, 2.2)}</button>`}<span class="rond">${esc(nomDe(p).charAt(0).toUpperCase())}</span><div><b>${esc(nomDe(p))}</b></div></div>
      <div class="fil">${bulles || `<p class="vide" style="align-self:center">Écrivez votre premier message à ${esc(nomDe(p))}.</p>`}</div>
      <form class="saisie" data-envoi><button type="button" class="rond-btn" data-joindre aria-label="Joindre un fichier">${ico('trombone', 20)}</button><button type="button" class="rond-btn" data-photo aria-label="Envoyer une photo">${ico('photo', 20)}</button>
        <input type="file" hidden data-fichier multiple><input type="file" hidden data-fichier-photo accept="image/*">
        <textarea data-texte rows="1" placeholder="Message…" aria-label="Message"></textarea><button type="submit" class="rond-btn metal" aria-label="Envoyer">${ico('envoyer', 20, 2.2)}</button></form></div>`;
  }
  const dejaControle = (m) => S.messages.some((x) => x.de === moi() && x.a === m.de && x.lien && x.lien.reponse && x.lien.route === m.lien.route && x.created_at >= m.created_at);
  function carteControle(m, a) {
    const auteur = nomDe(profil(m.de));
    const corps = a.type === 'tiers'
      ? `<div class="l1"><span class="rond" style="width:40px;height:40px;font-size:15px">${esc(String(a.ref || '?').charAt(0))}</span><div><small>${esc(a.titre)} créé par ${esc(auteur)}</small><b>${esc(a.ref)}</b></div></div><small>${esc([a.adresse, a.ville].filter(Boolean).join(', '))}${a.tel ? ' · ' + esc(a.tel) : ''}</small>`
      : `<div class="l1"><div style="flex:1"><small>${esc(a.titre)} de ${esc(auteur)}</small><b>${esc(a.ref)}</b></div></div><small>${esc(a.role)} : <b>${esc(a.tiers || '—')}</b>${a.ville ? ' · ' + esc(a.ville) : ''}</small>
        <table>${(a.lignes || []).slice(0, 6).map((l) => `<tr><td>${l.ref ? `<b>${esc(l.ref)}</b> ` : ''}${esc(l.desc)} × ${l.qte}</td><td>${euros(l.ht)}</td></tr>`).join('')}${(a.nb || 0) > 6 ? `<tr><td colspan="2">… et ${a.nb - 6} autres lignes</td></tr>` : ''}</table>
        <div class="tot"><span>HT <b>${euros(a.ht)}</b></span><span>TTC <b>${euros(a.ttc)}</b></span>${a.marge != null ? blocMarge(a.marge) : ''}</div>`;
    const ctrl = m.lien.controle && m.a === moi() ? (dejaControle(m) ? '<span class="ok-controle">✓ Contrôlé</span>' : `<button type="button" class="btn-verre" data-controle="${m.id}">✓ Contrôlé</button>`) : '';
    return `<div class="controle-quoi">🔎 À contrôler</div><div class="carte-controle">${corps}</div>${ctrl ? `<div class="actions-carte">${ctrl}</div>` : ''}`;
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
      <label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="clients" value="${esc(S.rechClients)}" placeholder="Nom, ville, téléphone…" aria-label="Rechercher un client"></label>
      <section class="widget">${!S.crm ? '<p class="vide">CRM indisponible (pas de connexion au serveur).</p>' : l.length ? `<div class="convs">${l.map((t) => `<button type="button" class="conv" data-fiche-client="${esc(t.id)}">${avatarTiers(t)}<span class="txt"><b>${esc(t.nom)}</b><small>${esc([t.prospect && !t.client ? 'Prospect' : 'Client', t.ville, t.tel].filter(Boolean).join(' · '))}</small></span><span class="droite">›</span></button>`).join('')}</div>` : '<p class="vide">Aucun client trouvé.</p>'}</section>`;
  }
  function pageClient() {
    const t = tiersDe(S.client); if (!t) return `${entete('CRM', 'Client', 'clients')}<section class="widget"><p class="vide">Fiche introuvable.</p></section>`;
    const db = S.crm; const an = aujISO().slice(0, 4);
    const docs = [...(db.propositions || []).map((d) => ({ ...d, _t: 'Devis' })), ...(db.commandes || []).map((d) => ({ ...d, _t: 'Commande' })), ...(db.factures || []).map((d) => ({ ...d, _t: 'Facture', etat: d.payee ? 'payee' : 'impayee' }))]
      .filter((d) => d.tiers === t.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const ca = (db.commandes || []).filter((c) => c.tiers === t.id && c.etat !== 'brouillon' && c.etat !== 'annulee' && String(c.date).slice(0, 4) === an).reduce((s, c) => s + htD(c), 0);
    const encours = (db.factures || []).filter((f) => f.tiers === t.id && !f.payee).reduce((s, f) => s + ttcD(f), 0);
    const adresse = [t.adresse, t.cp, t.ville].filter(Boolean).join(' ');
    return `${entete(t.prospect && !t.client ? 'Prospect' : 'Client', esc(t.nom), 'clients')}
      <div class="grille accueil">
        <section class="widget chaud large"><div style="display:flex;align-items:center;gap:14px">${avatarTiers(t, 64)}<div style="min-width:0"><b style="font-size:18px">${esc(t.nom)}</b><div class="vide" style="padding:2px 0">${esc([adresse, t.code_client].filter(Boolean).join(' · ') || '—')}</div></div></div>
          <div class="pastilles" style="margin-top:12px">${t.tel || t.portable ? `<a class="btn-verre" href="tel:${esc(String(t.tel || t.portable).replace(/\s/g, ''))}">${ico('tel', 18)}Appeler</a>` : ''}${adresse ? `<a class="btn-verre" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}" target="_blank" rel="noopener">${ico('carte', 18)}Itinéraire</a>` : ''}${t.email ? `<a class="btn-verre" href="mailto:${esc(t.email)}">${ico('mail', 18)}E-mail</a>` : ''}<button type="button" class="btn-metal" style="min-height:44px;font-size:14px" data-nouveau-devis="${esc(t.id)}">${ico('plus', 18, 2.4)}Nouveau devis</button></div></section>
        <section class="widget"><div class="tete"><h2>Cette année</h2></div><div class="ventes"><div class="chiffres"><span class="gros">${euros(ca)}</span><span class="vide" style="padding:0">CA HT (commandes)</span></div></div></section>
        <section class="widget"><div class="tete"><h2>Encours</h2></div><div class="ventes"><div class="chiffres"><span class="gros">${euros(encours)}</span><span class="vide" style="padding:0">factures non payées TTC</span></div></div></section>
        <section class="widget large"><div class="tete"><h2>Devis, commandes, factures</h2><small>${docs.length}</small></div>${docs.length ? `<div class="cartes">${docs.slice(0, 12).map((d) => { const e = ETATS_DOC[d.etat] || [d.etat || '', '']; return `<div class="carte-blanche"><div class="l1"><b>${esc(d.ref)}</b><span class="etat ${e[1]}">${esc(e[0])}</span></div><small>${esc(d._t)} · ${d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR') : ''} · ${euros(htD(d))} HT</small><small>${esc(((d.lignes || [])[0] || {}).desc || '')}${(d.lignes || []).length > 1 ? ` + ${(d.lignes || []).length - 1}` : ''}</small></div>`; }).join('')}</div>` : '<p class="vide">Aucun document.</p>'}</section>
        ${t.note_pub || t.cond || t.mode ? `<section class="widget"><div class="tete"><h2>Conditions</h2></div><p class="vide" style="padding:0">${esc([t.remise ? `Remise ${t.remise} %` : 'Prix net', t.cond, t.mode].filter(Boolean).join(' · '))}</p></section>` : ''}
      </div>`;
  }

  // ---------- stock (produits : table crm_produits) ----------
  const prixNet = (p) => +((p && p.prix) || [])[0] || 0;
  const emplacements = (p) => (p.emplacements3d || []).filter((e) => e && e.rayon).map((e) => `${e.rayon} · niv. ${e.niveau || 1} · case ${e.case || 1}${e.qte ? ` (${e.qte})` : ''}`);
  const imageProduit = (p, t = 64) => (p.image && /^(data:image|https:)/.test(p.image) ? `<img src="${esc(p.image)}" alt="" style="width:${t}px;height:${t}px;object-fit:contain;border-radius:14px;background:#fff">` : `<span style="width:${t}px;height:${t}px;flex:none;border-radius:14px;background:radial-gradient(120% 90% at 50% 15%,#fff,#f3ece7 45%,#d9cbc2);display:grid;place-items:center;color:#6F4A3C">${ico('stock', Math.round(t / 2.6))}</span>`);
  async function chercherProduits(q, limite = 60) {
    const propre = String(q || '').replace(/[,()*%\\]/g, ' ').trim();
    let r = sb.from('crm_produits').select('id,data').eq('supprime', false).limit(limite);
    if (propre) r = r.or(`ref.ilike.%${propre}%,ean.ilike.%${propre}%,data->>libelle.ilike.%${propre}%,marque.ilike.%${propre}%`);
    const { data, error } = await r; if (error) throw new Error(error.message);
    const l = (data || []).map((x) => x.data).filter((p) => p && p.id && p.en_vente !== false);
    l.forEach((p) => { S.produitsCache[p.id] = p; }); return l;
  }
  let minuteurStock = null;
  function lancerRechercheStock() {
    clearTimeout(minuteurStock);
    minuteurStock = setTimeout(async () => { try { S.produits = await chercherProduits(S.rechStock, S.rechStock ? 60 : 400); S.produitsCharges = true; } catch (e) { S.produits = []; S.produitsCharges = 'erreur'; toast('Catalogue : ' + e.message); } if (S.route === 'stock' || (S.route === 'devis' && S.devis && S.devis.etape === 2)) rendre(true); }, 300);
  }
  function pageStock() {
    if (!S.produitsCharges) lancerRechercheStock();
    const l = S.produits; const alertes = S.rechStock ? [] : l.filter((p) => +p.alerte > 0 && (+p.stock || 0) < +p.alerte);
    const carte = (p) => `<button type="button" class="ligne-produit" data-produit="${esc(p.id)}">${imageProduit(p)}<span class="txt"><b>${esc(p.libelle || p.ref)}</b><small>${esc(p.ref || '')}${emplacements(p)[0] ? ' · ' + esc(emplacements(p)[0]) : ''}</small></span><span class="droite"><b class="${+p.alerte > 0 && (+p.stock || 0) < +p.alerte ? 'bas' : ''}">${(+p.stock || 0).toLocaleString('fr-FR')}</b><small>en stock</small></span></button>`;
    return `${entete('Catalogue', 'Stock')}
      <label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="stock" value="${esc(S.rechStock)}" placeholder="Où est ce produit ? Réf., nom, code-barres" aria-label="Chercher un produit"></label>
      ${alertes.length ? `<div class="groupe retard">À réapprovisionner ${alertes.length}</div><section class="widget">${alertes.slice(0, 8).map(carte).join('')}</section>` : ''}
      <div class="groupe">${S.rechStock ? 'Résultats' : 'Produits'} ${S.produitsCharges === true ? l.length : ''}</div>
      <section class="widget">${S.produitsCharges === true ? (l.length ? l.slice(0, 60).map(carte).join('') : '<p class="vide">Aucun produit trouvé.</p>') : S.produitsCharges === 'erreur' ? '<p class="vide">Catalogue indisponible.</p>' : '<p class="vide">Chargement du catalogue…</p>'}</section>`;
  }
  function feuilleProduit(id) {
    const p = S.produitsCache[id]; if (!p) return;
    const empl = emplacements(p);
    ouvrirFeuille(`<div style="display:flex;gap:14px;align-items:center">${imageProduit(p, 84)}<div><h3>${esc(p.libelle || p.ref)}</h3><p class="vide" style="padding:0">${esc([p.ref, p.marque, p.code_barres].filter(Boolean).join(' · '))}</p></div></div>
      <div class="pastilles"><span class="pastille">${(+p.stock || 0).toLocaleString('fr-FR')} en stock</span>${+p.alerte ? `<span class="pastille neutre">seuil ${p.alerte}</span>` : ''}<span class="pastille neutre">${euros(prixNet(p))} HT</span></div>
      <div><b style="font-size:14px">Emplacement</b><p class="vide" style="padding:4px 0">${empl.length ? empl.map(esc).join('<br>') : 'Pas encore rangé dans le magasin 3D.'}</p></div>
      <button class="btn-verre" type="button" data-fermer>Fermer</button>`);
  }

  // ---------- devis en 3 étapes (même logique que le CRM du PC : js/erp-commerce.js, erp-donnees.js, erp-prix.js) ----------
  function nouveauDevis(tiersId) { S.devis = { etape: tiersId ? 2 : 1, tiers: tiersId || null, lignes: [], note: '' }; if (!S.produitsCharges) lancerRechercheStock(); S.route = 'devis'; S.feuille = null; rendre(); window.scrollTo(0, 0); }
  function prixPour(tiersId, p) { // D.prixPour : prix négocié client > prix promo en cours > prix net (+ remise client)
    const t = tiersDe(tiersId) || {}; const remise = +t.remise || 0; const j = aujISO();
    const spec = ((S.crm && S.crm.prixClients) || []).find((x) => x.tiers === tiersId && x.produit === p.id);
    if (spec) return { pu: +spec.pu, remise, auto: 'prix client' };
    if (+p.prix_promo > 0 && (!p.promo_du || p.promo_du <= j) && (!p.promo_au || p.promo_au >= j)) return { pu: +p.prix_promo, remise: 0, auto: 'prix promo' };
    return { pu: prixNet(p), remise, auto: 'prix net' };
  }
  const prixRevient = (p) => { if (!p) return 0; if (+p.pmp > 0) return +p.pmp; const f = (p.fournisseurs || []).map((x) => (+x.pu || 0) * (1 - (+x.remise || 0) / 100)).filter((x) => x > 0); return f.length ? rond2(Math.min(...f)) : 0; };
  function pageDevis() {
    const d = S.devis; if (!d) return pageAccueil();
    const t = tiersDe(d.tiers);
    const etapes = `<ol class="etapes" aria-label="Étapes">${['Client', 'Produits', 'Envoyer'].map((n, i) => `<li class="${d.etape === i + 1 ? 'actif' : d.etape > i + 1 ? 'fait' : ''}">${d.etape > i + 1 ? '✓' : i + 1}<span>${n}</span></li>`).join('')}</ol>`;
    const tete = `<div class="fil-tete" style="border:0;padding:0 0 8px"><button type="button" class="retour" data-devis-retour aria-label="Retour">${ico('retour', 20, 2.2)}</button><b style="font:700 22px var(--titre)">Nouveau devis</b></div>${etapes}`;
    const total = { ht: htD(d), ttc: ttcD(d), marge: rond2(htD(d) - d.lignes.reduce((s, l) => s + prixRevient(S.produitsCache[l.produit]) * l.qte, 0)) };
    if (d.etape === 1) {
      const q = normaliser(S.rechClients);
      const l = ((S.crm && S.crm.tiers) || []).filter((x) => (x.client || x.prospect) && (!q || normaliser([x.nom, x.ville, x.code_client].join(' ')).includes(q))).sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr')).slice(0, 60);
      return `${tete}<label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="clients" value="${esc(S.rechClients)}" placeholder="Choisir le client…" aria-label="Choisir le client"></label>
        <section class="widget"><div class="convs">${l.map((x) => `<button type="button" class="conv" data-devis-client="${esc(x.id)}">${avatarTiers(x)}<span class="txt"><b>${esc(x.nom)}</b><small>${esc([x.ville, x.remise ? `remise ${x.remise} %` : 'prix net'].filter(Boolean).join(' · '))}</small></span><span class="droite">›</span></button>`).join('') || '<p class="vide">Aucun client.</p>'}</div></section>`;
    }
    const recap = `<section class="widget chaud panier"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">${avatarTiers(t, 44)}<div style="flex:1;min-width:0"><b>${esc(t ? t.nom : '—')}</b><div class="vide" style="padding:0;font-size:12px">${esc(t && t.remise ? `remise client ${t.remise} %` : 'prix net')}</div></div>${d.etape === 2 ? '<button type="button" class="btn-verre" data-devis-etape="1">Changer</button>' : ''}</div>
      ${d.lignes.map((l, i) => `<div class="ligne-devis"><div class="txt"><b>${esc(l.desc)}</b><small>${euros(l.pu)}${l.remise ? ` −${l.remise} %` : ''} · ${esc(l.auto)}</small></div><div class="stepper" role="group" aria-label="Quantité"><button type="button" data-qte="${i}" data-pas="-1" aria-label="Retirer un">−</button><span>${l.qte}</span><button type="button" data-qte="${i}" data-pas="1" aria-label="Ajouter un">+</button></div></div>`).join('') || '<p class="vide">Ajoutez des produits.</p>'}
      <div class="totaux"><span>Total HT <b>${euros(total.ht)}</b></span>${blocMarge(total.marge)}<span class="ttc">TTC <b>${euros(total.ttc)}</b></span></div></section>`;
    if (d.etape === 2) {
      if (!S.produitsCharges) lancerRechercheStock();
      const dans = new Map(d.lignes.map((l) => [l.produit, l.qte]));
      const prods = S.produitsCharges === true ? S.produits.slice(0, 40).map((p) => { const px = prixPour(d.tiers, p); return `<div class="carte-produit">${imageProduit(p, 72)}<div class="txt"><b>${esc(p.libelle || p.ref)}</b><small>${esc(p.ref || '')} · stock ${(+p.stock || 0).toLocaleString('fr-FR')}</small><b class="prix">${euros(px.pu)}${px.remise ? ` <small>−${px.remise} %</small>` : ''}</b></div><button type="button" class="ajout ${dans.has(p.id) ? 'dans' : ''}" data-ajout-produit="${esc(p.id)}" aria-label="Ajouter ${esc(p.libelle || p.ref)}">${dans.has(p.id) ? '×' + dans.get(p.id) : '+'}</button></div>`; }).join('') : '<p class="vide">Chargement du catalogue…</p>';
      return `${tete}<div class="devis-grille"><div><label class="recherche">${ico('cherche', 18)}<input type="search" data-recherche="stock" value="${esc(S.rechStock)}" placeholder="Chercher un produit ou un code-barres" aria-label="Chercher un produit"></label><div class="produits-grille">${prods}</div></div>
        <div>${recap}<button type="button" class="btn-metal plein" data-devis-etape="3" ${d.lignes.length ? '' : 'disabled'}>Continuer ›</button></div></div>`;
    }
    const controleur = S.profil && S.profil.controle_par && profil(S.profil.controle_par);
    return `${tete}${recap}
      <section class="widget"><label class="champ">Note sur le devis (visible par le client)<textarea data-devis-note rows="3" maxlength="2000">${esc(d.note)}</textarea></label><p class="vide">Valable 15 jours. ${t && t.cond ? 'Paiement : ' + esc(t.cond) + '.' : ''}</p></section>
      <button type="button" class="btn-metal plein" data-devis-valider>${controleur ? `Valider et envoyer à ${esc(nomDe(controleur))}` : 'Valider le devis'}</button>
      <button type="button" class="btn-verre plein" data-devis-brouillon>Enregistrer en brouillon</button>`;
  }
  async function clicDevis(t) {
    const d = S.devis; if (!d) return false;
    if (t.closest('[data-devis-retour]')) { if (d.etape > 1) d.etape -= 1; else if (!d.lignes.length || window.confirm('Abandonner ce devis ?')) { S.devis = null; S.route = 'accueil'; } rendre(); return true; }
    const c = t.closest('[data-devis-client]'); if (c) { d.tiers = c.dataset.devisClient; d.lignes.forEach((l) => { const p = S.produitsCache[l.produit]; if (p) Object.assign(l, prixPour(d.tiers, p)); }); d.etape = 2; S.rechStock = ''; lancerRechercheStock(); rendre(); return true; }
    const e = t.closest('[data-devis-etape]'); if (e) { d.etape = +e.dataset.devisEtape; rendre(); window.scrollTo(0, 0); return true; }
    const a = t.closest('[data-ajout-produit]');
    if (a) { const p = S.produitsCache[a.dataset.ajoutProduit]; if (!p) return true; const l = d.lignes.find((x) => x.produit === p.id);
      if (l) l.qte += 1; else d.lignes.push({ produit: p.id, desc: p.libelle || [p.modele, p.couleur, p.taille].filter(Boolean).join(' ') || p.ref, tva: 20, qte: 1, ...prixPour(d.tiers, p) });
      rendre(true); return true; }
    const q = t.closest('[data-qte]'); if (q) { const l = d.lignes[+q.dataset.qte]; if (!l) return true; l.qte += +q.dataset.pas; if (l.qte <= 0) d.lignes.splice(+q.dataset.qte, 1); rendre(true); return true; }
    if (t.closest('[data-devis-valider]') || t.closest('[data-devis-brouillon]')) { const b = t.closest('button'); b.disabled = true; const valider = !!t.closest('[data-devis-valider]');
      const n = app.querySelector('[data-devis-note]'); if (n) d.note = n.value;
      try { const r = await enregistrerDevis(d, valider); S.devis = null; S.route = 'client'; S.client = r.tiers; rendre(); toast(valider ? `Devis ${r.ref} validé${r.envoye ? ' et envoyé pour contrôle' : ''} : visible sur le PC.` : `Brouillon ${r.ref} enregistré : à finir sur le PC ou ici.`); }
      catch (er) { b.disabled = false; toast('Devis non enregistré : ' + er.message); } return true; }
    return false;
  }
  // Enregistrement dans le CRM en ligne (donnees-fmd/crm/crm.json), comme un PC : lecture de la dernière version du serveur,
  // ajout du devis, nouvelle révision (_rev / _parent) → les PC la fusionnent. Si un PC enregistre entre la lecture et l'envoi,
  // le téléphone relit et recommence (jamais d'écrasement). Puis signal « crm » aux PC ouverts et carte « À contrôler ».
  async function enregistrerDevis(d, valider) {
    const auteur = nomDe(S.profil); const pad = (n, l) => String(n).padStart(l, '0');
    for (let essai = 0; essai < 4; essai++) {
      const { data: blob, error } = await sb.storage.from('donnees-fmd').download('crm/crm.json'); if (error || !blob) throw new Error('CRM illisible (' + ((error && error.message) || 'vide') + ')');
      const db = JSON.parse(await blob.text()); const rev = db._rev;
      ['propositions', 'evenements', 'tiers'].forEach((k) => { if (!Array.isArray(db[k])) db[k] = []; }); db.compteurs = db.compteurs || {};
      const date = aujISO(); const maintenant = new Date().toISOString(); const id = 'prop' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const prov = (db.compteurs.prov || 0) + 1; let ref;
      if (valider) { db.compteurs.pr = (db.compteurs.pr || 0) + 1; ref = 'PR-' + pad(db.compteurs.pr, 8); } else { db.compteurs.prov = prov; ref = `(PROV-PR${prov})`; }
      const t = db.tiers.find((x) => x.id === d.tiers) || {};
      const fin = new Date(date + 'T12:00:00'); fin.setDate(fin.getDate() + 15);
      const o = { id, ref, tiers: d.tiers, ref_client: '', ref_fourn: '', date, cond: t.cond || '', mode: t.mode || '', expedition: '', origine: 'Mobile', delai: '', livraison: '',
        note_pub: d.note || '', note_priv: '', etat: valider ? 'ouvert' : 'brouillon', lignes: d.lignes.map((l) => ({ produit: l.produit, desc: l.desc, tva: 20, pu: rond2(l.pu), qte: l.qte, remise: +l.remise || 0, auto: l.auto })),
        liens: [], auteur, cree: maintenant, validite: 15, fin: jourISO(fin), modifie: maintenant };
      db.propositions.push(o);
      db.evenements.unshift({ id: 'ev' + Date.now().toString(36), d: maintenant, par: auteur, tiers: o.tiers, objet: { type: 'prop', id }, titre: valider ? `Proposition commerciale ${ref} validée (téléphone)` : `Proposition commerciale ${ref} créée (brouillon, téléphone)`, texte: '', type: 'auto' });
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
        const apercu = { type: 'prop', titre: 'Proposition commerciale', ref, role: 'Client', tiers: t.nom || '', ville: [t.cp, t.ville].filter(Boolean).join(' '), date, lignes: lignes.slice(0, 25), nb: lignes.length, ht: htD(o), ttc: ttcD(o), marge: rond2(htD(o) - o.lignes.reduce((s, l) => s + prixRevient(S.produitsCache[l.produit]) * l.qte, 0)) };
        const libelle = `La proposition commerciale ${ref}`;
        try { await sb.from('messages').insert({ de: moi(), a: S.profil.controle_par, texte: `🔎 À contrôler : ${auteur} vient de valider ${libelle.toLowerCase()} (${t.nom || ''}) — ${lignes.length} ligne${lignes.length > 1 ? 's' : ''}, ${euros(apercu.ht)} HT.`, lien: { module: 'crm', route: `prop/fiche/${id}`, libelle, controle: true, apercu } }); envoye = true; } catch { /* devis enregistré quand même */ }
      }
      return { ref, tiers: o.tiers, envoye };
    }
    throw new Error('le CRM change en ce moment sur un autre poste, réessayez dans quelques secondes');
  }

  // ---------- feuilles (formulaires et menus) ----------
  function ouvrirFeuille(html) { S.feuille = `<div class="feuille" data-fermer-feuille><div class="panneau" role="dialog" aria-modal="true">${html}</div></div>`; rendre(true); const i = app.querySelector('.panneau input'); if (i) i.focus(); }
  function fermerFeuille() { S.feuille = null; rendre(true); }
  function feuilleRdv() {
    const d = S.route === 'agenda' ? S.jour : aujISO();
    ouvrirFeuille(`<h3>Nouveau rendez-vous</h3><form data-form-rdv style="display:flex;flex-direction:column;gap:10px">
      <label class="champ">Titre<input name="titre" required maxlength="200"></label>
      <label class="champ">Date<input name="date" type="date" value="${d}" required></label>
      <div style="display:flex;gap:10px"><label class="champ" style="flex:1">Début<input name="debut" type="time" value="09:00" required></label><label class="champ" style="flex:1">Fin<input name="fin" type="time" value="10:00" required></label></div>
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
    if (t.closest('[data-actualiser]')) { S.feuille = null; await Promise.all([chargerProfils(), chargerMessages(), chargerTaches(), chargerAgenda(), chargerCRM()]); rendre(); toast('À jour avec le serveur.'); return; }
    if (t.closest('[data-ajouter]')) { if (S.route === 'agenda') feuilleRdv(); else if (S.route === 'clients' || S.route === 'client') nouveauDevis(S.route === 'client' ? S.client : null); else feuilleTache(); return; }
    if (t.closest('[data-nouveau-devis]')) { nouveauDevis(t.closest('[data-nouveau-devis]').dataset.nouveauDevis || null); return; }
    const fc = t.closest('[data-fiche-client]'); if (fc) { S.client = fc.dataset.ficheClient; S.route = 'client'; rendre(); window.scrollTo(0, 0); return; }
    const fp = t.closest('[data-produit]'); if (fp && S.route === 'stock') { feuilleProduit(fp.dataset.produit); return; }
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
    const r = e.target.closest('[data-recherche]'); if (!r) return;
    if (r.dataset.recherche === 'clients') { S.rechClients = r.value; rendre(true); }
    if (r.dataset.recherche === 'stock') { S.rechStock = r.value; lancerRechercheStock(); }
  });
  app.addEventListener('change', (e) => { if (e.target.matches('[data-fichier], [data-fichier-photo]')) { const f = [...e.target.files]; e.target.value = ''; envoyerFichiers(f); } });
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
      S.feuille = null; await chargerAgenda(); S.jour = f.date.value; rendre(); toast('Rendez-vous ajouté (visible aussi sur le PC).'); return;
    }
    if (f.matches('[data-form-tache]')) {
      const { error } = await sb.from('taches').insert({ titre: f.titre.value.trim(), date_prevue: f.date.value || null, priorite: f.urgente.checked ? 'urgente' : 'normale', pour: moi() });
      if (error) { toast('Non enregistré : ' + error.message); return; }
      S.feuille = null; await chargerTaches(); rendre(); toast('Tâche ajoutée.'); return;
    }
  });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (S.profil && ROUTES.test(h) && h !== 'devis' && h !== S.route) aller(h); });
  window.addEventListener('resize', () => { if (S.profil) rendre(true); });

  // ================= mises à jour (même version que le logiciel FMD sur PC) =================
  // outils/deployer.ps1 publie le PC ET cette appli avec le même numéro, puis envoie le signal « nouvelle-version » (canal
  // fmd-deploiement). L'appli attend que la nouvelle version soit en ligne (version.json) puis se recharge toute seule —
  // jamais pendant une saisie. Au retour dans l'appli, version.json est aussi vérifié (signal manqué, téléphone en veille).
  let versionAttendue = null; let surveillance = null;
  async function versionEnLigne() { try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); return r.ok ? (await r.json()).version : null; } catch { return null; } }
  const occupe = () => { const t = app.querySelector('[data-texte]'); return !!S.feuille || !!(t && t.value.trim()); };
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
