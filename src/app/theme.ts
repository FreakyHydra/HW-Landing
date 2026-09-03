export type ThemePreference = 'system' | 'light' | 'dark'

const storageKey = 'hw.appearance.theme'
const media = matchMedia('(prefers-color-scheme: light)')

export function getThemePreference(): ThemePreference {
  const value = localStorage.getItem(storageKey)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  return preference === 'system' ? (media.matches ? 'light' : 'dark') : preference
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themePreference = preference
  document.documentElement.style.colorScheme = resolved
}

export function setThemePreference(preference: ThemePreference): void {
  localStorage.setItem(storageKey, preference)
  applyTheme(preference)
  const resolved = resolveTheme(preference)
  window.dispatchEvent(new CustomEvent('hw:theme-change', { detail: { preference, resolved } }))
}

media.addEventListener('change', () => {
  if (getThemePreference() === 'system') applyTheme('system')
})
