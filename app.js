// FMD Mobile V2 (25/11/2026) — appli web installable pour iPhone, Android et tablette (demande : « je veux que ça soit
// disponible sur Android comme sur iOS, que tout soit synchro avec le PC, en version téléphone, sur mon iPhone ce soir »).
// Mêmes comptes, mêmes données que le logiciel FMD sur PC (Supabase) : rien n'est gardé sur le téléphone à part la session.
// Écrans : Accueil (widgets), Agenda, Tâches, Messages. Le CRM est lu en lecture seule (chiffre du mois, commandes).
// D.A. FMD Signature (maquette V2 : https://claude.ai/artifact/6T9TEbxaE1DHg7L7GVLF56). Détail : cerveau/Mobile.md.
(function () {
  'use strict';
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

  const ICO = {
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
  };
  const ico = (n, t = 22, w = 2) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n] || ''}</svg>`;

  const S = { user: null, profil: null, profils: [], route: 'accueil', conv: null, messages: [], taches: [], evts: [], crm: null, jour: aujISO(), canal: null, urls: {}, feuille: null };
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
      <button class="btn-metal" type="submit">Se connecter</button></form></div>`;
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
    const h = location.hash.slice(1); if (/^(accueil|agenda|taches|messages)$/.test(h)) S.route = h;
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
    const page = S.route === 'agenda' ? pageAgenda() : S.route === 'taches' ? pageTaches() : (S.route === 'messages' || S.route === 'conv') ? pageMessages() : pageAccueil();
    app.classList.toggle('en-conversation', S.route === 'conv');
    app.innerHTML = `<div class="coquille">${page}</div>${dock()}${S.route === 'agenda' || S.route === 'taches' ? `<button type="button" class="flottant" data-ajouter aria-label="${S.route === 'agenda' ? 'Nouveau rendez-vous' : 'Nouvelle tâche'}">${ico('plus', 26, 2.4)}</button>` : ''}${S.feuille ? S.feuille : ''}`;
    const t = app.querySelector('[data-texte]'); if (t) { t.value = brouillon; if (focus) t.focus(); }
    const f2 = app.querySelector('.fil'); if (f2) f2.scrollTop = garderDefilement && yFil !== null && !enBas ? yFil : f2.scrollHeight;
    if (garderDefilement) window.scrollTo(0, y);
    chargerImages();
    if (S.route === 'conv' && S.conv && document.visibilityState === 'visible') marquerLus(S.conv);
    if (location.hash.slice(1) !== S.route && S.route !== 'conv') history.replaceState(null, '', '#' + S.route);
  }
  function aller(r) { S.route = r; S.feuille = null; rendre(); window.scrollTo(0, 0); }

  function dock() {
    const n = nonLus();
    const b = (r, nom, lib) => `<button type="button" data-aller="${r}" class="${S.route === r || (r === 'messages' && S.route === 'conv') ? 'actif' : ''}" aria-label="${lib}">${ico(nom, 22)}<span>${lib}</span>${r === 'messages' && n ? `<span class="badge">${n}</span>` : ''}</button>`;
    return `<nav class="dock" aria-label="Navigation">${b('accueil', 'accueil', 'Accueil')}${b('agenda', 'agenda', 'Agenda')}${b('taches', 'taches', 'Tâches')}${b('messages', 'messages', 'Messages')}<button type="button" data-compte aria-label="Mon compte">${ico('compte', 22)}<span>Compte</span></button></nav>`;
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
        <section class="widget" aria-label="Tâches"><div class="tete"><h2>Tâches</h2><small>${S.taches.filter((t) => !t.fait).length} restantes</small></div>${taches.length ? taches.map(ligneTache).join('') : '<p class="vide">Tout est fait.</p>'}</section>
        <section class="widget large" aria-label="Commandes à suivre"><div class="tete"><h2>Commandes à suivre</h2><small>CRM</small></div>${cmds.length ? `<div class="cartes">${cmds.map((c) => `<div class="carte-blanche"><div class="l1"><b>${esc(c.tiers)}</b><span class="etat ${c.etat[1]}">${esc(c.etat[0])}</span></div><small>${esc(c.ref)} · ${euros(c.ht)} HT</small></div>`).join('')}</div>` : '<p class="vide">Aucune commande en cours.</p>'}</section>
        <section class="widget" aria-label="Actions rapides"><div class="actions">
          <button type="button" class="action metal" data-nouveau-rdv>${ico('agenda', 24)}Rendez-vous</button>
          <button type="button" class="action" data-nouvelle-tache>${ico('taches', 24)}Tâche</button>
          <button type="button" class="action" data-aller="messages">${ico('messages', 24)}Écrire</button>
          <button type="button" class="action" data-aller="agenda">${ico('agenda', 24)}Agenda</button></div></section>
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
        <div class="tot"><span>HT <b>${euros(a.ht)}</b></span><span>TTC <b>${euros(a.ttc)}</b></span>${a.marge != null ? `<span>Marge <b>${euros(a.marge)}</b></span>` : ''}</div>`;
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
    ouvrirFeuille(`<h3>${esc(nomDe(S.profil))}</h3><p class="vide" style="padding:0">${esc(S.user.email || '')}</p><p class="vide" style="padding:0">Données synchronisées avec le logiciel FMD sur PC.</p>
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
    if (t.closest('[data-deconnexion]')) { S.feuille = null; if (S.canal) sb.removeChannel(S.canal); await sb.auth.signOut(); return; }
    if (t.closest('[data-actualiser]')) { S.feuille = null; await Promise.all([chargerProfils(), chargerMessages(), chargerTaches(), chargerAgenda(), chargerCRM()]); rendre(); toast('À jour avec le serveur.'); return; }
    if (t.closest('[data-ajouter]')) { if (S.route === 'agenda') feuilleRdv(); else feuilleTache(); return; }
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
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (S.profil && /^(accueil|agenda|taches|messages)$/.test(h) && h !== S.route) aller(h); });
  window.addEventListener('resize', () => { if (S.profil) rendre(true); });

  // ================= démarrage =================
  let demarre = null;
  sb.auth.onAuthStateChange((evt, session) => {
    if (session && session.user) { if (demarre !== session.user.id) { demarre = session.user.id; demarrer(session).catch((e) => { console.error(e); ecranConnexion('Erreur de chargement : ' + e.message); }); } }
    else { demarre = null; S.user = null; S.profil = null; ecranConnexion(); }
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
