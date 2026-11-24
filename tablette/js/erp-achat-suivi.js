// FMD — CRM / ERP : suivi des commandes fournisseurs avec pièces jointes (21 nov. 2026). Demande :
//  « quand on clique sur AR reçu, une page s'ouvre, il faut joindre l'AR pour qu'elle soit confirmée (pas possible de rentrer
//    la commande en stock si l'AR n'est pas joint). Après avoir réceptionné la marchandise, il faut joindre la facture
//    (automatiquement mise dans la comptabilité) avant que la commande soit définitivement clôturée. Quand il reste des
//    produits pas reçus (oubliés, perdus au transport), un bouton « Ouvrir un litige » qui édite un PDF de réclamation avec
//    uniquement les produits non réceptionnés ».
// Pages (routes) : achat/fiche/<id>/ar · achat/fiche/<id>/facture · achat/fiche/<id>/litige (appelées par erp-commerce.js).
// Pièces : d.ar_piece, d.facture_piece, d.litiges[] = { id, ref, date, motif, note, lignes, par, etat: ouvert|clos, pdf }.
// Fichiers : espace privé Supabase donnees-fmd, crm/pieces/achats/<id commande>/… (FMDERPNuage.envoyerPiece). Hors ligne
// (ou essai) : petit fichier gardé dans la base (data:), au plus 3 Mo. La Compta lit la commande « Classée facturée » toute seule.
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const U = D.ui;
  const esc = U.esc;
  const MAX_LOCAL = 3 * 1024 * 1024;
  const N = () => window.FMDERPNuage;

  // ---------- pièces jointes ----------
  const lireDataUrl = (f) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(new Error('Lecture du fichier impossible')); r.readAsDataURL(f); });
  const propre = (n) => String(n || 'piece').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
  D.envoyerPiece = async (fichier, dossier) => {
    if (!fichier) throw new Error('Aucun fichier choisi');
    if (fichier.size > 50 * 1024 * 1024) throw new Error('Fichier trop gros (50 Mo au plus)');
    const p = { nom: fichier.name, type: fichier.type || '', taille: fichier.size, le: D.maintenant(), par: D.MOI };
    const n = N();
    if (n && n.actif) { p.chemin = await n.envoyerPiece(`crm/pieces/${dossier}/${Date.now()}-${propre(fichier.name)}`, fichier); return p; }
    if (fichier.size > MAX_LOCAL) throw new Error('Hors ligne : fichier trop gros pour être gardé sur ce PC (3 Mo au plus). Réessayez une fois connecté.');
    p.data = await lireDataUrl(fichier); return p;
  };
  D.ouvrirPiece = async (v, p) => {
    if (!p) return;
    try {
      if (p.chemin) { const url = await N().lienPiece(p.chemin); window.open(url, '_blank'); return; }
      if (p.data) {
        const img = /^data:image\//.test(p.data);
        v.fenetre(esc(p.nom), img ? `<img src="${esc(p.data)}" alt="${esc(p.nom)}" style="max-width:100%;border-radius:12px">` : `<p>Pièce gardée sur ce PC (envoyée en ligne à la prochaine connexion impossible : elle reste dans la fiche).</p>`,
          `<a class="btn btn-ligne" href="${esc(p.data)}" download="${esc(p.nom)}">Enregistrer le fichier</a><button type="button" class="btn btn-metal" data-fermer>Fermer</button>`);
      }
    } catch (e) { v.notifier('Pièce impossible à ouvrir : ' + e.message); }
  };
  const taille = (n) => (n > 1048576 ? `${D.nombre(Math.round(n / 104857.6) / 10)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
  const lignePiece = (p, attr) => `<div class="erp-piece"><span class="erp-piece-ico">📎</span><span><b>${esc(p.nom)}</b><small>${taille(p.taille || 0)} · ajouté le ${D.jour(p.le)} par ${esc(p.par || '')}${p.data ? ' · gardé sur ce PC' : ''}</small></span><button type="button" class="btn petit btn-ligne" ${attr}>Voir</button></div>`;
  // Champ « joindre un fichier » (glisser-déposer ou clic)
  const champFichier = (nom, lib) => `<label class="erp-depot" data-depot><input type="file" name="${nom}" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.eml,.msg" required hidden>
    <span class="erp-depot-ico">📎</span><b>${esc(lib)}</b><small data-depot-nom>Cliquez ou glissez le fichier ici (PDF, photo, scan…)</small></label>`;
  const lierDepot = (el) => el.querySelectorAll('[data-depot]').forEach((z) => { const inp = z.querySelector('input'); const nom = z.querySelector('[data-depot-nom]');
    const maj = () => { const f = inp.files[0]; nom.textContent = f ? `${f.name} · ${taille(f.size)}` : 'Cliquez ou glissez le fichier ici (PDF, photo, scan…)'; z.classList.toggle('plein', !!f); };
    inp.addEventListener('change', maj);
    z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('survol'); });
    z.addEventListener('dragleave', () => z.classList.remove('survol'));
    z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('survol'); if (e.dataTransfer.files.length) { inp.files = e.dataTransfer.files; maj(); } }); });

  // ---------- règles ----------
  const restants = (d) => d.lignes.map((l, i) => ({ l, i, reste: Math.max(0, (+l.qte || 0) - (+l.recu || 0)) })).filter((x) => x.reste > 0);
  D.litigeOuvert = (d) => (d.litiges || []).some((x) => x.etat === 'ouvert');
  // Facture : commande reçue (entièrement, ou en partie avec un litige ouvert pour le reste)
  D.peutJoindreFacture = (d) => ['recue', 'attente_facture'].includes(d.etat) || (d.etat === 'recue_partiel' && (d.litiges || []).length > 0); // reste couvert par un litige (ouvert ou clos)

  const entete = (v, d, titre, ico) => { const t = D.tiers(v.db, d.tiers) || {};
    return `${U.titrePage(ico, `${titre} — ${d.ref}`, null, U.btn('Retour à la commande', 'rouvrir', 'btn-ligne', `data-aller="achat/fiche/${d.id}"`))}
      <div class="erp-carte erp-2c">${U.infos([['Fournisseur', U.lienTiers(v.db, d.tiers)], ['Commande', `<b>${esc(d.ref)}</b> du ${D.jour(d.date)}`], ['Réf. fournisseur', esc(d.ref_fourn || '')]])}
        ${U.infos([['Montant HT', `<b>${D.euros(D.ht(d))}</b>`], ['Montant TTC', D.euros(D.ttc(d))], ['État', U.pastille('achat', d.etat)], ['Contact fournisseur', esc(t.email || t.tel || '')]])}</div>`; };
  const envoi = async (v, form, faire) => { const b = form.querySelector('[type=submit]'); b.disabled = true; const txt = b.textContent; b.textContent = 'Envoi du fichier…';
    try { await faire(); } catch (e) { b.disabled = false; b.textContent = txt; v.notifier('Pièce non enregistrée : ' + e.message); } };

  // ---------- page « AR reçu » ----------
  function pageAR(v, d) {
    const db = v.db;
    if (!['commande', 'ar_recu'].includes(d.etat)) return { html: `${entete(v, d, 'Accusé de réception', 'valider')}${U.vide('L’AR se joint quand la commande est envoyée au fournisseur.')}` };
    return { html: `${entete(v, d, 'Accusé de réception', 'valider')}
      <p class="erp-gris">Joignez l’accusé de réception (AR) envoyé par le fournisseur : la commande passe en « AR reçu » et la réception des produits devient possible.</p>
      ${d.ar_piece ? U.bloc('AR déjà joint', lignePiece(d.ar_piece, 'data-voir-ar')) : ''}
      ${U.bloc(d.ar_piece ? 'Remplacer l’AR' : 'Joindre l’AR', U.form('erp-ar-page', `${champFichier('fichier', 'Accusé de réception du fournisseur')}
        <div class="erp-2f">${U.ligne('N° de l’AR', U.inp('ar_num', d.ar_num || '', { req: true, ph: 'Numéro indiqué sur l’AR' }), { req: true })}${U.ligne('Date de livraison confirmée', U.inp('livraison', d.livraison || '', { type: 'date' }))}</div>`,
        `${U.btn('Annuler', '', 'btn-ligne', `type="button" data-aller="achat/fiche/${d.id}"`)}${U.btn('Joindre l’AR et confirmer', 'valider', 'btn-metal', 'type="submit"')}`))}`,
      apres: (el) => {
        lierDepot(el);
        const vo = el.querySelector('[data-voir-ar]'); if (vo) vo.addEventListener('click', () => D.ouvrirPiece(v, d.ar_piece));
        const f = el.querySelector('#erp-ar-page');
        f.addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(f); const fichier = f.querySelector('[name=fichier]').files[0];
          envoi(v, f, async () => {
            d.ar_piece = await D.envoyerPiece(fichier, `achats/${d.id}`); d.ar_num = c.ar_num; d.ar_date = D.auj(); if (c.livraison) d.livraison = c.livraison;
            if (d.etat === 'commande') d.etat = 'ar_recu'; D.toucher(d);
            D.evt(db, `Commande fournisseur ${d.ref} : AR reçu et joint (n° ${c.ar_num}, ${d.ar_piece.nom})`, { tiers: d.tiers, objet: { type: 'achat', id: d.id } });
            v.sauver(); v.notifier('AR joint : la commande est confirmée, la réception est possible.'); v.aller(`achat/fiche/${d.id}`); }); });
      } };
  }

  // ---------- page « Joindre la facture » (clôture) ----------
  function pageFacture(v, d) {
    const db = v.db;
    if (!D.peutJoindreFacture(d)) return { html: `${entete(v, d, 'Facture fournisseur', 'facture')}${U.vide(d.etat === 'facturee' ? 'Cette commande est déjà clôturée (facture jointe).' : d.etat === 'recue_partiel' ? 'Des produits ne sont pas encore reçus : réceptionnez-les ou ouvrez un litige avant de joindre la facture.' : 'La facture se joint une fois la marchandise réceptionnée.')}` };
    const r = restants(d);
    return { html: `${entete(v, d, 'Facture fournisseur', 'facture')}
      <p class="erp-gris">Joignez la facture du fournisseur : la commande est <b>clôturée</b> (« Classée facturée ») et la facture part automatiquement dans la <b>Compta</b> (À payer, trésorerie).</p>
      ${r.length ? `<p class="erp-moins">⚠ ${r.length} produit(s) non reçu(s), en litige : vérifiez que la facture ne les compte pas (ou attendez l’avoir du fournisseur).</p>` : ''}
      ${U.bloc('Joindre la facture', U.form('erp-fa-page', `${champFichier('fichier', 'Facture du fournisseur')}
        <div class="erp-2f">${U.ligne('N° de la facture', U.inp('num', d.facture_num || '', { req: true }), { req: true })}${U.ligne('Date de la facture', U.inp('date', D.auj(), { type: 'date', req: true }), { req: true })}</div>
        ${U.ligne('Montant TTC (€)', U.inp('ttc', D.arrondi(D.ttc(d)), { type: 'number', step: '0.01', min: 0, req: true }), { req: true, aide: 'Montant figurant sur la facture (proposé : montant TTC de la commande).' })}`,
        `${U.btn('Annuler', '', 'btn-ligne', `type="button" data-aller="achat/fiche/${d.id}"`)}${U.btn('Joindre la facture et clôturer', 'valider', 'btn-metal', 'type="submit"')}`))}`,
      apres: (el) => {
        lierDepot(el);
        const f = el.querySelector('#erp-fa-page');
        f.addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(f); const fichier = f.querySelector('[name=fichier]').files[0];
          envoi(v, f, async () => {
            d.facture_piece = await D.envoyerPiece(fichier, `achats/${d.id}`); d.facture_num = c.num; d.facture_date = c.date; d.facture_ttc = +c.ttc || D.ttc(d); d.payee = false;
            d.etat = 'facturee'; d.cloturee = D.maintenant(); D.toucher(d);
            D.evt(db, `Commande fournisseur ${d.ref} clôturée : facture ${c.num} jointe (${D.euros(d.facture_ttc)} TTC), envoyée en comptabilité`, { tiers: d.tiers, objet: { type: 'achat', id: d.id } });
            v.sauver(); v.notifier(`${d.ref} clôturée : facture jointe et ajoutée à la Compta.`); v.aller(`achat/fiche/${d.id}`); }); });
      } };
  }

  // ---------- page « Ouvrir un litige » ----------
  const MOTIFS = ['Produits manquants à la livraison', 'Produits perdus pendant le transport', 'Produits oubliés par le fournisseur', 'Produits endommagés'];
  const docLitige = (d, x) => ({ id: x.id, ref: x.ref, tiers: d.tiers, date: x.date, etat: 'ouvert', motif: x.motif, note_pub: x.note, auteur: x.par, commande_ref: d.ref, commande_date: d.date, ref_fourn: d.ref_fourn, ar_num: d.ar_num,
    lignes: x.lignes.map((l) => ({ ...l })) });
  D.pdfLitige = async (v, d, x) => {
    v.notifier('Préparation du PDF de réclamation…');
    try { const doc = docLitige(d, x); const chemin = await D.produirePdf(v, 'litige', doc); if (chemin) { x.pdf = doc.pdf; D.toucher(d); v.sauver(); await window.lanceur.docAfficher(chemin); } }
    catch (e) { v.fenetre('PDF impossible', `<p>Le PDF n’a pas pu être fabriqué : ${esc(e.message)}</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); }
  };
  function pageLitige(v, d) {
    const db = v.db; const r = restants(d);
    if (!['ar_recu', 'recue_partiel'].includes(d.etat) || !r.length || !d.lignes.some((l) => (+l.recu || 0) > 0)) return { html: `${entete(v, d, 'Litige de livraison', 'alerte')}${U.vide('Un litige s’ouvre quand une partie des produits a été réceptionnée et qu’il en manque.')}` };
    const lignes = r.map(({ l, i, reste }) => `<tr><td><input type="checkbox" name="c${i}" checked aria-label="Mettre en litige"></td><td>${esc(l.desc)}${l.ref_fourn ? ` <span class="erp-gris">(${esc(l.ref_fourn)})</span>` : ''}</td><td class="nb">${D.nombre(l.qte)}</td><td class="nb">${D.nombre(l.recu || 0)}</td>
      <td class="nb"><input class="erp-inline" style="width:80px" type="number" min="1" max="${reste}" step="1" name="q${i}" value="${reste}" aria-label="Quantité manquante"></td><td class="nb">${D.euros(D.htLigne({ ...l, qte: reste }))}</td></tr>`).join('');
    return { html: `${entete(v, d, 'Litige de livraison', 'alerte')}
      <p class="erp-gris">Seuls les produits <b>non réceptionnés</b> sont repris. Décochez ceux qui doivent encore arriver normalement. Un PDF de réclamation est édité pour le fournisseur.</p>
      ${U.form('erp-lit', `${U.bloc('Produits non réceptionnés', `<table class="registre erp-table"><thead><tr><th></th><th>Produit</th><th class="nb">Commandé</th><th class="nb">Reçu</th><th class="nb">Manquant (litige)</th><th class="nb">Montant HT</th></tr></thead><tbody>${lignes}</tbody></table>`, { compte: r.length })}
        <div class="erp-2f">${U.ligne('Motif', U.sel('motif', MOTIFS, MOTIFS[0]))}${U.ligne('Note pour le fournisseur', U.inp('note', '', { ph: 'Ex. colis n° 2 manquant, constaté à la livraison du …' }))}</div>`,
        `${U.btn('Annuler', '', 'btn-ligne', `type="button" data-aller="achat/fiche/${d.id}"`)}${U.btn('Ouvrir le litige et éditer le PDF', 'pdf', 'btn-metal', 'type="submit"')}`)}`,
      apres: (el) => {
        const f = el.querySelector('#erp-lit');
        f.addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(f);
          const sel = r.filter(({ i }) => c['c' + i]).map(({ l, i, reste }) => ({ produit: l.produit, desc: l.desc, ref_fourn: l.ref_fourn || '', pu: +l.pu || 0, remise: +l.remise || 0, tva: l.tva, qte: Math.min(reste, Math.max(1, Math.round(+c['q' + i] || reste))), ligne: i }));
          if (!sel.length) { v.notifier('Cochez au moins un produit à mettre en litige.'); return; }
          d.litiges = d.litiges || []; const x = { id: D.id('lit'), ref: `LIT-${String(d.ref).replace(/[()]/g, '')}-${d.litiges.length + 1}`, date: D.auj(), motif: c.motif, note: c.note || '', lignes: sel, par: D.MOI, etat: 'ouvert', cree: D.maintenant() };
          d.litiges.push(x); D.toucher(d);
          D.evt(db, `Litige ${x.ref} ouvert sur ${d.ref} : ${sel.length} produit(s) non reçu(s) (${x.motif})`, { tiers: d.tiers, objet: { type: 'achat', id: d.id } });
          v.sauver(); v.aller(`achat/fiche/${d.id}`); D.pdfLitige(v, d, x); });
      } };
  }

  D.pageAchatSuivi = (v, etape, id) => {
    const d = v.db.achats.find((x) => x.id === id);
    if (!d) return { html: `<div class="erp-vide-page"><h1>Commande introuvable</h1>${U.lien('achat/liste/tous', 'Retour à la liste')}</div>` };
    return etape === 'ar' ? pageAR(v, d) : etape === 'facture' ? pageFacture(v, d) : pageLitige(v, d);
  };

  // ---------- bloc « Pièces jointes et litiges » de la fiche commande ----------
  D.blocPiecesAchat = (v, d) => {
    const lit = d.litiges || [];
    if (!d.ar_piece && !d.facture_piece && !lit.length) return '';
    const total = (x) => x.lignes.reduce((s, l) => s + D.htLigne(l), 0);
    return U.bloc('Pièces jointes et litiges', `${d.ar_piece ? `<h3 class="erp-sous-titre">Accusé de réception${d.ar_num ? ` n° ${esc(d.ar_num)}` : ''}</h3>${lignePiece(d.ar_piece, 'data-piece="ar"')}` : ''}
      ${d.facture_piece ? `<h3 class="erp-sous-titre">Facture${d.facture_num ? ` n° ${esc(d.facture_num)}` : ''} · ${D.euros(+d.facture_ttc || 0)} TTC · dans la Compta</h3>${lignePiece(d.facture_piece, 'data-piece="facture"')}` : ''}
      ${lit.length ? `<h3 class="erp-sous-titre">Litiges</h3>${U.tableau([['Réf.', (x) => `<b>${esc(x.ref)}</b>`], ['Date', (x) => D.jour(x.date)], ['Motif', (x) => esc(x.motif)], ['Produits', (x) => esc(x.lignes.map((l) => `${l.desc} × ${D.nombre(l.qte)}`).join(', '))], ['Montant HT', (x) => D.euros(total(x)), 'nb'], ['Par', (x) => esc(x.par || '')],
        ['État', (x) => (x.etat === 'ouvert' ? '<span class="pastille st-ko"><i class="erp-point"></i>Ouvert</span>' : `<span class="pastille st-ok"><i class="erp-point"></i>Clos${x.clos_le ? ' le ' + D.jour(x.clos_le) : ''}</span>`)],
        ['', (x) => `<button type="button" class="btn petit btn-ligne" data-lit-pdf="${x.id}">PDF</button>${x.etat === 'ouvert' ? ` <button type="button" class="btn petit btn-ligne" data-lit-clore="${x.id}">Clore</button>` : ''}`]], lit)}` : ''}`, { compte: (d.ar_piece ? 1 : 0) + (d.facture_piece ? 1 : 0) + lit.length });
  };
  D.lierPiecesAchat = (el, v, d) => {
    el.querySelectorAll('[data-piece]').forEach((b) => b.addEventListener('click', () => D.ouvrirPiece(v, b.dataset.piece === 'ar' ? d.ar_piece : d.facture_piece)));
    el.querySelectorAll('[data-lit-pdf]').forEach((b) => b.addEventListener('click', () => { const x = (d.litiges || []).find((y) => y.id === b.dataset.litPdf); if (x) D.pdfLitige(v, d, x); }));
    el.querySelectorAll('[data-lit-clore]').forEach((b) => b.addEventListener('click', () => { const x = (d.litiges || []).find((y) => y.id === b.dataset.litClore); if (!x) return;
      v.confirmer(`Clore le litige ${x.ref} ?`, 'À faire quand le fournisseur a livré les produits manquants ou envoyé un avoir.', 'Clore le litige', () => {
        x.etat = 'clos'; x.clos_le = D.auj(); x.clos_par = D.MOI; D.toucher(d); D.evt(v.db, `Litige ${x.ref} clos (${d.ref})`, { tiers: d.tiers, objet: { type: 'achat', id: d.id } }); v.sauver(); v.rendre(); }); }));
  };
})();
