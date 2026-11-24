// FMD — CRM / ERP : Import de l'HISTORIQUE des ventes (24 nov. 2026, demande : « fais un importateur de commandes et
// factures pour les avoir uniquement en mode spectateur et que ce soit intégré au CA / marge etc »).
// Menu Outils → Import de l'historique (route « historique »).
//  - Fichier Excel (.xlsx) ou CSV : UNE LIGNE PAR LIGNE DE DOCUMENT (type, n°, date, client, réf. produit, désignation,
//    quantité, prix unitaire HT, remise, TVA, prix d'achat…). Les lignes de même n° forment un document. Colonnes
//    reconnues par leur titre (plusieurs noms acceptés), modifiables dans l'aperçu.
//  - Commandes → db.commandes, factures et avoirs → db.factures, avec importe: true et import_lot = n° du lot.
//    LECTURE SEULE (« spectateur ») : aucun bouton d'action sur la fiche (sauf PDF), lignes non modifiables, aucun
//    mouvement de stock, aucun encours (factures classées payées), hors Compta (pas de double avec le relevé) et hors
//    commissions. COMPTÉES dans le CA, la marge, le top des ventes et les statistiques produits (D.ventes).
//  - Doublon (même type + même n° déjà importé) : ignoré. Client retrouvé par code puis par nom, sinon créé.
//    Produit retrouvé par référence ou code-barres, sinon ligne libre (désignation gardée).
//  - Chaque import = un lot (db.imports_historique), annulable : ses documents sont retirés (les clients créés restent).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;

  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  const txt = (v) => (v == null ? '' : String(v).trim());
  const num = (v) => { if (typeof v === 'number') return v; let s = txt(v); if (!s) return null; s = s.replace(/[\s €%]/g, '');
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '') : s.replace(/,/g, '');
    s = s.replace(',', '.'); const n = parseFloat(s); return Number.isFinite(n) ? n : NaN; };
  const dateIso = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    const s = txt(v); let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (/^\d{5}(\.\d+)?$/.test(s)) return dateIso(+s);
    return '';
  };

  // [clé, libellé, noms de colonne acceptés (normalisés)]
  const CHAMPS = [
    ['type', 'Type (commande / facture / avoir)', ['type', 'typedocument', 'typededocument', 'typepiece', 'typedepiece', 'nature', 'naturepiece']],
    ['num', 'N° du document', ['numero', 'numerodocument', 'numdocument', 'ndocument', 'ndoc', 'numerodepiece', 'numeropiece', 'npiece', 'piece', 'nfacture', 'numerofacture', 'numfacture', 'ncommande', 'numerocommande', 'numcommande', 'refdocument', 'referencedocument', 'refpiece', 'ref', 'reference']],
    ['date', 'Date', ['date', 'datedocument', 'datefacture', 'datecommande', 'datepiece', 'datedefacturation', 'datefacturation', 'datedecommande']],
    ['client', 'Client (nom)', ['client', 'nomclient', 'raisonsociale', 'tiers', 'societe', 'nomtiers', 'clientnom', 'nomduclient', 'nom']],
    ['code', 'Code client', ['codeclient', 'numclient', 'numeroclient', 'nclient', 'compteclient', 'idclient', 'codetiers']],
    ['cmd', 'N° de commande liée (factures)', ['commandeliee', 'ncommandeliee', 'commandeorigine', 'ncommandeorigine', 'ncommande', 'numerocommande', 'numcommande', 'refcommande', 'commande']],
    ['refp', 'Réf. produit', ['refproduit', 'referenceproduit', 'refarticle', 'referencearticle', 'codearticle', 'article', 'codeproduit', 'sku', 'refinterne', 'ref', 'reference', 'ean', 'codebarre', 'codebarres', 'gencod']],
    ['desc', 'Désignation', ['designation', 'libelle', 'description', 'libellearticle', 'designationarticle', 'produit', 'libelleproduit', 'intitule']],
    ['qte', 'Quantité', ['quantite', 'qte', 'qty', 'quantity', 'nb', 'nombre']],
    ['pu', 'Prix unitaire HT', ['prixunitaireht', 'puht', 'pu', 'prixht', 'prixunitaire', 'prixventeht', 'prixvente', 'pvht', 'tarifht', 'prixunitairehtnet', 'punet', 'punetht']],
    ['remise', 'Remise %', ['remise', 'remisepct', 'remisepourcent', 'reduc', 'reduction', 'remiseligne']],
    ['tva', 'TVA %', ['tva', 'tauxtva', 'tvapct', 'tauxdetva']],
    ['pa', 'Prix d’achat HT (pour la marge)', ['prixachatht', 'prixachat', 'prixdachat', 'prixdachatht', 'paht', 'pa', 'prixderevient', 'prixrevient', 'coutunitaire', 'cout', 'coutachat', 'pmp']],
    ['total', 'Total HT de la ligne', ['totalht', 'montantht', 'totalligneht', 'montantligneht', 'totalhtligne', 'total']],
    ['paiement', 'Date de paiement', ['datepaiement', 'datedepaiement', 'datedereglement', 'datereglement', 'payele', 'reglele']],
  ];
  const NOM_CHAMP = Object.fromEntries(CHAMPS.map((c) => [c[0], c[1]]));
  const TYPES = { cmd: 'Commande', fact: 'Facture', avoir: 'Avoir' };

  // Colonne → champ : chaque champ au plus une fois, de gauche à droite (un « N° commande » à côté d'un « N° facture »
  // devient la commande liée).
  const deviner = (tete) => { const pris = new Set();
    return tete.map((h) => { const n = norm(h); if (!n) return ''; const c = CHAMPS.find((x) => !pris.has(x[0]) && x[2].includes(n)); if (!c) return ''; pris.add(c[0]); return c[0]; }); };
  const typeDe = (v, defaut) => { const n = norm(v); if (!n) return defaut; if (/avoir|credit/.test(n)) return 'avoir'; if (/fact/.test(n)) return 'fact'; if (/comm|cde|bc|bon/.test(n)) return 'cmd'; return defaut; };

  // Analyse (sans rien enregistrer) : documents regroupés par type + n°, erreurs et remarques.
  function analyser(db, feuille, map, defaut) {
    const out = { docs: [], erreurs: [], avert: [], lignes: 0 }; const parCle = new Map(); let prec = null;
    const col = (r, k) => { const i = map.indexOf(k); return i < 0 ? '' : r[i]; };
    const dejaImp = new Set([...db.commandes.filter((c) => c.importe).map((c) => 'cmd|' + norm(c.ref)), ...db.factures.filter((f) => f.importe).map((f) => (f.avoir ? 'avoir|' : 'fact|') + norm(f.ref))]);
    feuille.lignes.slice(1).forEach((r, k) => {
      const n = k + 2; if (!r || !r.some((x) => txt(x))) return;
      const numDoc = txt(col(r, 'num')) || (prec && prec.num) || '';
      const type = typeDe(col(r, 'type'), txt(col(r, 'num')) || !prec ? defaut : prec.type);
      if (!numDoc) { out.erreurs.push(`Ligne ${n} : pas de n° de document`); return; }
      const cle = type + '|' + norm(numDoc); let doc = parCle.get(cle);
      if (!doc) {
        const date = dateIso(col(r, 'date')) || (prec && prec.num === numDoc ? prec.date : '');
        if (!date) { out.erreurs.push(`Ligne ${n} (${numDoc}) : date manquante ou illisible « ${txt(col(r, 'date'))} »`); return; }
        const client = txt(col(r, 'client')), code = txt(col(r, 'code'));
        if (!client && !code) { out.erreurs.push(`Ligne ${n} (${numDoc}) : client manquant`); return; }
        doc = { type, num: numDoc, date, client, code, cmd: txt(col(r, 'cmd')), paiement: dateIso(col(r, 'paiement')), lignes: [], doublon: dejaImp.has(cle) };
        parCle.set(cle, doc); out.docs.push(doc);
      }
      prec = doc;
      const refp = txt(col(r, 'refp')); const desc = txt(col(r, 'desc'));
      let qte = num(col(r, 'qte')); let pu = num(col(r, 'pu')); const total = num(col(r, 'total'));
      const remise = num(col(r, 'remise')), tva = num(col(r, 'tva')), pa = num(col(r, 'pa'));
      if ([qte, pu, total, remise, tva, pa].some((x) => Number.isNaN(x))) { out.erreurs.push(`Ligne ${n} (${numDoc}) : un montant ou une quantité n’est pas un nombre`); return; }
      if (qte == null || qte === 0) qte = qte === 0 ? 0 : 1;
      if (pu == null) { if (total == null) { out.erreurs.push(`Ligne ${n} (${numDoc}) : ni prix unitaire ni total HT`); return; } pu = qte ? total / qte / (1 - (remise || 0) / 100 || 1) : total; }
      if (!refp && !desc) { out.erreurs.push(`Ligne ${n} (${numDoc}) : ni référence ni désignation`); return; }
      if (!qte) { out.avert.push(`Ligne ${n} (${numDoc}) : quantité 0, ligne ignorée`); return; }
      // Avoir : toujours en négatif (quantité négative, prix positif), quel que soit le signe dans le fichier
      if (type === 'avoir' || (pu < 0 && qte > 0)) { qte = -Math.abs(qte); pu = Math.abs(pu); }
      const p = refp ? db.produits.find((x) => norm(x.ref) === norm(refp) || (x.ean && String(x.ean) === refp)) : null;
      if (refp && !p) out.avert.push(`Ligne ${n} (${numDoc}) : produit « ${refp} » inconnu → ligne libre`);
      doc.lignes.push({ produit: p ? p.id : null, desc: desc || (p ? p.libelle || p.ref : refp), ref_import: refp || '', qte, pu: D.arrondi(pu), remise: remise || 0, tva: tva == null ? D.TVA : tva, ...(pa != null ? { pa: D.arrondi(Math.abs(pa)) } : {}) });
      out.lignes++;
    });
    out.docs = out.docs.filter((d) => d.lignes.length);
    return out;
  }

  const trouverClient = (db, d) => (d.code && db.tiers.find((t) => (t.code_client && norm(t.code_client) === norm(d.code)) || (t.code_import && norm(t.code_import) === norm(d.code))))
    || (d.client && db.tiers.find((t) => norm(t.nom) === norm(d.client))) || null;

  function importer(db, an, fichier) {
    const lot = { id: D.id('imp'), date: D.maintenant(), fichier, par: D.MOI, cmd: 0, fact: 0, avoir: 0, doublons: 0, ht: 0, clients: 0 };
    const cmdsLot = {};
    // commandes d'abord : les factures s'y rattachent (n° de commande liée)
    [...an.docs].sort((a, b) => (a.type === 'cmd' ? -1 : 0) - (b.type === 'cmd' ? -1 : 0)).forEach((d) => {
      if (d.doublon) { lot.doublons++; return; }
      let t = trouverClient(db, d);
      if (!t) {
        const nom = d.client || d.code;
        t = { id: D.id('t'), nom, alt: '', prospect: false, client: true, fournisseur: false, adresse: '', cp: '', ville: '', pays: 'France', tel: '', portable: '', fax: '', web: '', email: '', pas_mail: false,
          siren: '', siret: '', naf: '', rcs: '', tva_num: '', assujetti: true, type: 'TPE', effectif: '', commercial: D.MOI, statut_prospect: 'jamais', potentiel: 0, niveau: 1, remise: 0, cond: '30 jours', mode: 'Virement', encours_max: 0, tags: [],
          contacts: [], comptes: [], note_pub: '', note_priv: `Créé par l’import de l’historique (${fichier})`, etat: 'ouvert', cree: D.maintenant(), code_client: '', code_fourn: '', compta_client: '', compta_fourn: '', logo: '', code_import: d.code || '' };
        t.code_client = D.prochaineRef(db, 'cu'); t.compta_client = '411' + nom.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase();
        D.toucher(t); db.tiers.push(t); lot.clients++;
      } else if (!t.client) { t.client = true; t.prospect = false; D.toucher(t); }
      const commun = { tiers: t.id, date: d.date, lignes: d.lignes, liens: [], importe: true, import_lot: lot.id, import_fichier: fichier, ref_client: '', cond: '', mode: '', note_pub: '', note_priv: '', auteur: 'Import historique', cree: D.maintenant() };
      if (d.type === 'cmd') {
        const c = { ...commun, id: D.id('cmd'), ref: d.num, livraison: d.date, etat: 'livree', facturee: true };
        D.toucher(c); db.commandes.push(c); cmdsLot[norm(d.num)] = c; lot.cmd++; lot.ht += D.ht(c);
      } else {
        const f = { ...commun, id: D.id('fa'), ref: d.num, echeance: d.date, payee: true, paiement: d.paiement || d.date, ...(d.type === 'avoir' ? { avoir: true, avoir_nature: 'import' } : {}) };
        const c = d.cmd && (cmdsLot[norm(d.cmd)] || db.commandes.find((x) => x.importe && x.tiers === t.id && norm(x.ref) === norm(d.cmd)));
        if (c && d.type === 'fact') { f.cmd_importee = c.id; f.liens.push({ type: 'cmd', id: c.id }); (c.liens = c.liens || []).push({ type: 'fact', id: f.id }); D.toucher(c); }
        D.toucher(f); db.factures.push(f); lot[d.type]++; if (!f.cmd_importee) lot.ht += D.ht(f);
      }
    });
    lot.ht = D.arrondi(lot.ht);
    (db.imports_historique = db.imports_historique || []).unshift(lot);
    D.evt(db, `Import de l’historique (${fichier}) : ${lot.cmd} commande(s), ${lot.fact} facture(s), ${lot.avoir} avoir(s), ${D.euros(lot.ht)} HT`);
    return lot;
  }

  function annulerLot(db, id) {
    const garder = (l) => l.filter((d) => d.import_lot !== id);
    const n = db.commandes.length + db.factures.length;
    db.commandes = garder(db.commandes); db.factures = garder(db.factures);
    db.imports_historique = (db.imports_historique || []).filter((x) => x.id !== id);
    return n - db.commandes.length - db.factures.length;
  }

  // Modèle à remplir
  async function modele() {
    const cols = ['Type', 'N° document', 'Date', 'Client', 'Code client', 'N° commande liée', 'Réf. produit', 'Désignation', 'Quantité', 'Prix unitaire HT', 'Remise %', 'TVA %', 'Prix d’achat HT', 'Date de paiement'].map((t) => ({ t, l: 18 }));
    const lignes = [
      ['Commande', 'CMD-2025-001', '15/03/2025', 'Dupont Bâtiment', 'C0012', '', 'VIS-T', 'Vis tête fraisée', 100, 0.12, 0, 20, 0.05, ''],
      ['Commande', 'CMD-2025-001', '15/03/2025', 'Dupont Bâtiment', 'C0012', '', '', 'Livraison', 1, 15, 0, 20, '', ''],
      ['Facture', 'FAC-2025-001', '20/03/2025', 'Dupont Bâtiment', 'C0012', 'CMD-2025-001', 'VIS-T', 'Vis tête fraisée', 100, 0.12, 0, 20, 0.05, '19/04/2025'],
      ['Facture', 'FAC-2025-001', '20/03/2025', 'Dupont Bâtiment', 'C0012', 'CMD-2025-001', '', 'Livraison', 1, 15, 0, 20, '', '19/04/2025'],
      ['Avoir', 'AV-2025-001', '02/04/2025', 'Dupont Bâtiment', 'C0012', '', 'VIS-T', 'Retour vis', 10, 0.12, 0, 20, 0.05, ''],
    ];
    const blob = new Blob([await D.echange.ecrireXlsx([{ nom: 'Historique', cols, lignes }])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Modele import historique FMD.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  let attente = null; // { fichier, feuilles, i, map, defaut }

  P.historique = (v) => {
    const db = v.db; const lots = db.imports_historique || [];
    const nbImp = db.commandes.filter((c) => c.importe).length + db.factures.filter((f) => f.importe).length;
    let apercu = '';
    if (attente) {
      const fe = attente.feuilles[attente.i]; const an = analyser(db, fe, attente.map, attente.defaut); attente.an = an;
      const tete = fe.lignes[0] || [];
      const choixCol = tete.map((h, j) => `<label class="erp-hist-col"><span>${esc(txt(h) || `Colonne ${j + 1}`)}</span><select data-hist-col="${j}" data-sans-recherche><option value="">— ignorée —</option>${CHAMPS.map(([k, l]) => `<option value="${k}"${attente.map[j] === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`).join('');
      const nb = (t) => an.docs.filter((d) => d.type === t && !d.doublon).length;
      const dbl = an.docs.filter((d) => d.doublon).length;
      const clientsNouv = new Set(an.docs.filter((d) => !d.doublon && !trouverClient(db, d)).map((d) => norm(d.client || d.code))).size;
      const ht = D.arrondi(an.docs.filter((d) => !d.doublon && !(d.type === 'fact' && d.cmd && an.docs.some((x) => x.type === 'cmd' && norm(x.num) === norm(d.cmd)))).reduce((s, d) => s + D.ht(d), 0));
      const manque = ['num', 'date'].filter((k) => !attente.map.includes(k)).concat(attente.map.includes('client') || attente.map.includes('code') ? [] : ['client']).concat(attente.map.includes('pu') || attente.map.includes('total') ? [] : ['pu']);
      const exemples = an.docs.slice(0, 8);
      apercu = U.bloc(`Aperçu : ${esc(attente.fichier)}`, `
        ${attente.feuilles.length > 1 ? `<p><label>Onglet : <select data-hist-feuille data-sans-recherche>${attente.feuilles.map((f, i) => `<option value="${i}"${i === attente.i ? ' selected' : ''}>${esc(f.nom)} (${f.lignes.length - 1} lignes)</option>`).join('')}</select></label></p>` : ''}
        <h3 class="erp-sous-titre">Colonnes reconnues (modifiables)</h3><div class="erp-hist-cols">${choixCol}</div>
        <p><label>Sans colonne « Type », les documents sont des : <select data-hist-defaut data-sans-recherche>${Object.entries(TYPES).map(([k, l]) => `<option value="${k}"${attente.defaut === k ? ' selected' : ''}>${l}s</option>`).join('')}</select></label></p>
        ${manque.length ? `<p class="erp-moins">⚠ Colonne(s) obligatoire(s) à choisir : ${manque.map((k) => esc(NOM_CHAMP[k])).join(', ')}.</p>` : ''}
        <h3 class="erp-sous-titre">Ce qui va être importé (lecture seule)</h3>
        ${U.infos([['Commandes', String(nb('cmd'))], ['Factures', String(nb('fact'))], ['Avoirs', String(nb('avoir'))], ['Lignes', String(an.lignes)], ['Montant HT ajouté au CA', `<b>${D.euros(ht)}</b>`], ['Clients à créer', String(clientsNouv)], dbl ? ['Déjà importés (ignorés)', String(dbl)] : null])}
        ${exemples.length ? `<div class="erp-av-wrap"><table class="registre erp-table"><thead><tr><th>Type</th><th>N°</th><th>Date</th><th>Client</th><th class="nb">Lignes</th><th class="nb">Total HT</th></tr></thead><tbody>${exemples.map((d) => `<tr${d.doublon ? ' class="erp-gris"' : ''}><td>${TYPES[d.type]}${d.doublon ? ' (déjà importé)' : ''}</td><td><b>${esc(d.num)}</b>${d.cmd && d.type === 'fact' ? ` <small class="erp-gris">cmd ${esc(d.cmd)}</small>` : ''}</td><td>${D.jour(d.date)}</td><td>${esc(d.client || d.code)}</td><td class="nb">${d.lignes.length}</td><td class="nb">${D.euros(D.ht(d))}</td></tr>`).join('')}</tbody></table></div>${an.docs.length > 8 ? `<p class="erp-gris">… et ${an.docs.length - 8} autres documents.</p>` : ''}` : ''}
        ${an.erreurs.length ? `<details class="erp-ech-det" open><summary>${an.erreurs.length} ligne(s) non importée(s)</summary><ul>${an.erreurs.slice(0, 50).map((e) => `<li>${esc(e)}</li>`).join('')}${an.erreurs.length > 50 ? `<li>… et ${an.erreurs.length - 50} autres</li>` : ''}</ul></details>` : ''}
        ${an.avert.length ? `<details class="erp-ech-det"><summary>${an.avert.length} remarque(s) (importé quand même)</summary><ul>${an.avert.slice(0, 60).map((e) => `<li>${esc(e)}</li>`).join('')}${an.avert.length > 60 ? `<li>… et ${an.avert.length - 60} autres</li>` : ''}</ul></details>` : ''}
        ${U.boutons([!manque.length && an.docs.some((d) => !d.doublon) ? U.btn('Importer maintenant', 'ok', 'btn-metal', 'data-hist="importer"') : '', U.btn('Annuler', '', 'btn-ligne', 'data-hist="annuler"')])}`, { ico: 'liste' });
    }
    const tableLots = lots.length ? U.table([['Date', (l) => D.jour(l.date)], ['Fichier', (l) => esc(l.fichier)], ['Par', (l) => esc(l.par)], ['Commandes', (l) => String(l.cmd), 'nb'], ['Factures', (l) => String(l.fact), 'nb'], ['Avoirs', (l) => String(l.avoir), 'nb'], ['Montant HT', (l) => D.euros(l.ht), 'nb'],
      ['', (l) => U.btn('Annuler cet import', '', 'btn-ligne erp-danger', `data-hist-annuler="${esc(l.id)}"`)]], lots) : U.vide('Aucun import pour l’instant.');
    return {
      html: `${U.titrePage('⇅', 'Import de l’historique (commandes et factures)', nbImp || null)}
        <p class="erp-gris">Pour retrouver dans FMD les ventes faites avant (ancien logiciel, tableur) : les documents importés sont <b>en lecture seule</b> (aucune action, aucun mouvement de stock, pas d’encours, hors Compta et commissions) mais <b>comptent dans le CA, la marge, le top des ventes et les statistiques</b>.</p>
        ${U.bloc('Importer un fichier', `<p>Fichier Excel (.xlsx) ou CSV : <b>une ligne par ligne de document</b> (les lignes qui ont le même n° forment un document). Colonnes utiles : Type, N° document, Date, Client, Code client, N° commande liée, Réf. produit, Désignation, Quantité, Prix unitaire HT (ou Total HT), Remise %, TVA %, Prix d’achat HT (pour la marge ; sinon prix de revient actuel du produit), Date de paiement.</p>
          ${U.boutons([`<label class="btn petit btn-metal erp-hist-fichier">${U.ico('liste')}Choisir le fichier<input type="file" accept=".xlsx,.csv,.txt" data-hist-fichier hidden></label>`, U.btn('Télécharger le modèle', '', 'btn-ligne', 'data-hist="modele"')])}
          <p class="erp-gris erp-petit">Rien n’est enregistré avant « Importer maintenant ». Un document déjà importé (même type et même n°) est ignoré. Client retrouvé par code client puis par nom, sinon créé ; produit retrouvé par référence ou code-barres, sinon ligne libre.</p>`, { ico: 'liste' })}
        ${apercu}
        ${U.bloc('Imports réalisés', tableLots, { compte: lots.length })}`,
      apres: (el) => {
        const inp = el.querySelector('[data-hist-fichier]');
        if (inp) inp.addEventListener('change', async () => { const f = inp.files && inp.files[0]; if (!f) return;
          try { const feuilles = (await D.echange.lireFichier(f)).filter((x) => x.lignes && x.lignes.length > 1);
            if (!feuilles.length) { v.notifier('Fichier vide : aucune ligne à importer.'); return; }
            const i = Math.max(0, feuilles.findIndex((x) => deviner(x.lignes[0] || []).includes('num')));
            const map = deviner(feuilles[i].lignes[0] || []);
            attente = { fichier: f.name, feuilles, i, map, defaut: /avoir/i.test(f.name) ? 'avoir' : /comm|cde/i.test(f.name) ? 'cmd' : 'fact' }; v.rendre();
          } catch (e) { v.notifier('Lecture impossible : ' + e.message); } });
        el.querySelectorAll('[data-hist-col]').forEach((s) => s.addEventListener('change', () => { const j = +s.dataset.histCol; const k = s.value;
          if (k) attente.map = attente.map.map((x) => (x === k ? '' : x)); attente.map[j] = k; v.rendre(); }));
        const sf = el.querySelector('[data-hist-feuille]'); if (sf) sf.addEventListener('change', () => { attente.i = +sf.value; attente.map = deviner(attente.feuilles[attente.i].lignes[0] || []); v.rendre(); });
        const sd = el.querySelector('[data-hist-defaut]'); if (sd) sd.addEventListener('change', () => { attente.defaut = sd.value; v.rendre(); });
        el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-hist]'); const an = e.target.closest('[data-hist-annuler]');
          if (b && b.dataset.hist === 'modele') { modele().catch((x) => v.notifier('Modèle impossible : ' + x.message)); return; }
          if (b && b.dataset.hist === 'annuler') { attente = null; v.rendre(); return; }
          if (b && b.dataset.hist === 'importer' && attente && attente.an) {
            const lot = importer(db, attente.an, attente.fichier); attente = null; v.sauver();
            v.notifier(`Import terminé : ${lot.cmd} commande(s), ${lot.fact} facture(s), ${lot.avoir} avoir(s), ${D.euros(lot.ht)} HT ajoutés au CA${lot.clients ? `, ${lot.clients} client(s) créé(s)` : ''}.`); v.rendre(); return;
          }
          if (an) { const l = lots.find((x) => x.id === an.dataset.histAnnuler); if (!l) return;
            v.confirmer(`Annuler l’import « ${l.fichier} » ?`, `Les ${l.cmd + l.fact + l.avoir} documents importés de ce fichier seront retirés de FMD (et du CA). Les clients créés par l’import restent. Vous pourrez réimporter le fichier.`, 'Annuler l’import', () => {
              const n = annulerLot(db, l.id); D.evt(db, `Import de l’historique « ${l.fichier} » annulé (${n} documents retirés)`); v.sauver(); v.notifier(`${n} documents retirés.`); v.rendre(); }); }
        });
      },
    };
  };

  D.historique = { analyser, importer, annulerLot, deviner }; // aussi pour les essais
})();
