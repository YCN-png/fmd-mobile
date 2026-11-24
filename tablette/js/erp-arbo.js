// FMD — Arborescence du catalogue (21 nov. 2026) : « FMD_Arborescence_V2_Affinee.pdf » fourni par l'utilisateur, intégrée
// au CRM et au site. 14 rayons › sous-catégories › sous-sous-catégories (propositions et « selon volume » comprises,
// demande de l'utilisateur). Rayon 11 « Ventilation » du PDF renommé « Génie climatique » (demande de l'utilisateur).
// Produit : p.categorie (rayon), p.souscat (id de la sous-catégorie), p.soussouscat (id de la sous-sous-catégorie).
// Les anciens identifiants de catégories sont repris tels quels quand le rayon existe encore (visserie, outillage, collage,
// masquage, vetements, electricite) : les produits existants restent dans le bon rayon sans rien reclasser. Seule
// « quincaillerie » disparaît → Visserie & Boulonnerie › Quincaillerie de fixation (D.migrerCategories).
// Marques, Métiers du bâtiment et Déstockage : accès transversaux du site, hors arborescence (PDF).
// Chargé après js/erp-donnees.js : remplace D.CATEGORIES, D.RAYONS_SITE, D.rayonSite, D.nomRayon, D.categorie.
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  // R|id|nom|nom court · S|nom · - sous-sous-catégorie
  const TEXTE = `
R|accessoires|Accessoires & Divers|Accessoires
S|Accessoires
-Accessoires transversaux
S|Pièces détachées
-Pièces détachées pour outillage
-Pièces détachées pour machines et équipements
S|Objets promotionnels
-Articles publicitaires FMD
R|atelier|Atelier & Rangement|Atelier
S|Atelier
-Établis et plans de travail
-Étaux et presses
S|Consommables chantier
-Sacs, seaux et consommables de chantier
S|Entretien & nettoyage
-Nettoyants et dégraissants techniques
-Décapants et détachants
-Brosses et balais
-Chiffons et produits d’essuyage
S|Rangement
-Boîtes et coffrets de rangement
-Servantes et modules d’atelier
-Sacs et mallettes à outils
R|automobile|Automobile|Automobile
S|Consommables automobile
-Nettoyants carrosserie et habitacle
-Additifs et entretien moteur
-Produits et accessoires pour vitrages
S|Outillage automobile
-Outils de mécanique automobile
-Outils de démontage et d’extraction
S|Vitrage automobile
-Consommables de remplacement de vitrage
R|climatisation|Climatisation|Climatisation
S|Unités intérieures
-Unités intérieures murales
-Unités intérieures consoles, cassettes et gainables
S|Unités extérieures
-Groupes extérieurs monosplit
-Groupes extérieurs multisplit
S|Liaisons frigorifiques
-Liaisons frigorifiques simples
-Liaisons frigorifiques doubles isolées
S|Pompes de relevage des condensats
-Pompes seules et mini-pompes
-Kits en goulotte
-Tuyaux et accessoires de relevage
S|Supports & goulottes
-Supports muraux et au sol
-Goulottes et accessoires de pose
-Plots et accessoires antivibratiles
S|Entretien & accessoires climatisation
-Nettoyants et désinfectants de climatisation
-Accessoires frigorifiques et pièces de montage
R|collage|Colles, Mastics & Étanchéité|Colles & mastics
S|Colles & adhésifs
-Colles de montage
-Colles techniques
-Rubans adhésifs toilés et techniques
-Rubans de signalisation
S|Mastics & silicones
-Silicones sanitaires et bâtiment
-Mastics acryliques
-Mastics hybrides et MS polymères
-Autres mastics de construction
S|Mousses PU
-Mousses polyuréthane pistolables
-Mousses polyuréthane manuelles
-Mousses PU de collage
S|Étanchéité
-Écrans sous-toiture
-Pare-vapeur
-Pare-pluie
-Bandes d’étanchéité
-Joints et accessoires d’étanchéité
S|Accessoires d’application
-Pistolets manuels à cartouches
-Canules, buses et adaptateurs
-Primaires et nettoyants de préparation
R|construction|Construction & Aménagement|Construction
S|Cloisons & Plafonds
-Ossatures et accessoires pour plaques de plâtre
-Bandes à joints et enduits
-Accessoires de pose des cloisons
S|Carrelage & revêtements
-Croisillons et cales
-Systèmes de nivellement
-Accessoires de pose de carrelage
S|Couverture & évacuation des eaux
-Gouttières et descentes
-Naissances, coudes et accessoires de gouttière
R|vetements|EPI & Vêtements|EPI & vêtements
S|Protection individuelle
-Casques et protection de la tête
-Lunettes et protection des yeux
-Protection respiratoire
-Protection auditive
-Harnais et équipements antichute
S|Gants
-Gants de manutention et anti-coupure
-Gants nitrile et protection chimique
-Gants spécifiques métiers
S|Chaussures de sécurité
-Chaussures basses
-Chaussures montantes
-Bottes de sécurité
-Semelles et accessoires
S|Vêtements professionnels
-Pantalons de travail
-Shorts et bermudas
-T-shirts et polos
-Sweats et pulls
-Vestes et softshells
-Parkas et vêtements de pluie
-Vêtements haute visibilité
-Sous-vêtements techniques et accessoires
S|Vêtements jetables
-Combinaisons et protections jetables
R|outillage|Outillage|Outillage
S|Abrasifs & ponçage
-Disques à tronçonner
-Disques à meuler et ébarber
-Disques à lamelles
-Feuilles, rouleaux et disques abrasifs
-Brosses métalliques
-Disques diamant
S|Découpe & sciage
-Lames de scie à ruban
-Lames de scie circulaire
-Lames de scie sauteuse et sabre
-Lames de scie à métaux
-Cutters, couteaux et lames
-Accessoires de sciage
S|Forets, mèches & perçage
-Forets métaux
-Forets béton
-Forets bois
-Forets étagés et coniques
-Forets carrelage, verre et diamant
-Trépans, scies-cloches et couronnes
-Coffrets de forets
-Mandrins et accessoires de perçage
-Burins et accessoires
S|Fraisage & usinage
-Fraises de fraisage
-Fraises à carotter
-Fraises-limes rotatives
-Outils de tournage
-Porte-outils et arbres
-Barreaux et plaquettes
-Ébavureurs et fraises à ébavurer
S|Taraudage, filetage & alésage
-Tarauds à main
-Tarauds machine
-Filières et accessoires
-Alésoirs
-Bagues et tampons de contrôle
-Inserts et filets rapportés
-Coffrets de taraudage
S|Clés & douilles
-Clés plates, mixtes et à pipe
-Clés Allen et Torx
-Clés dynamométriques
-Douilles et rallonges
-Cliquets et accessoires
S|Pinces, extraction & maintien
-Pinces et tenailles
-Pinces multiprises et étaux
-Extracteurs mécaniques et hydrauliques
-Serre-joints et accessoires de maintien
S|Tournevis & embouts
-Tournevis manuels
-Embouts de vissage
-Porte-embouts et adaptateurs
S|Frappe & démolition
-Marteaux et massettes
-Masses et outils de démolition manuels
S|Outillage de chantier
-Pelles, pioches et outils de terrassement
-Outils de manutention et de levage manuels
S|Coffrets & ensembles d’outils
-Coffrets de douilles et clés
-Modules et assortiments d’outils
-Coffrets d’outils spécialisés
S|Mesure & traçage
-Mètres, règles et équerres
-Niveaux et outils de contrôle
-Lasers et télémètres
-Crayons, marqueurs et traceurs
-Pieds à coulisse, jauges et micromètres
S|Outils de finition
-Lames et couteaux à enduire
-Outils de plaquiste
-Taloches et outils de maçonnerie
-Outils de ligature et ferraillage
S|Soudage, brasage & plomberie
-Chalumeaux et outils de brasage
-Consommables de brasage et soudure
R|masquage|Peinture & Protection|Peinture
S|Peinture & application
-Pinceaux et brosses
-Rouleaux et manchons
-Bacs, grilles et accessoires de peinture
-Peintures, primaires et aérosols
S|Protection
-Adhésifs de masquage
-Bâches et films de protection
-Protections des sols et surfaces
R|plomberie|Plomberie|Plomberie
S|Raccords plomberie
-Raccords filetés en laiton et métal
-Raccords à compression et bicone
-Raccords à sertir
-Raccords PER
-Raccords multicouche
-Raccords cuivre à souder
-Raccords PVC et synthétiques
-Coudes, tés et manchons
-Bouchons, unions et réductions
S|Tubes & flexibles
-Tubes cuivre
-Tubes PER et multicouche
-Flexibles sanitaires et de raccordement
S|Robinetterie & vannes
-Robinets
-Vannes et robinets d’arrêt
-Clapets et organes de réglage
S|Évacuation & assainissement
-Tubes PVC évacuation
-Raccords et accessoires PVC évacuation
-Siphons et accessoires de vidage
S|Fixation & supportage
-Colliers et supports de tubes
-Rails, consoles et accessoires de fixation
S|Joints & accessoires
-Joints de plomberie
-Accessoires d’étanchéité des raccords
S|Outillage plomberie
-Coupe-tubes et ébavureurs
-Outils de sertissage
-Déboucheurs et outillage sanitaire
S|Arrosage & jardin
-Raccords d’arrosage
-Tuyaux et accessoires d’arrosage
R|genie_climatique|Génie climatique|Génie climatique
S|VMC & extracteurs
-Kits et caissons simple flux
-VMC hygroréglables
-VMC double flux
-Extracteurs et moteurs
S|Gaines & conduits
-Gaines souples
-Gaines rigides et conduits
-Gaines isolées
S|Raccords & réductions
-Raccords droits et manchons
-Coudes et tés
-Réductions et adaptateurs
S|Bouches, grilles & entrées d’air
-Bouches d’extraction
-Bouches d’insufflation
-Grilles et aérateurs
-Entrées d’air
S|Rejets & sorties d’air extérieures
-Sorties murales et de façade
-Sorties toiture et chapeaux
S|Entretien & accessoires VMC
-Filtres et consommables VMC
-Pièces détachées VMC
-Colliers et accessoires de fixation
-Ramonage et nettoyage des conduits
R|visserie|Visserie & Boulonnerie|Visserie
S|Vis bois
-Vis bois universelles
-Vis de charpente
-Vis terrasse et bardage
-Tirefonds
S|Vis techniques
-Vis autoperceuses
-Vis béton et fixation directe
-Vis à tôle
-Vis plaque de plâtre
S|Vis métriques & boulonnerie
-Vis métriques
-Boulons et écrous
-Rondelles et accessoires de boulonnerie
S|Chevilles
-Chevilles nylon et universelles
-Chevilles métalliques
-Chevilles pour plaques de plâtre
S|Ancrages & scellement
-Goujons et ancrages
-Scellements chimiques et résines
-Tamis et accessoires de scellement
S|Colliers & supportage
-Tiges filetées
-Colliers de fixation et pontets
-Supports et accessoires de suspension
S|Clouage & agrafage
-Clous et pointes
-Agrafes
-Rivets
S|Quincaillerie de fixation
-Équerres et ferrures
-Gonds et crochets
-Accessoires et caches de fixation
R|electricite|Électricité & Éclairage|Électricité
S|Éclairage
-Lampes et ampoules LED
-Luminaires et éclairages de chantier
S|Installation électrique
-Câbles et fils électriques
-Conduits, tubes et gaines électriques
-Boîtes de dérivation et encastrement
-Prises, interrupteurs et plaques
S|Pile et batterie
-Piles
-Batteries et accus
S|Raccords de câbles électriques
-Bornes de connexion
-Cosses et connecteurs
S|Tableaux & coffrets résidentiels
-Tableaux et coffrets électriques
-Disjoncteurs et interrupteurs différentiels
-Accessoires de tableaux électriques
S|Coupe circuit et fusible
-Fusibles et porte-fusibles
R|electroportatif|Électroportatif|Électroportatif
S|Perçage & vissage
-Perceuses et visseuses
-Perforateurs et burineurs électriques
S|Découpe, sciage & ponçage
-Meuleuses électriques
-Scies électroportatives
-Ponceuses électriques
S|Pistolets électriques
-Pistolets à mastic sur batterie
-Pistolets électriques spécialisés
S|Clouage & agrafage
-Cloueurs et agrafeuses électriques
-Cloueurs et agrafeuses pneumatiques
S|Batteries & chargeurs
-Batteries pour outils
-Chargeurs et adaptateurs
S|Aspirateurs & extraction
-Aspirateurs de chantier
-Accessoires d’aspiration pour machines`;

  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const DEFAUT = []; let r = null; let s = null;
  TEXTE.trim().split('\n').forEach((l) => {
    if (l.startsWith('R|')) { const [, id, nom, court] = l.split('|'); r = { id, nom, court, sous: [] }; DEFAUT.push(r); }
    else if (l.startsWith('S|')) { const nom = l.slice(2); s = { id: slug(nom), nom, sous: [] }; r.sous.push(s); }
    else if (l.startsWith('-')) { const nom = l.slice(1); s.sous.push({ id: slug(nom), nom }); }
  });
  const copie = (x) => JSON.parse(JSON.stringify(x));

  // Arborescence modifiable (21 nov. 2026, demande : « pouvoir modifier le nom des catégories de l'arborescence, ajouter /
  // supprimer des catégories, sous-catégories, etc. ») : la version modifiée est dans la base du CRM (db.arbo, enregistrée en
  // ligne et partagée entre les PC). Sans modification : l'arborescence V2 du PDF (DEFAUT). Renommer garde l'identifiant :
  // les produits restent rangés au même endroit.
  D.ARBO = copie(DEFAUT);
  const recalculer = () => { D.ARBO.forEach((x, i) => { x.n = String(i + 1).padStart(2, '0'); x.sous = x.sous || []; x.sous.forEach((y) => { y.sous = y.sous || []; }); });
    D.CATEGORIES = D.ARBO.map((x) => [x.id, x.nom]); D.RAYONS_SITE = D.ARBO.map((x) => [x.id, x.nom]); };
  D.appliquerArbo = (db) => { D.ARBO = db && Array.isArray(db.arbo) && db.arbo.length ? db.arbo : copie(DEFAUT); recalculer(); return D.ARBO; };
  D.arboModifiable = (db) => { if (!Array.isArray(db.arbo) || !db.arbo.length) db.arbo = copie(DEFAUT); D.appliquerArbo(db); return db.arbo; };
  D.arboDefaut = () => copie(DEFAUT);
  recalculer();
  // Toute base chargée (CRM, site, Studio…) applique son arborescence. js/erp-nuage.js enveloppe D.charger ensuite.
  if (D.charger) { const charger0 = D.charger; D.charger = () => { const db = charger0(); D.appliquerArbo(db); return db; }; }

  const rayon = (id) => D.ARBO.find((x) => x.id === id);
  const sousDe = (rid, sid) => ((rayon(rid) || { sous: [] }).sous.find((x) => x.id === sid));
  D.rayonArbo = rayon;
  D.sousCats = (rid) => ((rayon(rid) || { sous: [] }).sous.map((x) => [x.id, x.nom]));
  D.sousSousCats = (rid, sid) => ((sousDe(rid, sid) || { sous: [] }).sous.map((x) => [x.id, x.nom]));
  D.categorie = (id) => { const x = rayon(id) || rayon((ANCIENNES[id] || {}).categorie); return x ? x.nom : id || '—'; };
  D.nomSousCat = (rid, sid) => (sousDe(rid, sid) || {}).nom || '';
  D.nomSousSousCat = (rid, sid, ssid) => ((sousDe(rid, sid) || { sous: [] }).sous.find((x) => x.id === ssid) || {}).nom || '';
  D.cheminCategorie = (p) => [D.categorie(p.categorie), D.nomSousCat(p.categorie, p.souscat), D.nomSousSousCat(p.categorie, p.souscat, p.soussouscat)].filter((x) => x && x !== '—').join(' › ');

  // ---------- anciens identifiants ----------
  const ANCIENNES = { quincaillerie: { categorie: 'visserie', souscat: 'quincaillerie-de-fixation' } };
  const ANCIENS_RAYONS = { sanitaire: 'plomberie', peinture: 'masquage', quincaillerie: 'visserie', metiers: '' };
  // Produits et produits à variantes rangés avec les anciennes catégories / anciens rayons du site. Renvoie true si changé.
  D.migrerCategories = (db) => { let ch = false;
    [...(db.produits || []), ...(db.modeles || [])].forEach((p) => { let m = false;
      const a = ANCIENNES[p.categorie]; if (a && rayon(a.categorie)) { p.categorie = a.categorie; if (!p.souscat && sousDe(a.categorie, a.souscat)) p.souscat = a.souscat; m = true; }
      if (p.web_rayon && !rayon(p.web_rayon) && ANCIENS_RAYONS[p.web_rayon] !== undefined) { p.web_rayon = ANCIENS_RAYONS[p.web_rayon]; m = true; }
      if (m) { if (D.toucher) D.toucher(p); ch = true; } });
    return ch; };

  // ---------- site ----------
  const estClim = (p) => /climatisation|split|frigorifique/i.test(`${p.libelle} ${p.marque}`);
  D.rayonSite = (p) => {
    const w = p.web_rayon && (rayon(p.web_rayon) ? p.web_rayon : ANCIENS_RAYONS[p.web_rayon]); if (w && rayon(w)) return w;
    const c = rayon(p.categorie) ? p.categorie : (ANCIENNES[p.categorie] || {}).categorie;
    if (c === 'electricite' && estClim(p) && rayon('climatisation')) return 'climatisation';
    return (c && rayon(c)) ? c : (D.ARBO[0] || {}).id || '';
  };
  D.nomRayon = (id) => (rayon(id) || { nom: id }).nom;

  // ---------- champs « Rayon / Sous-catégorie / Sous-sous-catégorie » des formulaires ----------
  const opts = (l, val, vide) => `<option value="">${vide}</option>${l.map(([v, t]) => `<option value="${v}"${v === val ? ' selected' : ''}>${D.ui.esc(t)}</option>`).join('')}`;
  D.champsCategorie = (b) => { const U = D.ui; const rid = rayon(b.categorie) ? b.categorie : (D.CATEGORIES[0] || [''])[0];
    return `<div class="erp-2f">${U.ligne('Rayon', `<select name="categorie" required data-sans-recherche>${D.ARBO.map((x) => `<option value="${x.id}"${x.id === rid ? ' selected' : ''}>${x.n} · ${D.ui.esc(x.nom)}</option>`).join('')}</select>`, { req: true })}
      ${U.ligne('Sous-catégorie', `<select name="souscat" data-arbo-s data-sans-recherche>${opts(D.sousCats(rid), b.souscat || '', 'À classer')}</select>`)}</div>
      ${U.ligne('Sous-sous-catégorie', `<select name="soussouscat" data-arbo-ss data-sans-recherche>${opts(D.sousSousCats(rid, b.souscat), b.soussouscat || '', 'À classer')}</select>`)}`; };
  D.lierChampsCategorie = (el) => { const r0 = el.querySelector('[name="categorie"]'); const s0 = el.querySelector('[data-arbo-s]'); const ss = el.querySelector('[data-arbo-ss]'); if (!r0 || !s0 || !ss) return;
    const majSS = () => { ss.innerHTML = opts(D.sousSousCats(r0.value, s0.value), '', 'À classer'); };
    r0.addEventListener('change', () => { s0.innerHTML = opts(D.sousCats(r0.value), '', 'À classer'); majSS(); });
    s0.addEventListener('change', majSS); };

  // ---------- page CRM › Catalogue › Arborescence (consultation + modification) ----------
  let edition = false;
  const idLibre = (nom, liste) => { const base = slug(nom) || 'categorie'; let id = base; let i = 2; while (liste.some((x) => x.id === id)) id = `${base}-${i++}`; return id; };
  D.pageArbo = (v) => {
    const U = D.ui; const esc = U.esc; const db = v.db; D.appliquerArbo(db);
    const nb = (f) => db.produits.filter(f).length;
    const aClasser = nb((p) => !p.souscat);
    const totS = D.ARBO.reduce((a, x) => a + x.sous.length, 0); const totSS = D.ARBO.reduce((a, x) => a + x.sous.reduce((b, y) => b + y.sous.length, 0), 0);
    const btn = (attr, txt, titre, cls = 'btn-icone') => `<button type="button" class="${cls}" ${attr} title="${esc(titre)}" aria-label="${esc(titre)}">${txt}</button>`;
    const fleches = (k, i, n) => `${btn(`data-arbo-monter="${k}" ${i ? '' : 'disabled'}`, '↑', 'Monter')}${btn(`data-arbo-descendre="${k}" ${i < n - 1 ? '' : 'disabled'}`, '↓', 'Descendre')}`;
    const champ = (k, val, l = '') => `<input class="erp-inline erp-arbo-nom" data-arbo-nom="${k}" value="${esc(val)}" aria-label="Nom" ${l}>`;
    const rayonHtml = (r, ri) => { const n = nb((p) => p.categorie === r.id); const nc = nb((p) => p.categorie === r.id && !p.souscat);
      const tete = edition
        ? `<span class="erp-arbo-n">${r.n}</span>${champ(`${ri}`, r.nom)}<input class="erp-inline erp-arbo-court" data-arbo-court="${ri}" value="${esc(r.court || '')}" placeholder="Nom court (site)" aria-label="Nom court sur le site"><em>${D.nombre(n)}</em>${fleches(`${ri}`, ri, D.ARBO.length)}${btn(`data-arbo-suppr="${ri}"`, '✕', 'Supprimer ce rayon')}`
        : `<span class="erp-arbo-n">${r.n}</span><b>${esc(r.nom)}</b><span class="erp-gris">${r.sous.length} sous-cat.</span><em>${D.nombre(n)} produit${n > 1 ? 's' : ''}</em>${nc ? `<span class="pastille st-att">${D.nombre(nc)} à classer</span>` : ''}<a href="#" data-aller="produits/liste/${r.id}" class="erp-lien">Voir</a>`;
      return `<${edition ? 'div' : 'details'} class="erp-arbo${edition ? ' erp-arbo-ed' : ''}"><${edition ? 'div class="erp-arbo-tete"' : 'summary'}>${tete}</${edition ? 'div' : 'summary'}>
        <ul>${r.sous.map((s0, si) => { const ns = nb((p) => p.categorie === r.id && p.souscat === s0.id); const k = `${ri}.${si}`;
          return `<li><div class="erp-arbo-s">${edition ? `${champ(k, s0.nom)}<em>${D.nombre(ns)}</em>${fleches(k, si, r.sous.length)}${btn(`data-arbo-suppr="${k}"`, '✕', 'Supprimer cette sous-catégorie')}` : `<b>${esc(s0.nom)}</b><em>${D.nombre(ns)}</em>`}</div>
            <div class="erp-arbo-ss">${s0.sous.map((x, xi) => { const nx = nb((p) => p.categorie === r.id && p.souscat === s0.id && p.soussouscat === x.id); const kx = `${k}.${xi}`;
              return edition ? `<span class="erp-arbo-ss-ed">${champ(kx, x.nom)}${nx ? `<small>${D.nombre(nx)}</small>` : ''}${btn(`data-arbo-monter="${kx}" ${xi ? '' : 'disabled'}`, '‹', 'Avant')}${btn(`data-arbo-suppr="${kx}"`, '✕', 'Supprimer')}</span>`
                : `<span class="pastille${nx ? ' st-ok' : ''}">${esc(x.nom)}${nx ? ` · ${D.nombre(nx)}` : ''}</span>`; }).join('')}
              ${edition ? `<span class="erp-arbo-ajout"><input class="erp-inline" data-arbo-nouveau="${k}" placeholder="+ Sous-sous-catégorie" aria-label="Nouvelle sous-sous-catégorie"></span>` : ''}</div></li>`; }).join('')}
          ${edition ? `<li class="erp-arbo-ajout"><input class="erp-inline" data-arbo-nouveau="${ri}" placeholder="+ Nouvelle sous-catégorie" aria-label="Nouvelle sous-catégorie"></li>` : ''}</ul></${edition ? 'div' : 'details'}>`; };
    const outils = edition
      ? `${U.btn('Terminer', 'valider', 'btn-metal', 'data-arbo-fin')}${U.btn('Revenir à l’arborescence V2 du PDF', '', 'btn-ligne', 'data-arbo-defaut')}`
      : U.btn('Modifier l’arborescence', 'modifier', 'btn-metal', 'data-arbo-edit');
    return { html: `${U.titrePage('◈', 'Arborescence du catalogue', D.ARBO.length, outils)}
      <p class="erp-gris">${D.ARBO.length} rayons · ${totS} sous-catégories · ${totSS} sous-sous-catégories${Array.isArray(db.arbo) && db.arbo.length ? ' (modifiée)' : ' (V2 du PDF)'}. ${edition ? 'Tapez le nouveau nom puis Entrée (ou cliquez ailleurs) : c’est enregistré et partagé avec tous les PC. Renommer ne déplace aucun produit.' : `Le rayon, la sous-catégorie et la sous-sous-catégorie se choisissent sur la fiche produit (« Modifier ») ou par l’import Excel.${aClasser ? ` <b>${D.nombre(aClasser)} produit(s) encore à classer</b> (sans sous-catégorie).` : ''}`}</p>
      <div class="erp-arbo-liste${edition ? ' edition' : ''}">${D.ARBO.map(rayonHtml).join('')}
        ${edition ? `<div class="erp-arbo-ajout erp-arbo-ajout-r"><input class="erp-inline" data-arbo-nouveau="" placeholder="+ Nouveau rayon" aria-label="Nouveau rayon"></div>` : ''}</div>`,
      apres: (el) => {
        const A = () => D.arboModifiable(db);
        const noeud = (k) => { const [a, b, c] = String(k).split('.').map(Number); const R = A();
          if (c != null && !Number.isNaN(c)) return { liste: R[a].sous[b].sous, i: c, niveau: 3, r: R[a], s: R[a].sous[b] };
          if (b != null && !Number.isNaN(b)) return { liste: R[a].sous, i: b, niveau: 2, r: R[a] };
          return { liste: R, i: a, niveau: 1 }; };
        const fin = (m) => { recalculer(); v.sauver(); if (m) v.notifier(m); v.rendre(); };
        const evt = (t) => D.evt(db, t, {});
        el.querySelectorAll('[data-arbo-edit], [data-arbo-fin]').forEach((b) => b.addEventListener('click', () => { edition = b.hasAttribute('data-arbo-edit'); v.rendre(); }));
        const def = el.querySelector('[data-arbo-defaut]');
        if (def) def.addEventListener('click', () => v.confirmer('Revenir à l’arborescence V2 du PDF ?', 'Les noms changés et les rubriques ajoutées ou supprimées sont oubliés. Les produits rangés dans une rubrique qui n’existe plus apparaîtront « À classer ».', 'Revenir à la V2', () => {
          delete db.arbo; D.appliquerArbo(db); evt('Arborescence remise à la V2 du PDF'); fin('Arborescence V2 rétablie.'); }));
        el.querySelectorAll('[data-arbo-nom]').forEach((i) => { i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } });
          
          i.addEventListener('change', () => { const nom = i.value.trim(); const o = noeud(i.dataset.arboNom); const x = o.liste[o.i]; if (!nom) { i.value = x.nom; return; }
            if (nom === x.nom) return; const avant = x.nom; x.nom = nom; evt(`Arborescence : « ${avant} » renommé « ${nom} »`); fin(`« ${avant} » → « ${nom} »`); }); });
        el.querySelectorAll('[data-arbo-court]').forEach((i) => { i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } });
          i.addEventListener('change', () => { const x = A()[+i.dataset.arboCourt]; x.court = i.value.trim() || x.nom; fin(); }); });
        el.querySelectorAll('[data-arbo-nouveau]').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const nom = i.value.trim(); if (!nom) return;
          const k = i.dataset.arboNouveau; const R = A();
          if (k === '') { R.push({ id: idLibre(nom, R), nom, court: nom, sous: [] }); evt(`Arborescence : rayon « ${nom} » ajouté`); }
          else if (!k.includes('.')) { const r0 = R[+k]; r0.sous.push({ id: idLibre(nom, r0.sous), nom, sous: [] }); evt(`Arborescence : sous-catégorie « ${nom} » ajoutée dans « ${r0.nom} »`); }
          else { const [a, b] = k.split('.').map(Number); const s1 = R[a].sous[b]; s1.sous.push({ id: idLibre(nom, s1.sous), nom }); evt(`Arborescence : « ${nom} » ajouté dans « ${s1.nom} »`); }
          fin(`« ${nom} » ajouté.`); }));
        const deplacer = (k, d) => { const o = noeud(k); const j = o.i + d; if (j < 0 || j >= o.liste.length) return; [o.liste[o.i], o.liste[j]] = [o.liste[j], o.liste[o.i]]; fin(); };
        el.querySelectorAll('[data-arbo-monter]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); deplacer(b.dataset.arboMonter, -1); }));
        el.querySelectorAll('[data-arbo-descendre]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); deplacer(b.dataset.arboDescendre, 1); }));
        el.querySelectorAll('[data-arbo-suppr]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); const o = noeud(b.dataset.arboSuppr); const x = o.liste[o.i];
          const touches = o.niveau === 1 ? db.produits.filter((p) => p.categorie === x.id) : o.niveau === 2 ? db.produits.filter((p) => p.categorie === o.r.id && p.souscat === x.id) : db.produits.filter((p) => p.categorie === o.r.id && p.souscat === o.s.id && p.soussouscat === x.id);
          if (o.niveau === 1 && touches.length) { v.fenetre('Suppression impossible', `<p>Le rayon « ${esc(x.nom)} » contient ${D.nombre(touches.length)} produit(s). Rangez-les d’abord dans un autre rayon (fiche produit ou import Excel), puis supprimez le rayon.</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
          if (o.niveau === 1 && o.liste.length <= 1) { v.notifier('Il faut garder au moins un rayon.'); return; }
          const sous = o.niveau === 1 ? `${x.sous.length} sous-catégorie(s) et leurs sous-sous-catégories seront supprimées aussi.` : o.niveau === 2 ? `Ses ${x.sous.length} sous-sous-catégorie(s) seront supprimées aussi.` : '';
          v.confirmer(`Supprimer « ${x.nom} » ?`, `${sous} ${touches.length ? `${D.nombre(touches.length)} produit(s) rangé(s) ici resteront dans le rayon mais passeront « À classer » à ce niveau.` : 'Aucun produit n’y est rangé.'}`, 'Supprimer', () => {
            touches.forEach((p) => { if (o.niveau === 2) { p.souscat = ''; p.soussouscat = ''; } else p.soussouscat = ''; if (D.toucher) D.toucher(p); });
            o.liste.splice(o.i, 1); evt(`Arborescence : « ${x.nom} » supprimé${touches.length ? ` (${touches.length} produit(s) à reclasser)` : ''}`); fin(`« ${x.nom} » supprimé.`); }); }));
      } };
  };
})();
