// FMD — Tâches : to-do personnelle + tâches confiées à un collègue (table public.taches, voir supabase/taches.sql).
// Une seule liste, visible à trois endroits : ce module (rangé par date), l'Agenda (au bon jour) et « Mon espace ».
// Règles appliquées par la base : on voit ses tâches et celles qu'on a confiées ; les administrateurs voient tout.
// API : window.FMDTaches = { monter, ouvrirFiche, basculer, utilisateurs, rendreListe, brancherListe, groupes, jourISO }.
(function () {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  const jourISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const depuisISO = (s) => { const [y, m, j] = s.split('-').map(Number); return new Date(y, m - 1, j); };
  const ajouterJours = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const libelleDate = (s) => {
    const auj = jourISO(new Date()), demain = jourISO(ajouterJours(new Date(), 1)), hier = jourISO(ajouterJours(new Date(), -1));
    if (s === auj) return 'Aujourd’hui';
    if (s === demain) return 'Demain';
    if (s === hier) return 'Hier';
    return depuisISO(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const heureCourte = (h) => (h ? h.slice(0, 5) : '');

  // ---------- Tâches répétées (table taches_series, voir supabase/taches-recurrentes.sql) ----------
  const JOURS_COURTS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  const isoJour = (d) => ((d.getDay() + 6) % 7) + 1; // 1 = lundi … 7 = dimanche
  const dernierJourMois = (y, m) => new Date(y, m + 1, 0).getDate();
  const ecart = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
  // Même règle que public.serie_tombe_le (base de données).
  function tombeLe(s, d) {
    const debut = depuisISO(s.debut);
    if (d < debut) return false;
    const n = s.intervalle || 1;
    if (s.frequence === 'jour') return ecart(debut, d) % n === 0;
    if (s.frequence === 'semaine') {
      const jours = s.jours && s.jours.length ? s.jours : [isoJour(debut)];
      const lundiDebut = ajouterJours(debut, -(isoJour(debut) - 1));
      return jours.includes(isoJour(d)) && Math.floor(ecart(lundiDebut, d) / 7) % n === 0;
    }
    const jourVise = Math.min(debut.getDate(), dernierJourMois(d.getFullYear(), d.getMonth()));
    if (s.frequence === 'mois') return d.getDate() === jourVise && ((d.getFullYear() * 12 + d.getMonth()) - (debut.getFullYear() * 12 + debut.getMonth())) % n === 0;
    if (s.frequence === 'annee') return d.getMonth() === debut.getMonth() && d.getDate() === jourVise && (d.getFullYear() - debut.getFullYear()) % n === 0;
    return false;
  }
  // « Tous les 2 jours », « Du lundi au vendredi », « Toutes les semaines le lun, jeu », « Tous les mois le 15 »…
  function resume(s) {
    const n = s.intervalle || 1;
    const debut = depuisISO(s.debut);
    let t;
    if (s.frequence === 'jour') t = n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
    else if (s.frequence === 'semaine') {
      const jours = (s.jours && s.jours.length ? s.jours : [isoJour(debut)]).slice().sort();
      t = n === 1 && jours.join() === '1,2,3,4,5' ? 'Du lundi au vendredi'
        : `${n === 1 ? 'Toutes les semaines' : `Toutes les ${n} semaines`} le ${jours.map((j) => JOURS_COURTS[j]).join(', ')}`;
    } else if (s.frequence === 'mois') t = `${n === 1 ? 'Tous les mois' : `Tous les ${n} mois`} le ${debut.getDate()}`;
    else t = `${n === 1 ? 'Tous les ans' : `Tous les ${n} ans`} le ${debut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    if (s.heure) t += ` à ${heureCourte(s.heure)}`;
    t += `, à partir du ${debut.toLocaleDateString('fr-FR')}`;
    if (s.fin_date) t += `, jusqu’au ${depuisISO(s.fin_date).toLocaleDateString('fr-FR')}`;
    else if (s.fin_nombre) t += `, ${s.fin_nombre} fois`;
    return t + '.';
  }
  // Jours prévus (pas encore créés) d'une série entre deux dates, pour l'agenda.
  function prevues(s, de, a) {
    const res = [];
    const auj = depuisISO(jourISO(new Date()));
    let d = s.genere_jusqua ? ajouterJours(depuisISO(s.genere_jusqua), 1) : (depuisISO(s.debut) > auj ? depuisISO(s.debut) : auj);
    let k = s.nb_generees || 0;
    const fin = s.fin_date ? depuisISO(s.fin_date) : null;
    for (let i = 0; i < 4000 && d < a; i++, d = ajouterJours(d, 1)) {
      if ((fin && d > fin) || (s.fin_nombre && k >= s.fin_nombre)) break;
      if (tombeLe(s, d)) { k++; if (d >= de) res.push(jourISO(d)); }
    }
    return res;
  }
  // Crée les tâches répétées du jour (et de demain) : appelée à l'ouverture de Mon espace, Tâches, Agenda.
  let derniereGeneration = 0;
  async function generer(sb) {
    if (Date.now() - derniereGeneration < 60 * 1000) return 0;
    derniereGeneration = Date.now();
    const { data, error } = await sb.rpc('generer_taches_recurrentes');
    return error ? 0 : data || 0;
  }

  // Comptes validés (pour « confier à » et afficher les noms). Mis en cache quelques minutes.
  let cacheUtilisateurs = null, cacheQuand = 0;
  async function utilisateurs(sb) {
    if (cacheUtilisateurs && Date.now() - cacheQuand < 5 * 60 * 1000) return cacheUtilisateurs;
    const { data } = await sb.from('profils').select('id, nom, prenom, nom_famille, email, statut, actif').eq('statut', 'valide');
    cacheUtilisateurs = (data || []).filter((p) => p.actif !== false)
      .map((p) => ({ id: p.id, nom: p.nom || `${p.prenom || ''} ${p.nom_famille || ''}`.trim() || p.email }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    cacheQuand = Date.now();
    return cacheUtilisateurs;
  }
  const nomDe = (id, ctx) => (id === ctx.moi.id ? 'moi' : ((cacheUtilisateurs || []).find((u) => u.id === id) || {}).nom || 'un collègue');

  // Rangement par date : En retard, Aujourd'hui, Demain, puis chaque jour, Sans date ; Terminées à part.
  function groupes(taches) {
    const auj = jourISO(new Date());
    const ouvertes = taches.filter((t) => !t.fait);
    const tri = (a, b) => (a.priorite === 'urgente' ? -1 : 0) - (b.priorite === 'urgente' ? -1 : 0)
      || String(a.heure || '99').localeCompare(String(b.heure || '99')) || String(a.created_at).localeCompare(String(b.created_at));
    const res = [];
    const retard = ouvertes.filter((t) => t.date_prevue && t.date_prevue < auj).sort((a, b) => a.date_prevue.localeCompare(b.date_prevue) || tri(a, b));
    if (retard.length) res.push({ cle: 'retard', titre: 'En retard', taches: retard, retard: true });
    const dates = [...new Set(ouvertes.filter((t) => t.date_prevue && t.date_prevue >= auj).map((t) => t.date_prevue))].sort();
    if (!dates.includes(auj)) dates.unshift(auj); // « Aujourd'hui » toujours affiché
    for (const d of dates) res.push({ cle: d, titre: libelleDate(d), taches: ouvertes.filter((t) => t.date_prevue === d).sort(tri) });
    const sans = ouvertes.filter((t) => !t.date_prevue).sort(tri);
    if (sans.length) res.push({ cle: 'sans', titre: 'Sans date', taches: sans });
    const faites = taches.filter((t) => t.fait).sort((a, b) => String(b.fait_le).localeCompare(String(a.fait_le)));
    if (faites.length) res.push({ cle: 'faites', titre: `Terminées (${faites.length})`, taches: faites, faites: true });
    return res;
  }

  // Une ligne de tâche (case à cocher + titre + infos).
  function ligne(t, ctx, opts = {}) {
    const { esc, moi } = ctx;
    const infos = [];
    if (t.serie) infos.push('↻');
    if (t.heure) infos.push(heureCourte(t.heure));
    if (opts.avecDate && t.date_prevue) infos.push(libelleDate(t.date_prevue));
    if (t.de && t.de !== t.pour && t.pour === moi.id) infos.push(`de ${esc(nomDe(t.de, ctx))}`);
    if (t.pour !== moi.id) infos.push(`pour ${esc(nomDe(t.pour, ctx))}`);
    return `<div class="tache ${t.fait ? 'faite' : ''} ${t.priorite === 'urgente' ? 'urgente' : ''}" data-tache="${esc(t.id)}">
      <label class="coche" title="${t.fait ? 'Marquer « à faire »' : 'Marquer « fait »'}"><input type="checkbox" data-cocher ${t.fait ? 'checked' : ''} aria-label="Fait"><i></i></label>
      <button type="button" class="tache-texte" data-ouvrir>
        <span class="tache-titre">${t.priorite === 'urgente' ? '<span class="pastille pastille-urgent">Urgent</span> ' : ''}${esc(t.titre)}</span>
        ${infos.length ? `<span class="discret">${infos.join(' · ')}</span>` : ''}
        ${t.details && !opts.compact ? `<span class="tache-details">${esc(t.details.split('\n')[0].slice(0, 140))}</span>` : ''}
      </button>
    </div>`;
  }

  function rendreListe(taches, ctx, opts = {}) {
    const g = groupes(taches).filter((x) => !(opts.sansFaites && x.faites)).filter((x) => !opts.limiteJours || x.retard || x.cle <= opts.limiteJours);
    return g.map((x) => `
      <div class="groupe-taches ${x.retard ? 'retard' : ''} ${x.faites ? 'faites' : ''}">
        <div class="groupe-titre">${x.titre}${x.faites ? '' : ` <span class="discret">${x.taches.length || ''}</span>`}</div>
        ${x.taches.length ? x.taches.map((t) => ligne(t, ctx, { avecDate: x.retard || x.faites, compact: opts.compact })).join('')
          : '<div class="discret groupe-vide">Rien de prévu.</div>'}
      </div>`).join('');
  }

  function brancherListe(zone, taches, ctx, apres) {
    zone.querySelectorAll('[data-tache]').forEach((el) => {
      const t = taches.find((x) => x.id === el.dataset.tache);
      if (!t) return;
      el.querySelector('[data-cocher]').addEventListener('change', (e) => basculer(ctx, t, e.target.checked).then(apres));
      el.querySelector('[data-ouvrir]').addEventListener('click', () => ouvrirFiche(ctx, t, null, apres));
    });
  }

  async function basculer(ctx, t, fait) {
    const { data, error } = await ctx.sb.from('taches').update({ fait }).eq('id', t.id).select().maybeSingle();
    if (error || !data) { ctx.notifier(error ? error.message : 'Modification refusée.'); return false; }
    Object.assign(t, data);
    if (fait) ctx.notifier(t.de && t.de !== ctx.moi.id ? `Bravo ! ${nomDe(t.de, ctx)} est prévenu(e).` : 'Tâche terminée.');
    return true;
  }

  // Fiche d'une tâche : création (pour soi et / ou plusieurs collègues) ou modification.
  async function ouvrirFiche(ctx, t, defauts, apres) {
    const { sb, moi, admin, notifier, esc } = ctx;
    const f = document.getElementById('fenetre');
    if (!f) return;
    const users = await utilisateurs(sb);
    const nouveau = !t;
    const createur = nouveau || t.de === moi.id || admin;
    const d = defauts || {};
    const v = t || { titre: '', details: '', date_prevue: d.date === undefined ? jourISO(new Date()) : d.date, heure: d.heure || null, priorite: 'normale', pour: d.pour || moi.id };
    const autres = users.filter((u) => u.id !== moi.id);
    f.innerHTML = `<div class="boite boite-fiche">
      <h2 id="fenetre-titre">${nouveau ? 'Nouvelle tâche' : createur ? 'Modifier la tâche' : 'Tâche'}</h2>
      <p class="discret" style="margin:4px 0 18px">${nouveau ? 'Pour vous, ou à confier à un ou plusieurs collègues.'
        : t.de && t.de !== t.pour ? `Confiée par ${esc(nomDe(t.de, ctx))} à ${esc(nomDe(t.pour, ctx))}.` : 'Tâche personnelle.'}</p>
      <form class="tache-form" novalidate>
        <div class="champ"><label>Tâche</label><input name="titre" maxlength="300" value="${esc(v.titre)}" placeholder="ex. Appeler Bricomarché pour le devis" autocomplete="off" ${createur ? '' : 'disabled'}></div>
        <div class="champ"><label>Détails</label><textarea name="details" rows="3" maxlength="5000" ${createur ? '' : 'disabled'}>${esc(v.details || '')}</textarea></div>
        <div class="tache-quand">
          <div class="champ"><label>Date</label><input type="date" name="date_prevue" value="${esc(v.date_prevue || '')}"></div>
          <div class="champ"><label>Heure (facultatif)</label><input type="time" name="heure" value="${esc(heureCourte(v.heure))}"></div>
          <div class="champ"><label>Priorité</label><select name="priorite" ${createur ? '' : 'disabled'}>
            <option value="normale" ${v.priorite !== 'urgente' ? 'selected' : ''}>Normale</option>
            <option value="urgente" ${v.priorite === 'urgente' ? 'selected' : ''}>Urgente</option></select></div>
        </div>
        ${nouveau ? `
        <div class="champ"><label>Répéter</label><select name="repeter">
          <option value="">Ne pas répéter</option>
          <option value="jour">Tous les jours</option>
          <option value="ouvres">Du lundi au vendredi</option>
          <option value="semaine">Toutes les semaines…</option>
          <option value="mois">Tous les mois</option>
          <option value="annee">Tous les ans</option>
        </select></div>
        <div class="repetition" hidden>
          <div class="rep-ligne" data-bloc-intervalle><span>Tous les</span><input type="number" name="intervalle" min="1" max="365" value="1"><span data-unite>jours</span></div>
          <div class="rep-jours" data-bloc-jours hidden>${[1, 2, 3, 4, 5, 6, 7].map((j) => `<label title="${['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][j]}"><input type="checkbox" name="jours" value="${j}"><span>${'LMMJVSD'[j - 1]}</span></label>`).join('')}</div>
          <div class="rep-fin">
            <span class="discret">Fin :</span>
            <label class="case"><input type="radio" name="fin" value="jamais" checked><span>Jamais</span></label>
            <label class="case"><input type="radio" name="fin" value="date"><span>Le</span><input type="date" name="fin_date"></label>
            <label class="case"><input type="radio" name="fin" value="nombre"><span>Après</span><input type="number" name="fin_nombre" min="1" max="1000" value="10"><span>fois</span></label>
          </div>
          <p class="rep-resume" data-resume></p>
        </div>` : t.serie ? '<div class="rep-serie" data-serie><span class="discret">Tâche répétée…</span></div>' : ''}
        ${nouveau ? `<div class="champ"><label>Pour</label><div class="destinataires">
            <label class="case"><input type="checkbox" name="pour" value="${esc(moi.id)}" ${v.pour === moi.id ? 'checked' : ''}><span>Moi</span></label>
            ${autres.map((u) => `<label class="case"><input type="checkbox" name="pour" value="${esc(u.id)}" ${v.pour === u.id ? 'checked' : ''}><span>${esc(u.nom)}</span></label>`).join('')}
          </div><span class="discret">Plusieurs personnes cochées = une tâche pour chacune (chacun coche la sienne).</span></div>`
        : createur ? `<div class="champ"><label>Pour</label><select name="pour">${users.map((u) => `<option value="${esc(u.id)}" ${u.id === v.pour ? 'selected' : ''}>${esc(u.id === moi.id ? u.nom + ' (moi)' : u.nom)}</option>`).join('')}</select></div>` : ''}
        ${!nouveau ? `<label class="case"><input type="checkbox" name="fait" ${t.fait ? 'checked' : ''}><span>Tâche terminée</span></label>` : ''}
        <div class="message erreur" hidden></div>
        <div class="actions-maj">
          <button class="btn btn-metal" type="submit">${nouveau ? 'Créer' : 'Enregistrer'}</button>
          <button class="btn btn-ligne" type="button" data-fermer>Annuler</button>
          ${!nouveau && (t.de === moi.id || admin) ? '<button class="btn btn-ligne btn-danger" type="button" data-supprimer>Supprimer</button>' : ''}
        </div>
      </form></div>`;
    f.hidden = false;
    const form = f.querySelector('form');
    const fermer = () => { f.hidden = true; f.innerHTML = ''; document.removeEventListener('keydown', echap); };
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', echap);
    f.onclick = (e) => { if (e.target === f) fermer(); };
    f.querySelector('[data-fermer]').addEventListener('click', fermer);
    const dire = (txt) => { const m = form.querySelector('.message'); m.textContent = txt; m.hidden = !txt; };

    // Répétition : lecture du formulaire → règle (même forme que la table taches_series)
    const lireRegle = () => {
      const el = form.elements;
      const choix = el.repeter ? el.repeter.value : '';
      if (!choix) return null;
      const debut = el.date_prevue.value || jourISO(new Date());
      const r = { frequence: choix === 'ouvres' ? 'semaine' : choix, intervalle: choix === 'ouvres' ? 1 : Math.max(1, Math.min(365, Number(el.intervalle.value) || 1)),
        jours: null, debut, heure: el.heure.value || null, fin_date: null, fin_nombre: null };
      if (choix === 'ouvres') r.jours = [1, 2, 3, 4, 5];
      if (choix === 'semaine') {
        r.jours = [...form.querySelectorAll('input[name=jours]:checked')].map((c) => Number(c.value));
        if (!r.jours.length) r.jours = [isoJour(depuisISO(debut))];
      }
      const fin = (form.querySelector('input[name=fin]:checked') || {}).value;
      if (fin === 'date' && el.fin_date.value) r.fin_date = el.fin_date.value;
      if (fin === 'nombre') r.fin_nombre = Math.max(1, Math.min(1000, Number(el.fin_nombre.value) || 1));
      return r;
    };
    if (form.elements.repeter) {
      const bloc = form.querySelector('.repetition');
      const maj = () => {
        const choix = form.elements.repeter.value;
        bloc.hidden = !choix;
        form.querySelector('.tache-quand label').textContent = choix ? 'À partir du' : 'Date';
        bloc.querySelector('[data-bloc-intervalle]').hidden = !choix || choix === 'ouvres';
        bloc.querySelector('[data-unite]').textContent = { jour: 'jour(s)', semaine: 'semaine(s)', mois: 'mois', annee: 'an(s)' }[choix] || '';
        bloc.querySelector('[data-bloc-jours]').hidden = choix !== 'semaine';
        if (choix === 'semaine' && !form.querySelector('input[name=jours]:checked')) {
          const j = isoJour(depuisISO(form.elements.date_prevue.value || jourISO(new Date())));
          form.querySelector(`input[name=jours][value="${j}"]`).checked = true;
        }
        const r = lireRegle();
        bloc.querySelector('[data-resume]').textContent = r ? '↻ ' + resume(r) : '';
      };
      form.addEventListener('input', maj);
      form.addEventListener('change', maj);
      maj();
    }
    // Tâche d'une série : résumé + « Arrêter la répétition » (créateur ou administrateur)
    const zoneSerie = form.querySelector('[data-serie]');
    if (zoneSerie) {
      sb.from('taches_series').select('*').eq('id', t.serie).maybeSingle().then(({ data: s }) => {
        if (!s) { zoneSerie.innerHTML = '<span class="discret">↻ Tâche répétée (série supprimée).</span>'; return; }
        const peut = s.de === moi.id || admin;
        zoneSerie.innerHTML = `<span>↻ ${esc(resume(s))}${s.actif ? '' : ' <b>Répétition arrêtée.</b>'}</span>
          ${s.actif && peut ? '<button type="button" class="btn btn-ligne petit" data-arreter>Arrêter la répétition</button>' : ''}`;
        const b = zoneSerie.querySelector('[data-arreter]');
        if (b) b.addEventListener('click', async () => {
          if (!window.confirm('Arrêter la répétition ? Les tâches déjà créées restent ; aucune nouvelle ne sera créée.')) return;
          const r = await sb.from('taches_series').update({ actif: false }).eq('id', s.id).select().maybeSingle();
          if (r.error || !r.data) return dire(r.error ? r.error.message : 'Modification refusée.');
          notifier('Répétition arrêtée.'); fermer(); if (apres) apres();
        });
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const el = form.elements;
      const base = { date_prevue: el.date_prevue.value || null, heure: el.heure.value || null };
      if (createur) {
        Object.assign(base, { titre: el.titre.value.trim(), details: el.details.value.trim() || null, priorite: el.priorite.value });
        if (!base.titre) return dire('Écrivez la tâche.');
      }
      const bouton = form.querySelector('button[type=submit]');
      bouton.disabled = true;
      let r;
      if (nouveau) {
        const pour = [...form.querySelectorAll('input[name=pour]:checked')].map((c) => c.value);
        if (!pour.length) { bouton.disabled = false; return dire('Choisissez au moins une personne (ou « Moi »).'); }
        const regle = lireRegle();
        if (regle) { // tâche répétée : une série par personne, puis création des tâches d'aujourd'hui / demain
          if (regle.fin_date && regle.fin_date < regle.debut) { bouton.disabled = false; return dire('La date de fin est avant le début.'); }
          r = await sb.from('taches_series').insert(pour.map((p) => ({ titre: base.titre, details: base.details, priorite: base.priorite, ...regle, pour: p, de: moi.id }))).select();
          if (!r.error) { derniereGeneration = 0; await generer(sb); notifier(`Tâche répétée créée : ${resume(regle)}`); }
        } else {
          r = await sb.from('taches').insert(pour.map((p) => ({ ...base, pour: p, de: moi.id }))).select();
          if (!r.error) notifier(pour.length > 1 ? `${pour.length} tâches créées.` : pour[0] === moi.id ? 'Tâche ajoutée.' : `Tâche confiée à ${nomDe(pour[0], ctx)}.`);
        }
      } else {
        if (createur && el.pour) base.pour = el.pour.value;
        base.fait = el.fait.checked;
        r = await sb.from('taches').update(base).eq('id', t.id).select().maybeSingle();
        if (!r.error && r.data) notifier('Tâche enregistrée.');
        else if (!r.error) r.error = { message: 'Modification refusée.' };
      }
      bouton.disabled = false;
      if (r.error) return dire(r.error.message);
      fermer();
      if (apres) apres();
    });
    const suppr = f.querySelector('[data-supprimer]');
    if (suppr) suppr.addEventListener('click', async () => {
      if (!window.confirm(`Supprimer la tâche « ${t.titre} » ?`)) return;
      const { error } = await sb.from('taches').delete().eq('id', t.id);
      if (error) return dire(error.message);
      fermer(); notifier('Tâche supprimée.');
      if (apres) apres();
    });
    (createur ? form.elements.titre : form.elements.date_prevue).focus();
  }

  // ---------- Module « Tâches » ----------
  function monter(conteneur, ctx) {
    const { sb, moi, admin, esc } = ctx;
    let filtre = 'moi';   // moi | confiees | <id> | tous (admin)
    let taches = [];
    let detruit = false, attente = null;
    conteneur.innerHTML = `
      <header class="entete">
        <div class="ag-titre"><h2 style="font-size:20px;margin:0">Tâches</h2>
          <span class="discret">Rangées par date. Celles qui ont une date apparaissent aussi dans votre agenda.</span></div>
        <button type="button" class="btn btn-metal" id="t-nouvelle">+ Nouvelle tâche</button>
      </header>
      <div class="contenu-page taches-page">
        <div class="taches-outils">
          <div class="onglets onglets-param" id="t-filtres">
            <button type="button" data-filtre="moi">Mes tâches</button>
            <button type="button" data-filtre="confiees">Tâches que j’ai confiées</button>
          </div>
          ${admin ? '<label class="ag-qui"><span class="discret">Administrateur :</span><select id="t-qui"><option value="">—</option></select></label>' : ''}
        </div>
        <form class="ajout-rapide" id="t-rapide"><input placeholder="Ajouter une tâche pour aujourd’hui… (Entrée)" maxlength="300" aria-label="Nouvelle tâche pour aujourd’hui"><button class="btn btn-ligne petit" type="submit">Ajouter</button></form>
        <section class="carte" id="t-liste"><div class="vide">Chargement…</div></section>
        <section class="carte" id="t-series" hidden><h2>Tâches répétées</h2>
          <p class="discret">Chaque jour prévu devient une tâche à cocher (créée la veille). Les suivantes sont visibles dans l’agenda.</p>
          <div id="t-series-liste"></div></section>
      </div>`;
    const $ = (s) => conteneur.querySelector(s);

    async function charger() {
      conteneur.querySelectorAll('[data-filtre]').forEach((b) => b.classList.toggle('actif', b.dataset.filtre === filtre));
      let q = sb.from('taches').select('*').order('date_prevue', { ascending: true, nullsFirst: false });
      if (filtre === 'moi') q = q.eq('pour', moi.id);
      else if (filtre === 'confiees') q = q.eq('de', moi.id).neq('pour', moi.id);
      else if (filtre !== 'tous') q = q.eq('pour', filtre);
      // Terminées : seulement les 30 derniers jours
      q = q.or(`fait.eq.false,fait_le.gte."${new Date(Date.now() - 30 * 864e5).toISOString()}"`);
      const { data, error } = await q;
      if (detruit) return;
      if (error) { $('#t-liste').innerHTML = `<div class="vide">Tâches indisponibles : ${esc(error.message)}</div>`; return; }
      taches = data;
      const zone = $('#t-liste');
      zone.innerHTML = taches.length || filtre === 'moi' ? rendreListe(taches, ctx) : '<div class="vide">Aucune tâche.</div>';
      brancherListe(zone, taches, ctx, charger);
      chargerSeries();
    }

    async function chargerSeries() {
      let q = sb.from('taches_series').select('*').eq('actif', true).order('created_at');
      if (filtre === 'moi') q = q.eq('pour', moi.id);
      else if (filtre === 'confiees') q = q.eq('de', moi.id).neq('pour', moi.id);
      else if (filtre !== 'tous') q = q.eq('pour', filtre);
      const { data, error } = await q;
      if (detruit) return;
      const bloc = $('#t-series');
      bloc.hidden = error || !data || !data.length;
      if (bloc.hidden) return;
      $('#t-series-liste').innerHTML = data.map((s) => `
        <div class="tache serie" data-serie-id="${esc(s.id)}">
          <span class="serie-ico" aria-hidden="true">↻</span>
          <div class="tache-texte" style="cursor:default">
            <span class="tache-titre">${s.priorite === 'urgente' ? '<span class="pastille pastille-urgent">Urgent</span> ' : ''}${esc(s.titre)}</span>
            <span class="discret">${esc(resume(s))}${s.pour !== moi.id ? ` · pour ${esc(nomDe(s.pour, ctx))}` : s.de && s.de !== moi.id ? ` · de ${esc(nomDe(s.de, ctx))}` : ''}</span>
          </div>
          ${s.de === moi.id || admin ? '<button type="button" class="btn btn-ligne petit" data-arreter>Arrêter</button>' : ''}
        </div>`).join('');
      $('#t-series-liste').querySelectorAll('[data-arreter]').forEach((b) => b.addEventListener('click', async () => {
        const s = data.find((x) => x.id === b.closest('[data-serie-id]').dataset.serieId);
        if (!window.confirm(`Arrêter la répétition de « ${s.titre} » ? Les tâches déjà créées restent.`)) return;
        const r = await sb.from('taches_series').update({ actif: false }).eq('id', s.id).select().maybeSingle();
        if (r.error || !r.data) { ctx.notifier(r.error ? r.error.message : 'Modification refusée.'); return; }
        ctx.notifier('Répétition arrêtée.'); chargerSeries();
      }));
    }

    conteneur.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => {
      filtre = b.dataset.filtre; const s = $('#t-qui'); if (s) s.value = ''; charger();
    }));
    $('#t-nouvelle').addEventListener('click', () => ouvrirFiche(ctx, null, { pour: filtre !== 'moi' && filtre !== 'confiees' && filtre !== 'tous' ? filtre : moi.id }, charger));
    $('#t-rapide').addEventListener('submit', async (e) => {
      e.preventDefault();
      const champ = e.target.querySelector('input');
      const titre = champ.value.trim();
      if (!titre) return;
      champ.value = '';
      const { error } = await sb.from('taches').insert({ titre, pour: moi.id, de: moi.id, date_prevue: jourISO(new Date()) });
      if (error) { champ.value = titre; ctx.notifier(error.message); return; }
      charger();
    });

    utilisateurs(sb).then((users) => {
      if (detruit) return;
      const s = $('#t-qui');
      if (s) {
        s.innerHTML = `<option value="">—</option><option value="tous">Toutes les tâches</option>${users.filter((u) => u.id !== moi.id).map((u) => `<option value="${esc(u.id)}">Tâches de ${esc(u.nom)}</option>`).join('')}`;
        s.addEventListener('change', () => { filtre = s.value || 'moi'; charger(); });
      }
      generer(sb).finally(() => { if (!detruit) charger(); });
    });

    const canal = sb.channel('taches-direct')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taches' }, () => {
        clearTimeout(attente); attente = setTimeout(() => { if (!detruit) charger(); }, 300);
      }).subscribe();

    return { detruire() { detruit = true; clearTimeout(attente); sb.removeChannel(canal); const f = document.getElementById('fenetre'); if (f && f.querySelector('.tache-form')) { f.hidden = true; f.innerHTML = ''; } } };
  }

  window.FMDTaches = { monter, ouvrirFiche, basculer, utilisateurs, rendreListe, brancherListe, groupes, jourISO, libelleDate, ligne,
    generer, prevues, resume, tombeLe };
})();
