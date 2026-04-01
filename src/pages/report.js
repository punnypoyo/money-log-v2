import { db } from '../db.js';
import { formatCurrency, formatDateTime } from '../utils/format.js';
import { showAddTransactionModal } from '../components/addTransaction.js';

export async function renderReport(container) {
  // Get start of month as default
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0,10);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString().substring(0,10);

  const accounts = await db.accounts.toArray();
  const accOptions = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Report Filters</h2>
      </div>
      <form id="report-filter-form">
        <div class="form-group">
          <label class="form-label">Date From</label>
          <input type="date" id="report-from" class="form-control" value="${startOfMonth}">
        </div>
        <div class="form-group">
          <label class="form-label">Date To</label>
          <input type="date" id="report-to" class="form-control" value="${endOfMonth}">
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select id="report-type" class="form-control">
            <option value="all">All</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select id="report-account" class="form-control">
            <option value="all">All Accounts</option>
            ${accOptions}
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block">
          <i class="ph ph-magnifying-glass"></i> Search
        </button>
      </form>
    </div>

    <div id="report-result" style="margin-top: 24px; padding-bottom: 24px;"></div>
  `;

  document.getElementById('report-filter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await generateReport();
  });

  // initial load
  await generateReport();
  
  window.editTransaction = (id) => {
    showAddTransactionModal(id);
  };
}

async function generateReport() {
  const resultDiv = document.getElementById('report-result');
  resultDiv.innerHTML = '<div class="loader"></div>';

  try {
    const fromStr = document.getElementById('report-from').value;
    const toStr = document.getElementById('report-to').value;
    const typeVal = document.getElementById('report-type').value;
    const accountId = document.getElementById('report-account').value;

    if(!fromStr || !toStr) {
      resultDiv.innerHTML = '<p class="text-danger">Please select valid dates.</p>';
      return;
    }

    const start = new Date(fromStr + 'T00:00:00.000');
    const end = new Date(toStr + 'T23:59:59.999');

    let txs = (await db.transactions
      .where('date')
      .between(start.toISOString(), end.toISOString())
      .toArray())
      .filter(tx => tx.type !== 'transfer');

    if (typeVal !== 'all') {
      txs = txs.filter(tx => tx.type === typeVal);
    }
    if (accountId !== 'all') {
      txs = txs.filter(tx => tx.accountId == accountId);
    }

    if (txs.length === 0) {
      resultDiv.innerHTML = '<p class="text-secondary text-center">No records found for this period.</p>';
      return;
    }

    // pre-fetch relationships
    const accountsInfo = await db.accounts.toArray();
    const categoriesInfo = await db.categories.toArray();
    const accMap = accountsInfo.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
    const catMap = categoriesInfo.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

    // group by account
    // format required:
    // Kbank / Platinum
    //   date | amount | note | category
    //   รวม amount บาท
    let grouped = {};
    let grandTotal = 0;

    txs.forEach(tx => {
      const a = accMap[tx.accountId];
      const accName = a ? a.name : 'Unspecified';
      if (!grouped[accName]) grouped[accName] = { txs: [], total: 0 };
      grouped[accName].txs.push(tx);
      
      const val = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
      grouped[accName].total += val;
      grandTotal += val;
    });

    let html = `<div class="text-xl mb-4" style="margin-bottom:16px;">Report ${fromStr} to ${toStr}</div>`;

    for (const [accName, groupData] of Object.entries(grouped)) {
      html += `
        <div class="card mb-4">
          <h3 class="card-title text-success" style="margin-bottom: 8px;">${accName}</h3>
          
          <div style="font-family: inherit; font-size: 0.85rem; border-top: 1px dashed var(--border-color); padding-top: 8px;">
            <table style="width: 100%; border-collapse: collapse;">
             <tbody>
      `;

      groupData.txs.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
        const cat = catMap[tx.categoryId] ? catMap[tx.categoryId].name : 'Unknown';
        const val = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
        html += `
          <tr style="border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="editTransaction(${tx.id})">
            <td style="padding: 6px 0; color: var(--text-secondary);">${formatDateTime(tx.date)}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 500; ${val>0?'color: var(--success-color)':''}">${formatCurrency(val)}</td>
            <td style="padding: 6px 8px;">${tx.note || cat}</td>
            <td style="padding: 6px 0; color: var(--text-muted); text-align: right;">${cat}</td>
          </tr>
        `;
      });

      html += `
             </tbody>
            </table>
          </div>
          <div style="text-align: right; margin-top: 8px; font-weight: bold; border-top: 1px dashed var(--border-color); padding-top: 8px;">
            Total ${formatCurrency(groupData.total)} THB
          </div>
        </div>
      `;
    }

    html += `
      <div class="card" style="background: var(--primary-hover); border-color: var(--primary-color);">
        <div style="font-size: 1.1rem; font-weight: bold; text-align: center;">Grand Total: ${formatCurrency(grandTotal)} THB</div>
      </div>
    `;

    resultDiv.innerHTML = html;
  } catch(e) {
    resultDiv.innerHTML = `<p class="text-danger">Error: ${e.message}</p>`;
  }
}
