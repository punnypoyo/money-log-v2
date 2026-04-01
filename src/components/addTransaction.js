import { db } from '../db.js';
import { navigate } from '../main.js';

export async function showAddTransactionModal() {
  const modalContainer = document.getElementById('modal-container');
  
  const accounts = await db.accounts.toArray();
  const categories = await db.categories.toArray();

  const accOptions = accounts.map(a => `<option value="${a.id}">${a.name} (${a.type.toUpperCase()})</option>`).join('');
  const expCats = categories.filter(c => c.type === 'expense').map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const incCats = categories.filter(c => c.type === 'income').map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  const now = new Date();
  
  // Format for datetime-local input
  const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

  modalContainer.innerHTML = `
    <div class="modal-overlay" id="add-tx-overlay">
      <div class="modal-content" style="background: var(--surface-color); padding-bottom: calc(24px + env(safe-area-inset-bottom));">
        <div class="modal-header">
          <h2 class="modal-title">New Transaction</h2>
          <button class="modal-close" onclick="closeAddTxModal()"><i class="ph ph-x"></i></button>
        </div>
        
        <form id="add-tx-form">
          <div class="segmented-control" id="tx-type-segment">
            <button type="button" class="segment-btn active" data-type="expense">Expense</button>
            <button type="button" class="segment-btn" data-type="income">Income</button>
          </div>
          <input type="hidden" id="tx-type" value="expense">

          <div class="form-group" style="margin-top:20px;">
            <label class="form-label" style="text-align:center; font-size:1rem;">Amount</label>
            <input type="number" id="tx-amount" class="form-control" style="font-size: 2.5rem; text-align: center; font-weight: bold; background: transparent; border: none; border-bottom: 2px solid var(--border-color); border-radius: 0;" placeholder="0.00" step="0.01" required autocomplete="off">
          </div>
          
          <div class="form-group">
            <label class="form-label">Date & Time</label>
            <input type="datetime-local" id="tx-date" class="form-control" value="${localIso}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Account / Payment Method</label>
            <select id="tx-account" class="form-control" required>
              ${accOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="tx-category" class="form-control" required>
              ${expCats}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Note (Optional)</label>
            <input type="text" id="tx-note" class="form-control" placeholder="What was this for?">
          </div>

          <button type="submit" class="btn btn-primary btn-block" style="margin-top:24px; padding: 16px; font-size: 1.1rem; border-radius: 12px;">Save Transaction</button>
        </form>
      </div>
    </div>
  `;

  window.closeAddTxModal = () => {
    const overlay = document.getElementById('add-tx-overlay');
    overlay.classList.remove('open');
    setTimeout(() => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
      navigate('dashboard');
    }, 300);
  };

  modalContainer.classList.remove('hidden');
  
  // Set category options dynamically
  const typeBtns = document.querySelectorAll('#tx-type-segment .segment-btn');
  const catSelect = document.getElementById('tx-category');
  const typeInput = document.getElementById('tx-type');
  const amountInput = document.getElementById('tx-amount');

  typeBtns.forEach(btn => {
    btn.onclick = () => {
      typeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      typeInput.value = type;
      
      if(type === 'expense') {
        catSelect.innerHTML = expCats;
        amountInput.style.color = 'var(--text-primary)';
      } else {
        catSelect.innerHTML = incCats;
        amountInput.style.color = 'var(--success-color)';
      }
    };
  });

  // Animate in
  setTimeout(() => {
    document.getElementById('add-tx-overlay').classList.add('open');
    amountInput.focus();
  }, 10);

  document.getElementById('add-tx-form').onsubmit = async (e) => {
    e.preventDefault();
    const type = typeInput.value;
    const amount = document.getElementById('tx-amount').value;
    const date = new Date(document.getElementById('tx-date').value).toISOString();
    const accountId = parseInt(document.getElementById('tx-account').value, 10);
    const categoryId = parseInt(document.getElementById('tx-category').value, 10);
    const note = document.getElementById('tx-note').value.trim();

    await db.transactions.add({
      date, type, amount: parseFloat(amount), accountId, categoryId, note
    });

    window.closeAddTxModal();
  };
}
