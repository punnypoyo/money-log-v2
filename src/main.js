import { initDb } from './db.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderTransactions } from './pages/transactions.js';
import { renderReport } from './pages/report.js';
import { renderSettings } from './pages/settings.js';
import { showAddTransactionModal } from './components/addTransaction.js';

// Setup PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // using vite-plugin-pwa standard behavior
    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({ immediate: true });
    }).catch(console.warn);
  });
}

const routes = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  transactions: { title: 'Transactions', render: renderTransactions },
  report: { title: 'Report', render: renderReport },
  settings: { title: 'Settings', render: renderSettings },
};

let currentPage = 'dashboard';

async function navigate(pageName) {
  if (pageName === 'add-transaction') {
    showAddTransactionModal();
    return;
  }

  const route = routes[pageName];
  if (!route) return;
  
  currentPage = pageName;
  document.getElementById('page-title').innerText = route.title;
  
  // Update nav UI
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if(btn.dataset.page === pageName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = '<div class="loader"></div>';
  
  try {
    await route.render(mainContent);
  } catch (err) {
    console.error(err);
    mainContent.innerHTML = `<div class="card p-4 text-danger">Error loading page: ${err.message}</div>`;
  }
}

async function boot() {
  await initDb();
  
  // Setup Nav listeners
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = e.currentTarget.dataset.page;
      navigate(page);
    });
  });

  // Initial load
  navigate('dashboard');
}

// Export navigate for other components to use (e.g. going back to dashboard after save)
export { navigate };

document.addEventListener('DOMContentLoaded', boot);
