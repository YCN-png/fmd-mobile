// FMD — CRM / ERP : documents commerciaux en PDF (devis, commandes, factures, commandes fournisseurs) et envoi par
// e-mail (10 nov. 2026). Demande : « générer un fichier PDF, dans le même style que les mails générés sur FM'RADAR,
// mais en mode devis / facture personnalisé ».
// - PDF : HTML à la charte FMD (en-tête noir, lettrage rose gold, Montserrat), mot personnalisé pour le client
//   (contact, conditions appliquées, économie par rapport au tarif public). Fabriqué par le launcher (window.lanceur.docPdf)
//   et rangé dans Documents\FMD\Documents commerciaux\<type>\<réf> - <client>.pdf, puis affiché (aperçu + Imprimer).
// - E-mail : fenêtre comme le Radar (À, Objet, Message pré-rédigé, signature FMD) ; « Ouvrir dans ma messagerie » ouvre un
//   brouillon avec le PDF joint (fichier .eml) ; sinon messagerie + dossier du PDF pour le joindre à la main.
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const U = D.ui;
  const esc = U.esc;
  const NL = '\n';
  D.SOCIETE = { nom: 'FMD', activite: 'Quincaillerie · Outillage · Climatisation', adresse: '3 quai Félix Faure', ville: '49100 Angers', tel: '07 44 22 82 54',
    email: 'farid.medegueb@fmdistrib.fr', web: 'www.fmdistrib.fr', horaires: 'du lundi au jeudi de 7 h 30 à 17 h 30 et le vendredi de 7 h 30 à 16 h 30',
    // Mentions légales du pied de page : à compléter avec les vraies informations de FMD (affichées seulement si remplies).
    forme: '', capital: '', siret: '', naf: '', tva_intra: '', rib: '' };
  const SIGNATURES = { 'Farid MEDEGUEB': ['Farid Medegueb', 'FMD · Quincaillerie · Outillage · Climatisation', '07 44 22 82 54 · farid.medegueb@fmdistrib.fr', 'www.fmdistrib.fr'] };
  const signature = (auteur) => SIGNATURES[auteur] || [String(auteur || 'L’équipe FMD').replace(/\b([A-ZÉÈ])([A-ZÉÈ]+)\b/g, (m, a, b) => a + b.toLowerCase()), 'FMD · Quincaillerie · Outillage · Climatisation', 'www.fmdistrib.fr'];
  const TITRES = { prop: 'Devis', cmd: 'Confirmation de commande', fact: 'Facture', achat: 'Bon de commande', litige: 'Réclamation · litige de livraison' };
  const DOSSIERS = { prop: 'Devis', cmd: 'Commandes clients', fact: 'Factures', achat: 'Commandes fournisseurs', litige: 'Litiges fournisseurs' };
  const contactDe = (db, tiersId) => { const l = db.contacts.filter((k) => k.tiers === tiersId); return l.find((k) => k.defaut) || l[0] || null; };
  const nomContact = (k) => (k ? [k.civilite, k.prenom, k.nom].filter(Boolean).join(' ') : '');
  // Économie du client par rapport au tarif public (niveau 1), sur les lignes de produits.
  const economie = (db, d) => D.arrondi(d.lignes.reduce((s, l) => { const p = l.produit && D.produit(db, l.produit); return s + (p ? p.prix[0] * l.qte - D.htLigne(l) : 0); }, 0));

  // ---------- ressources incluses dans le PDF (logo, police) ----------
  let ressources = null;
  const enDataUrl = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(url); const b = await r.blob(); return new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }); };
  D.ressourcesDocs = async () => {
    if (ressources) return ressources;
    const r = { logo: '', police: '' };
    // Logo des PDF FMD (21 nov. 2026, fourni par l'utilisateur : symbole + « FMD » rose gold 3D) ; pas pour FM'RENOV.
    try { r.logo = await enDataUrl('assets/logos/apercus/FMD-logo-rose-gold-3d.png'); } catch {
      try { r.logo = await enDataUrl('assets/logos/apercus/FMD-lettrage-rose-gold-transparent.png'); } catch { /* sans logo : lettrage texte */ } }
    try { r.police = await enDataUrl('assets/polices/Montserrat-latin-1.woff2'); } catch { /* police du système */ }
    ressources = r; return r;
  };

  // ---------- e-mail pré-rédigé (même ton que FM'RADAR) ----------
  D.mailDoc = (db, type, d) => {
    const t = D.tiers(db, d.tiers) || {}; const k = contactDe(db, d.tiers);
    const bonjour = 'Bonjour ' + (nomContact(k) || 'Madame, Monsieur') + ',';
    const ht = D.euros(D.ht(d)), ttc = D.euros(D.ttc(d)); const eco = type === 'achat' ? 0 : economie(db, d);
    const niv = D.NIVEAUX[(t.niveau || 1) - 1];
    const cond = eco > 0.5 ? `Vos conditions tarifaires${t.remise ? ` et votre remise de ${t.remise} %` : ''} sont appliquées : vous économisez ${D.euros(eco)} HT par rapport au prix net.` : '';
    const chantier = d.ref_client ? ` (votre référence : ${d.ref_client})` : '';
    let sujet, corps;
    if (type === 'prop') {
      sujet = `Votre devis FMD ${d.ref} · ${t.nom || ''}`;
      corps = [bonjour, '', `Merci pour votre confiance. Comme convenu, vous trouverez ci-joint notre devis ${d.ref}${chantier} d’un montant de ${ht} HT, soit ${ttc} TTC.`, ...(cond ? ['', cond] : []), '',
        `Ce devis est valable jusqu’au ${D.jour(d.fin)}. Pour le valider, il vous suffit de nous le retourner signé avec la mention « Bon pour accord », ou de répondre simplement à ce message.`];
    } else if (type === 'cmd') {
      sujet = `Confirmation de votre commande FMD ${d.ref} · ${t.nom || ''}`;
      corps = [bonjour, '', `Nous vous confirmons la bonne réception de votre commande ${d.ref}${chantier} d’un montant de ${ht} HT, soit ${ttc} TTC. Vous trouverez le récapitulatif en pièce jointe.`, ...(cond ? ['', cond] : []), '',
        d.livraison ? `La livraison est prévue le ${D.jour(d.livraison)}${d.expedition ? ` (${d.expedition.toLowerCase()})` : ''}.` : 'Nous revenons vers vous dès que votre commande est prête.'];
    } else if (type === 'fact') {
      sujet = `Votre ${d.avoir ? 'avoir' : 'facture'} FMD ${d.ref} · ${t.nom || ''}`;
      corps = [bonjour, '', `Vous trouverez ci-joint notre ${d.avoir ? "avoir" : "facture"} ${d.ref}${d.avoir ? ` (sur la facture ${d.origine_ref || ""})` : ""} d’un montant de ${ttc} TTC (${ht} HT).`, '',
        d.avoir ? 'Ce montant vient en déduction de vos prochains règlements ou vous sera remboursé.' : d.payee ? `Elle est déjà réglée (paiement reçu le ${D.jour(d.paiement)}) : merci !` : `Elle est payable ${d.cond ? d.cond.toLowerCase() : ''} au plus tard le ${D.jour(d.echeance)}${d.mode ? `, par ${d.mode.toLowerCase()}` : ''}. Si le règlement a déjà été effectué, merci de ne pas tenir compte de ce rappel.`];
    } else {
      sujet = `Commande FMD ${d.ref}${d.ref_fourn ? ` · votre réf. ${d.ref_fourn}` : ''}`;
      corps = [bonjour, '', `Veuillez trouver ci-joint notre bon de commande ${d.ref} d’un montant de ${ht} HT.`, '',
        d.livraison ? `Livraison souhaitée le ${D.jour(d.livraison)} au 3 quai Félix Faure, 49100 Angers.` : 'Merci de nous confirmer la date de livraison au 3 quai Félix Faure, 49100 Angers.', '', 'Merci de nous retourner un accusé de réception de commande.'];
    }
    if (type !== 'achat') corps.push('', `Notre boutique vous accueille au ${D.SOCIETE.adresse}, ${D.SOCIETE.ville}, ${D.SOCIETE.horaires}.`);
    corps.push('', 'Je reste à votre disposition pour toute question.', '', 'Bien cordialement,', '', ...(D.signatureMail ? D.signatureMail() : signature(d.auteur)));
    const a = (k && k.email) || t.email || '';
    return { a, sujet, corps: corps.join(NL), contact: k, fiche: [t.nom, k ? `Contact : ${nomContact(k)}${k.poste ? ` (${k.poste})` : ''}` : 'Contact : à renseigner', `${TITRES[type]} ${d.ref} · ${ht} HT · ${ttc} TTC`, a ? `E-mail : ${a}` : 'E-mail : à renseigner'] };
  };

  // ---------- HTML du document (PDF A4) ----------
  // Mise en page demandée le 10 nov. (exemple « Le petit potager ») : logo + coordonnées en haut à gauche, cadre client
  // arrondi à droite, « À Angers, le … », titre centré, tableau à colonnes avec rubriques et sous-totaux, détail de TVA,
  // totaux à droite, phrase personnalisée, pied avec le site et les mentions. Couleurs FMD : noir + rose gold.
  const UNITE = (l) => (/bo[iî]te|lot|coffret|couronne|ensemble/i.test(l.desc) ? 'u.' : /\b(m|mètre)\b/i.test(l.desc) && /× ?1 ?m\b/.test(l.desc) ? 'm' : 'u.');
  D.htmlDoc = (db, type, d, res = {}) => {
    const t = D.tiers(db, d.tiers) || {}; const k = contactDe(db, d.tiers); const S = D.SOCIETE;
    const ht = D.ht(d), tva = D.tva(d), ttc = D.ttc(d); const eco = type === 'achat' || type === 'litige' || d.avoir ? 0 : economie(db, d);
    const titre = type === 'fact' && d.avoir ? 'Avoir' : TITRES[type]; const brouillon = d.etat === 'brouillon';
    const niv = D.NIVEAUX[(t.niveau || 1) - 1];
    const dateLongue = (x) => new Date(String(x).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    // Rubriques = catégories de produits (comme les « Livraison pour le … » de l'exemple), lignes libres à la fin.
    const groupes = []; const parCle = {};
    // Facture de fin de mois (plusieurs commandes) : une rubrique par commande, séparée visuellement, avec ses sous-totaux
    const parCommande = type === 'fact' && Array.isArray(d.commandes) && d.commandes.length > 0;
    if (parCommande) d.commandes.forEach((c) => { parCle[c.id] = { titre: `Commande N° ${c.ref} du ${D.jour(c.date)}${c.ref_client ? ` · votre réf. ${c.ref_client}` : ''}`, cmd: true, lignes: [] }; groupes.push(parCle[c.id]); });
    if (!parCommande) d.lignes.forEach((l) => { const p = l.produit && D.produit(db, l.produit); const cle = p ? p.categorie : 'autres';
      if (!parCle[cle]) { parCle[cle] = { titre: p ? D.categorie(p.categorie) : 'Prestations et divers', lignes: [] }; groupes.push(parCle[cle]); } parCle[cle].lignes.push(l); });
    if (parCommande) d.lignes.forEach((l) => { const g = parCle[l.cmd] || parCle.autres || (parCle.autres = groupes[groupes.push({ titre: 'Autres lignes', cmd: true, lignes: [] }) - 1]); g.lignes.push(l); });
    const plusieurs = groupes.length > 1 || parCommande;
    const stCmd = (g) => { const h = g.lignes.reduce((s, l) => s + D.htLigne(l), 0); const tv = g.lignes.reduce((s, l) => s + D.htLigne(l) * (l.tva ?? D.TVA) / 100, 0);
      return `<tr class="st stc"><td colspan="4">Sous-total commande (${g.lignes.length} ligne${g.lignes.length > 1 ? 's' : ''})</td><td class="nb" colspan="2">HT ${D.euros(h)} · TVA ${D.euros(tv)}</td><td class="nb">${D.euros(h + tv)} TTC</td></tr><tr class="sep"><td colspan="7"></td></tr>`; };
    const corpsTable = groupes.filter((g) => g.lignes.length).map((g) => `${plusieurs ? `<tr class="rub${g.cmd ? ' rubc' : ''}"><td colspan="7">${esc(g.titre)}</td></tr>` : ''}
      ${g.lignes.map((l) => { const p = l.produit && D.produit(db, l.produit);
        return `<tr><td>${p ? `<span class="ref">${esc(p.ref)}</span> ` : ''}${esc(l.desc)}${(type === 'achat' || type === 'litige') && l.ref_fourn ? ` <span class="ref">(${esc(l.ref_fourn)})</span>` : ''}</td><td class="nb">${D.nombre(l.qte)}</td><td class="c">${UNITE(l)}</td><td class="nb">${D.euros(l.pu)}</td><td class="nb">${l.remise ? `${D.nombre(l.remise)} %` : ''}</td><td class="nb">${D.nombre(l.tva)} %</td><td class="nb">${D.euros(D.htLigne(l))}</td></tr>`; }).join('')}
      ${g.cmd ? stCmd(g) : plusieurs ? `<tr class="st"><td colspan="6">Sous-total HT</td><td class="nb">${D.euros(g.lignes.reduce((s, l) => s + D.htLigne(l), 0))}</td></tr>` : ''}`).join('');
    // Détail de la TVA par taux
    const taux = [...new Set(d.lignes.map((l) => l.tva ?? D.TVA))].sort((a, b) => b - a);
    const base = (x) => D.arrondi(d.lignes.filter((l) => (l.tva ?? D.TVA) === x).reduce((s, l) => s + D.htLigne(l), 0));
    const detailTva = `<table class="tva"><tr><th>Détails TVA</th>${taux.map((x) => `<th class="nb">${D.nombre(x)} %</th>`).join('')}<th class="nb">Total</th></tr>
      <tr><td>Base HT</td>${taux.map((x) => `<td class="nb">${D.euros(base(x))}</td>`).join('')}<td class="nb">${D.euros(ht)}</td></tr>
      <tr><td>Montant TVA</td>${taux.map((x) => `<td class="nb">${D.euros(base(x) * x / 100)}</td>`).join('')}<td class="nb">${D.euros(tva)}</td></tr></table>`;
    const sousTitre = (type === 'prop' ? [d.ref_client && `Chantier / référence : ${d.ref_client}`, `Valable jusqu’au ${D.jour(d.fin)}`].filter(Boolean).join(' · ')
      : type === 'cmd' ? [d.ref_client && `Votre référence : ${d.ref_client}`, d.livraison && `Livraison prévue le ${D.jour(d.livraison)}`].filter(Boolean).join(' · ')
        : type === 'fact' ? [parCommande && `Facture récapitulative de ${d.commandes.length} commande${d.commandes.length > 1 ? 's' : ''} (du ${D.jour(d.commandes[0].date)} au ${D.jour(d.commandes[d.commandes.length - 1].date)})`, d.avoir && `Sur la facture N° ${d.origine_ref || ''}`, d.ref_client && `Votre référence : ${d.ref_client}`, !d.avoir && `Échéance : ${D.jour(d.echeance)}`].filter(Boolean).join(' · ')
          : type === 'litige' ? [`Commande N° ${d.commande_ref} du ${D.jour(d.commande_date)}`, d.ref_fourn && `Votre référence : ${d.ref_fourn}`, d.ar_num && `Votre AR : ${d.ar_num}`].filter(Boolean).join(' · ')
          : [d.ref_fourn && `Votre référence : ${d.ref_fourn}`, d.livraison && `Livraison souhaitée le ${D.jour(d.livraison)}`].filter(Boolean).join(' · '));
    const perso = type === 'prop' ? `${eco > 0.5 ? `Vos conditions tarifaires${t.remise ? ` et votre remise de ${t.remise} %` : ''} sont appliquées : vous économisez ${D.euros(eco)} HT par rapport au prix net. ` : ''}Pour accepter ce devis, retournez-le signé avec la mention « Bon pour accord ».`
      : type === 'cmd' ? `${eco > 0.5 ? `Vos conditions tarifaires sont appliquées : vous économisez ${D.euros(eco)} HT. ` : ''}Merci pour votre commande${d.expedition ? ` · ${esc(d.expedition)}` : ''}.`
        : type === 'fact' && d.avoir ? `Avoir sur la facture N° ${esc(d.origine_ref || '')} : ce montant vient en déduction de vos prochains règlements ou vous est remboursé.`
        : type === 'fact' ? (d.payee ? `Facture acquittée le ${D.jour(d.paiement)} : merci pour votre règlement.` : `Règlement ${esc((d.cond || '').toLowerCase())} : à régler au plus tard le ${D.jour(d.echeance)}${d.mode ? ` par ${esc(d.mode.toLowerCase())}` : ''}.`)
          : type === 'litige' ? `Les articles ci-dessus, facturés ou commandés sur la commande ${esc(d.commande_ref)}, ne nous ont pas été livrés (${esc(d.motif || 'articles manquants')}). Merci de nous les livrer au ${esc(S.adresse)}, ${esc(S.ville)}, ou de nous adresser un avoir du montant correspondant, et de nous confirmer la suite donnée à cette réclamation.`
          : `Merci de nous livrer au ${esc(S.adresse)}, ${esc(S.ville)}${d.livraison ? ` pour le ${D.jour(d.livraison)}` : ''} et de nous retourner un accusé de réception de commande.`;
    const mentions = [S.forme, S.capital && `capital de ${S.capital}`, S.siret && `SIRET ${S.siret}`, S.naf && `NAF ${S.naf}`, S.tva_intra && `TVA intracom. ${S.tva_intra}`].filter(Boolean).join(' · ');
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(titre)} ${esc(d.ref)}</title><style>
${res.police ? `@font-face{font-family:'Montserrat';src:url(${res.police}) format('woff2');font-weight:100 900}` : ''}
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0}body{font:10px/1.45 Montserrat,Arial,sans-serif;color:#080808;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{padding:12mm 14mm 34mm;min-height:297mm;position:relative}
.filet{position:fixed;top:0;left:0;right:0;height:2mm;background:linear-gradient(90deg,#F7DAC5,#EAC2A9 24%,#C9987D 48%,#A3735C 78%,#6F4A3C)}
.haut{display:flex;justify-content:space-between;align-items:flex-start;gap:10mm}
.emet img{height:17mm;display:block;margin:-1mm 0 2mm -1.5mm}.emet .lettrage{font-size:28px;font-weight:800;color:#A3735C;letter-spacing:.06em}
.emet b{font-size:13px}.emet .act{color:#A3735C;font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;margin-bottom:1.5mm}
.client{width:84mm;border:1.4px solid #C9987D;border-radius:5mm;padding:4mm 5mm;min-height:32mm;margin-top:14mm;display:flex;gap:4mm;align-items:flex-start}
.client img{width:14mm;height:14mm;object-fit:contain;border-radius:2mm;flex:none}.client b{font-size:11.5px}
.lieu{text-align:right;margin-top:5mm;font-style:italic;color:#4f433b}
h1{text-align:center;font-size:21px;margin:7mm 0 1mm;font-weight:800}h1 span{color:#A3735C}
.sous{text-align:center;color:#4f433b;margin-bottom:6mm}
table.lignes{width:100%;border-collapse:collapse;border:1px solid #dcc6b8}thead{display:table-header-group}tr{page-break-inside:avoid}
.lignes th{background:#E2B79D;color:#080808;font-style:italic;font-weight:700;font-size:9.5px;text-align:left;padding:2.2mm 2mm;border-left:1px solid rgba(255,255,255,.55)}
.lignes td{padding:1.6mm 2mm;border-left:1px solid #eadfd8;vertical-align:top}.lignes tbody tr:not(.rub):not(.st) td{border-bottom:1px solid #f3ebe5}
.lignes .rub td{font-weight:700;background:#faf3ee;border-top:1px solid #dcc6b8;font-size:9.5px}.lignes .rubc td{background:#080808;color:#F7DAC5;font-size:10.5px;padding:2.4mm 2mm;border-top:none}.lignes .stc td{background:#faf3ee;border-top:1.4px solid #C9987D}.lignes .sep td{height:4mm;border:none;background:#fff}.lignes .st td{font-weight:700;border-top:1px solid #dcc6b8}
.ref{color:#75655b;font-size:8.5px}.nb{text-align:right;white-space:nowrap}.c{text-align:center}
.bas{display:flex;justify-content:space-between;align-items:flex-start;gap:8mm;margin-top:5mm;padding-top:4mm;border-top:1.4px solid #C9987D}
table.tva{border-collapse:collapse;font-size:9px}.tva th,.tva td{border:1px solid #dcc6b8;padding:1.4mm 2.4mm}.tva th{background:#faf3ee;font-weight:700;text-align:left}
.tot{width:70mm;font-size:10.5px}.tot div{display:flex;justify-content:space-between;padding:1.2mm 2mm}.tot .ttc{background:#080808;color:#F7DAC5;border-radius:2mm;font-weight:800;font-size:13px;padding:2.6mm 3mm;margin-top:1mm}
.perso{text-align:center;color:#A3735C;font-weight:700;margin:7mm 8mm 0;font-size:10px}
.accord{margin-top:7mm;border:1px dashed #C9987D;border-radius:3mm;padding:4mm;height:30mm;display:flex;justify-content:space-between;font-size:9.5px}
.legal{margin-top:5mm;font-size:8.5px;color:#4f433b}
.paye{display:inline-block;border:2px solid #2f7a4d;color:#2f7a4d;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:2mm 5mm;border-radius:2mm;transform:rotate(-4deg);margin-top:5mm}
.note{margin-top:5mm;font-size:9.5px}
.filigrane{position:fixed;top:118mm;left:0;right:0;text-align:center;font-size:88px;font-weight:800;color:rgba(163,115,92,.12);transform:rotate(-24deg)}
.pied{position:fixed;left:14mm;right:14mm;bottom:8mm;font-size:8.5px;color:#4f433b;border-top:1px solid #eadfd8;padding-top:3mm}
.pied .site{font-size:17px;font-weight:800;color:#A3735C;letter-spacing:.01em;margin-bottom:.8mm}
</style></head><body><div class="filet"></div><div class="page">
${brouillon ? '<div class="filigrane">BROUILLON</div>' : ''}
<div class="haut"><div class="emet">${res.logo ? `<img src="${res.logo}" alt="FMD">` : '<div class="lettrage">FMD</div>'}<div class="act">${esc(S.activite)}</div><b>${esc(S.nom)}</b><br>${esc(S.adresse)}<br>${esc(S.ville)}<br>Tél. : ${esc(S.tel)}<br>E-mail : ${esc(S.email)}</div>
<div><div class="client">${t.logo ? `<img src="${t.logo}" alt="">` : ''}<div><b>${esc(t.nom || '')}</b>${k ? `<br>${esc(nomContact(k))}` : ''}<br>${esc(t.adresse || '')}<br>${esc([t.cp, t.ville].filter(Boolean).join(' '))}${t.code_client && type !== 'achat' ? `<br><span class="ref">Code client ${esc(t.code_client)}</span>` : ''}</div></div>
<div class="lieu">À Angers, le ${dateLongue(d.date)}</div></div></div>
<h1>${esc(titre)} <span>N° ${esc(d.ref)}</span></h1><div class="sous">${esc(sousTitre)}</div>
<table class="lignes"><thead><tr><th style="width:52%">${type === 'achat' ? 'Articles commandés' : 'Produits et prestations'}</th><th class="nb">Qté</th><th class="c">Unité</th><th class="nb">P.U. HT</th><th class="nb">Remise</th><th class="nb">TVA</th><th class="nb">Total HT</th></tr></thead><tbody>${corpsTable}</tbody></table>
<div class="bas">${detailTva}<div class="tot"><div><span>Total HT</span><b>${D.euros(ht)}</b></div><div><span>Total TVA</span><span>${D.euros(tva)}</span></div><div class="ttc"><span>Total TTC</span><span>${D.euros(ttc)}</span></div></div></div>
<p class="perso">${perso}</p>
${d.note_pub ? `<p class="note">${esc(d.note_pub).replace(/\n/g, '<br>')}</p>` : ''}
${type === 'prop' ? `<div class="accord"><div><b>Bon pour accord</b><br>Date :<br><br>Nom et qualité du signataire :</div><div><b>Signature et cachet de l’entreprise</b></div></div>` : ''}
${type === 'fact' ? `<p class="legal">Conditions de règlement : ${esc(d.cond || '—')}${d.mode ? ` · ${esc(d.mode)}` : ''}. En cas de retard de paiement : pénalités au taux de trois fois le taux d’intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce). Pas d’escompte pour paiement anticipé.</p>${d.payee ? `<div class="paye">Acquittée le ${D.jour(d.paiement)}</div>` : ''}` : ''}
<div class="pied"><div class="site">${esc(S.web)}</div><div>${esc(S.nom)} · ${esc(S.activite)} · ${esc(S.adresse)}, ${esc(S.ville)} · Tél. ${esc(S.tel)} · ${esc(S.email)}</div>
<div>${mentions ? esc(mentions) : `Boutique ouverte ${esc(S.horaires)}`}${S.rib ? ` · RIB ${esc(S.rib)}` : ''}</div></div>
</div></body></html>`;
  };

  // ---------- fabrication du PDF ----------
  const nomFichier = (db, d) => `${String(d.ref).replace(/[()]/g, '')} - ${(D.tiers(db, d.tiers) || {}).nom || ''}`;
  D.produirePdf = async (v, type, d) => {
    const html = D.htmlDoc(v.db, type, d, await D.ressourcesDocs());
    if (!window.lanceur || !window.lanceur.docPdf) { imprimerSansLanceur(html); return null; }
    const chemin = await window.lanceur.docPdf(html, DOSSIERS[type], nomFichier(v.db, d));
    d.pdf = { chemin, le: D.maintenant() };
    D.evt(v.db, `PDF ${d.ref} généré`, { tiers: d.tiers, objet: { type, id: d.id } });
    v.sauver();
    return chemin;
  };
  // Version web / essais : impression du navigateur.
  function imprimerSansLanceur(html) {
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(fr);
    fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { /* impression indisponible */ } setTimeout(() => fr.remove(), 1500); }, 300);
  }

  D.ouvrirPdf = async (v, type, d) => {
    v.notifier('Préparation du PDF…');
    try { const f = await D.produirePdf(v, type, d); if (f) await window.lanceur.docAfficher(f); }
    catch (e) { v.fenetre('PDF impossible', `<p>Le PDF n’a pas pu être fabriqué : ${esc(e.message)}</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); }
  };

  // ---------- boîte e-mail IONOS et signature de CHAQUE utilisateur (21 nov. 2026) ----------
  // Demandes : « connecte-toi à ma boîte mail IONOS pour envoyer les mails directement depuis le CRM » ; « il faut que chaque
  // mail soit enregistré avec le compte utilisateur, donc que chaque personne ait sa propre signature ».
  // • Boîte liée au COMPTE FMD connecté (window.FMDCompte.id) : le launcher garde le mot de passe chiffré par Windows sur ce PC,
  //   un fichier par compte (jamais en ligne, jamais renvoyé ici). Adresse, nom affiché, serveur : dans la fiche en ligne
  //   (preferences.mail_ionos) → pré-remplis sur un autre PC, où il suffit de retaper le mot de passe.
  // • Signature : texte libre de l'utilisateur (preferences.signature_mail, en ligne), sinon signature par défaut faite avec
  //   sa fiche (nom, fonction, téléphone, e-mail). Mise à la fin de tous les e-mails préparés par FMD (D.mailDoc).
  const L = () => window.lanceur;
  const C = () => window.FMDCompte || null;
  D.compte = () => (C() ? C().id : '');
  const majuscules = (s) => String(s || '').replace(/\b([A-ZÉÈ])([A-ZÉÈ]+)\b/g, (m, a, b) => a + b.toLowerCase());
  D.signatureDefaut = () => {
    const c = C(); const p = (c && c.profil()) || {}; const pm = (c && c.preference('mail_ionos')) || {};
    const nom = majuscules(p.nom || `${p.prenom || ''} ${p.nom_famille || ''}`.trim() || (c && c.nom) || D.MOI || 'L’équipe FMD');
    return [nom, p.fonction ? `${p.fonction} · FMD` : 'FMD · Quincaillerie · Outillage · Climatisation', [p.telephone, pm.adresse || p.email || (c && c.email)].filter(Boolean).join(' · '), 'www.fmdistrib.fr'].filter(Boolean).join('\n');
  };
  D.signatureMail = () => { const s = C() && C().preference('signature_mail'); return String(typeof s === 'string' && s.trim() ? s : D.signatureDefaut()).split(/\r?\n/); };
  D.mailDisponible = () => !!(L() && L().mailEtat && L().mailEnvoyer);
  D.mailEtat = async () => (D.mailDisponible() && D.compte() ? L().mailEtat(D.compte()).catch(() => ({ configure: false })) : { configure: false, indisponible: !D.mailDisponible() });
  D.reglageMail = async (el, notifier, apres) => {
    if (!el) return;
    const c = C(); const pm = (c && c.preference('mail_ionos')) || {};
    const e = await D.mailEtat(); let edition = !e.configure && !e.indisponible;
    const dessiner = () => {
      const boite = e.indisponible ? '<p class="discret">L’envoi direct fonctionne dans le logiciel FMD installé (version à jour).</p>'
        : `${e.configure ? `<p class="mail-etat"><span class="pastille st-ok">✓ Boîte connectée</span> <b>${esc(e.adresse)}</b>${e.nom ? ` · envoyé au nom de « ${esc(e.nom)} »` : ''} <span class="discret">(${esc(e.serveur)}, port ${esc(e.port)})</span></p>` : `<p class="discret">Aucune boîte connectée pour votre compte${pm.adresse ? ` sur ce PC (${esc(pm.adresse)} : retapez le mot de passe)` : ''} : les e-mails s’ouvrent dans la messagerie du PC.</p>`}
        ${edition ? `<form class="mail-form" data-mail-form autocomplete="off">
          <label>Adresse e-mail IONOS<input name="adresse" type="email" required value="${esc(e.adresse || pm.adresse || (c && c.email) || '')}" placeholder="prenom.nom@fmdistrib.fr" autocomplete="off"></label>
          <label>Nom affiché aux destinataires<input name="nom" value="${esc(e.nom || pm.nom || (c && c.nom) || D.MOI || '')}" placeholder="Ex. : Yacine — FMD"></label>
          <label>Mot de passe de la boîte mail<input name="motdepasse" type="password" required autocomplete="new-password" placeholder="Tapé par vous, chiffré sur ce PC"></label>
          <div class="mail-form-2"><label>Serveur d’envoi<input name="serveur" value="${esc(e.serveur || pm.serveur || 'smtp.ionos.fr')}"></label><label>Port<select name="port"><option value="465"${String(e.port || pm.port || 465) === '465' ? ' selected' : ''}>465 (SSL)</option><option value="587"${String(e.port || pm.port) === '587' ? ' selected' : ''}>587 (STARTTLS)</option></select></label></div>
          <p class="discret">Boîte liée à votre compte FMD. Le mot de passe est vérifié auprès de IONOS puis chiffré par Windows sur ce PC : jamais en ligne, jamais montré.</p>
          <div class="mail-boutons"><button type="submit" class="btn btn-metal">Tester et enregistrer</button>${e.configure ? '<button type="button" class="btn btn-ligne" data-mail-annuler>Annuler</button>' : ''}</div>
          <p class="mail-msg" data-mail-msg></p></form>`
        : e.configure ? '<div class="mail-boutons"><button type="button" class="btn btn-ligne" data-mail-changer>Changer de boîte / de mot de passe</button><button type="button" class="btn btn-ligne" data-mail-oublier>Déconnecter la boîte</button></div>' : ''}`;
      const sig = C() && C().preference('signature_mail');
      el.innerHTML = `${boite}
        <form class="mail-form mail-signature" data-sig-form>
          <label>Ma signature (à la fin de mes e-mails)<textarea name="signature" rows="5" placeholder="${esc(D.signatureDefaut())}">${esc(typeof sig === 'string' ? sig : D.signatureDefaut())}</textarea></label>
          <div class="mail-boutons"><button type="submit" class="btn btn-ligne">Enregistrer ma signature</button><button type="button" class="btn btn-ligne" data-sig-defaut>Signature par défaut</button></div>
          <p class="mail-msg" data-sig-msg></p></form>`;
      const f = el.querySelector('[data-mail-form]');
      if (f) f.addEventListener('submit', async (ev) => { ev.preventDefault(); const msg = f.querySelector('[data-mail-msg]'); const b = f.querySelector('[type=submit]');
        if (!D.compte()) { msg.className = 'mail-msg erreur'; msg.textContent = 'Compte FMD inconnu : reconnectez-vous.'; return; }
        b.disabled = true; msg.className = 'mail-msg'; msg.textContent = 'Connexion à IONOS…';
        const o = { compte: D.compte(), adresse: f.adresse.value, nom: f.nom.value, motdepasse: f.motdepasse.value, serveur: f.serveur.value, port: f.port.value };
        const r = await L().mailConfigurer(o).catch((x) => ({ ok: false, erreur: x.message }));
        f.motdepasse.value = ''; b.disabled = false;
        if (!r.ok) { msg.className = 'mail-msg erreur'; msg.textContent = r.erreur || 'Connexion refusée.'; return; }
        if (C()) await C().ecrirePreference('mail_ionos', { adresse: o.adresse.trim(), nom: o.nom.trim(), serveur: o.serveur.trim(), port: Number(o.port) || 465 }).catch(() => false);
        Object.assign(e, await D.mailEtat()); edition = false; dessiner(); if (notifier) notifier(`Boîte ${r.adresse} connectée à votre compte : les e-mails partent directement depuis FMD.`); if (apres) apres(e); });
      const an = el.querySelector('[data-mail-annuler]'); if (an) an.addEventListener('click', () => { edition = false; dessiner(); });
      const ch = el.querySelector('[data-mail-changer]'); if (ch) ch.addEventListener('click', () => { edition = true; dessiner(); });
      const ou = el.querySelector('[data-mail-oublier]'); if (ou) ou.addEventListener('click', async () => { await L().mailOublier(D.compte()); Object.assign(e, { configure: false, adresse: '', nom: '' }); edition = true; dessiner(); if (notifier) notifier('Boîte e-mail déconnectée de votre compte sur ce PC.'); if (apres) apres(e); });
      const fs2 = el.querySelector('[data-sig-form]'); const smsg = fs2.querySelector('[data-sig-msg]');
      fs2.addEventListener('submit', async (ev) => { ev.preventDefault(); const t = fs2.signature.value.replace(/\s+$/g, '');
        const ok = C() ? await C().ecrirePreference('signature_mail', t.trim() ? t : null).catch(() => false) : false;
        smsg.className = ok ? 'mail-msg' : 'mail-msg erreur'; smsg.textContent = ok ? '✓ Signature enregistrée dans votre compte (suit sur tous les PC).' : 'Signature non enregistrée (hors ligne ?).'; if (ok && apres) apres(e); });
      fs2.querySelector('[data-sig-defaut]').addEventListener('click', () => { fs2.signature.value = D.signatureDefaut(); smsg.textContent = 'Signature par défaut remise : cliquez « Enregistrer ma signature ».'; });
    };
    dessiner();
  };

  // ---------- fenêtre « Envoyer par e-mail » (comme le Radar) ----------
  D.envoyerDoc = (v, type, d) => {
    const db = v.db; const m = D.mailDoc(db, type, d); const t = D.tiers(db, d.tiers) || {};
    const emails = [...new Set([t.email, ...db.contacts.filter((k) => k.tiers === d.tiers).map((k) => k.email)].filter(Boolean))];
    let chemin = null;
    v.fenetre(`Envoyer ${esc(d.ref)} par e-mail`, `
      <div class="erp-mail-fiche">${m.fiche.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <div class="erp-mail-boite" data-boite></div>
      <form id="erp-mail" class="erp-form-fen">
        <label class="erp-mail-l">À<input name="a" type="email" value="${esc(m.a)}" list="erp-mails" placeholder="adresse@entreprise.fr"><datalist id="erp-mails">${emails.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
        <label class="erp-mail-l">Objet<input name="sujet" value="${esc(m.sujet)}"></label>
        <label class="erp-mail-l">Message<textarea name="corps" rows="12">${esc(m.corps)}</textarea></label>
        <div class="erp-mail-pj"><span>📎</span><span data-pj>Préparation du PDF…</span><button type="button" class="erp-lien" data-voir hidden>Aperçu</button><button type="button" class="erp-lien" data-dossier hidden>Ouvrir le dossier</button></div>
      </form>`,
    `<label class="erp-coche erp-mail-envoye"><input type="checkbox" data-envoye> E-mail envoyé</label><span class="erp-gris" data-info></span>
     <button type="button" class="btn btn-ligne" data-copier>Copier le message</button><button type="button" class="btn btn-ligne" data-ouvrir disabled>Ouvrir dans ma messagerie</button>
     <label class="erp-coche" data-copie-l hidden><input type="checkbox" data-copie checked> M’envoyer une copie</label><button type="button" class="btn btn-metal" data-envoyer-fmd hidden disabled>Envoyer depuis FMD</button>`,
    async (b) => {
      const f = b.querySelector('#erp-mail'); const info = b.querySelector('[data-info]'); const pj = b.querySelector('[data-pj]');
      try { chemin = await D.produirePdf(v, type, d); pj.textContent = chemin ? chemin.split(/[\\/]/).pop() + ' (joint automatiquement)' : 'PDF disponible uniquement dans le logiciel installé'; if (chemin) { b.querySelector('[data-voir]').hidden = false; b.querySelector('[data-dossier]').hidden = false; } }
      catch (e) { pj.textContent = 'PDF impossible : ' + e.message; }
      b.querySelector('[data-ouvrir]').disabled = false;
      // Envoi direct par la boîte IONOS (21 nov. 2026) : bouton « Envoyer depuis FMD » si la boîte est connectée sur ce PC
      const zoneBoite = b.querySelector('[data-boite]'); const btnEnv = b.querySelector('[data-envoyer-fmd]'); const copieL = b.querySelector('[data-copie-l]');
      const majBoite = async () => { const e = await D.mailEtat(); if (e.indisponible) { zoneBoite.hidden = true; return; }
        btnEnv.hidden = !e.configure; copieL.hidden = !e.configure; btnEnv.disabled = !e.configure;
        if (e.configure) { zoneBoite.innerHTML = `<span>✉ Envoyé depuis <b>${esc(e.adresse)}</b> (IONOS)</span> <button type="button" class="erp-lien" data-changer-boite>changer</button>`;
          zoneBoite.querySelector('[data-changer-boite]').addEventListener('click', () => { zoneBoite.innerHTML = ''; D.reglageMail(zoneBoite, v.notifier, majBoite); }); }
        else { zoneBoite.innerHTML = '<p class="erp-gris">Connectez votre boîte IONOS une fois pour envoyer directement depuis FMD :</p><div data-reglage></div>'; D.reglageMail(zoneBoite.querySelector('[data-reglage]'), v.notifier, majBoite); } };
      majBoite();
      btnEnv.addEventListener('click', async () => { const a = f.a.value.trim(); if (!a) { info.textContent = 'Indiquez l’adresse du destinataire.'; f.a.focus(); return; }
        btnEnv.disabled = true; info.textContent = 'Envoi en cours…';
        const r = await window.lanceur.mailEnvoyer({ compte: D.compte(), a, sujet: f.sujet.value, corps: f.corps.value, chemin, copieMoi: b.querySelector('[data-copie]').checked }).catch((x) => ({ ok: false, erreur: x.message }));
        btnEnv.disabled = false;
        if (!r.ok) { info.textContent = 'Non envoyé : ' + (r.erreur || 'erreur inconnue'); return; }
        noterEnvoi(`depuis ${r.de}`); b.querySelector('[data-envoye]').checked = true;
        info.textContent = `✓ E-mail envoyé à ${a}${chemin ? ' avec le PDF' : ''}.`; v.notifier(`${d.ref} envoyé par e-mail à ${a}.`); });
      b.querySelector('[data-voir]').addEventListener('click', () => chemin && window.lanceur.docAfficher(chemin));
      b.querySelector('[data-dossier]').addEventListener('click', () => chemin && window.lanceur.docDossier(chemin));
      f.a.addEventListener('change', () => { const x = f.a.value.trim(); if (x && !t.email) { t.email = x; D.toucher(t); v.sauver(); info.textContent = 'Adresse enregistrée dans la fiche du tiers.'; } });
      b.querySelector('[data-copier]').addEventListener('click', () => { const txt = 'Objet : ' + f.sujet.value + NL + NL + f.corps.value;
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { info.textContent = 'Message copié : collez-le dans votre messagerie (Ctrl+V).'; }).catch(() => { f.corps.select(); info.textContent = 'Copie impossible : le texte est sélectionné, faites Ctrl+C.'; }); });
      b.querySelector('[data-ouvrir]').addEventListener('click', async () => {
        const o = { a: f.a.value.trim(), sujet: f.sujet.value, corps: f.corps.value, chemin };
        if (chemin && window.lanceur && window.lanceur.docEmail) {
          const r = await window.lanceur.docEmail(o).catch((e) => ({ ok: false, erreur: e.message }));
          if (r.ok) { info.textContent = 'Votre messagerie s’ouvre avec le message et le PDF joint. Cochez « E-mail envoyé » une fois envoyé.'; return; }
        }
        const url = 'mailto:' + encodeURIComponent(o.a) + '?subject=' + encodeURIComponent(o.sujet) + '&body=' + encodeURIComponent(o.corps);
        if (window.lanceur && window.lanceur.docMailto) await window.lanceur.docMailto(url); else window.open(url);
        if (chemin) await window.lanceur.docDossier(chemin);
        info.textContent = chemin ? 'Votre messagerie s’ouvre : joignez le PDF depuis le dossier qui vient de s’ouvrir.' : 'Votre messagerie s’ouvre avec le message prêt.';
      });
      let note = false;
      const noterEnvoi = (via) => { if (note) return; note = true;
        D.evt(db, `E-mail envoyé à ${f.a.value.trim() || t.nom} : ${TITRES[type].toLowerCase()} ${d.ref}${chemin ? ' (PDF joint)' : ''}${via ? ' ' + via : ''}`, { tiers: d.tiers, objet: { type, id: d.id }, type: 'mail', texte: 'Objet : ' + f.sujet.value + NL + NL + f.corps.value });
        d.envoye = D.maintenant(); D.toucher(d); v.sauver(); };
      b.querySelector('[data-envoye]').addEventListener('change', (e) => { if (!e.target.checked) return; noterEnvoi(''); info.textContent = 'Envoi noté dans les événements.'; });
    });
  };
})();
