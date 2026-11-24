// FMD — application connectée (version de test)
// Comptes + session + base de données en ligne (Supabase), synchronisée en direct entre les PC.
// Modules intégrés : FMD Studio et FMD Radar (affichés par le launcher à droite du menu, code d'origine inchangé).
(function () {
  'use strict';

  const racine = document.getElementById('racine');
  const cfg = window.FMD_CONFIG || {};
  // Logiciel (.exe) : window.lanceur (launcher). Version web : window.lanceurWeb (js/web.js), même interface.
  const L = window.lanceur || window.lanceurWeb || null;
  const WEB = Boolean(L && L.web);
  // Appli tablette Android (APK, dossier tablette/, 24 nov. 2026) : window.FMD_TABLETTE posé par js/tablette.js (présent
  // seulement dans l'APK). Modules limités à la demande de l'utilisateur : CRM, Agenda, Tâches, Messagerie.
  const TABLETTE = Boolean(window.FMD_TABLETTE);
  const MODULES_TABLETTE = ['crm', 'agenda', 'taches', 'messagerie', 'apropos'];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGO = 'assets/marque/logo-fmd.png';

  // ---------- Apparence : sombre (par défaut) / clair (style du Radar) / automatique (selon Windows) ----------
  // Choix gardé sur le PC (affichage immédiat au démarrage) et dans la fiche en ligne (profils.preferences.theme).
  const CLE_THEME = 'fmd-theme';
  const mediaSombre = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const themeChoisi = () => { try { return localStorage.getItem(CLE_THEME) || 'sombre'; } catch { return 'sombre'; } };
  function appliquerTheme(choix = themeChoisi()) {
    const reel = choix === 'auto' ? (mediaSombre && !mediaSombre.matches ? 'clair' : 'sombre') : choix;
    document.documentElement.dataset.theme = reel === 'clair' ? 'clair' : 'sombre';
  }
  appliquerTheme();
  if (mediaSombre) mediaSombre.addEventListener('change', () => { if (themeChoisi() === 'auto') appliquerTheme(); });

  function notifier(texte) {
    const n = document.getElementById('notif');
    n.textContent = texte;
    n.hidden = false;
    clearTimeout(notifier.t);
    notifier.t = setTimeout(() => { n.hidden = true; }, 3600);
  }

  async function infosLanceur() {
    if (L) { try { return await L.infos(); } catch { /* ignoré */ } }
    try { const v = await (await fetch('version.json', { cache: 'no-store' })).json(); return { version: v.version, origine: 'navigateur' }; } catch { return { version: '?', origine: '?' }; }
  }

  // ---------- Hébergeur non configuré ----------
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
    racine.innerHTML = `
      <div class="centre"><div class="carte">
        <img src="${LOGO}" alt="FMD" style="width:220px">
        <h2 style="margin-top:24px">Hébergeur pas encore branché</h2>
        <p class="discret" style="margin-top:10px;font-size:13px">Le launcher fonctionne. Il reste à renseigner l'adresse et la clé publique
        du projet Supabase dans <b>app/config.js</b>, puis à publier une mise à jour.</p>
      </div></div>`;
    return;
  }

  // « Rester connecté » : coché (par défaut) = session gardée sur ce PC (localStorage) → plus besoin de se reconnecter ;
  // décoché = session gardée seulement jusqu'à la fermeture de FMD (sessionStorage).
  const CLE_RESTER = 'fmd-rester-connecte';
  const CLE_EMAIL = 'fmd-dernier-email';
  const lireLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ecrireLocal = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignoré */ } };
  const resterConnecte = () => lireLocal(CLE_RESTER) !== '0';
  const stockageSession = {
    getItem: (k) => { try { return (resterConnecte() ? localStorage : sessionStorage).getItem(k); } catch { return null; } },
    setItem: (k, v) => { try { (resterConnecte() ? localStorage : sessionStorage).setItem(k, v); } catch { /* ignoré */ } },
    removeItem: (k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* ignoré */ } },
  };
  function choisirResterConnecte(oui, email) {
    ecrireLocal(CLE_RESTER, oui ? '1' : '0');
    ecrireLocal(CLE_EMAIL, oui && email ? email : null);
    try { // ancienne session éventuelle dans l'autre rangement : effacée
      for (const s of [localStorage, sessionStorage]) Object.keys(s).filter((k) => k.startsWith('fmd-session')).forEach((k) => s.removeItem(k));
    } catch { /* ignoré */ }
  }

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fmd-session', storage: stockageSession },
  });
  if (window.FMDWeb) window.FMDWeb.sb = sb; // version web : FM'STUDIO utilise la même connexion

  let canalNotes = null;
  let canalEvenements = null;
  let canalProfils = null;
  let sessionCourante = null;
  let observateur = null;

  // Modifications des autres postes (Studio, Radar…) : reçues en direct et transmises au launcher, qui met à jour
  // le module concerné. À chaque (re)connexion au direct, on resynchronise aussi tout (événements manqués).
  function ecouterEvenements(poste) {
    if (canalEvenements || !L || !L.evenement) return;
    canalEvenements = sb.channel('evenements-fmd')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evenements' }, (p) => {
        const e = p.new || {};
        if (e.module === 'crm') { if (e.poste !== poste && window.FMDERPNuage) window.FMDERPNuage.changementDistant(); return; } // CRM : relu par la coquille (js/erp-nuage.js)
        if (e.poste && e.poste !== poste) L.evenement({ module: e.module, cle: e.cle, poste: e.poste });
      })
      .subscribe((statut) => {
        if (statut !== 'SUBSCRIBED') return;
        for (const module of ['studio', 'studio-reglages', 'radar']) L.evenement({ module, cle: '', poste: 'resynchronisation' });
        if (window.FMDERPNuage) window.FMDERPNuage.changementDistant();
      });
  }

  // ---------- Mises à jour du logiciel (nouvelles fonctionnalités) ----------
  // Quand une nouvelle version de FMD est publiée (outils/deployer.ps1), un signal est diffusé sur le canal
  // « fmd-deploiement » : chaque poste ouvert la télécharge en arrière-plan puis affiche une alerte
  // « Nouvelle mise à jour disponible ». Rien n'est imposé : « Plus tard » = installée à la fermeture de FMD,
  // et l'alerte revient toutes les 30 minutes. Les DONNÉES (projets, prospects, commandes…) ne dépendent jamais de
  // la version : elles sont toujours lues et enregistrées sur le serveur.
  let canalDeploiement = null;
  function ecouterDeploiements() {
    if (canalDeploiement || !L || !L.verifierMaj) return;
    canalDeploiement = sb.channel('fmd-deploiement')
      .on('broadcast', { event: 'nouvelle-version' }, () => L.verifierMaj())
      .subscribe((statut) => { if (statut === 'SUBSCRIBED') L.verifierMaj(); }); // à chaque (re)connexion : signal peut-être manqué
  }
  // État de la mise à jour, envoyé en continu par le launcher :
  // inconnu | recherche | a-jour | telechargement (pourcent) | prete | erreur (message)
  let maj = { etat: 'inconnu' };
  let reporteJusqua = 0;
  const texteEtatMaj = (m) => ({
    inconnu: 'Pas encore vérifié.',
    recherche: 'Recherche d’une mise à jour…',
    'a-jour': 'FMD est à jour.',
    telechargement: `Nouvelle version ${m.version} : téléchargement… ${m.pourcent || 0} %`,
    prete: `Nouvelle version ${m.version} prête à installer.`,
    erreur: `Vérification impossible : ${m.message || 'erreur inconnue'}`,
  }[m.etat] || '');

  function recevoirEtatMaj(m) {
    if (!m) return;
    maj = m;
    dessinerAlerteMaj();
    dessinerParametresMaj();
  }

  // Alerte « Nouvelle mise à jour disponible » : ouverte dès qu'une version est trouvée (même pendant le téléchargement).
  function dessinerAlerteMaj() {
    const b = document.getElementById('alerte-maj');
    if (!b || !L) return;
    const pertinente = maj.etat === 'telechargement' || maj.etat === 'prete';
    if (!pertinente || Date.now() < reporteJusqua) { if (!b.hidden) fermerAlerteMaj(); return; }
    const prete = maj.etat === 'prete';
    const deja = !b.hidden;
    b.innerHTML = `<div class="boite">
        <div class="pastille-maj">↑</div>
        <h2 id="alerte-maj-titre">Nouvelle mise à jour disponible</h2>
        <p>FMD <b>${esc(maj.version)}</b> est disponible (vous avez la ${esc(maj.installee || 'version précédente')}).
        Elle apporte de nouvelles fonctionnalités. Vos données sont en ligne : rien n'est perdu pendant la mise à jour
        ${WEB ? '(la page se recharge, 2 secondes).' : '(environ 20 secondes, FMD redémarre tout seul).'}</p>
        ${prete ? '' : `<div class="barre-maj"><i style="width:${Number(maj.pourcent) || 0}%"></i></div><p class="discret">Téléchargement… ${Number(maj.pourcent) || 0} %</p>`}
        <div class="actions">
          <button type="button" class="btn btn-metal" id="maj-maintenant" ${prete ? '' : 'disabled'}>${prete ? 'Mettre à jour maintenant' : 'Préparation…'}</button>
          <button type="button" class="btn btn-ligne" id="maj-plus-tard">Plus tard</button>
        </div>
      </div>`;
    if (!deja) { b.hidden = false; if (L.superposition) L.superposition(true); } // sinon le module ouvert passerait par-dessus
    b.querySelector('#maj-maintenant').addEventListener('click', () => { fermerAlerteMaj(); notifier(WEB ? 'Mise à jour…' : 'Installation de la mise à jour… FMD redémarre tout seul.'); L.installerMaj(); });
    b.querySelector('#maj-plus-tard').addEventListener('click', () => {
      fermerAlerteMaj();
      reporteJusqua = Date.now() + 30 * 60 * 1000;
      setTimeout(dessinerAlerteMaj, 30 * 60 * 1000 + 1000);
      notifier('D’accord : la mise à jour sera installée à la fermeture de FMD (ou depuis Paramètres).');
    });
    if (prete) b.querySelector('#maj-maintenant').focus();
  }
  function fermerAlerteMaj() {
    const b = document.getElementById('alerte-maj');
    if (!b || b.hidden) return;
    b.hidden = true; b.innerHTML = '';
    if (L && L.superposition) L.superposition(false);
  }

  if (L && L.surMajEtat) {
    L.surMajEtat(recevoirEtatMaj);
    L.majEtat().then(recevoirEtatMaj).catch(() => {});
    ecouterDeploiements(); // canal public : actif même sur l'écran de connexion
  }

  // ---------- Connexion / création de compte ----------
  let messageAuRetour = null; // ex. « compte désactivé », affiché sur l'écran de connexion qui suit la déconnexion
  function ecranConnexion(mode = 'connexion', message = null) {
    if (!message && messageAuRetour) { message = messageAuRetour; messageAuRetour = null; }
    if (canalNotes) { sb.removeChannel(canalNotes); canalNotes = null; }
    if (canalEvenements) { sb.removeChannel(canalEvenements); canalEvenements = null; }
    if (window.FMDERPNuage) window.FMDERPNuage.arreter();
    if (canalProfils) { sb.removeChannel(canalProfils); canalProfils = null; }
    if (typeof fermerAgenda === 'function') fermerAgenda();
    if (canalNotifs) { sb.removeChannel(canalNotifs); canalNotifs = null; nbNonLues = 0; }
    if (L) L.afficherModule(null);
    const creer = mode === 'creation';
    const dernierEmail = lireLocal(CLE_EMAIL) || '';
    racine.innerHTML = `
      <div class="auth">
        <section class="auth-visuel"><div class="contenu">
          <img src="${LOGO}" alt="FMD">
          <h1>Tout FMD,<br><span class="texte-metal">au même endroit.</span></h1>
          <p>Connectez-vous depuis n'importe quel PC : vos données sont sauvegardées en ligne et synchronisées en direct.</p>
        </div></section>
        <section class="auth-form"><div class="carte-auth">
          <span class="eyebrow">Espace FMD</span>
          <h2 style="font-size:26px;margin-top:12px">${creer ? 'Demander un compte' : 'Connexion'}</h2>
          <div class="onglets">
            <button type="button" data-mode="connexion" class="${creer ? '' : 'actif'}">Se connecter</button>
            <button type="button" data-mode="creation" class="${creer ? 'actif' : ''}">Demander un compte</button>
          </div>
          ${creer ? '<p class="discret" style="margin:-12px 0 18px">Votre demande sera validée par l’administrateur de FMD avant que vous puissiez utiliser le logiciel.</p>' : ''}
          ${message ? `<div class="message ${message.type}">${esc(message.texte)}</div>` : ''}
          <form id="form-auth" novalidate>
            ${creer ? `<div class="deux-champs">
              <div class="champ"><label for="prenom">Prénom</label><input id="prenom" autocomplete="given-name" required></div>
              <div class="champ"><label for="nom">Nom</label><input id="nom" autocomplete="family-name" required></div>
            </div>` : ''}
            <div class="champ"><label for="email">Adresse e-mail</label><input id="email" type="email" autocomplete="email" value="${creer ? '' : esc(dernierEmail)}" required></div>
            <div class="champ"><label for="mdp">Mot de passe${creer ? ' (8 caractères minimum)' : ''}</label>
              <input id="mdp" type="password" autocomplete="${creer ? 'new-password' : 'current-password'}" minlength="8" required></div>
            <label class="case"><input type="checkbox" id="rester" ${resterConnecte() ? 'checked' : ''}>
              <span>Rester connecté sur ce PC <span class="discret">(plus besoin de se reconnecter à l’ouverture de FMD)</span></span></label>
            <button class="btn btn-metal" style="width:100%;margin-top:6px" type="submit">${creer ? 'Envoyer ma demande' : 'Se connecter'}</button>
          </form>
        </div></section>
      </div>`;

    racine.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => ecranConnexion(b.dataset.mode)));
    racine.querySelector('#form-auth').addEventListener('submit', async (e) => {
      e.preventDefault();
      const bouton = e.target.querySelector('button[type=submit]');
      const email = racine.querySelector('#email').value.trim();
      const mdp = racine.querySelector('#mdp').value;
      const prenom = creer ? racine.querySelector('#prenom').value.trim() : '';
      const nomFamille = creer ? racine.querySelector('#nom').value.trim() : '';
      const nom = `${prenom} ${nomFamille}`.trim();
      if (!email || mdp.length < 8 || (creer && (!prenom || !nomFamille))) {
        return ecranConnexion(mode, { type: 'erreur', texte: 'Remplissez tous les champs (mot de passe : 8 caractères minimum).' });
      }
      choisirResterConnecte(racine.querySelector('#rester').checked, email);
      bouton.disabled = true;
      bouton.textContent = 'Patientez…';
      if (creer) {
        const { data, error } = await sb.auth.signUp({ email, password: mdp, options: { data: { nom, prenom, nom_famille: nomFamille } } });
        if (error) return ecranConnexion(mode, { type: 'erreur', texte: traduire(error.message) });
        if (!data.session) return ecranConnexion('connexion', { type: 'info', texte: 'Demande envoyée. Confirmez votre adresse via le lien reçu par e-mail ; l’administrateur de FMD validera ensuite votre compte.' });
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: mdp });
        if (error) return ecranConnexion(mode, { type: 'erreur', texte: traduire(error.message) });
      }
    });
  }

  function traduire(m) {
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/already registered/i.test(m)) return 'Un compte existe déjà avec cette adresse.';
    if (/Email not confirmed/i.test(m)) return "Adresse e-mail pas encore confirmée (voir le lien reçu par e-mail).";
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Pas de connexion Internet ou serveur injoignable.';
    return m;
  }

  // ---------- Application ----------
  const MODULES = [
    { id: 'studio', l: 'S', nom: 'FM’STUDIO', txt: 'Campagnes email, catalogues A5, cartes de visite.', actif: true },
    { id: 'radar', l: 'R', nom: 'FM’RADAR', txt: 'Nouvelles entreprises du 49, grandes entreprises, courriers.', actif: true },
    { id: 'agenda', l: 'A', nom: 'Agenda', txt: 'Votre agenda personnel : rendez-vous, tâches, journées.', actif: true },
    { id: 'taches', l: 'T', nom: 'Tâches', txt: 'Votre to-do rangée par date, et les tâches confiées à l’équipe.', actif: true },
    { id: 'messagerie', l: '✉', nom: 'Messagerie', txt: 'Messages instantanés entre collègues, avec notification sur le bureau.', actif: true },
    { id: 'crm', l: 'C', nom: 'CRM', txt: 'Gestion commerciale FMD façon Dolibarr : tiers, catalogue, propositions, commandes, factures, achats, stock.', actif: true },
    { id: 'renov', l: 'Rn', nom: 'FM’RENOV', txt: 'Chantiers avec sous-traitants : tableau de bord, clients, dépenses, devis et factures (base à part).', actif: true },
    { id: 'parebrise', l: 'Pb', nom: 'FM’PAREBRISE', txt: 'Dossiers bris de glace : véhicule, plaque, assurance, franchise, avancement Décl. → Payé, montants (widgets).', actif: true },
    { id: 'agentai', l: 'AI', nom: 'Agent AI', txt: 'Les employés IA de FMD : Assistant AI, Prospecteur AI, Monteur AI (bientôt).', actif: true },
    { id: 'compta', l: '€', nom: 'Compta', txt: 'Trésorerie façon Qonto : solde, transactions, prévisionnel automatique avec les factures et commandes du CRM.', actif: true },
    { id: 'frais', l: 'Nf', nom: 'Notes de frais', txt: 'Notes de frais et indemnités kilométriques : véhicules, déplacements, barème, validation et remboursements.', actif: true },
    { id: 'site', l: 'W', nom: 'Site web', txt: 'Le futur site fmdistrib.fr : catalogue et commandes en ligne (maquette).', actif: true },
  ];
  // Menu regroupé en catégories (23 nov. 2026, « Proposition de réorganisation des modules » de l'utilisateur) :
  // les modules restent distincts, seul le menu change. Un nouveau module = l'ajouter dans la catégorie de même logique.
  // ico : pictogramme au trait (viewBox 24), même style que la maquette fournie par l'utilisateur (23 nov. 2026).
  const CATEGORIES = [
    { id: 'pilotage', nom: 'Pilotage', modules: ['radar', 'agentai'], ico: 'M4 20h16M4 4v16M7.5 15.5l3.5-3.5 3 3 5.5-6.5M15.5 8.5h4v4' },
    { id: 'commercial', nom: 'Gestion commerciale', modules: ['crm', 'renov', 'parebrise'], ico: 'M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18M11 12.5v1.5h2v-1.5' },
    { id: 'organisation', nom: 'Organisation', modules: ['agenda', 'taches', 'messagerie'], ico: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 3v4M16 3v4M3 10h18M7.5 14h.01M12 14h.01M16.5 14h.01M7.5 17.5h.01M12 17.5h.01' },
    { id: 'finances', nom: 'Finances', modules: ['compta', 'frais'], ico: 'M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5.5a2.5 2.5 0 0 0 0 5H20a1 1 0 0 1 1 1v3.5M21 17v2a1 1 0 0 1-1 1H5.5A2.5 2.5 0 0 1 3 17.5V6.5M17.5 13.5H21v3.5h-3.5a1.75 1.75 0 0 1 0-3.5z' },
    { id: 'marketing', nom: 'Marketing & Digital', modules: ['studio', 'site'], ico: 'M4 10v4a1 1 0 0 0 1 1h2.5L13 19V5L7.5 9H5a1 1 0 0 0-1 1zM7.5 15l1.2 4.5M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11' },
  ];
  const categorieDe = (id) => CATEGORIES.find((c) => c.modules.includes(id));
  const icoCat = (c) => `<span class="cat-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${c.ico}"/></svg></span>`;
  // Catégories ouvertes dans le menu (préférence gardée sur le PC) ; celle du module affiché est toujours ouverte.
  const CLE_CATS = 'fmd-menu-categories';
  const catsOuvertes = () => { try { return JSON.parse(lireLocal(CLE_CATS) || '["organisation"]'); } catch { return ['organisation']; } };

  // ---------- Ordre du menu choisi par chaque utilisateur (23 nov. 2026 : « réorganiser les modules moi-même en restant
  // appuyé et en déplaçant ») : appui long (0,45 s) sur un module ou une catégorie, puis glisser. Ordre propre à chaque
  // compte, enregistré EN LIGNE (donnees-fmd/menus/<id du compte>.json) + copie sur le PC pour un affichage immédiat.
  // Format : [[id catégorie, [id module, …]], …]. Module inconnu ignoré ; module absent de l'ordre → sa catégorie d'origine.
  let ordreMenu = null; let ordreCompte = null;
  const cleOrdre = () => `fmd-menu-ordre-${utilisateur && utilisateur.user ? utilisateur.user.id : ''}`;
  const cheminOrdre = () => `menus/${utilisateur.user.id}.json`;
  function categories() {
    const uid = utilisateur && utilisateur.user && utilisateur.user.id;
    if (uid && ordreCompte !== uid) { ordreCompte = uid; try { ordreMenu = JSON.parse(lireLocal(cleOrdre()) || 'null'); } catch { ordreMenu = null; } chargerOrdreMenu(); }
    if (!Array.isArray(ordreMenu)) return CATEGORIES;
    const vus = new Set(); const res = [];
    ordreMenu.forEach((e) => { const c = Array.isArray(e) && CATEGORIES.find((x) => x.id === e[0]); if (!c || res.some((r) => r.id === c.id)) return;
      res.push({ ...c, modules: (Array.isArray(e[1]) ? e[1] : []).filter((id) => MODULES.some((m) => m.id === id) && !vus.has(id) && vus.add(id)) }); });
    CATEGORIES.forEach((c) => { if (!res.some((r) => r.id === c.id)) res.push({ ...c, modules: [] }); });
    CATEGORIES.forEach((c) => c.modules.forEach((id) => { if (!vus.has(id)) { vus.add(id); res.find((r) => r.id === c.id).modules.push(id); } }));
    return res;
  }
  async function chargerOrdreMenu() {
    const uid = ordreCompte;
    try {
      const { data, error } = await sb.storage.from('donnees-fmd').download(cheminOrdre());
      if (error || !data || uid !== ordreCompte) return; // pas encore d'ordre en ligne : ordre par défaut
      const o = JSON.parse(await data.text()); const v = Array.isArray(o.ordre) ? o.ordre : null;
      if (JSON.stringify(v) === JSON.stringify(ordreMenu)) return;
      ordreMenu = v; ecrireLocal(cleOrdre(), JSON.stringify(v)); if (!glisseEnCours) dessiner();
    } catch { /* hors ligne : copie du PC */ }
  }
  async function sauverOrdreMenu(o) {
    ordreMenu = o; if (o) ecrireLocal(cleOrdre(), JSON.stringify(o)); else { try { localStorage.removeItem(cleOrdre()); } catch { /* ignoré */ } }
    try {
      const r = o ? await sb.storage.from('donnees-fmd').upload(cheminOrdre(), new Blob([JSON.stringify({ ordre: o, modifie: new Date().toISOString() })], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' })
        : await sb.storage.from('donnees-fmd').remove([cheminOrdre()]);
      if (r.error) throw r.error;
    } catch (e) { notifier('Ordre du menu gardé sur ce PC (pas de connexion au serveur).'); }
  }
  let glisseEnCours = false;
  function brancherGlisserMenu(menu) {
    let minuteur = null, depart = null, el = null, fantome = null, type = '', dx = 0, dy = 0, bloquerClic = false, prise = null;
    const annuler = () => { clearTimeout(minuteur); minuteur = null; };
    menu.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || el) return;
      const cible = e.target.closest('.menu-cat-corps > .item, .menu-cat-tete'); if (!cible) return;
      depart = { x: e.clientX, y: e.clientY, id: e.pointerId }; prise = cible;
      minuteur = setTimeout(() => commencer(cible), 450);
    });
    function commencer(cible) {
      minuteur = null; type = cible.classList.contains('menu-cat-tete') ? 'cat' : 'mod';
      el = type === 'cat' ? cible.closest('.menu-cat') : cible; glisseEnCours = true;
      const r = el.getBoundingClientRect(); dx = depart.x - r.left; dy = depart.y - r.top;
      fantome = el.cloneNode(true); fantome.classList.add('menu-fantome'); fantome.style.width = `${r.width}px`;
      document.body.appendChild(fantome); placer(depart.x, depart.y);
      menu.classList.add('glisse'); el.classList.add('en-glisse');
      try { menu.setPointerCapture(depart.id); } catch { /* ignoré */ }
    }
    const placer = (x, y) => { fantome.style.transform = `translate(${x - dx}px, ${y - dy}px)`; };
    menu.addEventListener('pointermove', (e) => {
      // 23/11 : bouger en gardant le clic enfoncé démarre aussi le déplacement (sans attendre l'appui long)
      if (minuteur && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 8) { annuler(); if (prise) commencer(prise); }
      if (!el) return;
      e.preventDefault(); placer(e.clientX, e.clientY);
      const m = menu.getBoundingClientRect(); if (e.clientY < m.top + 40) menu.scrollTop -= 12; else if (e.clientY > m.bottom - 40) menu.scrollTop += 12;
      const t = document.elementFromPoint(e.clientX, e.clientY); if (!t || !menu.contains(t)) return;
      if (type === 'cat') {
        const c = t.closest('.menu-cat'); if (!c || c === el) return;
        const rc = c.getBoundingClientRect(); c.parentNode.insertBefore(el, e.clientY < rc.top + rc.height / 2 ? c : c.nextSibling); return;
      }
      const it = t.closest('.menu-cat-corps > .item');
      if (it && it !== el) { const ri = it.getBoundingClientRect(); it.parentNode.insertBefore(el, e.clientY < ri.top + ri.height / 2 ? it : it.nextSibling); return; }
      const c = t.closest('.menu-cat'); if (!c) return;
      const corps = c.querySelector('.menu-cat-corps'); c.classList.add('ouverte');
      if (el.parentNode !== corps) { if (t.closest('.menu-cat-tete')) corps.prepend(el); else corps.appendChild(el); }
    });
    const finir = () => {
      annuler(); prise = null; if (!el) return;
      el.classList.remove('en-glisse'); menu.classList.remove('glisse'); if (fantome) fantome.remove();
      const avant = categories();
      const o = [...menu.querySelectorAll('.menu-cat')].map((c) => { const id = c.dataset.cat; const vus = [...c.querySelectorAll('.menu-cat-corps > .item[data-mod]')].map((b) => b.dataset.mod);
        const caches = ((avant.find((x) => x.id === id) || {}).modules || []).filter((m) => !menu.querySelector(`.item[data-mod="${m}"]`)); // modules sans accès : gardés à leur place
        return [id, [...vus, ...caches]]; });
      el = null; fantome = null; glisseEnCours = false; bloquerClic = true; setTimeout(() => { bloquerClic = false; }, 400);
      const ouvertes = [...menu.querySelectorAll('.menu-cat.ouverte')].map((c) => c.dataset.cat); ecrireLocal(CLE_CATS, JSON.stringify(ouvertes));
      if (JSON.stringify(o) !== JSON.stringify(avant.map((c) => [c.id, c.modules]))) { sauverOrdreMenu(o); notifier('Menu réorganisé (enregistré pour votre compte).'); }
      setTimeout(dessiner, 0);
    };
    menu.addEventListener('pointerup', finir); menu.addEventListener('pointercancel', finir);
    menu.addEventListener('click', (e) => { if (bloquerClic) { e.stopPropagation(); e.preventDefault(); bloquerClic = false; } }, true);
    menu.addEventListener('contextmenu', (e) => { if (el || minuteur) e.preventDefault(); });
  }

  // Modules intégrés à la fenêtre (js/agenda.js, taches.js, apropos.js, crm.js, renov.js, parebrise.js, agentai.js, site.js, compta.js) :
  // UNE seule liste, utilisée partout (page affichée, montage, ouverture). Modules soumis aux droits d'accès : MODULES_DROITS.
  const MODULES_DONNEES_CRM = ['crm', 'compta', 'frais', 'renov', 'parebrise', 'site']; // données dans crm/crm.json (js/erp-nuage.js)
  const INTEGRES = ['agenda', 'taches', 'messagerie', 'apropos', 'crm', 'renov', 'parebrise', 'agentai', 'site', 'compta', 'frais'];
  // Messagerie (21 nov. 2026, js/messagerie.js) : nombre de messages non lus, affiché sur l'entrée du menu et le titre de la fenêtre.
  let nbMessages = 0;
  const majCompteurMessages = () => {
    const b = document.querySelector('.menu [data-page="messagerie"]'); if (b) { let c = b.querySelector('[data-msg-compteur]');
      if (nbMessages && !c) { c = document.createElement('span'); c.className = 'compteur msg-compteur'; c.dataset.msgCompteur = '1'; b.appendChild(c); }
      if (c) { if (nbMessages) c.textContent = nbMessages > 99 ? '99+' : String(nbMessages); else c.remove(); }
      const cc = document.querySelector('.menu [data-cat-compteur]'); if (cc) { cc.hidden = !nbMessages; cc.textContent = nbMessages > 99 ? '99+' : String(nbMessages); }
      b.title = nbMessages ? `Messagerie (${nbMessages} message${nbMessages > 1 ? 's' : ''} non lu${nbMessages > 1 ? 's' : ''})` : 'Messagerie'; }
    document.title = nbMessages ? `(${nbMessages}) FMD` : 'FMD';
  };
  const MODULES_DROITS = ['studio', 'radar', 'agenda', 'taches', 'crm', 'renov', 'parebrise', 'compta', 'frais'];
  let page = 'accueil';
  let utilisateur = null;

  // ---------- Utilisateurs, rôles, inscriptions et accès (supabase/utilisateurs.sql + supabase/validation-acces.sql) ----------
  // Hiérarchie : super_admin = Administrateur suprême (le patron : valide les inscriptions, nomme les administrateurs)
  //            > admin (fiches, rôles, accès aux modules) > direction, commercial, vendeur, comptable, magasinier.
  // Inscription : un nouveau compte est « en_attente » et n'entre pas dans FMD tant qu'il n'est pas validé.
  // Accès aux modules : roles.permissions = {"studio":true,"radar":false,…} (clé absente = autorisé ; admins = tout).
  // La base applique les mêmes règles (public.a_acces, public.est_valide) : l'écran ne fait que les refléter.
  const ROLES_ADMIN = ['admin', 'super_admin'];
  let roles = [];          // [{ code, libelle, niveau, description, permissions }]
  let registre = null;     // toutes les fiches (null = pas encore chargées)
  let registrePret = true; // false si la base n'a pas encore les tables du registre
  let ongletParam = 'general'; // Paramètres : general | utilisateurs | acces

  const roleDe = (code) => roles.find((r) => r.code === code) || null;
  const libelleRole = (code) => (roleDe(code) || {}).libelle || code || '—';
  const niveauRole = (code) => (roleDe(code) || {}).niveau || 0;
  const nomAffiche = (p, user) => (p && (p.nom || `${p.prenom || ''} ${p.nom_famille || ''}`.trim()))
    || (user && user.user_metadata && user.user_metadata.nom) || (p && p.email) || (user && user.email) || 'Utilisateur';
  const monProfil = () => (utilisateur && utilisateur.profil) || null;
  const ficheValide = (p) => !p || !p.statut || p.statut === 'valide';
  const estValide = () => ficheValide(monProfil());
  const estAdmin = () => { const p = monProfil(); return Boolean(p && ROLES_ADMIN.includes(p.role) && p.actif && ficheValide(p)); };
  const estSuperAdmin = () => { const p = monProfil(); return Boolean(p && p.role === 'super_admin' && p.actif && ficheValide(p)); };
  // Accès d'un rôle à un module (admins : tout ; clé absente : autorisé).
  const roleAAcces = (code, module) => ROLES_ADMIN.includes(code) || ((roleDe(code) || {}).permissions || {})[module] !== false;
  const aAcces = (module) => (!TABLETTE || MODULES_TABLETTE.includes(module)) && (!registrePret || !monProfil() || roleAAcces(monProfil().role, module));
  const enAttente = () => (registre || []).filter((p) => !ficheValide(p));
  const dateCourte = (d) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  function traduireBase(m) {
    m = String(m || '');
    if (/profils_identifiant_unique|duplicate key/i.test(m)) return 'Ce nom d’utilisateur est déjà pris par quelqu’un d’autre.';
    if (/profils_identifiant_format/i.test(m)) return 'Nom d’utilisateur : 2 à 30 caractères, lettres sans accent, chiffres, point, tiret ou _.';
    return traduire(m);
  }

  async function chargerRoles() {
    const { data, error } = await sb.from('roles').select('*').order('niveau', { ascending: false });
    registrePret = !error;
    roles = error ? [] : data;
  }
  async function chargerProfil(user) {
    const { data, error } = await sb.from('profils').select('*').eq('id', user.id).maybeSingle();
    return error ? null : data;
  }
  async function chargerRegistre() {
    const { data, error } = await sb.from('profils').select('*');
    if (error) { registre = []; return; }
    registre = data.sort((a, b) => (niveauRole(b.role) - niveauRole(a.role)) || nomAffiche(a).localeCompare(nomAffiche(b), 'fr'));
  }

  // Thème enregistré dans la fiche en ligne : suivi d'un PC à l'autre.
  async function changerTheme(choix) {
    try { localStorage.setItem(CLE_THEME, choix); } catch { /* ignoré */ }
    appliquerTheme(choix);
    const p = monProfil();
    if (p && 'preferences' in p) {
      const preferences = { ...(p.preferences || {}), theme: choix };
      const { data } = await sb.from('profils').update({ preferences }).eq('id', p.id).select().maybeSingle();
      if (data) utilisateur.profil = data;
    }
  }

  // Compte connecté, pour les modules (21 nov. 2026 : boîte e-mail et signature propres à chaque utilisateur, js/erp-documents.js).
  // Préférences enregistrées dans la fiche en ligne (profils.preferences) : elles suivent l'utilisateur d'un PC à l'autre.
  window.FMDCompte = {
    get id() { return utilisateur && utilisateur.user ? utilisateur.user.id : ''; },
    get nom() { return utilisateur ? utilisateur.nom : ''; },
    get email() { return utilisateur && utilisateur.user ? utilisateur.user.email : ''; },
    profil: () => monProfil() || (utilisateur && utilisateur.profil) || null,
    preference: (k) => { const p = monProfil() || (utilisateur && utilisateur.profil); return p && p.preferences ? p.preferences[k] : undefined; },
    async ecrirePreference(k, v) { const p = monProfil() || (utilisateur && utilisateur.profil); if (!p || !('preferences' in p)) return false;
      const preferences = { ...(p.preferences || {}) }; if (v === undefined || v === null) delete preferences[k]; else preferences[k] = v;
      const { data, error } = await sb.from('profils').update({ preferences }).eq('id', p.id).select().maybeSingle();
      if (error || !data) return false; utilisateur.profil = data; if (registre) { const i = registre.findIndex((x) => x.id === data.id); if (i >= 0) registre[i] = data; } return true; },
  };

  // 25/11/2026 — « tout sur le serveur » : les préférences d'affichage (ordre du menu, vues des listes, lignes par page,
  // périodes des graphiques, vue de l'agenda, réglages de la Compta, mode clair du CRM…) sont gardées dans la fiche en
  // ligne (profils.preferences.ui) et suivent l'utilisateur sur tous ses PC. La copie du PC (localStorage) n'est qu'un
  // reflet : à la connexion, la fiche en ligne la remplace. Pas concernés : la page ouverte (éphémère), « rester connecté »
  // et le dernier e-mail saisi (propres à ce PC), les données du CRM (js/erp-nuage.js).
  const RE_PREF_UI = /^fmd-(menu$|menu-categories$|crm-theme$|crm-periodes$|vue-listes$|par-page:|agenda-vue$|compta-(horizon|potentiel|depenses)$|renov-vue$|stock-(onglet|anim)$|site-(panier|favoris)$)/;
  let prefsUIActives = false; let prefsUIMinuteur = null; const prefsUIAttente = {};
  const lsSetOrig = Storage.prototype.setItem, lsRemoveOrig = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { lsSetOrig.call(this, k, v); if (prefsUIActives && this === window.localStorage && RE_PREF_UI.test(k)) noterPrefUI(k, String(v)); };
  Storage.prototype.removeItem = function (k) { lsRemoveOrig.call(this, k); if (prefsUIActives && this === window.localStorage && RE_PREF_UI.test(k)) noterPrefUI(k, null); };
  function noterPrefUI(k, v) { prefsUIAttente[k] = v; clearTimeout(prefsUIMinuteur); prefsUIMinuteur = setTimeout(envoyerPrefsUI, 3000); }
  async function envoyerPrefsUI() {
    const id = utilisateur && utilisateur.user && utilisateur.user.id; if (!id || !sb) return;
    const ch = { ...prefsUIAttente }; Object.keys(prefsUIAttente).forEach((k) => delete prefsUIAttente[k]);
    try {
      const { data: frais } = await sb.from('profils').select('preferences').eq('id', id).maybeSingle(); // version en ligne (autre PC)
      const preferences = { ...((frais && frais.preferences) || {}) }; const ui = { ...(preferences.ui || {}) };
      Object.entries(ch).forEach(([k, v]) => { if (v === null) delete ui[k]; else ui[k] = v; }); preferences.ui = ui;
      const { data } = await sb.from('profils').update({ preferences }).eq('id', id).select().maybeSingle();
      if (data && utilisateur) utilisateur.profil = data;
    } catch (e) { Object.assign(prefsUIAttente, ch); console.warn('Préférences en ligne :', e); }
  }
  function appliquerPrefsUI(profil) {
    prefsUIActives = false;
    const ui = profil && profil.preferences && profil.preferences.ui;
    if (ui && typeof ui === 'object') Object.entries(ui).forEach(([k, v]) => { if (RE_PREF_UI.test(k) && typeof v === 'string') { try { lsSetOrig.call(window.localStorage, k, v); } catch { /* ignoré */ } } });
    prefsUIActives = !!(profil && 'preferences' in profil);
  }

  function appliquerProfil(profil) {
    const theme = profil && profil.preferences && profil.preferences.theme;
    if (theme && theme !== themeChoisi()) { try { localStorage.setItem(CLE_THEME, theme); } catch { /* ignoré */ } appliquerTheme(theme); }
    const { user } = utilisateur;
    const nom = nomAffiche(profil, user);
    Object.assign(utilisateur, { profil, nom, initiale: nom.trim().charAt(0).toUpperCase(), role: profil ? profil.role : null, niveau: profil ? niveauRole(profil.role) : 0 });
  }

  // Un administrateur a désactivé ce compte : déconnexion, avec explication sur l'écran de connexion.
  async function compteDesactive() {
    messageAuRetour = { type: 'erreur', texte: 'Votre compte a été désactivé par un administrateur de FMD. Contactez-le pour retrouver l’accès.' };
    if (L) await L.afficherModule(null);
    await sb.auth.signOut();
  }

  // Compte pas encore validé (ou refusé) par l'Administrateur suprême : rien d'autre n'est accessible.
  function ecranAttente() {
    page = 'attente';
    if (L) L.afficherModule(null);
    const p = monProfil();
    const refuse = p.statut === 'refuse';
    racine.innerHTML = `
      <div class="centre"><div class="carte carte-attente">
        <img src="${LOGO}" alt="FMD" style="width:190px">
        <div><span class="pastille ${refuse ? 'pastille-refus' : ''}">${refuse ? 'Demande refusée' : 'En attente de validation'}</span></div>
        <h2>${refuse ? 'Votre demande d’inscription a été refusée' : 'Votre demande d’inscription est bien envoyée'}</h2>
        <p class="discret">${refuse
          ? 'L’administrateur de FMD n’a pas validé ce compte. Contactez-le si c’est une erreur.'
          : `Bonjour ${esc((p.prenom || utilisateur.nom).split(' ')[0])}, votre compte (${esc(p.email || utilisateur.user.email)}) doit être validé par
             l’administrateur de FMD avant de pouvoir utiliser le logiciel. Cette page s’ouvrira toute seule dès qu’il l’aura validé.`}</p>
        <button class="btn btn-ligne" id="deconnexion" type="button">Se déconnecter</button>
      </div></div>`;
    racine.querySelector('#deconnexion').addEventListener('click', () => sb.auth.signOut());
  }

  // En direct : fiches (validation, rôle, désactivation, nouvelles demandes) et accès des rôles.
  function ecouterProfils() {
    if (canalProfils || !registrePret) return;
    canalProfils = sb.channel('profils-direct')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profils' }, async (p) => {
        const moi = utilisateur && utilisateur.user.id;
        if (p.new && p.new.id === moi) {
          if (p.new.actif === false) return compteDesactive();
          const etaitValide = estValide();
          const avant = JSON.stringify([utilisateur.nom, utilisateur.role]);
          appliquerProfil(p.new);
          if (!estValide()) return ecranAttente();
          if (!etaitValide) { // inscription validée à l'instant
            await chargerRoles();
            ecouterEvenements(utilisateur.infos.poste);
            page = 'accueil';
            dessiner();
            return notifier('Votre inscription est validée : bienvenue dans FMD !');
          }
          if (JSON.stringify([utilisateur.nom, utilisateur.role]) !== avant) apresChangementDroits();
        }
        if (!estValide()) return;
        await chargerRegistre();
        rafraichirGestion();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, async () => {
        await chargerRoles();
        if (estValide()) apresChangementDroits();
      })
      .subscribe();
  }

  // Rôle ou accès modifiés : on ferme le module s'il n'est plus autorisé, et on redessine si rien n'est en cours de saisie.
  function apresChangementDroits() {
    if (MODULES_DROITS.includes(page) && !aAcces(page)) {
      notifier('Votre rôle n’a plus accès à ce module.');
      return ouvrir('accueil');
    }
    if (page === 'accueil' || (page === 'parametres' && ongletParam !== 'general')) dessiner();
    else rafraichirGestion();
  }

  async function ecranApp(session) {
    const user = session.user;
    utilisateur = { user, infos: await infosLanceur() };
    registre = null;
    ongletParam = 'general';
    await chargerRoles();
    const profil = registrePret ? await chargerProfil(user) : null;
    if (profil && profil.actif === false) return compteDesactive();
    appliquerProfil(profil);
    appliquerPrefsUI(profil); // préférences d'affichage : la fiche en ligne fait foi (25/11)
    ecouterProfils();
    if (!estValide()) return ecranAttente();
    if (estAdmin()) await chargerRegistre(); // pour la pastille « demandes en attente »
    ecouterEvenements(utilisateur.infos.poste);
    // CRM : tous les articles, tiers et documents sur le serveur (js/erp-nuage.js), si le rôle a accès au CRM.
    if (window.FMDERPNuage && aAcces('crm')) window.FMDERPNuage.demarrer({ sb, poste: utilisateur.infos.poste });
    synchroniserCles(); // clés API enregistrées en ligne → recopiées sur ce PC (supabase/cles-api.sql)
    ecouterNotifs();
    chargerNotifs();
    // Messagerie : écoute des messages dès la connexion (compteur + notification de bureau), quelle que soit la page ouverte.
    // Présence en direct (js/presence.js) : qui est sur quelle fiche / quel projet ; relais vers le Studio par le lanceur.
    if (window.FMDPresence) {
      window.FMDPresence.demarrer(sb, { id: user.id, nom: utilisateur.nom });
      if (L && L.surPresenceStudio && !presenceStudioBranchee) {
        presenceStudioBranchee = true;
        L.surPresenceStudio((id) => window.FMDPresence.etre('studio', id || null));
        window.FMDPresence.surChange(() => { try { L.presenceVersStudio(JSON.stringify(window.FMDPresence.autresTous ? window.FMDPresence.autresTous() : [])); } catch { /* Studio fermé */ } });
      }
    }
    if (window.FMDMessagerie) window.FMDMessagerie.demarrer(ctxModules(), { surCompte: (n) => { nbMessages = n; majCompteurMessages(); }, ouvrir: () => ouvrir('messagerie'), ouvrirModule: (m) => ouvrir(m) }).catch((e) => console.error('Messagerie :', e));
    page = 'accueil';
    dessiner();
  }

  // Agenda : module intégré à la coquille (js/agenda.js), pas une vue séparée du launcher comme Studio / Radar.
  let instanceAgenda = null;
  let presenceStudioBranchee = false;
  function fermerAgenda() { if (instanceAgenda) { instanceAgenda.detruire(); instanceAgenda = null; } }

  // ---------- Menu de gauche adapté à la taille de l'écran (portables, zoom Windows) ----------
  // Préférence gardée sur le PC : 'auto' (défaut : réduit aux icônes si l'écran est étroit), 'ouvert' ou 'replie'.
  const CLE_MENU = 'fmd-menu';
  const prefMenu = () => lireLocal(CLE_MENU) || 'auto';
  const MODULES_A_MENU = ['crm', 'renov', 'parebrise', 'stock', 'site', 'agentai', 'compta', 'frais']; // ont déjà leur propre menu
  function menuReduit() {
    const p = prefMenu();
    if (p === 'ouvert') return false;
    if (p === 'replie') return true;
    return window.innerWidth < 1400 || (window.innerWidth < 1700 && MODULES_A_MENU.includes(page));
  }
  function appliquerMenu() {
    const c = racine.querySelector('.coquille');
    if (!c || c.classList.contains('compacte')) return;
    c.classList.toggle('etroite', menuReduit());
    const b = c.querySelector('[data-bascule-menu] .lib');
    if (b) b.textContent = menuReduit() ? 'Agrandir le menu' : 'Réduire le menu';
  }
  function basculerMenu() {
    ecrireLocal(CLE_MENU, menuReduit() ? 'ouvert' : 'replie');
    appliquerMenu();
  }
  window.addEventListener('resize', appliquerMenu);
  // Barres d'onglets trop longues pour l'écran : la molette les fait défiler de gauche à droite.
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const b = e.target.closest && e.target.closest('.erp-modules, .onglets, .crm-haut-l1, .reseaux-onglets, [data-defile-x]');
    if (!b || b.scrollWidth <= b.clientWidth + 2) return;
    b.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  function dessiner() {
    const { user, nom, initiale, infos } = utilisateur;
    const enModule = page === 'studio' || page === 'radar';
    if (observateur) { observateur.disconnect(); observateur = null; }
    fermerAgenda();
    const demandes = estSuperAdmin() ? enAttente().filter((p) => p.statut === 'en_attente').length : 0;
    const pointParam = ['telechargement', 'prete'].includes(maj.etat) ? '<span class="point-maj" title="Mise à jour disponible"></span>'
      : demandes ? `<span class="point-maj" title="${demandes} demande(s) d’inscription en attente"></span>` : '';

    racine.innerHTML = `
      <div class="coquille ${enModule ? 'compacte' : ''} ${!enModule && menuReduit() ? 'etroite' : ''}">
        <aside class="menu">
          <img class="logo" src="${LOGO}" alt="FMD">
          <img class="logo-mini" src="assets/marque/symbole-fmd.png" alt="FMD">
          <button type="button" class="item ${page === 'accueil' ? 'actif' : ''}" data-page="accueil" title="Mon espace${nbNonLues ? ` (${nbNonLues} notification${nbNonLues > 1 ? 's' : ''})` : ''}"><span class="ico">⌂</span><span class="lib">Mon espace</span><span class="compteur compteur-notifs" ${nbNonLues ? '' : 'hidden'}>${nbNonLues}</span></button>
          ${categories().map((c) => {
            const mods = c.modules.map((id) => MODULES.find((m) => m.id === id)).filter((m) => m && aAcces(m.id));
            const ouverte = catsOuvertes().includes(c.id) || mods.some((m) => m.id === page);
            return `<div class="menu-cat${ouverte ? ' ouverte' : ''}${mods.length ? '' : ' vide'}" data-cat="${c.id}">
              <button type="button" class="section menu-cat-tete" data-cat-bascule="${c.id}" aria-expanded="${ouverte}" title="Cliquer : ouvrir / fermer · Rester appuyé puis glisser : déplacer">${icoCat(c)}<span class="cat-nom">${esc(c.nom)}</span>${mods.some((m) => m.id === 'messagerie') ? `<span class="compteur msg-compteur cat-compteur" data-cat-compteur ${nbMessages ? '' : 'hidden'}>${nbMessages > 99 ? '99+' : nbMessages}</span>` : ''}<span class="menu-cat-fleche" aria-hidden="true">›</span></button>
              <div class="menu-cat-corps">${mods.map((m) => m.actif
                ? `<button type="button" class="item ${page === m.id ? 'actif' : ''}" data-page="${m.id}" data-mod="${m.id}" title="${esc(m.nom)} · rester appuyé puis glisser pour déplacer"><span class="ico">${m.l}</span><span class="lib">${esc(m.nom)}</span>${m.id === 'messagerie' && nbMessages ? `<span class="compteur msg-compteur" data-msg-compteur>${nbMessages > 99 ? '99+' : nbMessages}</span>` : ''}</button>`
                : `<div class="item inactif" data-mod="${m.id}" title="${esc(m.nom)} : module en préparation"><span class="ico">${m.l}</span><span class="lib">${esc(m.nom)}</span><span class="pastille lib">Bientôt</span></div>`).join('')}</div></div>`;
          }).join('')}
          <div class="section">FMD</div>
          <button type="button" class="item ${page === 'apropos' ? 'actif' : ''}" data-page="apropos" title="À propos de FMD"><span class="ico">i</span><span class="lib">À propos de FMD</span></button>
          <div class="bas">
            <div class="moi"><div class="avatar">${esc(initiale)}</div><div class="lib"><div class="nom">${esc(nom)}</div><div class="discret">${monProfil() ? esc(libelleRole(monProfil().role)) + ' · ' : ''}v ${esc(infos.launcher || infos.version)}</div></div></div>
            <button type="button" class="item bascule-menu" data-bascule-menu title="Réduire ou agrandir le menu"><span class="ico">⇆</span><span class="lib">Réduire le menu</span></button>
            <button type="button" class="item ${page === 'parametres' ? 'actif' : ''}" data-page="parametres" title="Paramètres"><span class="ico">⚙</span><span class="lib">Paramètres</span>${pointParam}</button>
            ${enModule ? `<button class="btn btn-ligne petit" id="recharger" type="button" title="Recharger le module"><span class="ico">↻</span><span class="lib">Recharger</span></button>` : ''}
            <button class="btn btn-ligne petit" id="deconnexion" type="button" title="Déconnexion"><span class="ico">⎋</span><span class="lib">Déconnexion</span></button>
          </div>
        </aside>
        <main class="principal">${enModule ? `<div class="zone-module" id="zone-module"><div class="chargement-module">Ouverture de ${esc(MODULES.find((m) => m.id === page).nom)}…</div></div>` : page === 'parametres' ? pageParametres(user, nom, infos) : INTEGRES.includes(page) ? '<div id="page-agenda" class="page-agenda"></div>' : pageAccueil(user, nom, infos)}</main>
      </div>`;

    racine.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => ouvrir(b.dataset.page)));
    const menuG = racine.querySelector('.menu'); if (menuG) brancherGlisserMenu(menuG);
    racine.querySelectorAll('[data-cat-bascule]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.catBascule; const bloc = b.closest('.menu-cat'); const ouvrirCat = !bloc.classList.contains('ouverte');
      bloc.classList.toggle('ouverte', ouvrirCat); b.setAttribute('aria-expanded', String(ouvrirCat));
      const l = catsOuvertes().filter((x) => x !== id); if (ouvrirCat) l.push(id); ecrireLocal(CLE_CATS, JSON.stringify(l));
    }));
    const bascule = racine.querySelector('[data-bascule-menu]');
    if (bascule) bascule.addEventListener('click', basculerMenu);
    racine.querySelector('#deconnexion').addEventListener('click', async () => { if (L) await L.afficherModule(null); if (window.FMDMessagerie) window.FMDMessagerie.arreter(); if (window.FMDPresence) window.FMDPresence.arreter(); nbMessages = 0; majCompteurMessages(); await sb.auth.signOut(); });
    const rech = racine.querySelector('#recharger');
    if (rech) rech.addEventListener('click', () => L && L.rechargerModule());

    if (enModule) {
      const zone = document.getElementById('zone-module');
      // Nombres simples : un DOMRect arrive vide de l'autre côté du pont du launcher (zone 0 × 0 = module invisible).
      const envoyerZone = () => {
        if (!L) return;
        const r = zone.getBoundingClientRect();
        L.zoneModule({ x: r.left, y: r.top, width: r.width, height: r.height });
      };
      observateur = new ResizeObserver(envoyerZone);
      observateur.observe(zone);
      envoyerZone();
    } else if (page === 'parametres') {
      dessinerParametresMaj();
      brancherParametres();
    } else if (INTEGRES.includes(page)) { // modules intégrés (js/agenda.js, taches.js, apropos.js, crm.js → stock.js, renov.js)
      const M = { agenda: window.FMDAgenda, taches: window.FMDTaches, messagerie: window.FMDMessagerie, apropos: window.FMDAPropos, crm: window.FMDCRM, renov: window.FMDRenov, parebrise: window.FMDParebrise, agentai: window.FMDAgentAI, site: window.FMDSite, compta: window.FMDCompta, frais: window.FMDFrais }[page];
      const zoneModule = document.getElementById('page-agenda');
      // 25/11/2026 (« tout sur le serveur ») : les modules qui lisent les données du CRM ne s'ouvrent qu'une fois la version
      // du serveur lue dans cette séance (js/erp-nuage.js) : jamais d'affichage d'une vieille copie du PC.
      const N = window.FMDERPNuage;
      if (M && MODULES_DONNEES_CRM.includes(page) && N && !N.pret) {
        const pageAttendue = page;
        zoneModule.innerHTML = '<div class="attente-serveur"><span class="spin" aria-hidden="true"></span><b>Chargement des données depuis le serveur…</b><small data-etat-serveur></small></div>';
        const offEtat = N.surEtat ? N.surEtat((e) => { const z = zoneModule.querySelector('[data-etat-serveur]'); if (z) z.textContent = e.texte || ''; }) : null;
        N.attendrePret().then(() => { if (offEtat) offEtat(); if (page !== pageAttendue || instanceAgenda || document.getElementById('page-agenda') !== zoneModule) return; zoneModule.innerHTML = ''; instanceAgenda = M.monter(zoneModule, { ...ctxModules(), L }); });
      } else instanceAgenda = M ? M.monter(zoneModule, { ...ctxModules(), L }) : null;
    } else {
      brancherAccueil(nom);
    }
  }

  // ---------- Paramètres : Général | Gestion des utilisateurs | Gestion des accès (ces deux-là : administrateurs) ----------
  function pageParametres(user, nom, infos) {
    if (!estAdmin()) ongletParam = 'general';
    const demandes = estAdmin() ? enAttente().filter((p) => p.statut === 'en_attente').length : 0;
    const onglets = estAdmin() ? `
      <div class="onglets onglets-param" role="tablist">
        <button type="button" data-onglet="general" class="${ongletParam === 'general' ? 'actif' : ''}">Général</button>
        <button type="button" data-onglet="utilisateurs" class="${ongletParam === 'utilisateurs' ? 'actif' : ''}">Gestion des utilisateurs${demandes ? ` <span class="compteur">${demandes}</span>` : ''}</button>
        <button type="button" data-onglet="acces" class="${ongletParam === 'acces' ? 'actif' : ''}">Gestion des accès</button>
        <button type="button" data-onglet="cles" class="${ongletParam === 'cles' ? 'actif' : ''}">Clés API</button>
      </div>` : '';
    let corps;
    if (ongletParam === 'utilisateurs') {
      corps = `
        <section class="carte">
          <h2>En attente de validation</h2>
          <p class="discret">Personnes qui ont demandé un compte depuis l’écran de connexion de FMD. Elles n’ont accès à rien tant que
          ${estSuperAdmin() ? 'vous n’avez pas validé leur inscription.' : 'l’Administrateur suprême n’a pas validé leur inscription (lui seul peut le faire).'}</p>
          <div id="zone-attente"><div class="vide">Chargement…</div></div>
        </section>
        <section class="carte">
          <h2>Utilisateurs créés</h2>
          <p class="discret">Comptes validés, à jour en direct. ${estSuperAdmin()
            ? 'Vous pouvez modifier toutes les fiches, nommer les administrateurs et désactiver un compte.'
            : 'Vous pouvez modifier les fiches et les rôles (sauf ceux des administrateurs).'}</p>
          <div id="zone-registre"><div class="vide">Chargement…</div></div>
        </section>`;
    } else if (ongletParam === 'cles') {
      corps = `
        <section class="carte">
          <h2>Clés API</h2>
          <p class="discret">Les clés des services utilisés par les modules (ex. la clé Sirene de l’Insee pour FM’RADAR). Enregistrées une fois
          ici, sur le serveur, puis recopiées automatiquement sur chaque PC à la connexion : tout marche sur tous les PC.
          Seuls les administrateurs les voient et les modifient ; une clé n’est transmise qu’aux comptes qui ont accès à son module.
          Une clé enregistrée n’est jamais réaffichée en entier.</p>
          <div id="zone-cles"><div class="vide">Chargement…</div></div>
        </section>`;
    } else if (ongletParam === 'acces') {
      corps = `
        <section class="carte">
          <h2>Gestion des accès</h2>
          <p class="discret">Modules accessibles pour chaque rôle. Un module décoché disparaît du menu des personnes de ce rôle et le
          serveur refuse l’accès à ses données. Les administrateurs ont toujours accès à tout. Enregistré et appliqué tout de suite, sur tous les PC.</p>
          <div id="zone-acces"></div>
        </section>
        <section class="carte">
          <h2>Rôles (hiérarchie)</h2>
          <div id="zone-roles"></div>
        </section>`;
    } else {
      corps = `
        <section class="grille">
          <div class="carte infos" id="carte-maj">
            <h2>Mise à jour du logiciel</h2>
            <p class="discret">Les mises à jour apportent de nouvelles fonctionnalités. Vos données (projets, prospects…)
            ne dépendent pas de la version : elles sont toujours sur le serveur, à jour en direct.</p>
            <div id="zone-maj"></div>
          </div>
          <div class="carte" id="carte-mail">
            <h2>Mes e-mails : boîte IONOS et signature</h2>
            <p class="discret">Propres à votre compte FMD : votre boîte mail IONOS (devis, commandes et factures envoyés directement depuis FMD, PDF joint) et votre signature, ajoutée à la fin de vos e-mails.</p>
            <div id="zone-mail"></div>
          </div>
          <div class="carte infos" id="carte-compte">
            <h2>Mon compte</h2>
            ${monProfil() ? formulaireFiche(monProfil(), false) : `
            <dl>
              <dt>Nom</dt><dd>${esc(nom)}</dd>
              <dt>E-mail</dt><dd>${esc(user.email)}</dd>
            </dl>`}
            <dl style="margin-top:14px">
              <dt>Connexion</dt><dd>${resterConnecte() ? 'Reste connecté sur ce PC' : 'Déconnexion à la fermeture de FMD'}</dd>
              <dt>Version de FMD</dt><dd>${esc(infos.launcher || infos.version)}</dd>
            </dl>
          </div>
        </section>
        <section class="carte">
          <h2>Apparence</h2>
          <p class="discret">Choix gardé sur ce PC et sur votre compte (suit sur vos autres PC).</p>
          <div class="choix-themes" role="radiogroup" aria-label="Apparence">
            ${[['sombre', 'Sombre', 'Noir et rose gold'], ['clair', 'Clair', 'Crème et rose gold, comme FM’RADAR'], ['auto', 'Automatique', 'Suit le réglage de Windows']].map(([v, t, d]) => `
              <button type="button" class="choix-theme ${themeChoisi() === v ? 'actif' : ''}" data-theme-choix="${v}" role="radio" aria-checked="${themeChoisi() === v}">
                <span class="apercu apercu-${v}"><i></i><i></i><i></i></span><b>${t}</b><span class="discret">${d}</span>
              </button>`).join('')}
          </div>
          ${L && L.zoom ? `<div class="taille-affichage">
            <div><b>Taille d’affichage</b><span class="discret">Pour les portables et le zoom de Windows. Raccourcis : Ctrl + molette, Ctrl + / Ctrl − / Ctrl 0. Réglage gardé sur ce PC.</span></div>
            <select id="taille-affichage" aria-label="Taille d’affichage"><option value="auto">Automatique (selon l’écran)</option>
              ${[0.7, 0.8, 0.9, 1, 1.1, 1.25].map((z) => `<option value="${z}">${Math.round(z * 100)} %</option>`).join('')}</select>
          </div>
          <div class="taille-affichage">
            <div><b>Menu de gauche</b><span class="discret">Réduit aux icônes, il laisse plus de place aux modules. Automatique : réduit sur les écrans étroits.</span></div>
            <select id="pref-menu" aria-label="Menu de gauche"><option value="auto">Automatique</option><option value="ouvert">Toujours ouvert</option><option value="replie">Toujours réduit</option></select>
          </div>` : ''}
          <div class="taille-affichage">
            <div><b>Ordre du menu</b><span class="discret">Restez appuyé sur un module ou une catégorie du menu, puis glissez-le où vous voulez. Ordre propre à votre compte, sur tous vos PC.</span></div>
            <button type="button" class="btn btn-ligne petit" id="ordre-defaut"${Array.isArray(ordreMenu) ? '' : ' disabled'}>Remettre l’ordre d’origine</button>
          </div>
        </section>`;
    }
    return `
      <header class="entete"><h2 style="font-size:20px;margin:0">Paramètres</h2></header>
      <div class="contenu-page">${onglets}${corps}</div>`;
  }

  // Rôles qu'on peut donner : l'Administrateur suprême = tous ; un administrateur = ceux en dessous de lui.
  const rolesAttribuables = () => roles.filter((r) => r.code !== 'en_attente' && (estSuperAdmin() || !ROLES_ADMIN.includes(r.code)));
  // Fiches qu'un administrateur peut modifier (pas la sienne ici : « Mon compte » ; pas les administrateurs, sauf le suprême).
  const peutModifier = (p) => estAdmin() && p.id !== utilisateur.user.id && (estSuperAdmin() || !ROLES_ADMIN.includes(p.role));

  // Formulaire d'une fiche : « Mon compte » (rôle non modifiable) ou fenêtre d'un administrateur (rôle + accès).
  function formulaireFiche(p, admin) {
    return `
      <form class="form-fiche" data-id="${esc(p.id)}" novalidate>
        <div class="deux-champs">
          <div class="champ"><label>Prénom</label><input name="prenom" value="${esc(p.prenom || '')}" maxlength="60" autocomplete="off"></div>
          <div class="champ"><label>Nom</label><input name="nom_famille" value="${esc(p.nom_famille || '')}" maxlength="60" autocomplete="off"></div>
        </div>
        <div class="deux-champs">
          <div class="champ"><label>Nom d’utilisateur</label><input name="identifiant" value="${esc(p.identifiant || '')}" maxlength="30" placeholder="ex. yacine.i" autocomplete="off"></div>
          <div class="champ"><label>Téléphone</label><input name="telephone" type="tel" value="${esc(p.telephone || '')}" maxlength="25" placeholder="06 12 34 56 78" autocomplete="off"></div>
        </div>
        <div class="champ"><label>Fonction / poste</label><input name="fonction" value="${esc(p.fonction || '')}" maxlength="80" placeholder="ex. Chargé de communication" autocomplete="off"></div>
        <div class="champ"><label>Adresse e-mail (celle de la connexion)</label><input value="${esc(p.email || '')}" disabled></div>
        ${admin ? `
        <div class="deux-champs">
          <div class="champ"><label>Rôle</label><select name="role">${rolesAttribuables().map((r) => `<option value="${esc(r.code)}" ${r.code === p.role ? 'selected' : ''}>${esc(r.libelle)}</option>`).join('')}</select></div>
          <div class="champ"><label>Accès au logiciel</label>
            <label class="case" style="margin:8px 0 0"><input type="checkbox" name="actif" ${p.actif ? 'checked' : ''}><span>Compte actif</span></label></div>
        </div>
        ${'controle_par' in p ? `<div class="champ"><label>Ses créations (commandes, propositions, tiers) sont envoyées pour contrôle à</label>
          <select name="controle_par"><option value="">Personne (pas de contrôle)</option>${(registre || []).filter((x) => x.id !== p.id && x.statut === 'valide' && x.actif !== false).map((x) => `<option value="${esc(x.id)}" ${x.id === p.controle_par ? 'selected' : ''}>${esc(nomAffiche(x))}</option>`).join('')}</select>
          <small class="discret">Un message « À contrôler » avec le lien vers la fiche lui arrive dans la Messagerie à chaque création.</small></div>` : ''}` : `
        <div class="champ"><label>Rôle</label><div><span class="pastille role-${esc(p.role)}">${esc(libelleRole(p.role))}</span></div></div>`}
        <div class="message erreur" hidden></div>
        <div class="actions-maj">
          <button class="btn btn-metal" type="submit">Enregistrer</button>
          ${admin ? '<button class="btn btn-ligne" type="button" data-fermer>Annuler</button>' : ''}
        </div>
      </form>`;
  }

  // Enregistre une fiche (la base vérifie les droits : voir supabase/validation-acces.sql).
  async function enregistrerFiche(form, admin) {
    const v = (n) => { const c = form.elements[n]; return c ? c.value.trim() : undefined; };
    const erreur = form.querySelector('.message');
    const dire = (t) => { erreur.textContent = t; erreur.hidden = !t; };
    const fiche = { prenom: v('prenom') || null, nom_famille: v('nom_famille') || null, identifiant: v('identifiant') || null,
      telephone: v('telephone') || null, fonction: v('fonction') || null };
    if (!fiche.prenom || !fiche.nom_famille) return dire('Le prénom et le nom sont obligatoires.');
    if (fiche.identifiant && !/^[A-Za-z0-9._-]{2,30}$/.test(fiche.identifiant)) return dire('Nom d’utilisateur : 2 à 30 caractères, lettres sans accent, chiffres, point, tiret ou _.');
    if (fiche.telephone && !/^[0-9+().\s-]{6,25}$/.test(fiche.telephone)) return dire('Numéro de téléphone non valide.');
    if (admin) { fiche.role = form.elements.role.value; fiche.actif = form.elements.actif.checked; if (form.elements.controle_par) fiche.controle_par = form.elements.controle_par.value || null; }
    dire('');
    const bouton = form.querySelector('button[type=submit]');
    bouton.disabled = true; bouton.textContent = 'Enregistrement…';
    const { data, error } = await sb.from('profils').update(fiche).eq('id', form.dataset.id).select().maybeSingle();
    bouton.disabled = false; bouton.textContent = 'Enregistrer';
    if (error) return dire(traduireBase(error.message));
    if (!data) return dire('Modification refusée : vous n’avez pas les droits pour cette fiche.');
    return data;
  }

  async function brancherParametres() {
    racine.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => { ongletParam = b.dataset.onglet; dessiner(); }));
    const taille = racine.querySelector('#taille-affichage');
    if (taille) {
      L.zoom().then((r) => { if (r) taille.value = String(r.reglage); });
      taille.addEventListener('change', async () => {
        const r = await L.zoom(taille.value === 'auto' ? 'auto' : Number(taille.value));
        if (r) notifier('Taille d’affichage : ' + (r.reglage === 'auto' ? 'automatique (' + Math.round(r.zoom * 100) + ' %)' : Math.round(r.zoom * 100) + ' %'));
      });
    }
    const pm = racine.querySelector('#pref-menu');
    if (pm) { pm.value = prefMenu(); pm.addEventListener('change', () => { ecrireLocal(CLE_MENU, pm.value); appliquerMenu(); }); }
    racine.querySelectorAll('[data-theme-choix]').forEach((b) => b.addEventListener('click', async () => {
      await changerTheme(b.dataset.themeChoix);
      racine.querySelectorAll('[data-theme-choix]').forEach((x) => { const ok = x === b; x.classList.toggle('actif', ok); x.setAttribute('aria-checked', ok); });
    }));
    const od = racine.querySelector('#ordre-defaut');
    if (od) od.addEventListener('click', async () => { await sauverOrdreMenu(null); notifier('Ordre d’origine du menu remis.'); dessiner(); });
    const form = racine.querySelector('#carte-compte .form-fiche');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = await enregistrerFiche(form, false);
      if (!p) return;
      appliquerProfil(p);
      notifier('Vos informations sont enregistrées.');
      dessiner();
    });
    if (ongletParam === 'general') { if (window.FMDERP && window.FMDERP.reglageMail) window.FMDERP.reglageMail(racine.querySelector('#zone-mail'), notifier); return; }
    if (ongletParam === 'cles') { dessinerCles(); return; }
    if (!registrePret) {
      racine.querySelector('.contenu-page').insertAdjacentHTML('beforeend', '<div class="vide">Le registre n’est pas encore prêt sur le serveur.</div>');
      return;
    }
    if (ongletParam === 'utilisateurs' && !registre) await chargerRegistre();
    rafraichirGestion();
  }

  // Redessine la partie « gestion » affichée (sans toucher aux champs en cours de saisie ailleurs).
  function rafraichirGestion() {
    if (page !== 'parametres') return;
    if (ongletParam === 'utilisateurs') { dessinerDemandes(); dessinerRegistre(); }
    if (ongletParam === 'acces') { dessinerAcces(); dessinerRoles(); }
    const onglet = racine.querySelector('[data-onglet="utilisateurs"]');
    if (onglet) {
      const n = enAttente().filter((p) => p.statut === 'en_attente').length;
      onglet.innerHTML = `Gestion des utilisateurs${n ? ` <span class="compteur">${n}</span>` : ''}`;
    }
  }

  // Demandes d'inscription : l'Administrateur suprême choisit le rôle puis valide (ou refuse).
  function dessinerDemandes() {
    const zone = document.getElementById('zone-attente');
    if (!zone || !registre) return;
    const liste = enAttente().sort((a, b) => (a.statut === 'refuse') - (b.statut === 'refuse') || String(b.created_at).localeCompare(String(a.created_at)));
    const sup = estSuperAdmin();
    const options = rolesAttribuables().filter((r) => !ROLES_ADMIN.includes(r.code));
    zone.innerHTML = liste.length ? `<div class="demandes">${liste.map((p) => `
      <div class="demande ${p.statut === 'refuse' ? 'refusee' : ''}" data-id="${esc(p.id)}">
        <div class="qui"><div class="avatar petit">${esc(nomAffiche(p).trim().charAt(0).toUpperCase())}</div>
          <div><div class="fort">${esc(nomAffiche(p))}</div>
          <div class="discret">${esc(p.email || '')}${p.telephone ? ' · ' + esc(p.telephone) : ''} · demande du ${esc(dateCourte(p.created_at))}</div></div></div>
        <span class="pastille ${p.statut === 'refuse' ? 'pastille-refus' : 'role-en_attente'}">${p.statut === 'refuse' ? 'Refusée' : 'En attente'}</span>
        ${sup ? `<div class="actions-demande">
          <select aria-label="Rôle à donner">${options.map((r) => `<option value="${esc(r.code)}" ${r.code === 'vendeur' ? 'selected' : ''}>${esc(r.libelle)}</option>`).join('')}</select>
          <button type="button" class="btn btn-metal petit" data-valider>${p.statut === 'refuse' ? 'Valider quand même' : 'Valider l’inscription'}</button>
          ${p.statut === 'refuse' ? '' : '<button type="button" class="btn btn-ligne petit" data-refuser>Refuser</button>'}
        </div>` : ''}
      </div>`).join('')}</div>` : '<div class="vide">Aucune demande d’inscription en attente.</div>';
    zone.querySelectorAll('.demande').forEach((ligne) => {
      const id = ligne.dataset.id;
      const p = registre.find((x) => x.id === id);
      const traiter = async (changement, message) => {
        ligne.querySelectorAll('button, select').forEach((b) => { b.disabled = true; });
        const { data, error } = await sb.from('profils').update(changement).eq('id', id).select().maybeSingle();
        if (error || !data) { notifier(error ? traduireBase(error.message) : 'Action refusée par le serveur.'); ligne.querySelectorAll('button, select').forEach((b) => { b.disabled = false; }); return; }
        notifier(message);
        await chargerRegistre();
        rafraichirGestion();
      };
      const v = ligne.querySelector('[data-valider]');
      if (v) v.addEventListener('click', () => {
        const role = ligne.querySelector('select').value;
        traiter({ statut: 'valide', role }, `${nomAffiche(p)} peut maintenant utiliser FMD (rôle : ${libelleRole(role)}).`);
      });
      const r = ligne.querySelector('[data-refuser]');
      if (r) r.addEventListener('click', () => {
        if (!window.confirm(`Refuser la demande de ${nomAffiche(p)} ? Cette personne n’aura pas accès à FMD (vous pourrez la valider plus tard).`)) return;
        traiter({ statut: 'refuse' }, `Demande de ${nomAffiche(p)} refusée.`);
      });
    });
  }

  function dessinerRegistre() {
    const zone = document.getElementById('zone-registre');
    if (!zone || !registre) return;
    const moi = utilisateur.user.id;
    const valides = registre.filter((p) => ficheValide(p));
    // 18 nov. 2026 : utilisateurs en cartes widgets (styles .erp-w de app.css, communs avec le CRM).
    zone.innerHTML = `
      <div class="erp-cartes">${valides.map((p) => { const n = nomAffiche(p); return `
          <div class="erp-w${p.actif ? '' : ' desactive'}">
            <div class="erp-w-haut"><div class="erp-w-img"><div class="avatar">${esc(n.trim().charAt(0).toUpperCase())}</div></div>
              <div class="erp-w-titres"><div class="erp-w-sur">${p.identifiant ? '@' + esc(p.identifiant) : 'pas de nom d’utilisateur'}</div>
                <div class="erp-w-titre">${esc(n)}${p.id === moi ? ' <span class="discret">(vous)</span>' : ''}</div>
                <div class="erp-w-etats"><span class="pastille role-${esc(p.role)}">${esc(libelleRole(p.role))}</span>${p.actif ? '<span class="statut ok">Actif</span>' : '<span class="statut">Désactivé</span>'}</div></div></div>
            <dl class="erp-w-infos"><div><dt>E-mail</dt><dd>${esc(p.email || '—')}</dd></div><div><dt>Téléphone</dt><dd>${esc(p.telephone || '—')}</dd></div><div><dt>Fonction</dt><dd>${esc(p.fonction || '—')}</dd></div></dl>
            <div class="erp-w-pied">${peutModifier(p) ? `<button type="button" class="btn btn-ligne petit" data-modifier="${esc(p.id)}">Modifier</button>`
              : p.id === moi ? '<span class="discret">Général → Mon compte</span>' : ''}</div>
          </div>`; }).join('')}</div>
      <p class="discret" style="margin-top:12px">${valides.length} utilisateur${valides.length > 1 ? 's' : ''} validé${valides.length > 1 ? 's' : ''}.</p>`;
    zone.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => ouvrirFicheAdmin(b.dataset.modifier)));
  }

  // Gestion des accès : rôles × modules (cases enregistrées tout de suite dans roles.permissions).
  function dessinerAcces() {
    const zone = document.getElementById('zone-acces');
    if (!zone) return;
    const lignes = roles.filter((r) => r.code !== 'en_attente');
    zone.innerHTML = `
      <div class="tableau-defile"><table class="registre matrice">
        <thead><tr><th>Rôle</th>${MODULES.map((m) => `<th>${esc(m.nom)}${m.actif ? '' : '<div class="discret">à venir</div>'}</th>`).join('')}</tr></thead>
        <tbody>${lignes.map((r) => `
          <tr><td><span class="pastille role-${esc(r.code)}">${esc(r.libelle)}</span></td>
          ${MODULES.map((m) => ROLES_ADMIN.includes(r.code)
            ? '<td><span class="statut ok">Tout</span></td>'
            : `<td><label class="interrupteur" title="${esc(r.libelle)} — ${esc(m.nom)}"><input type="checkbox" data-role="${esc(r.code)}" data-module="${m.id}"
                ${roleAAcces(r.code, m.id) ? 'checked' : ''}><i></i></label></td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    zone.querySelectorAll('input[data-role]').forEach((c) => c.addEventListener('change', async () => {
      const r = roleDe(c.dataset.role);
      const permissions = { ...(r.permissions || {}), [c.dataset.module]: c.checked };
      c.disabled = true;
      const { data, error } = await sb.from('roles').update({ permissions }).eq('code', r.code).select().maybeSingle();
      c.disabled = false;
      if (error || !data) { c.checked = !c.checked; notifier(error ? traduireBase(error.message) : 'Modification refusée par le serveur.'); return; }
      r.permissions = data.permissions;
      const m = MODULES.find((x) => x.id === c.dataset.module);
      notifier(`${r.libelle} : ${m.nom} ${c.checked ? 'autorisé' : 'retiré'}.`);
    }));
  }

  function dessinerRoles() {
    const zone = document.getElementById('zone-roles');
    if (!zone) return;
    zone.innerHTML = `<div class="liste-roles">${roles.map((r) => `
      <div class="role"><span class="pastille role-${esc(r.code)}">${esc(r.libelle)}</span><span class="discret">${esc(r.description || '')}</span></div>`).join('')}</div>`;
  }

  // Fenêtre d'un administrateur : modifier une fiche, le rôle et l'accès.
  function ouvrirFicheAdmin(id) {
    const p = registre.find((x) => x.id === id);
    const f = document.getElementById('fenetre');
    if (!p || !f) return;
    f.innerHTML = `<div class="boite boite-fiche"><h2 id="fenetre-titre">${esc(nomAffiche(p))}</h2>
      <p class="discret" style="margin:4px 0 18px">Fiche utilisateur — modification par un administrateur.</p>${formulaireFiche(p, true)}</div>`;
    f.hidden = false;
    const fermer = () => { f.hidden = true; f.innerHTML = ''; };
    f.querySelector('[data-fermer]').addEventListener('click', fermer);
    f.onclick = (e) => { if (e.target === f) fermer(); };
    const form = f.querySelector('.form-fiche');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await enregistrerFiche(form, true);
      if (!r) return;
      fermer();
      notifier('Fiche de ' + nomAffiche(r) + ' enregistrée.');
      await chargerRegistre();
      rafraichirGestion();
    });
    form.elements.prenom.focus();
  }
  function dessinerParametresMaj() {
    // Pastille « Mise à jour » du menu
    const item = racine.querySelector('[data-page="parametres"]');
    if (item) {
      const p = item.querySelector('.point-maj');
      const montrer = maj.etat === 'telechargement' || maj.etat === 'prete'
        || (estSuperAdmin() && enAttente().some((x) => x.statut === 'en_attente')); // ou demandes d'inscription
      if (montrer && !p) item.insertAdjacentHTML('beforeend', '<span class="point-maj" title="Mise à jour disponible"></span>');
      if (!montrer && p) p.remove();
    }
    const zone = document.getElementById('zone-maj');
    if (!zone) return;
    const occupe = maj.etat === 'recherche' || maj.etat === 'telechargement';
    const quand = maj.verifie ? new Date(maj.verifie).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    zone.innerHTML = `
      <dl style="margin:16px 0">
        <dt>Version installée</dt><dd>${esc(maj.installee || (utilisateur && utilisateur.infos.launcher) || '?')}</dd>
        <dt>Dernière version</dt><dd>${esc(maj.version || '—')}</dd>
        <dt>État</dt><dd class="${maj.etat === 'erreur' ? 'texte-danger' : ''}">${esc(texteEtatMaj(maj))}${quand && !occupe ? ` <span class="discret">(vérifié à ${quand})</span>` : ''}</dd>
      </dl>
      ${maj.etat === 'telechargement' ? `<div class="barre-maj"><i style="width:${Number(maj.pourcent) || 0}%"></i></div>` : ''}
      <div class="actions-maj">
        ${maj.etat === 'prete'
          ? '<button type="button" class="btn btn-metal" id="maj-installer">Mettre à jour maintenant</button>'
          : `<button type="button" class="btn btn-metal" id="maj-rechercher" ${occupe ? 'disabled' : ''}>${occupe ? 'Recherche en cours…' : 'Rechercher une mise à jour'}</button>`}
      </div>`;
    const r = zone.querySelector('#maj-rechercher');
    if (r) r.addEventListener('click', async () => {
      if (!L) { notifier('Les mises à jour se font dans le logiciel FMD (.exe).'); return; }
      reporteJusqua = 0;
      recevoirEtatMaj({ ...maj, etat: 'recherche' });
      const res = await L.verifierMaj('bouton');
      if (res) recevoirEtatMaj(res);
    });
    const i = zone.querySelector('#maj-installer');
    if (i) i.addEventListener('click', () => { notifier('Installation de la mise à jour… FMD redémarre tout seul.'); L.installerMaj(); });
  }

  async function ouvrir(cible) {
    if (TABLETTE && !['accueil', 'parametres', ...MODULES_TABLETTE].includes(cible)) { notifier('Ce module s’ouvre dans le logiciel FMD sur PC.'); return; }
    if (MODULES_DROITS.includes(cible) && !aAcces(cible)) { notifier('Votre rôle n’a pas accès à ce module.'); return; }
    if (!['accueil', 'parametres', ...INTEGRES].includes(cible) && !L) { notifier('Les modules s\'ouvrent dans le logiciel FMD (.exe).'); return; }
    page = cible;
    dessiner();
    if (!L) return;
    const r = await L.afficherModule(cible === 'accueil' ? null : cible);
    if (r && !r.ok) { notifier('Impossible d\'ouvrir le module : ' + r.erreur); page = 'accueil'; dessiner(); L.afficherModule(null); }
  }

  function pageAccueil(user, nom, infos) {
    return `
      <header class="entete">
        <span class="synchro" id="synchro"><i></i><span>Connexion au direct…</span></span>
        <div class="utilisateur">
          <div style="text-align:right"><div style="font-weight:600">${esc(nom)}</div><div class="discret">${esc(user.email)}</div></div>
          <div class="avatar">${esc(nom.trim().charAt(0).toUpperCase())}</div>
        </div>
      </header>
      <div class="contenu-page">
        <section class="hero">
          <span class="eyebrow">Mon espace</span>
          <h1>Bonjour ${esc(nom.split(' ')[0])}, <span class="texte-metal">bienvenue.</span></h1>
          <p style="text-transform:capitalize">${esc(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
        </section>
        <section class="espace">
          ${aAcces('agenda') ? `<div class="carte">
            <div class="titre-carte"><h2>Aujourd’hui</h2><button type="button" class="btn btn-ligne petit" data-page="agenda">Agenda →</button></div>
            <div id="espace-jour"><div class="vide">Chargement…</div></div>
          </div>` : ''}
          ${aAcces('taches') ? `<div class="carte">
            <div class="titre-carte"><h2>Mes tâches</h2><button type="button" class="btn btn-ligne petit" data-page="taches">Toutes →</button></div>
            <form class="ajout-rapide" id="espace-ajout"><input placeholder="Ajouter une tâche pour aujourd’hui… (Entrée)" maxlength="300" aria-label="Nouvelle tâche pour aujourd’hui"></form>
            <div id="espace-taches"><div class="vide">Chargement…</div></div>
          </div>` : ''}
          <div class="carte">
            <div class="titre-carte"><h2>Notifications</h2><button type="button" class="btn btn-ligne petit" id="notifs-lues" hidden>Tout marquer lu</button></div>
            <div id="espace-notifs"><div class="vide">Chargement…</div></div>
          </div>
        </section>
        ${categories().map((c) => { const mods = c.modules.map((id) => MODULES.find((m) => m.id === id)).filter((m) => m && aAcces(m.id)); return mods.length ? `
        <h2 class="modules-cat">${icoCat(c)}<span class="cat-nom">${esc(c.nom)}</span><span class="cat-nb">${mods.length} module${mods.length > 1 ? 's' : ''}</span></h2>
        <section class="modules">
          ${mods.map((m) => m.actif
            ? `<button type="button" class="module cliquable" data-page="${m.id}"><div class="icone">${m.l}</div><h3>${esc(m.nom)}</h3><p>${esc(m.txt)}</p><span class="ouvrir">Ouvrir →</span></button>`
            : `<div class="module"><div class="icone">${m.l}</div><h3>${esc(m.nom)}</h3><p>${esc(m.txt)}</p><span class="pastille" style="justify-self:start">En préparation</span></div>`).join('')}
        </section>` : ''; }).join('')}
        <div id="carte-cle"></div>
        <section class="carte">
          <h2>Bloc-notes partagé</h2>
          <p class="discret">Visible par toute l’équipe, en direct sur tous les PC.</p>
          <form class="saisie-note" id="form-note">
            <textarea id="note" placeholder="Écrire une note…" maxlength="2000"></textarea>
            <button class="btn btn-metal" type="submit">Ajouter</button>
          </form>
          <div class="notes" id="notes"><div class="vide">Chargement…</div></div>
        </section>
      </div>`;
  }

  // ---------- Mon espace : aujourd'hui (agenda + tâches), mes tâches, notifications ----------
  const ctxModules = () => ({ sb, moi: { id: utilisateur.user.id, nom: utilisateur.nom }, admin: estAdmin(), notifier, esc, taches: aAcces('taches') });
  const T = () => window.FMDTaches;

  async function chargerEspace() {
    if (page !== 'accueil') return;
    const ctx = ctxModules();
    const auj = new Date();
    const debut = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate()), fin = new Date(debut.getTime() + 864e5);
    const zj = document.getElementById('espace-jour');
    if (zj) {
      const { data } = await sb.from('agenda').select('*').eq('proprietaire', ctx.moi.id).lt('debut', fin.toISOString()).gt('fin', debut.toISOString()).order('debut');
      const h = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (document.getElementById('espace-jour')) zj.innerHTML = data && data.length ? data.map((e) => `
        <button type="button" class="ag-ligne" data-page="agenda" style="--c:${({ vert: '#86c39f', bleu: '#7fa7d9', ambre: '#e0b45c', rouge: '#e8806d' })[e.couleur] || '#C9987D'}">
          <span class="ag-quand">${e.journee ? 'Toute la journée' : `${h(e.debut)} – ${h(e.fin)}`}</span>
          <span class="ag-quoi">${esc(e.titre)}</span>${e.lieu ? `<span class="discret">${esc(e.lieu)}</span>` : ''}
        </button>`).join('') : '<div class="vide">Aucun rendez-vous aujourd’hui.</div>';
      zj.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => ouvrir('agenda')));
    }
    const zt = document.getElementById('espace-taches');
    if (zt && T()) {
      await T().utilisateurs(sb);
      await T().generer(sb); // tâches répétées du jour / de demain
      const demain = T().jourISO(new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + 1));
      const { data } = await sb.from('taches').select('*').eq('pour', ctx.moi.id).eq('fait', false).or(`date_prevue.lte.${demain},date_prevue.is.null`);
      if (!document.getElementById('espace-taches')) return;
      const liste = data || [];
      zt.innerHTML = T().rendreListe(liste, ctx, { compact: true, sansFaites: true }) || '<div class="vide">Rien à faire. 🎉</div>';
      T().brancherListe(zt, liste, ctx, chargerEspace);
    }
  }

  // Notifications (table notifications, créées par la base : tâche confiée, tâche terminée…)
  let nbNonLues = 0;
  let canalNotifs = null;
  function majCompteurNotifs() {
    const c = racine.querySelector('.compteur-notifs');
    if (c) { c.textContent = nbNonLues; c.hidden = !nbNonLues; }
  }
  async function chargerNotifs() {
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('lu', false);
    nbNonLues = count || 0;
    majCompteurNotifs();
    const zone = document.getElementById('espace-notifs');
    if (!zone) return;
    const r = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(15);
    const liste = r.data || [];
    zone.innerHTML = liste.length ? liste.map((n) => `
      <button type="button" class="notif-ligne ${n.lu ? '' : 'non-lue'}" data-notif="${esc(n.id)}">
        <span>${esc(n.texte)}</span><span class="discret">${new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
      </button>`).join('') : '<div class="vide">Aucune notification.</div>';
    const tout = document.getElementById('notifs-lues');
    if (tout) { tout.hidden = !nbNonLues; tout.onclick = async () => { await sb.from('notifications').update({ lu: true }).eq('lu', false); chargerNotifs(); }; }
    zone.querySelectorAll('[data-notif]').forEach((b) => b.addEventListener('click', async () => {
      const n = liste.find((x) => x.id === b.dataset.notif);
      if (!n.lu) { await sb.from('notifications').update({ lu: true }).eq('id', n.id); chargerNotifs(); }
      if (n.lien && n.lien.tache && T()) {
        const { data } = await sb.from('taches').select('*').eq('id', n.lien.tache).maybeSingle();
        if (data) T().ouvrirFiche(ctxModules(), data, null, chargerEspace); else notifier('Cette tâche n’existe plus.');
      }
    }));
  }
  function ecouterNotifs() {
    if (canalNotifs) return;
    canalNotifs = sb.channel('notifications-direct')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (p) => {
        if (p.new && p.new.destinataire === utilisateur.user.id) notifier(p.new.texte);
        chargerNotifs();
        if (page === 'accueil') chargerEspace();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taches' }, () => { if (page === 'accueil') chargerEspace(); })
      .subscribe();
  }

  async function brancherAccueil(nom) {
    const ajout = document.getElementById('espace-ajout');
    if (ajout) ajout.addEventListener('submit', async (e) => {
      e.preventDefault();
      const champ = ajout.querySelector('input');
      const titre = champ.value.trim();
      if (!titre) return;
      champ.value = '';
      const { error } = await sb.from('taches').insert({ titre, pour: utilisateur.user.id, de: utilisateur.user.id, date_prevue: T() ? T().jourISO(new Date()) : null });
      if (error) { champ.value = titre; notifier(error.message); return; }
      chargerEspace();
    });
    chargerEspace();
    chargerNotifs();
    racine.querySelector('#form-note').addEventListener('submit', async (e) => {
      e.preventDefault();
      const champ = racine.querySelector('#note');
      const contenu = champ.value.trim();
      if (!contenu) return;
      champ.value = '';
      const { error } = await sb.from('notes').insert({ contenu, auteur_nom: nom });
      if (error) { champ.value = contenu; notifier('Erreur : ' + error.message); }
      else chargerNotes();
    });
    racine.querySelector('#note').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); racine.querySelector('#form-note').requestSubmit(); }
    });
    carteCleRadar();
    await chargerNotes();
    ecouterNotes();
  }

  // ---------- Clés API (Paramètres › Clés API, table cles_api : supabase/cles-api.sql) ----------
  // Emplacements connus : la clé est appliquée sur le PC par le logiciel (ex. fichier de clé du Radar).
  const CLES_API = [
    { nom: 'insee', libelle: 'Sirene (Insee)', module: 'radar', usage: 'FM’RADAR : collecte des nouvelles entreprises', lien: 'https://portail-api.insee.fr/' },
    { nom: 'anthropic', libelle: 'Claude (Anthropic)', module: 'agentai', usage: 'Agent AI : Assistant AI (bientôt)', lien: 'https://console.anthropic.com/' },
  ];
  let clesEnLigne = null; // null = pas encore lu ; false = table absente sur le serveur
  const tableAbsente = (err) => !!err && (err.code === 'PGRST205' || err.code === '42P01' || /cles_api/.test(err.message || '') && /find|exist/i.test(err.message || ''));
  async function lireCles() {
    const { data, error } = await sb.from('cles_api').select('nom, libelle, module, valeur, modifie, par_nom');
    if (error) { clesEnLigne = tableAbsente(error) ? false : null; if (!tableAbsente(error)) throw error; return []; }
    clesEnLigne = data || [];
    return clesEnLigne;
  }
  // À la connexion : chaque clé lisible par ce compte est recopiée sur ce PC (le Radar lit sa clé à chaque recherche).
  async function synchroniserCles() {
    try {
      const cles = await lireCles();
      const insee = cles.find((c) => c.nom === 'insee');
      if (insee && L && L.radarEnregistrerCle) await L.radarEnregistrerCle(insee.valeur);
    } catch { /* hors ligne : on garde les clés déjà sur ce PC */ }
  }
  const masque = (v) => { const t = String(v || ''); return t.length > 8 ? '••••••••' + t.slice(-4) : '••••••••'; };
  async function dessinerCles() {
    const zone = document.getElementById('zone-cles');
    if (!zone) return;
    let cles;
    try { cles = await lireCles(); } catch (e) { zone.innerHTML = `<div class="vide">Impossible de lire les clés : ${esc(e.message || e)}</div>`; return; }
    if (clesEnLigne === false) {
      zone.innerHTML = '<div class="vide">Le coin « Clés API » n’est pas encore activé sur le serveur : le script <b>supabase/cles-api.sql</b> doit être exécuté une fois dans Supabase.</div>';
      return;
    }
    const autres = cles.filter((c) => !CLES_API.some((k) => k.nom === c.nom)).map((c) => ({ nom: c.nom, libelle: c.libelle || c.nom, module: c.module, usage: c.module ? 'Module : ' + c.module : 'Clé personnalisée' }));
    const ligne = (k) => { const c = cles.find((x) => x.nom === k.nom);
      return `<form class="cle-api" data-cle="${esc(k.nom)}">
        <div class="cle-api-tete"><b>${esc(k.libelle)}</b><span class="discret">${esc(k.usage)}${k.lien ? ` · <a href="#" data-lien-cle="${esc(k.lien)}">obtenir une clé</a>` : ''}</span></div>
        <div class="cle-api-etat">${c ? `<span class="pastille ok">Enregistrée</span> <code>${esc(masque(c.valeur))}</code> <span class="discret">${c.modifie ? 'le ' + new Date(c.modifie).toLocaleDateString('fr-FR') : ''}${c.par_nom ? ' par ' + esc(c.par_nom) : ''}</span>` : '<span class="pastille">Non renseignée</span>'}</div>
        <div class="cle-api-saisie"><input type="password" name="valeur" autocomplete="off" spellcheck="false" placeholder="${c ? 'Coller une nouvelle clé pour la remplacer' : 'Coller la clé API'}" aria-label="Clé ${esc(k.libelle)}">
          <button class="btn btn-metal" type="submit">${c ? 'Remplacer' : 'Enregistrer'}</button>${c ? '<button class="btn btn-ligne" type="button" data-suppr-cle>Supprimer</button>' : ''}</div>
      </form>`; };
    zone.innerHTML = [...CLES_API, ...autres].map(ligne).join('') + `
      <form class="cle-api cle-api-nouvelle" id="form-cle-perso">
        <div class="cle-api-tete"><b>Autre clé API</b><span class="discret">Un autre service (nom court sans espace, ex. google-maps)</span></div>
        <div class="cle-api-saisie"><input name="nom" placeholder="Nom (ex. google-maps)" autocomplete="off" style="max-width:200px" aria-label="Nom de la clé">
          <input type="password" name="valeur" autocomplete="off" spellcheck="false" placeholder="Coller la clé API" aria-label="Clé API">
          <button class="btn btn-ligne" type="submit">Ajouter</button></div>
      </form>`;
    zone.querySelectorAll('[data-lien-cle]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); if (L && L.ouvrirExterne) L.ouvrirExterne(a.dataset.lienCle); else window.open(a.dataset.lienCle, '_blank'); }));
    zone.querySelectorAll('form[data-cle]').forEach((form) => {
      const k = [...CLES_API, ...autres].find((x) => x.nom === form.dataset.cle);
      form.addEventListener('submit', async (e) => { e.preventDefault(); await enregistrerCle(k, form.valeur.value); });
      const sup = form.querySelector('[data-suppr-cle]');
      if (sup) sup.addEventListener('click', async () => {
        if (!window.confirm(`Supprimer la clé « ${k.libelle} » du serveur ? Elle restera sur les PC où elle est déjà, jusqu’à ce qu’une nouvelle clé la remplace.`)) return;
        const { error } = await sb.from('cles_api').delete().eq('nom', k.nom);
        if (error) { notifier('Suppression impossible : ' + error.message); return; }
        notifier(`Clé « ${k.libelle} » supprimée du serveur.`); dessinerCles();
      });
    });
    zone.querySelector('#form-cle-perso').addEventListener('submit', async (e) => { e.preventDefault(); const fo = e.target;
      const nom = fo.nom.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
      if (!/^[a-z0-9_-]{2,40}$/.test(nom)) { notifier('Donnez un nom court à la clé (lettres, chiffres, tirets).'); return; }
      await enregistrerCle({ nom, libelle: fo.nom.value.trim(), module: null }, fo.valeur.value); });
  }
  async function enregistrerCle(k, brute) {
    const valeur = String(brute || '').trim();
    if (valeur.length < 8 || /\s/.test(valeur)) { notifier('Clé invalide : collez la clé complète, sans espace.'); return; }
    const ligne = { nom: k.nom, libelle: k.libelle, module: k.module || null, valeur, modifie: new Date().toISOString(), par: utilisateur.user.id, par_nom: utilisateur.nom || '' };
    const { data: deja, error: e1 } = await sb.from('cles_api').select('nom').eq('nom', k.nom).maybeSingle();
    if (e1) { notifier('Enregistrement impossible : ' + e1.message); return; }
    const { error } = deja ? await sb.from('cles_api').update(ligne).eq('nom', k.nom) : await sb.from('cles_api').insert(ligne);
    if (error) { notifier('Enregistrement impossible : ' + error.message); return; }
    if (k.nom === 'insee' && L && L.radarEnregistrerCle) await L.radarEnregistrerCle(valeur); // appliquée tout de suite sur ce PC
    notifier(`Clé « ${k.libelle} » enregistrée en ligne : elle sera utilisée sur tous les PC.`);
    dessinerCles();
  }

  // Clé Sirene du Radar : demandée ici si elle n'est pas encore sur ce PC (remplace la question du .bat).
  async function carteCleRadar() {
    const zone = document.getElementById('carte-cle');
    if (!zone || !L) return;
    if (await L.radarClePresente()) { zone.innerHTML = ''; return; }
    zone.innerHTML = `
      <div class="carte">
        <h2>FM’RADAR : clé Sirene (Insee)</h2>
        <p class="discret">Nécessaire pour la collecte des nouvelles entreprises. Le plus simple : un administrateur l’enregistre une fois dans
        <b>Paramètres › Clés API</b>, elle arrive alors sur tous les PC. Sinon, collez-la ici pour ce PC seulement. Sans clé, le Radar fonctionne mais la collecte Sirene est désactivée.</p>
        <form class="saisie-note" id="form-cle">
          <input id="cle" type="password" autocomplete="off" placeholder="Collez votre clé API Sirene" style="background:var(--surface-2);border:1px solid var(--ligne);border-radius:12px;padding:12px 14px;flex:1">
          <button class="btn btn-metal" type="submit">Enregistrer</button>
        </form>
      </div>`;
    zone.querySelector('#form-cle').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await L.radarEnregistrerCle(zone.querySelector('#cle').value);
      if (r.ok) { notifier('Clé Sirene enregistrée sur ce PC.'); zone.innerHTML = ''; }
      else notifier(r.erreur);
    });
  }

  async function chargerNotes() {
    const liste = document.getElementById('notes');
    if (!liste) return;
    const { data, error } = await sb.from('notes').select('*').order('created_at', { ascending: false }).limit(100);
    if (!document.getElementById('notes')) return;
    if (error) { liste.innerHTML = `<div class="vide">Erreur : ${esc(error.message)}</div>`; return; }
    const moi = sessionCourante && sessionCourante.user.id;
    liste.innerHTML = data.length ? data.map((n) => `
      <div class="note">
        <div class="texte">${esc(n.contenu)}</div>
        ${n.auteur === moi ? `<button class="btn-icone" data-suppr="${n.id}" title="Supprimer ma note" type="button">✕</button>` : '<span></span>'}
        <div class="meta">${esc(n.auteur_nom || 'Utilisateur')} · ${new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
      </div>`).join('') : '<div class="vide">Aucune note pour le moment.</div>';
    liste.querySelectorAll('[data-suppr]').forEach((b) => b.addEventListener('click', async () => {
      const { error: err } = await sb.from('notes').delete().eq('id', b.dataset.suppr);
      if (err) notifier('Erreur : ' + err.message); else chargerNotes();
    }));
  }

  function majPastille(statut) {
    const s = document.getElementById('synchro');
    if (!s) return;
    const ok = statut === 'SUBSCRIBED';
    s.classList.toggle('ok', ok);
    s.lastElementChild.textContent = ok ? 'Synchronisé en direct' : 'Direct indisponible (' + String(statut).toLowerCase() + ')';
  }

  function ecouterNotes() {
    if (canalNotes) { majPastille(canalNotes.state === 'joined' ? 'SUBSCRIBED' : canalNotes.state); return; }
    canalNotes = sb.channel('notes-direct')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => chargerNotes())
      .subscribe((statut) => majPastille(statut));
  }

  // ---------- Problème au démarrage : jamais de page blanche ----------
  function ecranErreur(texte) {
    racine.innerHTML = `
      <div class="centre"><div class="carte">
        <img src="${LOGO}" alt="FMD" style="width:200px">
        <h2 style="margin-top:22px">FMD n'a pas pu s'ouvrir correctement</h2>
        <p class="discret" style="margin:10px 0 18px;font-size:13px">${esc(texte)}</p>
        <button class="btn btn-metal" id="reessayer" type="button">Réessayer</button>
      </div></div>`;
    racine.querySelector('#reessayer').addEventListener('click', () => location.reload());
  }
  // Si rien ne s'affiche au bout de 15 s (connexion Internet très lente, serveur indisponible…), on le dit.
  setTimeout(() => { if (document.getElementById('attente')) ecranErreur('La connexion prend plus de temps que prévu. Vérifiez Internet puis réessayez.'); }, 15000);

  // ---------- Démarrage ----------
  sb.auth.onAuthStateChange((evenement, session) => {
    const avant = sessionCourante && sessionCourante.user.id;
    sessionCourante = session;
    if (L && L.session) L.session(session ? session.access_token : null); // enregistrements en ligne des modules
    // setTimeout : ne pas appeler Supabase directement dans ce rappel (blocage connu de la bibliothèque).
    if (!session) return setTimeout(() => ecranConnexion(), 0);
    if (evenement === 'TOKEN_REFRESHED' || (avant === session.user.id && evenement !== 'USER_UPDATED')) return;
    setTimeout(() => ecranApp(session).catch((err) => ecranErreur('Erreur : ' + err.message)), 0);
  });
})();
