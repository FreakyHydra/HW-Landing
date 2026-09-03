(function () {
  var key = 'hw.appearance.theme'
  var saved = localStorage.getItem(key)
  var preference = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  var resolved = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : preference
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themePreference = preference
  document.documentElement.style.colorScheme = resolved
})()
