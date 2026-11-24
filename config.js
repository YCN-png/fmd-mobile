// Connexion à l'hébergement Supabase.
// La clé « anon » est publique par conception : la sécurité vient des règles RLS de la base (supabase/schema.sql).
// Ne JAMAIS mettre ici la clé « service_role ».
window.FMD_CONFIG = {
  supabaseUrl: 'https://vnmpfzcsaxlizehbfnsc.supabase.co',
  supabaseAnonKey: 'sb_publishable_jtiYbO9oWA82veIWzxwBcw_WRoDYIKT',
};
