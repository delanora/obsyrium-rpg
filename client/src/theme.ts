/** Tema único da interface, aplicado também na marcação inicial do HTML. */
export function initTheme(): 'dark' {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = 'dark';
  // Substitui a preferência antiga sem depender de o armazenamento estar disponível.
  try { localStorage.setItem('grimorio.theme', 'dark'); } catch { /* O tema escuro já foi aplicado. */ }
  return 'dark';
}
