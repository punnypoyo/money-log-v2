import { db } from '../db.js';
import { getStartOfDay, getEndOfDay, getStartOfMonth, getEndOfMonth, getStartOfYear, getEndOfYear, formatCurrency } from '../utils/format.js';
import Chart from 'chart.js/auto';

let currentFilter = 'month'; // 'day', 'month', 'year'
let charts = {};

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="segmented-control" id="dashboard-filter">
      <button class="segment-btn" data-filter="day">Day</button>
      <button class="segment-btn active" data-filter="month">Month</button>
      <button class="segment-btn" data-filter="year">Year</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Expense</div>
        <div class="stat-value text-danger" id="dash-expense">฿0.00</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Income</div>
        <div class="stat-value text-success" id="dash-income">฿0.00</div>
      </div>
    </div>

    <div class="card mt-4" style="margin-top: 16px;">
      <div class="card-header">
        <h2 class="card-title">By Payment Method</h2>
      </div>
      <div class="chart-container">
        <canvas id="paymentChart"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">By Category</h2>
      </div>
      <div class="chart-container">
        <canvas id="categoryChart"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Credit Cards Limit</h2>
      </div>
      <div id="credit-cards-container">
         <div class="loader"></div>
      </div>
    </div>
  `;

  // Filter Buttons
  document.querySelectorAll('#dashboard-filter .segment-btn').forEach(btn => {
    if (btn.dataset.filter === currentFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#dashboard-filter .segment-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      loadDashboardData();
    });
  });

  await loadDashboardData();
}

async function loadDashboardData() {
  const now = new Date();
  let start, end;
  
  if (currentFilter === 'day') {
    start = getStartOfDay(now);
    end = getEndOfDay(now);
  } else if (currentFilter === 'month') {
    start = getStartOfMonth(now);
    end = getEndOfMonth(now);
  } else {
    start = getStartOfYear(now);
    end = getEndOfYear(now);
  }

  const txs = await db.transactions
    .where('date')
    .between(start.toISOString(), end.toISOString())
    .toArray();

  let totalExpense = 0;
  let totalIncome = 0;
  let byAccount = {};
  let byCategory = {};

  const accounts = await db.accounts.toArray();
  const categories = await db.categories.toArray();
  
  const accountMap = accounts.reduce((acc, a) => { acc[a.id] = a; return acc; }, {});
  const categoryMap = categories.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

  txs.forEach(tx => {
    const amount = Number(tx.amount);
    if (tx.type === 'income') {
      totalIncome += amount;
    } else if (tx.type === 'expense') {
      totalExpense += amount;
      
      // By payment type
      const acc = accountMap[tx.accountId];
      const accType = acc ? acc.type : 'unknown';
      if (!byAccount[accType]) byAccount[accType] = 0;
      byAccount[accType] += amount;

      // By category
      const cat = categoryMap[tx.categoryId];
      const catName = cat ? cat.name : 'Unknown';
      if (!byCategory[catName]) byCategory[catName] = 0;
      byCategory[catName] += amount;
    }
  });

  document.getElementById('dash-expense').innerText = `฿${formatCurrency(totalExpense)}`;
  document.getElementById('dash-income').innerText = `฿${formatCurrency(totalIncome)}`;

  renderPaymentChart(byAccount);
  renderCategoryChart(byCategory, categories);
  renderCreditCards(accountMap, totalExpense); // A simplified version using lifetime/current bounds
}

function renderPaymentChart(data) {
  const ctx = document.getElementById('paymentChart');
  if(!ctx) return;
  if(charts.payment) charts.payment.destroy();

  const labels = Object.keys(data).map(k => k === 'bank' ? 'Mobile Bank' : (k === 'cash' ? 'Cash' : 'Credit Card'));
  const values = Object.values(data);
  const colors = ['#3b82f6', '#10b981', '#f59e0b']; // Standardized colors

  charts.payment = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels : ['No Data'],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: values.length ? colors : ['#334155'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#f8fafc' } }
      }
    }
  });
}

function renderCategoryChart(dataCategories, allCategories) {
  const ctx = document.getElementById('categoryChart');
  if(!ctx) return;
  if(charts.category) charts.category.destroy();
  
  // Sort descending
  const sorted = Object.entries(dataCategories).sort((a,b) => b[1] - a[1]);
  const labels = sorted.map(i => i[0]);
  const values = sorted.map(i => i[1]);
  const bgColors = labels.map(label => {
    const cat = allCategories.find(c => c.name === label);
    return cat ? cat.color : '#6366f1';
  });

  charts.category = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No expenses'],
      datasets: [{
        label: 'Expense',
        data: values.length ? values : [0],
        backgroundColor: values.length ? bgColors : '#334155',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
        y: { grid: { display: false }, ticks: { color: '#e2e8f0' } }
      }
    }
  });
}

async function renderCreditCards(accountMap, ignored) {
  const container = document.getElementById('credit-cards-container');
  if(!container) return;

  // Real world: Credit cards roll over at statement date.
  // For simplicity, we calculate lifetime usage for shared limit demonstration.
  // The Prompt: "แสดงยอดคงเหลือวงเงินบัตรเครดิตปัจจุบัน และยอดที่ใช้ไปแยกตามบัตร บัตรที่เป็นบัตรเสริม ให้อยู่ใน section เดียวกันกับบัตรหลัก"
  
  const allAccounts = Object.values(accountMap);
  const creditCards = allAccounts.filter(a => a.type === 'credit');
  
  if (creditCards.length === 0) {
    container.innerHTML = '<p class="text-secondary text-center">No Credit Cards found.</p>';
    return;
  }

  // Calculate usage. Need all lifetime expenses for these cards (ignoring date filter for current limit)
  const allTxs = await db.transactions.where('type').equals('expense').toArray();
  
  // Group by main card
  const mainCards = creditCards.filter(c => !c.parentCardId);
  const supplementaryCards = creditCards.filter(c => c.parentCardId);

  let html = '';

  for (const mainCard of mainCards) {
    // Find its supplementary cards
    const subCards = supplementaryCards.filter(c => c.parentCardId === mainCard.id);
    const familyCards = [mainCard, ...subCards];
    const familyIds = familyCards.map(c => c.id);

    // Calculate total used for the family
    const familyExpenses = allTxs.filter(tx => familyIds.includes(tx.accountId));
    let totalUsed = 0;
    let usedByCard = {};
    
    familyCards.forEach(c => usedByCard[c.id] = 0);

    familyExpenses.forEach(tx => {
      totalUsed += Number(tx.amount);
      usedByCard[tx.accountId] += Number(tx.amount);
    });

    const limit = Number(mainCard.limit) || 0;
    const remaining = limit - totalUsed;
    const usagePercent = limit > 0 ? Math.min(100, (totalUsed / limit) * 100) : 0;

    html += `
      <div style="background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong style="color: ${mainCard.color || '#fff'}">${mainCard.name} (Shared Limit: ฿${formatCurrency(limit)})</strong>
        </div>
        
        <div style="height: 8px; background: #334155; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
          <div style="width: ${usagePercent}%; height: 100%; background: ${usagePercent >= 90 ? 'var(--danger-color)' : 'var(--primary-color)'};"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 16px; color: var(--text-secondary);">
          <span>Used: <span class="text-primary">฿${formatCurrency(totalUsed)}</span></span>
          <span>Remaining: <span class="text-success">฿${formatCurrency(remaining)}</span></span>
        </div>

        <div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">Usage Breakdown:</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 4px 0;">
             <span>${mainCard.name} (Main)</span>
             <span>฿${formatCurrency(usedByCard[mainCard.id])}</span>
          </div>
          ${subCards.map(sub => `
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 4px 0; border-top: 1px solid #334155;">
               <span>↳ ${sub.name} (Supplementary)</span>
               <span>฿${formatCurrency(usedByCard[sub.id])}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}
