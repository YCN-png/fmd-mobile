// FMD — « À propos de FMD » : présentation de l'entreprise, logos à télécharger (photos de profil, bannière, pack HD)
// et réseaux sociaux de FMD en direct (pages affichées dans le logiciel par le launcher, session séparée).
// Contenu : OBJECTIF PROJET/FMD_Angers_document_reference_IA.pdf (faits publics + éléments internes), contacts des mails
// officiels, comptes @fmdistrib. Logos : assets/logos (copiés du pack graphiste « FMD_SIGNATURE_PACK_GRAPHISTE »).
(function () {
  'use strict';

  const CONTACT = {
    adresse: '3 quai Félix Faure, 49100 Angers',
    carte: 'https://www.google.com/maps/search/?api=1&query=3+quai+F%C3%A9lix+Faure+49100+Angers',
    telephone: '07 44 22 82 54',
    email: 'farid.medegueb@fmdistrib.fr',
    site: 'https://fmdistrib.fr/',
  };
  const RESEAUX = [
    { id: 'reseau-instagram', nom: 'Instagram', compte: '@fmdistrib', url: 'https://www.instagram.com/fmdistrib/', ico: 'IG' },
    { id: 'reseau-tiktok', nom: 'TikTok', compte: '@fmdistrib', url: 'https://www.tiktok.com/@fmdistrib', ico: 'TT' }, // affiché dans FMD : version « embed » (launcher)
    { id: 'reseau-linkedin', nom: 'LinkedIn', compte: 'FMD — fmdistrib', url: 'https://www.linkedin.com/company/fmdistrib/', ico: 'in' },
    { id: 'reseau-site', nom: 'Site web', compte: 'fmdistrib.fr', url: 'https://fmdistrib.fr/', ico: 'W' },
  ];
  const UNIVERS = [
    ['Outillage & atelier', 'Outillage à main et électroportatif, équipements et usages d’atelier.'],
    ['Fixation & quincaillerie', 'Visserie, chevilles, fixations et quincaillerie du bâtiment.'],
    ['Consommables', 'Colles, mastics, étanchéité et consommables de chantier.'],
    ['Technique bâtiment', 'Électricité et éclairage ; sanitaire, chauffage et climatisation.'],
    ['Protection (EPI)', 'Équipements de protection individuelle et vêtements de travail.'],
    ['Mobilité', 'Consommables et équipements pour l’automobile et les véhicules.'],
  ];
  const CLIENTS = [
    ['Artisans du bâtiment', 'Dépannage, compatibilité produit et disponibilité rapide.'],
    ['Second œuvre', 'Achats répétés multi-chantiers, conditions tarifaires et livraisons.'],
    ['Menuiserie, agencement, serrurerie', 'Quincaillerie technique, finition, accès et fixation.'],
    ['Industrie & maintenance', 'Consommables, outillage, EPI, besoins récurrents.'],
  ];
  const VALEURS = [
    ['Proximité utile', 'Une réponse claire, un interlocuteur identifié, la connaissance du terrain.'],
    ['Fiabilité', 'Stock, prix, délai et produit compatible : la promesse est tenue.'],
    ['Réactivité', 'Devis, préparation et urgences chantier traités en priorité.'],
    ['Expertise', 'La bonne solution, sans survente, avec la preuve technique.'],
    ['Simplicité', 'Trouver, commander, recevoir, être facturé : facilement.'],
  ];
  const PALETTE = [['Rose gold clair', '#F7DAC5'], ['Champagne rosé', '#EAC2A9'], ['Rose gold', '#C9987D'], ['Bronze cuivré', '#A3735C'], ['Cuivre foncé', '#6F4A3C'], ['Noir profond', '#080808']];
  // [fichier, titre, détail, forme de l'aperçu]
  const PROFILS = [
    ['FMD-profil-F-fond-noir.png', 'F rose gold — fond noir', 'Recommandé : Instagram, TikTok'],
    ['FMD-profil-logo-fond-noir.png', 'F + FMD — fond noir', 'LinkedIn, Facebook, Google'],
    ['FMD-profil-F-fond-creme.png', 'F rose gold — fond crème', 'Version claire'],
    ['FMD-profil-logo-fond-blanc.png', 'F + FMD — fond blanc', 'Version claire'],
    ['FMD-profil-F-noir-fond-rose-gold.png', 'F noir — fond rose gold', 'Version couleur'],
  ];
  const VISUELS = [
    ['FMD-banniere-linkedin-1584x396.png', 'Bannière LinkedIn', '1584 × 396 px', 'large'],
    ['FMD-logo-horizontal-metallique.png', 'Logo horizontal métallique', '2048 × 768 px', 'large'],
    ['FMD-story-fond-noir-9x16.png', 'Story / fond d’écran', '941 × 1672 px (9:16)', 'haut'],
  ];
  const PACK = [
    ['FMD-logo-principal-transparent.png', 'Logo principal', 'Fond transparent', 'damier'],
    ['FMD-logo-principal-fond-noir.png', 'Logo principal', 'Fond noir', ''],
    ['FMD-logo-made-in-angers-transparent.png', 'Logo « Made in Angers »', 'Fond transparent', 'damier'],
    ['FMD-logo-made-in-angers-fond-noir.png', 'Logo « Made in Angers »', 'Fond noir', ''],
    ['FMD-logo-sans-baseline-transparent.png', 'F + FMD sans baseline', 'Fond transparent', 'damier'],
    ['FMD-symbole-F-rose-gold-transparent.png', 'Symbole F rose gold', '2048 px, transparent', 'damier'],
    ['FMD-lettrage-rose-gold-transparent.png', 'Lettrage FMD rose gold', '2400 px, transparent', 'damier'],
    ['FMD-logo-blanc-transparent.png', 'Logo blanc', 'Sur fonds foncés', 'sombre'],
    ['FMD-logo-noir-transparent.png', 'Logo noir', 'Sur fonds clairs', 'clair'],
    ['FMD-symbole-F-blanc-transparent.png', 'Symbole F blanc', 'Sur fonds foncés', 'sombre'],
    ['FMD-symbole-F-noir-transparent.png', 'Symbole F noir', 'Sur fonds clairs', 'clair'],
  ];

  function monter(conteneur, ctx) {
    const { L, esc, notifier } = ctx;
    let onglet = 'entreprise';
    let reseau = RESEAUX[0].id;
    let observateur = null;
    let detruit = false;
    const lien = (url, texte) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(texte)}</a>`;

    function dessiner() {
      if (observateur) { observateur.disconnect(); observateur = null; }
      window.removeEventListener('resize', envoyerZone);
      if (L) L.afficherModule(onglet === 'reseaux' ? reseau : null);
      conteneur.innerHTML = `
        <header class="entete">
          <div class="ag-titre"><h2 style="font-size:20px;margin:0">À propos de FMD</h2>
            <span class="discret">Quincaillerie · Outillage · Climatisation — Angers</span></div>
          <div class="onglets onglets-param" style="margin:0">
            <button type="button" data-onglet="entreprise" class="${onglet === 'entreprise' ? 'actif' : ''}">L’entreprise</button>
            <button type="button" data-onglet="logos" class="${onglet === 'logos' ? 'actif' : ''}">Logos & photos de profil</button>
            <button type="button" data-onglet="reseaux" class="${onglet === 'reseaux' ? 'actif' : ''}">Réseaux en direct</button>
          </div>
        </header>
        ${onglet === 'entreprise' ? pageEntreprise() : onglet === 'logos' ? pageLogos() : pageReseaux()}`;
      conteneur.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => { onglet = b.dataset.onglet; dessiner(); }));
      conteneur.querySelectorAll('[data-enregistrer]').forEach((b) => b.addEventListener('click', () => enregistrer(b.dataset.enregistrer)));
      conteneur.querySelectorAll('[data-copier]').forEach((b) => b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(b.dataset.copier); notifier(`${b.dataset.copier} copié.`); } catch { notifier(b.dataset.copier); }
      }));
      if (onglet === 'reseaux') brancherReseaux();
    }

    // ---------- L'entreprise ----------
    function pageEntreprise() {
      return `
        <div class="contenu-page apropos">
          <section class="apropos-hero carte">
            <img src="assets/logos/apercus/FMD-logo-made-in-angers-fond-noir.png" alt="Logo FMD — Quincaillerie, outillage, climatisation, Made in Angers">
            <div>
              <span class="eyebrow">FMD · FM Distrib</span>
              <h1>La quincaillerie des professionnels, <span class="texte-metal">à Angers.</span></h1>
              <p>FMD distribue la quincaillerie, l’outillage et les fournitures techniques dont les professionnels ont besoin
              pour leurs chantiers, leurs ateliers et leurs bâtiments. Installée au 3 quai Félix Faure à Angers, l’entreprise
              accompagne les artisans et les entreprises avec du conseil, des devis, des conditions adaptées aux professionnels
              et une livraison partout en France.</p>
              <div class="apropos-actions">
                <button type="button" class="btn btn-metal" data-ouvrir-url="${CONTACT.site}">Voir fmdistrib.fr</button>
                <button type="button" class="btn btn-ligne" data-aller="reseaux">Nos réseaux en direct</button>
              </div>
            </div>
          </section>
          <section class="grille">
            <div class="carte">
              <h2>Notre ambition</h2>
              <p class="apropos-gros">Devenir <b>la référence n°1 de la quincaillerie à Angers</b>.</p>
              <p class="discret">Pas seulement en chiffre d’affaires : par la qualité du conseil, la disponibilité des références
              essentielles, la rapidité des devis et des livraisons, et la fidélité de nos clients professionnels.</p>
            </div>
            <div class="carte infos">
              <h2>Coordonnées</h2>
              <dl>
                <dt>Adresse</dt><dd>${lien(CONTACT.carte, CONTACT.adresse)}</dd>
                <dt>Téléphone</dt><dd>${lien('tel:+33744228254', CONTACT.telephone)}</dd>
                <dt>E-mail</dt><dd>${lien('mailto:' + CONTACT.email, CONTACT.email)}</dd>
                <dt>Site</dt><dd>${lien(CONTACT.site, 'fmdistrib.fr')}</dd>
                ${RESEAUX.filter((r) => r.id !== 'reseau-site').map((r) => `<dt>${esc(r.nom)}</dt><dd>${lien(r.url, r.compte)}</dd>`).join('')}
              </dl>
            </div>
          </section>
          <section class="carte">
            <h2>Nos univers</h2>
            <div class="apropos-tuiles">${UNIVERS.map(([t, d], i) => `<div class="tuile"><span class="tuile-num">${String(i + 1).padStart(2, '0')}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
          </section>
          <section class="grille">
            <div class="carte">
              <h2>Nos clients</h2>
              <p class="discret" style="margin-bottom:12px">FMD s’adresse d’abord aux professionnels (B2B).</p>
              ${CLIENTS.map(([t, d]) => `<div class="apropos-ligne"><b>${esc(t)}</b><span class="discret">${esc(d)}</span></div>`).join('')}
            </div>
            <div class="carte">
              <h2>Nos engagements <span class="pastille" title="Proposition du document de référence, à valider par la direction">À valider</span></h2>
              ${VALEURS.map(([t, d]) => `<div class="apropos-ligne"><b>${esc(t)}</b><span class="discret">${esc(d)}</span></div>`).join('')}
            </div>
          </section>
          <section class="carte">
            <h2>Identité de marque</h2>
            <p class="discret">Baseline : <b>QUINCAILLERIE · OUTILLAGE · CLIMATISATION</b> — mention « Made in Angers ». Typographie : Montserrat (Alternates pour les titres).
            Couleurs (cliquez pour copier le code) :</p>
            <div class="palette">${PALETTE.map(([n, c]) => `<button type="button" class="couleur" data-copier="${c}" title="Copier ${c}"><i style="background:${c}"></i><b>${esc(n)}</b><span class="discret">${c}</span></button>`).join('')}</div>
          </section>
        </div>`;
    }

    // ---------- Logos ----------
    const carteLogo = ([f, titre, detail, forme], rond) => `
      <div class="logo-carte">
        <div class="logo-apercu ${forme || ''} ${rond ? 'rond' : ''}"><img src="assets/logos/apercus/${esc(f)}" alt="${esc(titre)}" loading="lazy"></div>
        <div class="logo-texte"><b>${esc(titre)}</b><span class="discret">${esc(detail)}</span></div>
        ${L && L.enregistrerLogo ? `<button type="button" class="btn btn-ligne petit" data-enregistrer="${esc(f)}">Enregistrer</button>`
          : `<a class="btn btn-ligne petit" href="assets/logos/${esc(f)}" download>Télécharger</a>`}
      </div>`;
    function pageLogos() {
      return `
        <div class="contenu-page apropos">
          <section class="carte">
            <h2>Photos de profil <span class="discret" style="font-size:12px;font-family:var(--corps)">1080 × 1080 px</span></h2>
            <p class="discret">Prêtes pour Instagram, TikTok, LinkedIn, Facebook, WhatsApp, Google… Le logo est centré avec une marge :
            il reste entier dans le rond que les réseaux découpent (aperçu ci-dessous).</p>
            <div class="logos-grille profils">${PROFILS.map((p) => carteLogo([...p, ''], true)).join('')}</div>
          </section>
          <section class="carte">
            <h2>Bannière et visuels</h2>
            <div class="logos-grille larges">${VISUELS.map((v) => carteLogo(v, false)).join('')}</div>
          </section>
          <section class="carte">
            <h2>Logos haute définition <span class="discret" style="font-size:12px;font-family:var(--corps)">pack graphiste, PNG ~2000 px</span></h2>
            <p class="discret">Fond transparent : à poser sur une image, un document, une signature d’e-mail. Blanc sur fond foncé, noir sur fond clair.</p>
            <div class="logos-grille">${PACK.map((p) => carteLogo(p, false)).join('')}</div>
          </section>
        </div>`;
    }
    async function enregistrer(fichier) {
      const r = await L.enregistrerLogo(fichier);
      if (r && r.ok) notifier('Logo enregistré : ' + r.chemin);
      else if (r && !r.annule) notifier('Enregistrement impossible : ' + (r.erreur || 'erreur inconnue'));
    }

    // ---------- Réseaux en direct ----------
    function pageReseaux() {
      const r = RESEAUX.find((x) => x.id === reseau);
      return `
        <div class="reseaux-barre">
          <div class="reseaux-onglets">${RESEAUX.map((x) => `<button type="button" class="reseau-btn ${x.id === reseau ? 'actif' : ''}" data-reseau="${x.id}"><span class="reseau-ico">${x.ico}</span>${esc(x.nom)}</button>`).join('')}</div>
          <div class="reseaux-actions">
            ${L ? '<button type="button" class="btn btn-ligne petit" id="r-retour" title="Page précédente">‹ Retour</button><button type="button" class="btn btn-ligne petit" id="r-recharger">↻ Actualiser</button>' : ''}
            <button type="button" class="btn btn-ligne petit" data-ouvrir-url="${esc(r.url)}">Ouvrir dans le navigateur</button>
          </div>
        </div>
        ${L ? '<div class="zone-module zone-reseau" id="zone-reseau"><div class="chargement-module">Chargement de ' + esc(r.nom) + '…</div></div>'
          : `<div class="contenu-page"><div class="vide">Les pages en direct s’affichent dans le logiciel FMD (.exe). ${lien(r.url, 'Ouvrir ' + r.nom)}</div></div>`}
        <p class="discret reseaux-note">Instagram et LinkedIn demandent parfois de se connecter pour tout afficher : connectez-vous une fois ici,
        FMD s’en souvient sur ce PC (connexion séparée du reste du logiciel).</p>`;
    }
    function envoyerZone() {
      const z = conteneur.querySelector('#zone-reseau');
      if (!z || !L || detruit) return;
      const b = z.getBoundingClientRect();
      L.zoneModule({ x: b.left, y: b.top, width: b.width, height: b.height });
    }
    function brancherReseaux() {
      conteneur.querySelectorAll('[data-reseau]').forEach((b) => b.addEventListener('click', () => { reseau = b.dataset.reseau; dessiner(); }));
      const re = conteneur.querySelector('#r-retour'); if (re) re.addEventListener('click', () => L.retourModule && L.retourModule());
      const rc = conteneur.querySelector('#r-recharger'); if (rc) rc.addEventListener('click', () => L.rechargerModule());
      const z = conteneur.querySelector('#zone-reseau');
      if (z) {
        observateur = new ResizeObserver(envoyerZone); observateur.observe(z);
        window.addEventListener('resize', envoyerZone);
        envoyerZone();
      }
    }
    conteneur.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ouvrir-url]');
      if (b) { window.open(b.dataset.ouvrirUrl, '_blank'); return; }
      const a = e.target.closest('[data-aller]');
      if (a) { onglet = a.dataset.aller; dessiner(); }
    });

    dessiner();
    return {
      detruire() {
        detruit = true;
        if (observateur) observateur.disconnect();
        window.removeEventListener('resize', envoyerZone);
        if (L && onglet === 'reseaux') L.afficherModule(null);
      },
    };
  }

  window.FMDAPropos = { monter };
})();
