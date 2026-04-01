import { db } from '../db.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Manage Categories</h2>
        <button class="btn btn-primary" id="add-category-btn"><i class="ph ph-plus"></i></button>
      </div>
      <div id="category-list"></div>
    </div>
    
    <div class="card mt-4" style="margin-top: 16px;">
      <div class="card-header">
        <h2 class="card-title">Manage Accounts</h2>
        <button class="btn btn-primary" id="add-account-btn"><i class="ph ph-plus"></i></button>
      </div>
      <div id="account-list"></div>
    </div>
  `;

  document.getElementById('add-category-btn').addEventListener('click', showAddCategoryModal);
  document.getElementById('add-account-btn').addEventListener('click', showAddAccountModal);

  await loadCategories();
  await loadAccounts();
}

async function loadCategories() {
  const list = document.getElementById('category-list');
  if(!list) return;

  const cats = await db.categories.toArray();
  if (cats.length === 0) {
    list.innerHTML = '<p class="text-secondary text-center">No categories created.</p>';
    return;
  }

  list.innerHTML = cats.map(c => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 36px; height: 36px; border-radius: 8px; background: ${c.color}; display: flex; align-items: center; justify-content: center; color: white;">
          <i class="ph ph-${c.icon}"></i>
        </div>
        <div>
           <div style="font-weight: 500;">${c.name}</div>
           <div class="text-secondary text-sm">${c.type.toUpperCase()}</div>
        </div>
      </div>
      <button class="btn btn-danger-outline" style="background:transparent; border:none; color: var(--danger-color); cursor:pointer;" onclick="deleteCategory(${c.id})"><i class="ph ph-trash"></i></button>
    </div>
  `).join('');
}

async function loadAccounts() {
  const list = document.getElementById('account-list');
  if(!list) return;

  const accounts = await db.accounts.toArray();
  if (accounts.length === 0) {
    list.innerHTML = '<p class="text-secondary text-center">No accounts created.</p>';
    return;
  }

  // Pre-process supplementary cards
  const mains = accounts.filter(a => !a.parentCardId);
  const subs = accounts.filter(a => a.parentCardId);

  list.innerHTML = mains.map(a => {
    const isCredit = a.type === 'credit';
    const children = subs.filter(s => s.parentCardId === a.id);
    
    let html = `
      <div style="padding: 12px 0; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 500; color: ${a.color}">${a.name}</div>
            <div class="text-secondary text-sm">
              ${a.type.toUpperCase()} ${isCredit ? `(Limit: ฿${a.limit})` : ''}
            </div>
          </div>
          <button class="btn btn-danger-outline" style="background:transparent; border:none; color: var(--danger-color); cursor:pointer;" onclick="deleteAccount(${a.id})"><i class="ph ph-trash"></i></button>
        </div>
        
        ${children.map(c => `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-left: 24px; border-left: 2px solid var(--border-color);">
             <div>
                <div style="font-weight: 500; font-size: 0.9rem;">↳ ${c.name}</div>
                <div class="text-secondary" style="font-size: 0.75rem;">SUPPLEMENTARY CARD</div>
             </div>
             <button class="btn" style="background:transparent; border:none; padding: 4px; color: var(--danger-color); cursor:pointer;" onclick="deleteAccount(${c.id})"><i class="ph ph-trash"></i></button>
          </div>
        `).join('')}
      </div>
    `;
    return html;
  }).join('');
}

