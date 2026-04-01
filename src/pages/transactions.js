import { db } from '../db.js';
import { formatDate, formatCurrency } from '../utils/format.js';

let currentPage = 1;
const itemsPerPage = 200;

export async function renderTransactions(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Recent Transactions</h2>
      </div>
      <div id="tx-list">
        <div class="loader"></div>
      </div>
      <div id="pagination-controls" style="display: flex; justify-content: space-between; margin-top: 16px;">
        <button class="btn btn-primary" id="prev-btn" disabled>Previous</button>
        <span id="page-info" style="align-self: center;">Page 1</span>
        <button class="btn btn-primary" id="next-btn" disabled>Next</button>
      </div>
    </div>
  `;

  await loadTransactions();
}

async function loadTransactions() {
  const txList = document.getElementById('tx-list');
  if(!txList) return;

  const totalCount = await db.transactions.count();
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

  if (currentPage > totalPages) currentPage = totalPages;

  const txs = await db.transactions
    .orderBy('date').reverse()
    .offset((currentPage - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .toArray();

  const categories = await db.categories.toArray();
  const accounts = await db.accounts.toArray();
  const catMap = categories.reduce((acc, c) => { acc[c.id]=c; return acc;}, {});
  const accMap = accounts.reduce((acc, c) => { acc[c.id]=c; return acc;}, {});

  if (txs.length === 0) {
    txList.innerHTML = '<p class="text-secondary text-center p-4">No transactions found.</p>';
  } else {
    txList.innerHTML = txs.map(tx => {
      const cat = catMap[tx.categoryId] || { name: 'Unknown', icon: 'question', color: '#64748b' };
      const acc = accMap[tx.accountId] || { name: 'Unknown' };
      const isIncome = tx.type === 'income';

      return `
        <div class="tx-item">
          <div class="tx-icon-wrapper" style="background-color: ${cat.color};">
            <i class="ph ph-${cat.icon}"></i>
          </div>
          <div class="tx-details">
            <div class="tx-title">${cat.name}</div>
            <div class="tx-subtitle">${formatDate(tx.date)} &bull; ${acc.name}${tx.note ? ' &bull; ' + tx.note : ''}</div>
          </div>
          <div class="tx-amount ${isIncome ? 'income' : 'expense'}">
            ${isIncome ? '+' : '-'} ฿${formatCurrency(tx.amount)}
          </div>
        </div>
      `;
    }).join('');
  }

  // Update controls
  document.getElementById('page-info').innerText = `Page ${currentPage} of ${totalPages}`;
  
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;

  prevBtn.onclick = () => { if(currentPage > 1) { currentPage--; loadTransactions(); } };
  nextBtn.onclick = () => { if(currentPage < totalPages) { currentPage++; loadTransactions(); } };
}
