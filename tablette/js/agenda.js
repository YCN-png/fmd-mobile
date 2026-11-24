// FMD — module Agenda : un agenda personnel par utilisateur (table public.agenda, voir supabase/agenda.sql).
// Chacun voit et modifie SON agenda ; les administrateurs voient et modifient tous les agendas.
// 23 nov. 2026 (supabase/agenda-prive.sql) : chacun voit aussi les créneaux de ses collègues (lecture seule) ; un événement
// « Privé » apparaît aux autres « Occupé », sans titre, lieu ni notes (administrateurs compris).
// Ces règles sont appliquées par la base (RLS) : l'écran ne fait que proposer ce qui est autorisé.
// Utilisé par js/app.js : window.FMDAgenda.monter(conteneur, { sb, moi: { id, nom }, admin, notifier, esc }).
(function () {
  'use strict';

  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const COULEURS = [
    { id: 'rg', nom: 'Rose gold', c: '#C9987D' },
    { id: 'vert', nom: 'Vert', c: '#86c39f' },
    { id: 'bleu', nom: 'Bleu', c: '#7fa7d9' },
    { id: 'ambre', nom: 'Ambre', c: '#e0b45c' },
    { id: 'rouge', nom: 'Rouge', c: '#e8806d' },
  ];
  const couleur = (id) => (COULEURS.find((x) => x.id === id) || COULEURS[0]).c;
  const pad = (n) => String(n).padStart(2, '0');
  const jourISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const heure = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const debutJour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const ajouterJours = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const lundi = (d) => ajouterJours(debutJour(d), -((d.getDay() + 6) % 7));
  const memeJour = (a, b) => jourISO(a) === jourISO(b);
  const depuisChamps = (date, h) => {
    const [y, m, j] = date.split('-').map(Number);
    const [hh, mm] = (h || '00:00').split(':').map(Number);
    return new Date(y, m - 1, j, hh, mm);
  };
  const lire = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };
  const fmt = (d, o) => d.toLocaleDateString('fr-FR', o);

  function monter(conteneur, ctx) {
    const { sb, moi, admin, notifier, esc } = ctx;
    let vue = ['jour', 'semaine', 'mois'].includes(lire('fmd-agenda-vue')) ? lire('fmd-agenda-vue') : 'mois';
    let ref = new Date();
    let proprietaire = moi.id;   // ou l'id d'un autre utilisateur, ou 'tous' (administrateurs)
    let evenements = [];
    let taches = [];             // tâches datées de la période (module Tâches, js/taches.js)
    const T = ctx.taches && window.FMDTaches ? window.FMDTaches : null;
    const ctxT = { sb, moi, admin, notifier, esc };
    let utilisateurs = [];       // liste des comptes validés (choix « Agenda de »)
    // Événements privés + agendas des collègues (supabase/agenda-prive.sql, 23 nov. 2026) : actif quand la fonction
    // agenda_voir existe dans la base (null = pas encore vérifié). Sinon : ancien fonctionnement (son agenda ; admins : tous).
    let partage = null;
    const peutModifier = (e) => !e || (!e.masque && (e.proprietaire === moi.id || admin));
    let canal = null;
    let detruit = false;
    let attente = null;

    const nomDe = (id) => (id === moi.id ? moi.nom : ((utilisateurs.find((u) => u.id === id) || {}).nom || 'Utilisateur'));
    const initiales = (id) => nomDe(id).split(/\s+/).map((m) => m.charAt(0)).join('').slice(0, 2).toUpperCase();
    const tous = () => proprietaire === 'tous';

    function periode() {
      if (vue === 'jour') { const a = debutJour(ref); return [a, ajouterJours(a, 1)]; }
      if (vue === 'semaine') { const a = lundi(ref); return [a, ajouterJours(a, 7)]; }
      const a = lundi(new Date(ref.getFullYear(), ref.getMonth(), 1));
      return [a, ajouterJours(a, 42)];
    }
    const duJour = (d) => {
      const a = debutJour(d), b = ajouterJours(a, 1);
      return evenements.filter((e) => new Date(e.debut) < b && (new Date(e.fin) > a || new Date(e.debut) >= a))
        .sort((x, y) => (y.journee - x.journee) || (new Date(x.debut) - new Date(y.debut)));
    };

    // ---------- Squelette ----------
    conteneur.innerHTML = `
      <header class="entete agenda-entete">
        <div class="ag-titre">
          <h2 style="font-size:20px;margin:0">Agenda</h2>
          <label class="ag-qui" ${admin ? '' : 'hidden'}><span class="discret">Agenda de</span><select id="ag-qui"></select></label>
          <span class="discret ag-aide" ${admin ? 'hidden' : ''}>Votre agenda personnel : vous seul le voyez (et les administrateurs de FMD).</span>
        </div>
        <div class="ag-outils">
          <div class="ag-nav">
            <button type="button" class="btn btn-ligne petit" data-nav="-1" title="Précédent" aria-label="Précédent">‹</button>
            <button type="button" class="btn btn-ligne petit" data-nav="0">Aujourd’hui</button>
            <button type="button" class="btn btn-ligne petit" data-nav="1" title="Suivant" aria-label="Suivant">›</button>
            <strong id="ag-periode"></strong>
          </div>
          <div class="onglets ag-vues">
            <button type="button" data-vue="jour">Jour</button>
            <button type="button" data-vue="semaine">Semaine</button>
            <button type="button" data-vue="mois">Mois</button>
          </div>
          <button type="button" class="btn btn-metal" id="ag-nouveau">+ Nouvel événement</button>
          ${T ? '<button type="button" class="btn btn-ligne" id="ag-nouvelle-tache">+ Tâche</button>' : ''}
        </div>
      </header>
      <div class="agenda-corps">
        <section class="carte ag-calendrier" id="ag-grille"><div class="vide">Chargement…</div></section>
        <aside class="carte ag-avenir"><h2>À venir</h2><div id="ag-avenir"><div class="vide">Chargement…</div></div></aside>
      </div>`;
    const $ = (s) => conteneur.querySelector(s);

    conteneur.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.nav);
      if (n === 0) ref = new Date();
      else if (vue === 'jour') ref = ajouterJours(ref, n);
      else if (vue === 'semaine') ref = ajouterJours(ref, 7 * n);
      else ref = new Date(ref.getFullYear(), ref.getMonth() + n, 1);
      charger();
    }));
    conteneur.querySelectorAll('[data-vue]').forEach((b) => b.addEventListener('click', () => {
      vue = b.dataset.vue; ecrire('fmd-agenda-vue', vue); charger();
    }));
    $('#ag-nouveau').addEventListener('click', () => ouvrirFiche(null, new Date()));
    if (T) $('#ag-nouvelle-tache').addEventListener('click', () => T.ouvrirFiche(ctxT, null,
      { date: jourISO(vue === 'jour' ? ref : new Date()), pour: tous() ? moi.id : proprietaire }, charger));
    const tachesDuJour = (d) => taches.filter((t) => t.date_prevue === jourISO(d));
    let prevuesParJour = {};
    const prevuesDuJour = (d) => prevuesParJour[jourISO(d)] || [];
    const pucePrevue = (s) => `<button type="button" class="ag-puce ag-puce-tache prevue" data-prevue title="Tâche répétée : ${esc(T.resume(s))}">↻ ${esc(s.titre)}</button>`;
    const lignePrevue = (s) => `<div class="tache prevue" data-prevue title="${esc(T.resume(s))}"><span class="serie-ico">↻</span><span class="tache-texte"><span class="tache-titre">${esc(s.titre)}</span><span class="discret">prévue${s.heure ? ' · ' + s.heure.slice(0, 5) : ''}</span></span></div>`;
    const puceTache = (t) => `<button type="button" class="ag-puce ag-puce-tache ${t.fait ? 'faite' : ''}" data-tache-id="${esc(t.id)}" title="Tâche : ${esc(t.titre)}">
      <span class="mini-coche">${t.fait ? '✓' : ''}</span>${t.heure ? `<b>${t.heure.slice(0, 5)}</b> ` : ''}${esc(t.titre)}</button>`;

    // ---------- Données ----------
    async function charger() {
      dessinerEntete();
      const [a, b] = periode();
      const q = lireEvenements(a, b);
      let qt = null;
      if (T) {
        qt = sb.from('taches').select('*').gte('date_prevue', jourISO(a)).lt('date_prevue', jourISO(b));
        if (!tous()) qt = qt.eq('pour', proprietaire);
      }
      let qs = null;
      if (T) {
        qs = sb.from('taches_series').select('*').eq('actif', true);
        if (!tous()) qs = qs.eq('pour', proprietaire);
      }
      const [{ data, error }, rt, rs] = await Promise.all([q, qt || Promise.resolve({ data: [] }), qs || Promise.resolve({ data: [] })]);
      // Tâches répétées : jours à venir pas encore créés, affichés en « prévu »
      prevuesParJour = {};
      for (const s of (rs && rs.data) || []) {
        for (const j of T.prevues(s, a, b)) (prevuesParJour[j] = prevuesParJour[j] || []).push(s);
      }
      if (detruit) return;
      if (error) {
        $('#ag-grille').innerHTML = `<div class="vide">Agenda indisponible : ${esc(error.message)}</div>`;
        return;
      }
      evenements = data;
      taches = (rt && rt.data) || [];
      if (vue === 'mois') dessinerMois(); else if (vue === 'jour') dessinerJour(); else dessinerSemaine();
      chargerAVenir();
    }

    // Événements de la période : fonction agenda_voir (créneaux des collègues, privés masqués) ou table (ancien fonctionnement)
    async function lireEvenements(a, b, limite) {
      if (partage !== false) {
        const r = await sb.rpc('agenda_voir', { p_debut: a.toISOString(), p_fin: b.toISOString(), p_qui: tous() ? null : proprietaire });
        if (!r.error) { if (partage !== true) { partage = true; majEntete(); } return { data: limite ? (r.data || []).slice(0, limite) : r.data || [], error: null }; }
        if (partage === true) return r;
        partage = false; majEntete(); // fonction absente : SQL agenda-prive.sql pas encore exécuté
      }
      let q = sb.from('agenda').select('*').lt('debut', b.toISOString()).gte('fin', a.toISOString()).order('debut');
      if (!tous()) q = q.eq('proprietaire', proprietaire);
      if (limite) q = q.limit(limite);
      return q;
    }
    function majEntete() {
      const voirAutres = admin || partage === true;
      const l = $('.ag-qui'), aide = $('.ag-aide');
      if (l) l.hidden = !voirAutres;
      if (aide) { aide.hidden = admin; aide.textContent = partage ? 'Vos collègues voient vos créneaux ; un événement « Privé » leur apparaît « Occupé », sans son intitulé.' : 'Votre agenda personnel : vous seul le voyez (et les administrateurs de FMD).'; }
    }
    async function chargerAVenir() {
      const maintenant = new Date();
      const { data, error } = await lireEvenements(maintenant, new Date(maintenant.getTime() + 366 * 864e5), 8);
      if (detruit) return;
      const zone = $('#ag-avenir');
      if (error) { zone.innerHTML = `<div class="vide">${esc(error.message)}</div>`; return; }
      const auj = new Date(), demain = ajouterJours(auj, 1);
      zone.innerHTML = data.length ? data.map((e) => {
        const d = new Date(e.debut);
        const jour = memeJour(d, auj) ? 'Aujourd’hui' : memeJour(d, demain) ? 'Demain' : fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
        return `<button type="button" class="ag-ligne" data-id="${esc(e.id)}" style="--c:${couleur(e.couleur)}">
          <span class="ag-quand">${esc(jour)}${e.journee ? '' : ' · ' + heure(d)}</span>
          <span class="ag-quoi">${titreDe(e)}</span>
          ${e.lieu || tous() ? `<span class="discret">${tous() ? esc(nomDe(e.proprietaire)) : ''}${tous() && e.lieu ? ' · ' : ''}${esc(e.lieu || '')}</span>` : ''}
        </button>`;
      }).join('') : '<div class="vide">Rien de prévu.</div>';
      zone.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
        const e = data.find((x) => x.id === b.dataset.id); if (e) ouvrirFiche(e);
      }));
    }

    function dessinerEntete() {
      conteneur.querySelectorAll('[data-vue]').forEach((b) => b.classList.toggle('actif', b.dataset.vue === vue));
      // Semaine : toute la largeur pour les 7 colonnes (la colonne « À venir » est masquée).
      $('.agenda-corps').classList.toggle('pleine-largeur', vue === 'semaine');
      const [a] = periode();
      $('#ag-periode').textContent = vue === 'mois'
        ? fmt(ref, { month: 'long', year: 'numeric' })
        : vue === 'jour' ? fmt(ref, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(ajouterJours(a, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    // Titre affiché : cadenas pour un événement privé ; « Occupé » (sans intitulé) pour celui d'un collègue
    const titreDe = (e) => `${e.prive ? '<span class="ag-cadenas" title="Privé">🔒</span> ' : ''}${esc(e.titre)}`;
    const puce = (e) => `<button type="button" class="ag-puce ${e.journee ? 'journee' : ''}${e.masque ? ' masque' : ''}" data-id="${esc(e.id)}" style="--c:${e.masque ? '#8d8580' : couleur(e.couleur)}"
      title="${esc(e.masque ? `Occupé (${nomDe(e.proprietaire)})` : e.titre)}">${e.journee ? '' : `<b>${heure(new Date(e.debut))}</b> `}${titreDe(e)}${tous() ? ` <i>${esc(initiales(e.proprietaire))}</i>` : ''}</button>`;

    function brancherGrille(zone) {
      zone.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const e = evenements.find((x) => x.id === b.dataset.id); if (e) ouvrirFiche(e);
      }));
      zone.querySelectorAll('[data-plus]').forEach((b) => b.addEventListener('click', (ev) => {
        ev.stopPropagation(); ref = depuisChamps(b.dataset.plus); vue = 'jour'; ecrire('fmd-agenda-vue', vue); charger();
      }));
      // Semaine : clic sur l'en-tête d'un jour = ce jour heure par heure.
      zone.querySelectorAll('[data-voir-jour]').forEach((b) => b.addEventListener('click', (ev) => {
        ev.stopPropagation(); ref = depuisChamps(b.dataset.voirJour); vue = 'jour'; ecrire('fmd-agenda-vue', vue); charger();
      }));
      // Jour : clic sur une demi-heure libre = nouvel événement à cette heure.
      zone.querySelectorAll('[data-creneau]').forEach((c) => c.addEventListener('click', () => ouvrirFiche(null, depuisChamps(jourISO(ref), c.dataset.creneau))));
      zone.querySelectorAll('[data-jour]').forEach((c) => c.addEventListener('click', () => ouvrirFiche(null, depuisChamps(c.dataset.jour, '09:00'))));
      if (T) { // tâches : puce (Mois) = ouvrir ; ligne (Semaine / Jour) = cocher ou ouvrir
        zone.querySelectorAll('[data-tache-id]').forEach((b) => b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const t = taches.find((x) => x.id === b.dataset.tacheId); if (t) T.ouvrirFiche(ctxT, t, null, charger);
        }));
        T.brancherListe(zone, taches, ctxT, charger);
        zone.querySelectorAll('[data-prevue]').forEach((el) => el.addEventListener('click', (ev) => {
          ev.stopPropagation(); notifier('Tâche répétée : elle apparaîtra dans vos tâches la veille du jour prévu.');
        }));
        zone.querySelectorAll('.tache').forEach((el) => el.addEventListener('click', (ev) => ev.stopPropagation()));
      }
    }

    function dessinerMois() {
      const [a] = periode();
      const auj = new Date();
      let cases = '';
      for (let i = 0; i < 42; i++) {
        const d = ajouterJours(a, i);
        const elements = [...duJour(d).map(puce), ...(T ? tachesDuJour(d).map(puceTache) : []), ...(T ? prevuesDuJour(d).map(pucePrevue) : [])];
        cases += `<div class="ag-case ${d.getMonth() !== ref.getMonth() ? 'hors' : ''} ${memeJour(d, auj) ? 'aujourdhui' : ''}" data-jour="${jourISO(d)}" title="Ajouter un événement le ${fmt(d, { day: 'numeric', month: 'long' })}">
          <span class="ag-num">${d.getDate()}</span>
          ${elements.slice(0, 3).join('')}
          ${elements.length > 3 ? `<button type="button" class="ag-plus" data-plus="${jourISO(d)}">+ ${elements.length - 3} autre${elements.length > 4 ? 's' : ''}</button>` : ''}
        </div>`;
      }
      const zone = $('#ag-grille');
      zone.innerHTML = `<div class="ag-mois"><div class="ag-entetes">${JOURS.map((j) => `<div>${j}</div>`).join('')}</div><div class="ag-cases">${cases}</div></div>`;
      brancherGrille(zone);
    }

    function dessinerSemaine() {
      const [a] = periode();
      const auj = new Date();
      let cols = '';
      for (let i = 0; i < 7; i++) {
        const d = ajouterJours(a, i);
        const evs = duJour(d);
        cols += `<div class="ag-col ${memeJour(d, auj) ? 'aujourdhui' : ''}" data-jour="${jourISO(d)}" title="Ajouter un événement le ${fmt(d, { day: 'numeric', month: 'long' })}">
          <button type="button" class="ag-col-tete" data-voir-jour="${jourISO(d)}" title="Voir ce jour heure par heure"><span>${JOURS[i]}</span><strong>${d.getDate()}</strong></button>
          ${T && (tachesDuJour(d).length || prevuesDuJour(d).length) ? `<div class="ag-taches-jour">${tachesDuJour(d).map((t) => T.ligne(t, ctxT, { compact: true })).join('')}${prevuesDuJour(d).map(lignePrevue).join('')}</div>` : ''}
          ${evs.map((e) => {
            const db = new Date(e.debut), fn = new Date(e.fin);
            return `<button type="button" class="ag-carte${e.masque ? ' masque' : ''}" data-id="${esc(e.id)}" style="--c:${e.masque ? '#8d8580' : couleur(e.couleur)}">
              <span class="ag-heure">${e.journee ? 'Journée' : `${heure(db)} – ${memeJour(db, fn) ? heure(fn) : fmt(fn, { day: 'numeric', month: 'short' }) + ' ' + heure(fn)}`}</span>
              <span class="ag-quoi">${titreDe(e)}</span>
              ${e.lieu ? `<span class="discret">${esc(e.lieu)}</span>` : ''}
              ${tous() ? `<span class="discret">${esc(nomDe(e.proprietaire))}</span>` : ''}
            </button>`;
          }).join('') || (T && (tachesDuJour(d).length || prevuesDuJour(d).length) ? '' : '<span class="ag-vide-jour">—</span>')}
        </div>`;
      }
      const zone = $('#ag-grille');
      zone.innerHTML = `<div class="ag-semaine">${cols}</div>`;
      brancherGrille(zone);
    }

    // Jour : les 24 heures, événements placés à leur heure (côte à côte s'ils se chevauchent), ligne de l'heure actuelle.
    const PX_MIN = 1; // 60 px par heure
    function dessinerJour() {
      const a = debutJour(ref), b = ajouterJours(a, 1);
      const evs = duJour(a);
      const enJournee = (e) => e.journee || (new Date(e.debut) <= a && new Date(e.fin) >= b);
      const journee = evs.filter(enJournee);
      const items = evs.filter((e) => !enJournee(e)).map((e) => {
        const s = Math.max(0, (new Date(e.debut) - a) / 60000);
        const f = Math.min(1440, Math.max(s + 25, (new Date(e.fin) - a) / 60000));
        return { e, s, f };
      }).sort((x, y) => x.s - y.s || y.f - x.f);
      // Chevauchements : chaque groupe d'événements qui se touchent est réparti en colonnes.
      let groupe = [], finGroupe = -1;
      const placer = () => {
        const cols = [];
        for (const it of groupe) {
          let c = cols.findIndex((fin) => fin <= it.s);
          if (c < 0) { c = cols.length; cols.push(0); }
          cols[c] = it.f; it.col = c;
        }
        groupe.forEach((it) => { it.n = cols.length; });
      };
      for (const it of items) {
        if (groupe.length && it.s >= finGroupe) { placer(); groupe = []; finGroupe = -1; }
        groupe.push(it); finGroupe = Math.max(finGroupe, it.f);
      }
      if (groupe.length) placer();

      const maintenant = new Date();
      const minMaintenant = memeJour(maintenant, a) ? (maintenant - a) / 60000 : null;
      let creneaux = '', heures = '';
      for (let h = 0; h < 24; h++) {
        heures += `<div class="ag-h-lib" style="top:${h * 60 * PX_MIN}px">${pad(h)}:00</div>`;
        for (const m of [0, 30]) creneaux += `<button type="button" class="ag-creneau ${m ? 'demi' : ''}" data-creneau="${pad(h)}:${pad(m)}" style="top:${(h * 60 + m) * PX_MIN}px" title="Ajouter un événement à ${pad(h)}:${pad(m)}" aria-label="Ajouter à ${pad(h)}:${pad(m)}"></button>`;
      }
      const zone = $('#ag-grille');
      zone.innerHTML = `
        <div class="ag-jour">
          ${journee.length ? `<div class="ag-jour-journee"><span class="discret">Journée</span>${journee.map(puce).join('')}</div>` : ''}
          ${T && (tachesDuJour(a).length || prevuesDuJour(a).length) ? `<div class="ag-jour-taches"><div class="groupe-titre">Tâches du jour</div>${tachesDuJour(a)
            .sort((x, y) => String(x.heure || '99').localeCompare(String(y.heure || '99'))).map((t) => T.ligne(t, ctxT, { compact: true })).join('')}${prevuesDuJour(a).map(lignePrevue).join('')}</div>` : ''}
          <div class="ag-jour-defile">
            <div class="ag-jour-grille" style="height:${1440 * PX_MIN}px">
              ${heures}
              <div class="ag-jour-zone">
                ${creneaux}
                ${items.map(({ e, s, f, col, n }) => `
                  <button type="button" class="ag-bloc ${f - s < 50 ? 'court' : ''}${e.masque ? ' masque' : ''}" data-id="${esc(e.id)}" style="--c:${e.masque ? '#8d8580' : couleur(e.couleur)};top:${s * PX_MIN}px;height:${(f - s) * PX_MIN - 2}px;left:calc(${(col / n) * 100}% + 2px);width:calc(${100 / n}% - 4px)">
                    <span class="ag-heure">${heure(new Date(e.debut))} – ${heure(new Date(e.fin))}</span>
                    <span class="ag-quoi">${titreDe(e)}</span>
                    ${e.lieu ? `<span class="discret">${esc(e.lieu)}</span>` : ''}
                    ${tous() ? `<span class="discret">${esc(nomDe(e.proprietaire))}</span>` : ''}
                  </button>`).join('')}
                ${minMaintenant !== null ? `<div class="ag-maintenant" style="top:${minMaintenant * PX_MIN}px" title="Maintenant"></div>` : ''}
              </div>
            </div>
          </div>
        </div>`;
      brancherGrille(zone);
      // Ouverture vers 7 h (ou une heure avant maintenant, aujourd'hui)
      const defile = zone.querySelector('.ag-jour-defile');
      const debutVue = minMaintenant !== null ? Math.max(0, minMaintenant - 60) : Math.min(7 * 60, items.length ? items[0].s : 7 * 60);
      defile.scrollTop = debutVue * PX_MIN;
    }

    // ---------- Fiche d'un événement (création / modification / suppression) ----------
    function ouvrirFiche(e, jour) {
      const f = document.getElementById('fenetre');
      if (!f) return;
      if (e && !peutModifier(e)) return ouvrirLecture(e, f);
      const nouveau = !e;
      const db = e ? new Date(e.debut) : jour;
      const fn = e ? new Date(e.fin) : new Date(jour.getTime() + 60 * 60 * 1000);
      const journee = e ? e.journee : false;
      const pour = e ? e.proprietaire : (tous() ? moi.id : proprietaire);
      const optionsQui = admin ? [{ id: moi.id, nom: moi.nom + ' (moi)' }, ...utilisateurs.filter((u) => u.id !== moi.id)] : [];
      f.innerHTML = `<div class="boite boite-fiche">
        <h2 id="fenetre-titre">${nouveau ? 'Nouvel événement' : 'Modifier l’événement'}</h2>
        <p class="discret" style="margin:4px 0 18px">${admin ? 'Agenda de' : 'Dans votre agenda personnel.'}</p>
        <form class="ag-form" novalidate>
          ${admin ? `<div class="champ"><select name="proprietaire" aria-label="Agenda de">${optionsQui.map((u) => `<option value="${esc(u.id)}" ${u.id === pour ? 'selected' : ''}>${esc(u.nom)}</option>`).join('')}</select></div>` : ''}
          <div class="champ"><label>Titre</label><input name="titre" maxlength="200" value="${esc(e ? e.titre : '')}" placeholder="ex. Rendez-vous client, livraison, réunion…" autocomplete="off"></div>
          <label class="case"><input type="checkbox" name="journee" ${journee ? 'checked' : ''}><span>Toute la journée</span></label>
          <div class="ag-dates">
            <div class="champ"><label>Début</label><input type="date" name="date_debut" value="${jourISO(db)}"></div>
            <div class="champ ag-h"><label>Heure</label><input type="time" name="heure_debut" value="${heure(db)}"></div>
            <div class="champ"><label>Fin</label><input type="date" name="date_fin" value="${jourISO(fn)}"></div>
            <div class="champ ag-h"><label>Heure</label><input type="time" name="heure_fin" value="${heure(fn)}"></div>
          </div>
          <div class="champ"><label>Lieu</label><input name="lieu" maxlength="300" value="${esc(e ? e.lieu || '' : '')}" placeholder="ex. FMD, 3 quai Félix Faure" autocomplete="off"></div>
          <div class="champ"><label>Notes</label><textarea name="description" maxlength="5000" rows="3">${esc(e ? e.description || '' : '')}</textarea></div>
          ${partage ? `<label class="case ag-prive"><input type="checkbox" name="prive" ${e && e.prive ? 'checked' : ''}><span>🔒 Privé : les collègues voient le créneau « Occupé », pas l’intitulé</span></label>` : ''}
          <div class="champ"><label>Couleur</label><div class="ag-couleurs">${COULEURS.map((c) => `
            <label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${(e ? e.couleur : 'rg') === c.id ? 'checked' : ''}><i style="--c:${c.c}"></i></label>`).join('')}</div></div>
          <div class="message erreur" hidden></div>
          <div class="actions-maj">
            <button class="btn btn-metal" type="submit">Enregistrer</button>
            <button class="btn btn-ligne" type="button" data-fermer>Annuler</button>
            ${nouveau ? '' : '<button class="btn btn-ligne btn-danger" type="button" data-supprimer>Supprimer</button>'}
          </div>
        </form></div>`;
      f.hidden = false;
      const form = f.querySelector('form');
      const fermer = () => { f.hidden = true; f.innerHTML = ''; document.removeEventListener('keydown', echap); };
      const echap = (ev) => { if (ev.key === 'Escape') fermer(); };
      document.addEventListener('keydown', echap);
      f.onclick = (ev) => { if (ev.target === f) fermer(); };
      f.querySelector('[data-fermer]').addEventListener('click', fermer);
      const majHeures = () => {
        form.querySelectorAll('.ag-h').forEach((h) => { h.hidden = form.elements.journee.checked; });
        form.querySelector('.ag-dates').classList.toggle('sans-heures', form.elements.journee.checked);
      };
      form.elements.journee.addEventListener('change', majHeures);
      majHeures();
      form.elements.date_debut.addEventListener('change', () => { // la fin suit le début
        if (form.elements.date_fin.value < form.elements.date_debut.value) form.elements.date_fin.value = form.elements.date_debut.value;
      });
      const dire = (t) => { const m = form.querySelector('.message'); m.textContent = t; m.hidden = !t; };

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const el = form.elements;
        const titre = el.titre.value.trim();
        if (!titre) return dire('Donnez un titre à l’événement.');
        if (!el.date_debut.value || !el.date_fin.value) return dire('Indiquez les dates de début et de fin.');
        const j = el.journee.checked;
        const debut = j ? depuisChamps(el.date_debut.value, '00:00') : depuisChamps(el.date_debut.value, el.heure_debut.value || '09:00');
        const fin = j ? new Date(depuisChamps(el.date_fin.value, '23:59').getTime() + 59999) : depuisChamps(el.date_fin.value, el.heure_fin.value || '10:00');
        if (fin < debut) return dire('La fin doit être après le début.');
        const ligne = { titre, journee: j, debut: debut.toISOString(), fin: fin.toISOString(),
          lieu: el.lieu.value.trim() || null, description: el.description.value.trim() || null,
          couleur: (form.querySelector('input[name=couleur]:checked') || {}).value || 'rg',
          proprietaire: admin ? el.proprietaire.value : moi.id };
        if (partage && el.prive) ligne.prive = el.prive.checked;
        dire('');
        const bouton = form.querySelector('button[type=submit]');
        bouton.disabled = true; bouton.textContent = 'Enregistrement…';
        const r = nouveau ? await sb.from('agenda').insert(ligne).select().maybeSingle()
          : await sb.from('agenda').update(ligne).eq('id', e.id).select().maybeSingle();
        bouton.disabled = false; bouton.textContent = 'Enregistrer';
        if (r.error || !r.data) return dire(r.error ? r.error.message : 'Enregistrement refusé : vous n’avez pas accès à cet agenda.');
        fermer();
        notifier(nouveau ? 'Événement ajouté à l’agenda.' : 'Événement modifié.');
        ref = debut;
        charger();
      });

      const suppr = f.querySelector('[data-supprimer]');
      if (suppr) suppr.addEventListener('click', async () => {
        if (!window.confirm(`Supprimer « ${e.titre} » de l’agenda ?`)) return;
        const { error } = await sb.from('agenda').delete().eq('id', e.id);
        if (error) return dire(error.message);
        fermer();
        notifier('Événement supprimé.');
        charger();
      });
      form.elements.titre.focus();
    }

    // Événement d'un collègue (pas modifiable) : créneau seul s'il est privé, sinon le détail en lecture
    function ouvrirLecture(e, f) {
      const d = new Date(e.debut), fn = new Date(e.fin);
      const quand = e.journee ? (memeJour(d, fn) ? fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) : `du ${fmt(d, { day: 'numeric', month: 'long' })} au ${fmt(fn, { day: 'numeric', month: 'long' })}`) + ' · toute la journée'
        : `${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })} · ${heure(d)} – ${heure(fn)}`;
      f.innerHTML = `<div class="boite boite-fiche">
        <h2 id="fenetre-titre">${e.masque ? '🔒 Occupé' : esc(e.titre)}</h2>
        <p class="discret" style="margin:4px 0 14px">Agenda de ${esc(nomDe(e.proprietaire))}</p>
        <p><b>${esc(quand)}</b></p>
        ${e.masque ? '<p class="discret">Événement privé : seul son propriétaire en voit l’intitulé.</p>' : `${e.lieu ? `<p>⌂ ${esc(e.lieu)}</p>` : ''}${e.description ? `<p class="discret" style="white-space:pre-wrap">${esc(e.description)}</p>` : ''}`}
        <div class="actions-maj"><button class="btn btn-ligne" type="button" data-fermer>Fermer</button></div></div>`;
      f.hidden = false;
      const fermer = () => { f.hidden = true; f.innerHTML = ''; document.removeEventListener('keydown', echap); };
      const echap = (ev) => { if (ev.key === 'Escape') fermer(); };
      document.addEventListener('keydown', echap);
      f.onclick = (ev) => { if (ev.target === f) fermer(); };
      f.querySelector('[data-fermer]').addEventListener('click', fermer);
    }

    // ---------- Choix de l'agenda affiché (administrateurs ; tout le monde quand agenda-prive.sql est exécuté) ----------
    async function chargerUtilisateurs() {
      const { data } = await sb.from('profils').select('id, nom, prenom, nom_famille, email, statut, actif').eq('statut', 'valide');
      if (detruit) return;
      utilisateurs = (data || []).map((p) => ({ id: p.id, nom: p.nom || `${p.prenom || ''} ${p.nom_famille || ''}`.trim() || p.email }))
        .sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
      const sel = $('#ag-qui');
      sel.innerHTML = `<option value="${esc(moi.id)}">Moi (${esc(moi.nom)})</option>
        ${utilisateurs.filter((u) => u.id !== moi.id).map((u) => `<option value="${esc(u.id)}">${esc(u.nom)}</option>`).join('')}
        <option value="tous">Tous les agendas</option>`;
      sel.value = proprietaire;
      sel.addEventListener('change', () => { proprietaire = sel.value; charger(); });
      majEntete();
    }

    // ---------- Direct : modifications faites ailleurs (autre PC, administrateur) ----------
    const relire = () => { clearTimeout(attente); attente = setTimeout(() => { if (!detruit) charger(); }, 300); };
    canal = sb.channel('agenda-direct')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda' }, relire);
    if (T) canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: 'taches' }, relire);
    canal = canal.subscribe();
    if (T) { T.utilisateurs(sb); T.generer(sb).then((n) => { if (n && !detruit) charger(); }); } // noms des collègues ; tâches répétées du jour

    chargerUtilisateurs().then(() => { if (!detruit) charger(); });

    return {
      detruire() {
        detruit = true;
        clearTimeout(attente);
        if (canal) sb.removeChannel(canal);
        const f = document.getElementById('fenetre');
        if (f && f.querySelector('.ag-form')) { f.hidden = true; f.innerHTML = ''; }
      },
    };
  }

  window.FMDAgenda = { monter };
})();
