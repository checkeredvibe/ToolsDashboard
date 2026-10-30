// Shared template logic (index + all tool pages)

document.addEventListener('DOMContentLoaded', () => {
  const footer = document.querySelector('.dashboard-footer p');
  if (footer) {
    footer.textContent = 'All results in SI units. Offline tool — no internet connection required.';
  }
});
