// FMD — Messagerie instantanée entre les utilisateurs (21 nov. 2026, demande : « ajoute une messagerie instantanée vers les
// différents utilisateurs avec une notification de bureau lors de la réception des messages »).
// Données : table public.messages (supabase/messagerie.sql : chacun ne voit que ses conversations, direct Realtime).
// • Écoute permanente dès la connexion (FMDMessagerie.demarrer, appelé par js/app.js) : compteur des non-lus sur l'entrée
//   « Messagerie » du menu, notification de bureau Windows à chaque message reçu (sauf si la conversation est affichée et la
//   fenêtre active), clic sur la notification → FMD au premier plan, sur la conversation. Barre des tâches qui clignote.
// • Page (FMDMessagerie.monter) : collègues à gauche (dernier message, non-lus, recherche), conversation à droite ;
//   Entrée = envoyer, Maj + Entrée = retour à la ligne. Messages marqués lus quand la conversation est affichée.
// V2 (21 nov. 2026, supabase/messagerie-v2.sql) :
// • « Vu à 14:32 » sous ses propres messages (heure de lecture), « ✓✓ Vu » / « ✓ Envoyé » dans la liste des collègues.
// • Fichiers et images joints (tout type, 50 Mo max) : bouton 📎, glisser-déposer ou Ctrl + V d'une capture.
//   Espace privé « messagerie », dossier <expéditeur>/<destinataire>/ : seuls les deux personnes peuvent l'ouvrir.
//   Images affichées dans la conversation (clic = grande taille) ; autres fichiers : carte, clic = téléchargement.
// • Contrôle des créations (demande : « je suis alternant et Benoit est commercial donc chaque action doit être contrôlée
//   et vue par Farid ») : FMDMessagerie.signalerCreation(), appelé par le CRM à la création d'une commande client, d'une
//   commande fournisseur, d'une proposition ou d'un tiers, envoie « 🔎 À contrôler… » avec un bouton « Ouvrir » vers la
//   fiche à la personne qui contrôle (profils.controle_par, réglé par un administrateur dans la fiche utilisateur).
//   Le contrôleur répond d'un clic « ✓ Contrôlé » (message « ✅ Contrôlé : … » renvoyé à l'auteur).
// V3 (21 nov. 2026, supabase/messagerie-v3.sql) :
// • Widget « À contrôler » = la MÊME carte blanche que les listes du CRM (logo, état, photos des produits, réf. client,
//   date, auteur, montant), dessinée avec les données actuelles du CRM : toute modification de la commande / du tiers
//   s'affiche aussitôt dans le message (FMDERPNuage.surMaj). Fiche absente sur ce PC : aperçu enregistré à l'envoi.
// • « ⋯ » sur chaque message : « Supprimer pour moi » (masque_de / masque_a) ou, pour ses propres messages,
//   « Supprimer pour tout le monde » (ligne et fichier joint supprimés).
// • Mode clair / sombre de la messagerie (bouton ☀ / ☾), gardé sur le PC et dans la fiche en ligne (preferences.messagerie_theme).
(function () {
  'use strict';
  const MAX = 4000;
  const MAX_FICHIER = 50 * 1024 * 1024; // limite de l'espace « messagerie » (offre gratuite Supabase)
  const ESPACE = 'messagerie';
  const S = { ctx: null, sb: null, moi: null, moiNom: '', controle: null, canal: null, messages: [], profils: [], surCompte: null, ouvrirPage: null, ouvrirModule: null, vue: null, cible: null, pret: false, urls: {} };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nomDe = (p) => (p ? (p.nom || `${p.prenom || ''} ${p.nom_famille || ''}`.trim() || p.email || 'Utilisateur') : 'Utilisateur');
  const profil = (id) => S.profils.find((p) => p.id === id);
  const initiale = (p) => nomDe(p).trim().charAt(0).toUpperCase() || '?';
  const heure = (iso) => { const d = new Date(iso); const auj = new Date(); const memeJour = d.toDateString() === auj.toDateString();
    const hier = new Date(auj); hier.setDate(auj.getDate() - 1);
    const h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return memeJour ? h : d.toDateString() === hier.toDateString() ? `Hier ${h}` : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${h}`; };
  const vuA = (iso) => { const h = heure(iso); return /^\d/.test(h) && h.length <= 5 ? `Vu à ${h}` : `Vu ${h.replace(/^Hier/, 'hier')}`; };
  const autre = (m) => (m.de === S.moi ? m.a : m.de);
  // Messages masqués pour moi (« Supprimer pour moi ») : jamais affichés ni comptés.
  const visible = (m) => !((m.de === S.moi && m.masque_de) || (m.a === S.moi && m.masque_a));
  const nonLus = (id) => S.messages.filter((m) => m.a === S.moi && !m.lu_le && visible(m) && (!id || m.de === id)).length;
  const fenetreActive = () => document.visibilityState === 'visible' && document.hasFocus();
  const compter = () => { if (S.surCompte) S.surCompte(nonLus()); };
  const taille = (o) => (o < 1024 ? `${o} o` : o < 1048576 ? `${Math.round(o / 1024)} Ko` : `${(o / 1048576).toFixed(1).replace('.', ',')} Mo`);
  const estImage = (pc) => !!pc && /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$/i.test(pc.type || '');
  const euros = (n) => (+n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const resume = (m) => (m.texte || (m.piece ? `📎 ${m.piece.nom}` : ''));

  async function chargerProfils() {
    const { data } = await S.sb.from('profils').select('id, nom, prenom, nom_famille, email, statut, actif').eq('statut', 'valide');
    S.profils = (data || []).filter((p) => p.actif !== false);
  }
  // Qui contrôle mes créations (supabase/messagerie-v2.sql). Colonne absente (SQL pas encore exécuté) : aucun contrôle.
  async function chargerControle() {
    try { const { data, error } = await S.sb.from('profils').select('*').eq('id', S.moi).maybeSingle(); S.controle = !error && data ? data.controle_par || null : null;
      S.profilMoi = !error ? data : null; const t = data && data.preferences && data.preferences.messagerie_theme; if (t) { S.theme = t; try { localStorage.setItem('fmd-msg-theme', t); } catch { /* */ } } }
    catch { S.controle = null; }
  }
  async function chargerMessages() {
    const { data, error } = await S.sb.from('messages').select('*').order('created_at', { ascending: true }).limit(3000);
    if (error) { S.erreur = /messages|PGRST205|does not exist/i.test(`${error.code} ${error.message}`) ? 'table' : error.message; S.messages = []; return; }
    S.erreur = null;
    S.messages = (data || []).filter((m) => m.de === S.moi || m.a === S.moi).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  // ---------- fichiers joints ----------
  // Lien signé (10 min) gardé en mémoire 8 min : les images ne se rechargent pas à chaque dessin.
  async function lienFichier(chemin, telecharger) {
    const k = `${chemin}|${telecharger || ''}`; const c = S.urls[k];
    if (c && c.fin > Date.now()) return c.url;
    const { data, error } = await S.sb.storage.from(ESPACE).createSignedUrl(chemin, 600, telecharger ? { download: telecharger } : undefined);
    if (error || !data) throw new Error(error ? error.message : 'lien indisponible');
    S.urls[k] = { url: data.signedUrl, fin: Date.now() + 8 * 60 * 1000 };
    return data.signedUrl;
  }
  const nomPropre = (n) => String(n || 'fichier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(-80) || 'fichier';
  async function envoyerFichier(a, f, texte) {
    if (f.size > MAX_FICHIER) throw new Error(`« ${f.name} » dépasse 50 Mo.`);
    const chemin = `${S.moi}/${a}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${nomPropre(f.name)}`;
    const { error } = await S.sb.storage.from(ESPACE).upload(chemin, f, { upsert: false, contentType: f.type || 'application/octet-stream' });
    if (error) throw new Error(/bucket|not found/i.test(error.message) ? 'envoi de fichiers pas encore activé (supabase/messagerie-v2.sql)' : error.message);
    const piece = { chemin, nom: f.name || 'fichier', taille: f.size, type: f.type || '' };
    return inserer({ de: S.moi, a, texte: texte || '', piece });
  }
  async function inserer(ligne) {
    const { data, error } = await S.sb.from('messages').insert(ligne).select().single();
    if (error) throw new Error(error.message || String(error));
    if (data) recu(data); else { await chargerMessages(); if (S.vue) S.vue.dessiner(); }
    return data;
  }

  // ---------- notification de bureau ----------
  function notifierBureau(m) {
    const p = profil(m.de); const titre = m.lien && m.lien.accord ? `🛑 Accord d’encours — ${nomDe(p)}` : m.lien && m.lien.controle ? `🔎 À contrôler — ${nomDe(p)}` : `💬 ${nomDe(p)}`;
    const r = resume(m); const corps = r.length > 160 ? r.slice(0, 157) + '…' : r;
    const L = window.lanceur;
    try { if (L && L.alerte) L.alerte(); } catch { /* barre des tâches */ }
    try {
      if (!('Notification' in window)) return;
      const montrer = () => { const n = new Notification(titre, { body: corps, icon: 'assets/marque/symbole-fmd.png', tag: `fmd-msg-${m.de}`, renotify: true });
        n.onclick = () => { try { if (L && L.premierPlan) L.premierPlan(); window.focus(); } catch { /* */ } S.cible = m.de; if (S.ouvrirPage) S.ouvrirPage(); n.close(); }; };
      if (Notification.permission === 'granted') montrer();
      else if (Notification.permission !== 'denied') Notification.requestPermission().then((x) => { if (x === 'granted') montrer(); });
    } catch (e) { console.error('Notification :', e); }
  }

  function recu(m) {
    if (!m || (m.de !== S.moi && m.a !== S.moi) || S.messages.some((x) => x.id === m.id)) return;
    S.messages.push(m);
    if (m.a === S.moi) {
      const visible = S.vue && S.vue.actuel === m.de && fenetreActive();
      if (!visible) notifierBureau(m);
      else marquerLus(m.de);
    }
    compter(); if (S.vue) S.vue.dessiner();
  }

  async function marquerLus(id) {
    const a = S.messages.filter((m) => m.a === S.moi && m.de === id && !m.lu_le); if (!a.length) return;
    const t = new Date().toISOString(); a.forEach((m) => { m.lu_le = t; }); compter();
    await S.sb.from('messages').update({ lu_le: t }).eq('a', S.moi).eq('de', id).is('lu_le', null);
  }

  // ---------- démarrage (connexion) ----------
  async function demarrer(ctx, o = {}) {
    arreter();
    S.ctx = ctx; S.sb = ctx.sb; S.moi = ctx.moi.id; S.moiNom = ctx.moi.nom || ''; S.surCompte = o.surCompte || null; S.ouvrirPage = o.ouvrir || null; S.ouvrirModule = o.ouvrirModule || null;
    await Promise.all([chargerProfils(), chargerMessages(), chargerControle()]);
    S.pret = true; compter();
    if (S.erreur === 'table') return; // supabase/messagerie.sql pas encore exécuté
    S.canal = S.sb.channel('messagerie-direct')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => recu(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => { const m = S.messages.find((x) => x.id === p.new.id); if (m) { m.lu_le = p.new.lu_le; m.masque_de = p.new.masque_de; m.masque_a = p.new.masque_a; compter(); if (S.vue) S.vue.dessiner(); } })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => { S.messages = S.messages.filter((x) => x.id !== (p.old || {}).id); compter(); if (S.vue) S.vue.dessiner(); })
      .subscribe();
    // la fenêtre redevient active sur une conversation ouverte → messages lus
    window.addEventListener('focus', surFocus);
    // CRM modifié (ce PC ou un autre) → cartes « À contrôler » redessinées avec les données à jour
    if (window.FMDERPNuage && window.FMDERPNuage.surMaj) S.offCrm = window.FMDERPNuage.surMaj(() => { if (S.vue) S.vue.dessiner(); });
  }
  function surFocus() { if (S.vue && S.vue.actuel) marquerLus(S.vue.actuel); }
  function arreter() { if (S.canal && S.sb) { try { S.sb.removeChannel(S.canal); } catch { /* */ } } S.canal = null; S.messages = []; S.pret = false; S.controle = null; S.urls = {}; window.removeEventListener('focus', surFocus); if (S.offCrm) { try { S.offCrm(); } catch { /* */ } S.offCrm = null; } }

  // ---------- mode clair / sombre de la messagerie ----------
  async function changerTheme(t) {
    S.theme = t; try { localStorage.setItem('fmd-msg-theme', t); } catch { /* */ }
    const p = S.profilMoi; if (!p || !('preferences' in p) || !S.sb) return;
    const preferences = { ...(p.preferences || {}), messagerie_theme: t };
    try { const { data } = await S.sb.from('profils').update({ preferences }).eq('id', S.moi).select().maybeSingle(); if (data) S.profilMoi = data; } catch { /* reste sur ce PC */ }
  }

  // ---------- contrôle des créations (appelé par le CRM) ----------
  // o = { quoi: 'la commande client', verbe: 'validé', ref, tiers: 'nom du client', route: 'cmd/fiche/<id>', apercu }
  // apercu (widget dans la conversation) : document { type, titre, ref, role, tiers, ville, date, lignes[], nb, ht, ttc, marge }
  //                                        ou tiers { type: 'tiers', titre, ref, adresse, ville, tel, email, siret, code }
  async function signalerCreation(o) {
    try {
      if (!S.sb || !S.pret || S.erreur || !S.controle || S.controle === S.moi || !o || !o.route) return;
      const libelle = `${o.quoi} ${o.ref || ''}`.trim(); const a = o.apercu;
      const texte = `🔎 À contrôler : ${S.moiNom || 'un utilisateur'} vient de ${o.verbe === 'passé' ? 'passer' : o.verbe === 'validé' ? 'valider' : 'créer'} ${libelle}${o.tiers ? ` (${o.tiers})` : ''}${a && a.ht != null ? ` — ${a.nb} ligne${a.nb > 1 ? 's' : ''}, ${euros(a.ht)} HT` : ''}.`;
      await inserer({ de: S.moi, a: S.controle, texte, lien: { module: 'crm', route: o.route, libelle: libelle.charAt(0).toUpperCase() + libelle.slice(1), controle: true, apercu: a || null } });
    } catch (e) { console.error('Contrôle :', e); if (S.ctx && S.ctx.notifier) S.ctx.notifier('Message de contrôle non envoyé : ' + e.message); }
  }
  // Demandes d'accord d'encours (23 nov. 2026, js/erp-encours.js) : retrouver un collègue par son nom, lui envoyer un message.
  const normNom = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function idParNom(nom) { const n = normNom(nom); const p = S.profils.find((x) => [nomDe(x), `${x.prenom || ''} ${x.nom_famille || ''}`, `${x.nom_famille || ''} ${x.prenom || ''}`].some((k) => normNom(k) === n)); return p ? p.id : null; }
  async function envoyerA(id, texte, lien) {
    if (!S.sb || !S.pret || S.erreur || !id || id === S.moi) return false;
    try { await inserer({ de: S.moi, a: id, texte, lien: lien || null }); return true; } catch (e) { console.error('Message :', e); if (S.ctx && S.ctx.notifier) S.ctx.notifier('Message non envoyé : ' + e.message); return false; }
  }
  // Ouvre la fiche liée (CRM : la route est reprise par js/crm.js au montage).
  function ouvrirLien(l) {
    if (!l || l.module !== 'crm' || !l.route) return;
    try { localStorage.setItem('fmd-crm-route', l.route); } catch { /* */ }
    if (S.ouvrirModule) S.ouvrirModule('crm');
  }
  const dejaControle = (m) => S.messages.some((x) => x.de === S.moi && x.a === m.de && x.lien && x.lien.reponse && x.lien.route === m.lien.route && x.created_at >= m.created_at);

  // ---------- page Messagerie ----------
  function monter(conteneur, ctx) {
    if (!S.sb) { S.sb = ctx.sb; S.moi = ctx.moi.id; S.moiNom = ctx.moi.nom || ''; }
    let recherche = ''; let detruit = false; let envois = 0; let menu = null;
    if (!S.theme) { try { S.theme = localStorage.getItem('fmd-msg-theme') || 'sombre'; } catch { S.theme = 'sombre'; } }
    const vue = { actuel: S.cible || null, dessiner };
    S.cible = null; S.vue = vue;
    conteneur.classList.add('page-messagerie');

    const conversations = () => {
      const derniers = {};
      S.messages.forEach((m) => { if (visible(m)) derniers[autre(m)] = m; });
      return S.profils.filter((p) => p.id !== S.moi)
        .map((p) => ({ p, dernier: derniers[p.id] || null, n: nonLus(p.id) }))
        .filter((c) => !recherche || nomDe(c.p).toLowerCase().includes(recherche))
        .sort((a, b) => (b.dernier ? b.dernier.created_at : '').localeCompare(a.dernier ? a.dernier.created_at : '') || nomDe(a.p).localeCompare(nomDe(b.p), 'fr'));
    };

    const htmlPiece = (pc) => {
      if (!pc) return '';
      const c = S.urls[`${pc.chemin}|`];
      if (estImage(pc)) return `<button type="button" class="msg-image" data-msg-ouvrir="${esc(pc.chemin)}" title="Ouvrir l’image en grand"><img alt="${esc(pc.nom)}" data-msg-img="${esc(pc.chemin)}"${c && c.fin > Date.now() ? ` src="${esc(c.url)}"` : ''}></button>`;
      const ext = (String(pc.nom).match(/\.([A-Za-z0-9]{1,5})$/) || [, ''])[1].toUpperCase();
      return `<button type="button" class="msg-fichier" data-msg-telecharger="${esc(pc.chemin)}" data-msg-nom="${esc(pc.nom)}" title="Télécharger"><span class="msg-fichier-ico">${esc(ext || 'FICHIER')}</span><span class="msg-fichier-txt"><b>${esc(pc.nom)}</b><small>${taille(pc.taille || 0)} · Télécharger</small></span></button>`;
    };
    // Widget « À contrôler » : aperçu de la commande / du devis / du tiers (instantané au moment de l'envoi)
    // Carte du CRM, à jour (D.carteDoc / D.carteTiers), sinon '' (fiche absente sur ce PC, pas d'accès au CRM).
    const CLE_DOC = { prop: 'propositions', cmd: 'commandes', achat: 'achats' };
    let dbCrm;
    const carteCrm = (m) => {
      const l = m.lien; if (!l || l.module !== 'crm' || !l.route || !l.controle) return '';
      const D = window.FMDERP; if (!D || !D.charger || !(D.carteDoc || D.carteTiers)) return '';
      const [tete, vue, id] = l.route.split('/'); if (vue !== 'fiche' || !id) return '';
      try {
        if (dbCrm === undefined) { dbCrm = D.charger(); if (D.ui) D.ui.dbCourant = dbCrm; }
        let html = '';
        if (CLE_DOC[tete] && D.carteDoc) { const d = (dbCrm[CLE_DOC[tete]] || []).find((x) => x.id === id); if (d) html = D.carteDoc(dbCrm, tete, d); }
        else if (tete === 'tiers' && D.carteTiers) { const t = (dbCrm.tiers || []).find((x) => x.id === id); if (t) html = D.carteTiers(dbCrm, t); }
        return html ? `<div class="msg-carte crm-clair" data-msg-lien="${esc(m.id)}" title="Ouvrir la fiche">${html}</div>` : '';
      } catch (e) { console.error('Carte CRM :', e); return ''; }
    };
    const htmlApercu = (m) => {
      const a = m.lien && m.lien.apercu; if (!a && !(m.lien && m.lien.controle)) return '';
      const auteur = nomDe(profil(m.de));
      const carte = carteCrm(m);
      if (carte) return `<div class="msg-widget"><small class="msg-w-quoi">${m.lien.accord ? '🛑 Accord d’encours demandé' : '🔎 À contrôler'} · ${esc(m.lien.libelle || '')} — ${esc(auteur)}</small>${carte}</div>`;
      if (!a) return '';
      if (a.type === 'tiers') return `<div class="msg-widget"><div class="msg-w-tete"><span class="msg-w-ico">▣</span><div><small>🔎 À contrôler · ${esc(a.titre)} créé par ${esc(auteur)}</small><b>${esc(a.ref)}</b></div></div>
        <dl class="msg-w-infos">${[['Adresse', [a.adresse, a.ville].filter(Boolean).join(', ')], ['Téléphone', a.tel], ['E-mail', a.email], ['SIRET', a.siret], ['Code', a.code]].filter((x) => x[1]).map(([k, x]) => `<dt>${k}</dt><dd>${esc(x)}</dd>`).join('') || '<dt>Infos</dt><dd>Aucune coordonnée saisie</dd>'}</dl></div>`;
      const reste = (a.nb || 0) - (a.lignes || []).length;
      return `<div class="msg-widget"><div class="msg-w-tete"><span class="msg-w-ico">${a.type === 'achat' ? '⇩' : a.type === 'prop' ? '✎' : '▤'}</span><div><small>🔎 À contrôler · ${esc(a.titre)} de ${esc(auteur)}</small><b>${esc(a.ref)}</b></div>${a.date ? `<em>${esc(new Date(a.date).toLocaleDateString('fr-FR'))}</em>` : ''}</div>
        <div class="msg-w-tiers"><span>${esc(a.role)}</span><b>${esc(a.tiers || '—')}</b>${a.ville ? `<small>${esc(a.ville)}</small>` : ''}</div>
        <table class="msg-w-lignes"><thead><tr><th>Produit</th><th>Qté</th><th>P.U. HT</th><th>Total HT</th></tr></thead><tbody>${(a.lignes || []).map((l) => `<tr><td>${l.ref ? `<b>${esc(l.ref)}</b> ` : ''}${esc(l.desc)}</td><td>${l.qte}</td><td>${euros(l.pu)}${l.remise ? ` <small>−${l.remise} %</small>` : ''}</td><td>${euros(l.ht)}</td></tr>`).join('') || '<tr><td colspan="4">Aucune ligne</td></tr>'}${reste > 0 ? `<tr><td colspan="4"><small>… et ${reste} autre${reste > 1 ? 's' : ''} ligne${reste > 1 ? 's' : ''}</small></td></tr>` : ''}</tbody></table>
        <div class="msg-w-totaux"><span>Total HT <b>${euros(a.ht)}</b></span><span>TTC <b>${euros(a.ttc)}</b></span>${a.marge != null ? `<span class="${a.marge < 0 ? 'msg-w-perte' : ''}">Marge <b>${euros(a.marge)}</b>${a.ht ? ` (${Math.round((a.marge / a.ht) * 100)} %${a.ht - a.marge > 0 ? ` · coef. ${(a.ht / (a.ht - a.marge)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''})` : ''}</span>` : ''}</div></div>`;
    };
    const htmlLien = (m) => {
      if (!m.lien || !m.lien.route) return '';
      const controler = m.lien.controle && !m.lien.accord && m.a === S.moi; // accord d'encours : se donne sur la fiche du document
      const fait = controler && dejaControle(m);
      return `<div class="msg-lien-actions"><button type="button" class="btn btn-ligne petit" data-msg-lien="${esc(m.id)}">Ouvrir › ${esc(m.lien.libelle || 'la fiche')}</button>${controler ? (fait ? '<span class="pastille st-ok">✓ Contrôlé</span>' : `<button type="button" class="btn btn-metal petit" data-msg-controle="${esc(m.id)}">✓ Contrôlé</button>`) : ''}</div>`;
    };

    function dessiner() {
      if (detruit) return;
      dbCrm = undefined; conteneur.classList.toggle('crm-clair', S.theme === 'clair');
      if (!S.pret) { conteneur.innerHTML = '<div class="msg-vide">Chargement de la messagerie…</div>'; return; }
      if (S.erreur === 'table') { conteneur.innerHTML = '<div class="msg-vide"><b>Messagerie pas encore activée</b><p>Le script <code>supabase/messagerie.sql</code> doit être exécuté une fois dans Supabase.</p></div>'; return; }
      const champ = conteneur.querySelector('[data-msg-texte]'); const brouillon = champ ? champ.value : ''; const focus = champ && document.activeElement === champ;
      const ancienFil = conteneur.querySelector('[data-msg-fil]'); const enBas = !ancienFil || ancienFil.scrollHeight - ancienFil.scrollTop - ancienFil.clientHeight < 80; const yFil = ancienFil ? ancienFil.scrollTop : 0;
      const liste = conversations(); const p = vue.actuel ? profil(vue.actuel) : null;
      const fil = p ? S.messages.filter((m) => autre(m) === p.id && visible(m)) : [];
      const dernierAMoi = [...fil].reverse().find((m) => m.de === S.moi);
      let jour = '';
      const bulles = fil.map((m) => { const j = new Date(m.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const sep = j !== jour ? `<div class="msg-jour"><span>${esc(j)}</span></div>` : ''; jour = j; const moi = m.de === S.moi;
        const etat = moi ? (m.lu_le ? ` · <span class="msg-lu" title="Lu le ${esc(new Date(m.lu_le).toLocaleString('fr-FR'))}">✓✓ ${esc(vuA(m.lu_le))}</span>` : ` · <span class="msg-envoye" title="Pas encore lu">✓ Envoyé${m === dernierAMoi ? ', pas encore vu' : ''}</span>`) : '';
        return `${sep}<div class="msg-bulle ${moi ? 'moi' : 'lui'}${m.lien && m.lien.controle ? ' controle' : ''}${m.lien && (m.lien.apercu || m.lien.controle) ? ' widget' : ''}${m.piece && estImage(m.piece) && !m.texte ? ' image-seule' : ''}">${htmlPiece(m.piece)}${htmlApercu(m)}${m.texte && !(m.lien && (m.lien.apercu || carteCrm(m))) ? `<div class="msg-texte">${esc(m.texte).replace(/\n/g, '<br>')}</div>` : ''}${htmlLien(m)}<div class="msg-meta">${heure(m.created_at)}${etat}</div>
          <button type="button" class="msg-plus" data-msg-menu="${esc(m.id)}" title="Options du message" aria-label="Options du message">⋯</button>${menu === m.id ? `<div class="msg-menu" role="menu"><button type="button" role="menuitem" data-msg-masquer="${esc(m.id)}">Supprimer pour moi</button>${moi ? `<button type="button" role="menuitem" class="danger" data-msg-supprimer="${esc(m.id)}">Supprimer pour tout le monde</button>` : ''}</div>` : ''}</div>`; }).join('');
      const apercu = (c) => { if (!c.dernier) return 'Aucun message'; const d = c.dernier; const r = esc(resume(d).slice(0, 60));
        return d.de === S.moi ? `${d.lu_le ? '<i class="msg-vu">✓✓ Vu</i>' : '<i>✓</i>'} Vous : ${r}` : r; };
      conteneur.innerHTML = `
        <aside class="msg-cote">
          <div class="msg-cote-tete"><div class="msg-titre"><h2>Messagerie</h2><button type="button" class="btn btn-ligne petit" data-msg-theme title="Changer l’apparence de la messagerie">${S.theme === 'clair' ? '☾ Mode sombre' : '☀ Mode clair'}</button></div><input type="search" class="msg-cherche" placeholder="Rechercher un collègue…" value="${esc(recherche)}" data-msg-cherche aria-label="Rechercher un collègue"></div>
          <div class="msg-liste">${liste.length ? liste.map((c) => `<button type="button" class="msg-contact${c.p.id === vue.actuel ? ' actif' : ''}${c.n ? ' non-lu' : ''}" data-msg-contact="${c.p.id}">
              <span class="msg-avatar">${esc(initiale(c.p))}</span><span class="msg-c-txt"><b>${esc(nomDe(c.p))}</b><small>${apercu(c)}</small></span>
              <span class="msg-c-d">${c.dernier ? `<em>${heure(c.dernier.created_at)}</em>` : ''}${c.n ? `<span class="compteur">${c.n}</span>` : ''}</span></button>`).join('') : '<p class="msg-rien">Aucun collègue trouvé.</p>'}</div>
          ${S.controle && profil(S.controle) ? `<p class="msg-info">🔎 Vos nouvelles commandes, propositions et tiers sont envoyés pour contrôle à <b>${esc(nomDe(profil(S.controle)))}</b>.</p>` : ''}
          ${'Notification' in window && Notification.permission === 'denied' ? '<p class="msg-alerte">Notifications de bureau bloquées par Windows pour FMD : Paramètres Windows › Système › Notifications.</p>' : ''}
        </aside>
        <section class="msg-conv">${p ? `
          <header class="msg-conv-tete"><span class="msg-avatar grand">${esc(initiale(p))}</span><div><b>${esc(nomDe(p))}</b><small>${esc(p.email || '')}</small></div></header>
          <div class="msg-fil" data-msg-fil>${bulles || `<div class="msg-vide petit">Écrivez votre premier message à ${esc(nomDe(p))}.</div>`}${envois ? `<div class="msg-bulle moi envoi">Envoi de ${envois} fichier${envois > 1 ? 's' : ''}…</div>` : ''}</div>
          <form class="msg-saisie" data-msg-form><button type="button" class="btn-icone msg-joindre" data-msg-joindre title="Joindre un fichier ou une image (50 Mo max). Vous pouvez aussi glisser-déposer ou coller une capture (Ctrl + V)." aria-label="Joindre un fichier">📎</button><input type="file" multiple hidden data-msg-fichiers><textarea data-msg-texte rows="1" maxlength="${MAX}" placeholder="Écrire à ${esc(nomDe(p))}… (Entrée pour envoyer, Maj + Entrée pour aller à la ligne)" aria-label="Message">${esc(brouillon)}</textarea><button type="submit" class="btn btn-metal">Envoyer</button></form>
          <div class="msg-depot" data-msg-depot hidden>Déposez le fichier pour l’envoyer à ${esc(nomDe(p))}</div>`
        : '<div class="msg-vide"><b>Choisissez un collègue</b><p>Les messages arrivent instantanément, avec une notification sur le bureau.</p></div>'}</section>`;
      const filEl = conteneur.querySelector('[data-msg-fil]'); if (filEl) filEl.scrollTop = enBas ? filEl.scrollHeight : yFil;
      const t = conteneur.querySelector('[data-msg-texte]'); if (t && (focus || p)) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
      if (p && fenetreActive()) marquerLus(p.id);
      // images : lien signé chargé après le dessin
      conteneur.querySelectorAll('img[data-msg-img]:not([src])').forEach((img) => {
        lienFichier(img.dataset.msgImg).then((u) => { img.src = u; img.addEventListener('load', () => { const f = conteneur.querySelector('[data-msg-fil]'); if (f && enBas) f.scrollTop = f.scrollHeight; }, { once: true }); })
          .catch(() => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'msg-rien', textContent: 'Image indisponible' })); });
      });
    }

    // « Supprimer pour moi » : masqué seulement chez moi
    async function masquer(id) {
      const m = S.messages.find((x) => x.id === id); if (!m) return;
      const champ = m.de === S.moi ? 'masque_de' : 'masque_a'; m[champ] = true; compter(); dessiner();
      const { error } = await S.sb.from('messages').update({ [champ]: true }).eq('id', id);
      if (error) { m[champ] = false; compter(); dessiner(); ctx.notifier(/masque/i.test(error.message) ? 'Suppression pas encore activée (supabase/messagerie-v3.sql).' : 'Non supprimé : ' + error.message); }
    }
    // « Supprimer pour tout le monde » : mes messages seulement ; la pièce jointe part aussi
    async function supprimerTous(id) {
      const m = S.messages.find((x) => x.id === id); if (!m || m.de !== S.moi) return;
      if (!window.confirm('Supprimer ce message pour tout le monde ? Il disparaîtra aussi chez ' + nomDe(profil(m.a)) + '. Cette action ne peut pas être annulée.')) { dessiner(); return; }
      const { error } = await S.sb.from('messages').delete().eq('id', id);
      if (error) { ctx.notifier('Non supprimé : ' + error.message); return; }
      if (m.piece && m.piece.chemin) { try { await S.sb.storage.from(ESPACE).remove([m.piece.chemin]); } catch { /* fichier déjà parti */ } }
      S.messages = S.messages.filter((x) => x.id !== id); compter(); dessiner();
    }

    async function envoyerFichiers(fichiers) {
      const a = vue.actuel; if (!a || !fichiers.length) return;
      const trop = fichiers.filter((f) => f.size > MAX_FICHIER);
      if (trop.length) ctx.notifier(`Trop lourd (50 Mo max) : ${trop.map((f) => f.name).join(', ')}`);
      const ok = fichiers.filter((f) => f.size <= MAX_FICHIER); if (!ok.length) return;
      const t = conteneur.querySelector('[data-msg-texte]'); const texte = t ? t.value.trim() : ''; if (t) t.value = '';
      envois += ok.length; dessiner();
      for (let i = 0; i < ok.length; i++) {
        try { await envoyerFichier(a, ok[i], i === 0 ? texte : ''); }
        catch (e) { ctx.notifier(`« ${ok[i].name} » non envoyé : ${e.message}`); if (i === 0 && texte && t) t.value = texte; }
        envois--; dessiner();
      }
    }

    async function envoyer() {
      const t = conteneur.querySelector('[data-msg-texte]'); const texte = t.value.trim(); if (!texte || !vue.actuel) return;
      if (texte.length > MAX) { ctx.notifier(`Message trop long (${MAX} caractères au plus).`); return; }
      t.value = ''; t.disabled = true;
      try { await inserer({ de: S.moi, a: vue.actuel, texte }); t.disabled = false; }
      catch (e) { t.disabled = false; t.value = texte; ctx.notifier('Message non envoyé : ' + e.message); t.focus(); }
    }

    const clic = async (e) => {
      if (e.target.closest('[data-msg-theme]')) { changerTheme(S.theme === 'clair' ? 'sombre' : 'clair'); dessiner(); return; }
      const mn = e.target.closest('[data-msg-menu]'); if (mn) { menu = menu === mn.dataset.msgMenu ? null : mn.dataset.msgMenu; dessiner(); return; }
      const ms = e.target.closest('[data-msg-masquer]'); if (ms) { menu = null; await masquer(ms.dataset.msgMasquer); return; }
      const sp = e.target.closest('[data-msg-supprimer]'); if (sp) { menu = null; await supprimerTous(sp.dataset.msgSupprimer); return; }
      if (menu && !e.target.closest('.msg-menu')) { menu = null; dessiner(); }
      const c = e.target.closest('[data-msg-contact]'); if (c) { vue.actuel = c.dataset.msgContact; marquerLus(vue.actuel); dessiner(); return; }
      if (e.target.closest('[data-msg-joindre]')) { conteneur.querySelector('[data-msg-fichiers]').click(); return; }
      const l = e.target.closest('[data-msg-lien]'); if (l) { const m = S.messages.find((x) => x.id === l.dataset.msgLien); if (m) ouvrirLien(m.lien); return; }
      const k = e.target.closest('[data-msg-controle]');
      if (k) { const m = S.messages.find((x) => x.id === k.dataset.msgControle); if (!m) return; k.disabled = true;
        try { await inserer({ de: S.moi, a: m.de, texte: `✅ Contrôlé : ${m.lien.libelle || 'votre création'}. Merci !`, lien: { module: m.lien.module, route: m.lien.route, libelle: m.lien.libelle, reponse: true } }); }
        catch (er) { k.disabled = false; ctx.notifier('Réponse non envoyée : ' + er.message); } return; }
      const o = e.target.closest('[data-msg-ouvrir], [data-msg-telecharger]');
      if (o) { try { const u = o.dataset.msgOuvrir ? await lienFichier(o.dataset.msgOuvrir) : await lienFichier(o.dataset.msgTelecharger, o.dataset.msgNom || true); window.open(u, '_blank'); }
        catch (er) { ctx.notifier('Fichier indisponible : ' + er.message); } }
    };
    const saisie = (e) => { if (e.target.matches('[data-msg-cherche]')) { recherche = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; dessiner(); const r = conteneur.querySelector('[data-msg-cherche]'); r.focus(); r.setSelectionRange(pos, pos); } };
    const change = (e) => { if (e.target.matches('[data-msg-fichiers]')) { const f = [...e.target.files]; e.target.value = ''; envoyerFichiers(f); } };
    const touche = (e) => { if (e.target.matches('[data-msg-texte]') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } };
    const soumis = (e) => { if (e.target.matches('[data-msg-form]')) { e.preventDefault(); envoyer(); } };
    // Ctrl + V d'une capture d'écran ou d'un fichier copié
    const coller = (e) => { if (!vue.actuel || !e.clipboardData) return; const f = [...e.clipboardData.files]; if (f.length) { e.preventDefault(); envoyerFichiers(f.map((x, i) => (x.name && x.name !== 'image.png' ? x : new File([x], `capture-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}${i ? '-' + i : ''}.png`, { type: x.type || 'image/png' })))); } };
    // Glisser-déposer
    const depot = (montrer) => { const d = conteneur.querySelector('[data-msg-depot]'); if (d) d.hidden = !montrer; };
    const survol = (e) => { if (vue.actuel && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); depot(true); } };
    const sortie = (e) => { if (!e.relatedTarget || !conteneur.contains(e.relatedTarget)) depot(false); };
    const lache = (e) => { if (!vue.actuel || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); depot(false); envoyerFichiers([...e.dataTransfer.files]); };
    conteneur.addEventListener('click', clic); conteneur.addEventListener('input', saisie); conteneur.addEventListener('change', change); conteneur.addEventListener('keydown', touche); conteneur.addEventListener('submit', soumis);
    conteneur.addEventListener('paste', coller); conteneur.addEventListener('dragover', survol); conteneur.addEventListener('dragleave', sortie); conteneur.addEventListener('drop', lache);
    if (!S.pret) Promise.all([chargerProfils(), chargerMessages(), chargerControle()]).then(() => { S.pret = true; compter(); dessiner(); }); else dessiner();
    return { detruire() { detruit = true; if (S.vue === vue) S.vue = null;
      conteneur.removeEventListener('click', clic); conteneur.removeEventListener('input', saisie); conteneur.removeEventListener('change', change); conteneur.removeEventListener('keydown', touche); conteneur.removeEventListener('submit', soumis);
      conteneur.removeEventListener('paste', coller); conteneur.removeEventListener('dragover', survol); conteneur.removeEventListener('dragleave', sortie); conteneur.removeEventListener('drop', lache);
      conteneur.classList.remove('page-messagerie', 'crm-clair'); } };
  }

  window.FMDMessagerie = { demarrer, arreter, monter, signalerCreation, idParNom, envoyerA, ouvrirConversation(id) { S.cible = id; }, get nonLus() { return nonLus(); } };
})();