// Minimal modal injection for settings
function createModal(id, title, formHtml, onSave) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay" id="${id}-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" onclick="closeModal('${id}')"><i class="ph ph-x"></i></button>
        </div>
        <form id="${id}-form">${formHtml}</form>
      </div>
    </div>
  `;
  
  modalContainer.classList.remove('hidden');
  
  // Animate in
  setTimeout(() => {
    document.getElementById(`${id}-overlay`).classList.add('open');
  }, 10);

  document.getElementById(`${id}-form`).onsubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  window.closeModal = (targetId) => {
    const overlay = document.getElementById(`${targetId}-overlay`);
    overlay.classList.remove('open');
    setTimeout(() => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
    }, 300);
  };
}

function showAddCategoryModal() {
  const formHtml = `
    <div class="form-group">
      <label class="form-label">Type</label>
      <select id="cat-type" class="form-control" required>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Name</label>
      <input type="text" id="cat-name" class="form-control" required placeholder="e.g. Subscriptions">
    </div>
    <div class="form-group">
      <label class="form-label">Icon (Phosphor Icon Name)</label>
      <input type="text" id="cat-icon" class="form-control" required value="star">
    </div>
    <div class="form-group">
      <label class="form-label">Color (Hex)</label>
      <input type="color" id="cat-color" class="form-control" style="height: 50px; padding: 4px;" value="#6366f1">
    </div>
    <button type="submit" class="btn btn-primary btn-block">Save Category</button>
  `;

  createModal('add-category', 'Add New Category', formHtml, async () => {
    const name = document.getElementById('cat-name').value;
    const type = document.getElementById('cat-type').value;
    const icon = document.getElementById('cat-icon').value;
    const color = document.getElementById('cat-color').value;
    await db.categories.add({ name, type, icon, color });
    window.closeModal('add-category');
    loadCategories();
  });
}

async function showAddAccountModal() {
  const accounts = await db.accounts.filter(a => a.type === 'credit' && !a.parentCardId).toArray();
  const accOptions = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

  const formHtml = `
    <div class="form-group">
      <label class="form-label">Account Type</label>
      <select id="acc-type" class="form-control" onchange="toggleAccountFields(this.value)" required>
        <option value="bank">Mobile Bank</option>
        <option value="cash">Cash</option>
        <option value="credit">Credit Card</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Account Name</label>
      <input type="text" id="acc-name" class="form-control" required placeholder="e.g. KBank">
    </div>
    
    <div id="credit-fields" style="display: none;">
       <div class="form-group">
         <label class="form-label">Is this a supplementary card?</label>
         <select id="acc-is-sub" class="form-control" onchange="toggleLimitFields(this.value)">
           <option value="no">No, Main Card</option>
           <option value="yes">Yes, Supplementary Card</option>
         </select>
       </div>
       
       <div class="form-group" id="limit-field-group">
         <label class="form-label">Credit Limit</label>
         <input type="number" id="acc-limit" class="form-control" placeholder="100000">
       </div>
       
       <div class="form-group" id="parent-card-group" style="display: none;">
         <label class="form-label">Select Main Card (Shares the limit)</label>
         <select id="acc-parent" class="form-control">
           ${accOptions}
         </select>
       </div>
    </div>
    
    <div class="form-group">
      <label class="form-label">Theme Color</label>
      <input type="color" id="acc-color" class="form-control" style="height: 50px; padding: 4px;" value="#3b82f6">
    </div>
    <button type="submit" class="btn btn-primary btn-block">Save Account</button>
  `;

  createModal('add-account', 'Add New Account', formHtml, async () => {
    const type = document.getElementById('acc-type').value;
    const name = document.getElementById('acc-name').value;
    const color = document.getElementById('acc-color').value;
    let limit = null;
    let parentCardId = null;

    if (type === 'credit') {
      const isSub = document.getElementById('acc-is-sub').value === 'yes';
      if (isSub) {
        parentCardId = parseInt(document.getElementById('acc-parent').value, 10);
      } else {
        limit = parseFloat(document.getElementById('acc-limit').value) || 0;
      }
    }

    await db.accounts.add({ name, type, color, limit, parentCardId });
    window.closeModal('add-account');
    loadAccounts();
  });

  window.toggleAccountFields = (val) => {
    document.getElementById('credit-fields').style.display = val === 'credit' ? 'block' : 'none';
  };
  window.toggleLimitFields = (val) => {
    document.getElementById('limit-field-group').style.display = val === 'yes' ? 'none' : 'block';
    document.getElementById('parent-card-group').style.display = val === 'yes' ? 'block' : 'none';
  };
}

window.deleteCategory = async (id) => {
  if(confirm('Are you sure you want to delete this category?')) {
    await db.categories.delete(id);
    loadCategories();
  }
};

window.deleteAccount = async (id) => {
  if(confirm('Are you sure you want to delete this account?')) {
    await db.accounts.delete(id);
    loadAccounts();
  }
};
