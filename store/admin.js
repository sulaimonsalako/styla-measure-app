// Global state
let categories = [];
let allProducts = [];
let editingProductId = null;

// Tab Switching
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const targetId = tab.getAttribute('data-target');
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(targetId).classList.remove('hidden');
  });
});

// File Preview & Base64 Reader
const fileInput = document.getElementById('prod-files');
const previewsGrid = document.getElementById('file-previews');
let base64Images = [];

fileInput.addEventListener('change', () => {
  previewsGrid.innerHTML = '';
  base64Images = [];
  const files = Array.from(fileInput.files);
  
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      base64Images.push(base64);
      
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `<img src="${base64}"><button type="button" class="remove-prev">A-</button>`;
      
      div.querySelector('.remove-prev').addEventListener('click', () => {
        const index = base64Images.indexOf(base64);
        if (index > -1) base64Images.splice(index, 1);
        div.remove();
      });
      
      previewsGrid.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
});

// Size Chart Input Generator (Dynamic columns based on prod-poms text field)
const sizesCheckboxes = document.querySelectorAll('input[name="sizes"]');
const sizeChartInputsContainer = document.getElementById('size-chart-inputs-container');
const prodPomsInput = document.getElementById('prod-poms');

function updateSizeChartInputs() {
  const checkedSizes = Array.from(sizesCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
  const columnsText = prodPomsInput ? prodPomsInput.value : 'Chest, Waist, Hips, Sleeve Length, Shoulder Width';
  const columns = columnsText.split(',').map(c => c.trim()).filter(c => c.length > 0);
  
  if (checkedSizes.length === 0 || columns.length === 0) {
    sizeChartInputsContainer.innerHTML = '';
    return;
  }

  sizeChartInputsContainer.innerHTML = `
    <label style="font-size:0.8rem; font-weight:600; margin-bottom:0.5rem; display:block;">Garment Size Chart Specs (inches)</label>
    <div style="background-color:#f4f4f5; border:1px solid #e4e4e7; border-radius:6px; padding:10px; overflow-x: auto;">
      <table style="width:100%; border-collapse:collapse; font-size:0.8rem; min-width: 450px;">
        <thead>
          <tr style="border-bottom:1px solid #e4e4e7; text-align:left;">
            <th style="padding:6px 4px; font-weight:700;">Size</th>
            ${columns.map(col => `<th style="padding:6px 4px;">Garment ${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${checkedSizes.map(sz => `
            <tr style="border-bottom:1px solid #f4f4f5;">
              <td style="padding:6px 4px; font-weight:700;">${sz}</td>
              ${columns.map(col => `
                <td style="padding:6px 4px;">
                  <input type="number" step="0.1" class="size-chart-val" data-size="${sz}" data-field="${col}" placeholder="e.g. 40" required style="width:65px; padding:4px; border:1px solid #ccc; border-radius:4px;">
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

sizesCheckboxes.forEach(cb => {
  cb.addEventListener('change', updateSizeChartInputs);
});

if (prodPomsInput) {
  prodPomsInput.addEventListener('input', updateSizeChartInputs);
}

// Edit, Replicate, Pause Elements
const formTitle = document.getElementById('form-title');
const btnSubmitProd = document.getElementById('btn-submit-prod');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

if (btnCancelEdit) {
  btnCancelEdit.addEventListener('click', () => {
    resetEditMode();
  });
}

function resetEditMode() {
  editingProductId = null;
  form.reset();
  document.getElementById('file-previews').innerHTML = '';
  base64Images = [];
  if (prodPomsInput) prodPomsInput.value = "Chest, Waist, Hips, Sleeve Length, Shoulder Width";
  if (formTitle) formTitle.innerText = "Upload New Product";
  if (btnSubmitProd) btnSubmitProd.innerText = "Publish Product";
  if (btnCancelEdit) btnCancelEdit.classList.add('hidden');
  updateSizeChartInputs(); // Reset grid inputs
}

function populateForm(prod) {
  document.getElementById('prod-name').value = prod.name;
  document.getElementById('prod-category').value = prod.category;
  document.getElementById('prod-supplier').value = prod.supplier;
  document.getElementById('prod-desc').value = prod.description || '';
  document.getElementById('prod-single-price').value = prod.singlePrice;
  document.getElementById('prod-bulk-price').value = prod.bulkPrice;
  document.getElementById('prod-colors').value = prod.colors ? prod.colors.join(', ') : 'Standard';

  // Set sizes checkboxes
  sizesCheckboxes.forEach(cb => {
    cb.checked = prod.sizes ? prod.sizes.includes(cb.value) : false;
  });

  // Extract columns (POMs) from existing sizeChart keys
  if (prod.sizeChart && prod.sizes && prod.sizes.length > 0) {
    const firstSizeData = prod.sizeChart[prod.sizes[0]] || {};
    const existingPoms = Object.keys(firstSizeData);
    if (existingPoms.length > 0 && prodPomsInput) {
      prodPomsInput.value = existingPoms.join(', ');
    }
  }

  // Regenerate dynamic grid inputs
  updateSizeChartInputs();

  // Populate dynamic inputs
  if (prod.sizeChart) {
    document.querySelectorAll('.size-chart-val').forEach(input => {
      const sz = input.getAttribute('data-size');
      const field = input.getAttribute('data-field');
      if (prod.sizeChart[sz] && prod.sizeChart[sz][field] !== undefined) {
        input.value = prod.sizeChart[sz][field];
      }
    });
  }

  // Image handling: display existing URLs
  const textTabBtn = document.querySelector('.tab-btn[data-target="urls-input"]');
  if (textTabBtn) textTabBtn.click();
  
  const urlsTextarea = document.getElementById('prod-image-urls');
  if (urlsTextarea) {
    urlsTextarea.value = Array.isArray(prod.images) ? prod.images.filter(img => !img.startsWith('data:')).join('\n') : '';
  }
  
  // Base64 image previews
  previewsGrid.innerHTML = '';
  base64Images = [];
  if (Array.isArray(prod.images)) {
    const base64s = prod.images.filter(img => img.startsWith('data:'));
    base64s.forEach(base64 => {
      base64Images.push(base64);
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `<img src="${base64}"><button type="button" class="remove-prev">A-</button>`;
      div.querySelector('.remove-prev').addEventListener('click', () => {
        const index = base64Images.indexOf(base64);
        if (index > -1) base64Images.splice(index, 1);
        div.remove();
      });
      previewsGrid.appendChild(div);
    });
  }
}

function replicateProduct(id) {
  const prod = allProducts.find(p => p.id === id);
  if (!prod) return;
  
  populateForm(prod);
  editingProductId = null; // Replicate means new creation
  if (formTitle) formTitle.innerText = `Publish New Design (Copy of ${prod.name})`;
  if (btnSubmitProd) btnSubmitProd.innerText = "Publish Product";
  if (btnCancelEdit) btnCancelEdit.classList.remove('hidden');
  
  form.scrollIntoView({ behavior: 'smooth' });
}

function editProduct(id) {
  const prod = allProducts.find(p => p.id === id);
  if (!prod) return;
  
  populateForm(prod);
  editingProductId = id; 
  if (formTitle) formTitle.innerText = `Edit Design: ${prod.name}`;
  if (btnSubmitProd) btnSubmitProd.innerText = "Save Changes";
  if (btnCancelEdit) btnCancelEdit.classList.remove('hidden');
  
  form.scrollIntoView({ behavior: 'smooth' });
}

async function toggleProductStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'paused' ? 'active' : 'paused';
  try {
    const res = await fetch('/api/store-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, status: nextStatus })
    });
    if (!res.ok) throw new Error("Failed to toggle visibility status");
    await loadInventory();
  } catch (err) {
    alert("Error updating visibility: " + err.message);
  }
}

// Load Inventory
async function loadInventory() {
  const inventoryContainer = document.getElementById('inventory-container');
  try {
    const res = await fetch('/api/store-products');
    if (!res.ok) throw new Error("Failed to load inventory");
    allProducts = await res.json();
    
    if (allProducts.length === 0) {
      inventoryContainer.innerHTML = '<div class="no-items">Inventory is empty.</div>';
      return;
    }
    
    inventoryContainer.innerHTML = allProducts.map(prod => {
      const isPaused = prod.status === 'paused';
      const firstSizeData = prod.sizeChart && prod.sizes ? (prod.sizeChart[prod.sizes[0]] || {}) : {};
      const specsList = Object.keys(firstSizeData).join(', ');
      
      return `
        <div class="inventory-item ${isPaused ? 'paused' : ''}" data-id="${prod.id}">
          <div class="inv-img-wrap">
            <img src="${prod.images && prod.images[0] ? prod.images[0] : 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop'}" alt="${prod.name}">
          </div>
          <div class="inv-details">
            <div class="inv-supplier">${prod.supplier}</div>
            <div class="inv-name">${prod.name} ${isPaused ? '<span class="paused-badge">PAUSED</span>' : ''}</div>
            <div class="inv-prices">
              <span class="inv-price-single">Single: $${prod.singlePrice}</span>
              <span class="inv-price-bulk">Bulk: $${prod.bulkPrice}</span>
            </div>
            <div style="font-size:0.7rem; color:#666; margin-top:2px;">
              Colors: ${prod.colors ? prod.colors.join(', ') : 'Standard'}
            </div>
            <div style="font-size:0.7rem; color:#666; margin-top:1px;">
              Specs Columns: ${specsList || 'None'}
            </div>
            <div class="inv-category-tag">${prod.category}</div>
            
            <div style="margin-top:10px; display:flex; gap:6px; flex-wrap: wrap;">
              <button class="btn-pause-prod" data-id="${prod.id}" data-status="${prod.status || 'active'}">${isPaused ? 'Resume' : 'Pause'}</button>
              <button class="btn-replicate-prod" data-id="${prod.id}">Replicate</button>
              <button class="btn-edit-prod btn-secondary-sm" data-id="${prod.id}" style="padding:6px 12px; cursor:pointer;">Edit</button>
              <button class="btn-delete-prod" data-id="${prod.id}" style="padding:6px 12px; background-color:#ef4444; color:#fff; border:1px solid #ef4444; border-radius:4px;">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    document.querySelectorAll('.btn-delete-prod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm(`Are you sure you want to delete this product?`)) {
          await deleteProduct(id);
        }
      });
    });

    document.querySelectorAll('.btn-pause-prod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const status = e.target.getAttribute('data-status');
        await toggleProductStatus(id, status);
      });
    });

    document.querySelectorAll('.btn-replicate-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        replicateProduct(id);
      });
    });

    document.querySelectorAll('.btn-edit-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        editProduct(id);
      });
    });

  } catch (err) {
    inventoryContainer.innerHTML = `<div class="error-msg">Error: ${err.message}</div>`;
  }
}

// Delete Product
async function deleteProduct(id) {
  try {
    const res = await fetch(`/api/store-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    });
    if (!res.ok) throw new Error("Failed to delete product");
    loadInventory();
  } catch (err) {
    alert("Error deleting product: " + err.message);
  }
}

// Load Categories
async function loadCategories() {
  try {
    const res = await fetch('/api/store-categories');
    if (!res.ok) throw new Error("Failed to load categories");
    categories = await res.json();
  } catch (err) {
    console.error("Error loading categories:", err);
    categories = ["Outerwear", "Knitwear", "Shirts", "Pants", "Accessories"];
  }

  const select = document.getElementById('prod-category');
  if (select) {
    select.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  }

  const managerList = document.getElementById('categories-manager-list');
  if (managerList) {
    managerList.innerHTML = categories.map(cat => `
      <div class="category-manager-item" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e4e4e7; padding-bottom:6px; margin-bottom: 4px;">
        <span style="font-size:0.85rem; font-weight:600; color:#333;">${cat}</span>
        <div style="display:flex; gap:6px;">
          <button class="btn-rename-cat btn-secondary-sm" style="padding:2px 6px; font-size:0.7rem; cursor:pointer;" data-name="${cat}">Rename</button>
          <button class="btn-delete-cat btn-delete-prod" style="padding:2px 6px; font-size:0.7rem; cursor:pointer;" data-name="${cat}">Delete</button>
        </div>
      </div>
    `).join('');

    managerList.querySelectorAll('.btn-rename-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const oldName = btn.getAttribute('data-name');
        const newName = prompt(`Rename category "${oldName}" to:`, oldName);
        if (newName && newName.trim() !== '' && newName !== oldName) {
          await renameCategory(oldName, newName.trim());
        }
      });
    });

    managerList.querySelectorAll('.btn-delete-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-name');
        if (confirm(`Are you sure you want to delete category "${name}"? Products using this category will be changed to "Uncategorized".`)) {
          await deleteCategory(name);
        }
      });
    });
  }
}

// Rename Category
async function renameCategory(oldName, newName) {
  try {
    const res = await fetch('/api/store-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', oldName, newName })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to rename category");
    }
    alert("Category renamed successfully!");
    await loadCategories();
    await loadInventory();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

// Delete Category
async function deleteCategory(name) {
  try {
    const res = await fetch('/api/store-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', name })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to delete category");
    }
    alert("Category deleted successfully!");
    await loadCategories();
    await loadInventory();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

// Category Form Submission
const categoryForm = document.getElementById('category-manager-form');
if (categoryForm) {
  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('new-cat-name');
    const name = nameInput.value.trim();
    
    try {
      const res = await fetch('/api/store-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add category");
      }
      nameInput.value = '';
      alert("Category added successfully!");
      await loadCategories();
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
}

// Submit Product Form
const form = document.getElementById('upload-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('prod-name').value;
  const category = document.getElementById('prod-category').value;
  const supplier = document.getElementById('prod-supplier').value;
  const description = document.getElementById('prod-desc').value;
  const singlePrice = document.getElementById('prod-single-price').value;
  const bulkPrice = document.getElementById('prod-bulk-price').value;
  
  const sizes = [];
  document.querySelectorAll('input[name="sizes"]:checked').forEach(cb => {
    sizes.push(cb.value);
  });
  
  const colorsInput = document.getElementById('prod-colors').value.trim();
  const colors = colorsInput ? colorsInput.split(',').map(c => c.trim()).filter(c => c.length > 0) : ['Standard'];

  // Size chart inputs parsing
  const sizeChart = {};
  document.querySelectorAll('.size-chart-val').forEach(input => {
    const sz = input.getAttribute('data-size');
    const field = input.getAttribute('data-field');
    const val = Number(input.value);
    if (!sizeChart[sz]) sizeChart[sz] = {};
    sizeChart[sz][field] = val;
  });

  let images = [];
  const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-target');
  if (activeTab === 'urls-input') {
    const urlsText = document.getElementById('prod-image-urls').value.trim();
    if (urlsText) {
      images = urlsText.split('\n').map(url => url.trim()).filter(url => url.length > 0);
    }
  } else {
    images = [...base64Images];
  }
  
  const payload = {
    name,
    category,
    supplier,
    description,
    singlePrice,
    bulkPrice,
    sizes,
    colors,
    sizeChart,
    images
  };

  if (editingProductId) {
    payload.action = 'update';
    payload.id = editingProductId;
  }
  
  try {
    const res = await fetch('/api/store-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to publish product");
    }
    
    if (editingProductId) {
      alert("Product updated successfully!");
      resetEditMode();
    } else {
      form.reset();
      document.getElementById('file-previews').innerHTML = '';
      base64Images = [];
      alert("Product published successfully!");
      if (prodPomsInput) prodPomsInput.value = "Chest, Waist, Hips, Sleeve Length, Shoulder Width";
      updateSizeChartInputs(); // Reset chart inputs
    }
    loadInventory();
  } catch (err) {
    alert("Error publishing product: " + err.message);
  }
});

// Load Simulated Orders from the Server (Displays username, measurements, and ordered sizes)
async function loadOrders() {
  const ordersContainer = document.getElementById('orders-container');
  try {
    const res = await fetch('/api/store-cart?all=true');
    if (!res.ok) throw new Error("Failed to fetch orders from server");
    const carts = await res.json();
    
    // Filter carts to only show those that are paid or partially paid (active orders)
    const orders = carts.filter(c => c.paymentStatus === 'paid' || c.paymentStatus === 'partially_paid');
    
    if (orders.length === 0) {
      ordersContainer.innerHTML = '<div class="no-orders">No active group orders placed yet.</div>';
      return;
    }
    
    ordersContainer.innerHTML = orders.map(order => {
      const totalItems = (order.creatorItems ? order.creatorItems.length : 0) + (order.friendItems ? order.friendItems.length : 0);
      
      // Format Creator's body measurements details
      let measurementsHtml = '<em>No saved measurements.</em>';
      if (order.creatorMeasurements) {
        const m = order.creatorMeasurements;
        measurementsHtml = `
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; background:#f4f4f5; padding:8px; border-radius:4px; margin-top:4px;">
            Chest: ${m.chest || '-'} | Waist: ${m.waist || '-'} | Hips: ${m.hips || '-'} | Height: ${m.height || '-'} | Shldr: ${m.shoulder || '-'} | Sleeve: ${m.sleeve || '-'} | Inseam: ${m.inseam || '-'} | Neck: ${m.neck || '-'} | Thigh: ${m.thigh || '-'} | Bicep: ${m.bicep || '-'} | Wrist: ${m.wrist || '-'} | Length: ${m.length || '-'} (inches)
          </div>
        `;
      }

      const orderStatus = order.paymentStatus || 'unpaid';

      return `
        <div class="order-item">
          <div class="order-id-row">
            <span class="order-id">BATCH ID: ${order.id}</span>
            <span class="order-status-badge status-${orderStatus}">${orderStatus.toUpperCase()}</span>
          </div>
          <div class="order-meta">
            <span>Total Items: ${totalItems} / 4</span>
            <span>Total Paid: $${(order.amountPaid || 0).toFixed(2)}</span>
          </div>
          <div class="order-details-expanded" style="font-size: 0.8rem;">
            <div class="order-party" style="margin-bottom: 8px;">
              <strong>Creator Profile:</strong> @${order.creatorUsername || 'Guest'}
              ${measurementsHtml}
              <strong style="margin-top:6px; display:block;">Creator Items:</strong>
              <ul>
                ${order.creatorItems ? order.creatorItems.map(item => `<li>${item.quantity}x ${item.name} (Manufacturer Size: <strong>${item.size}</strong> - Color: ${item.color || 'Standard'}) - Supplier: ${item.supplier || 'Unknown'} - Bulk: $${item.bulkPrice}</li>`).join('') : '<li>No items</li>'}
              </ul>
            </div>
            ${order.friendItems && order.friendItems.length > 0 ? `
              <div class="order-party">
                <strong>Friend:</strong> ${order.friendUsername || 'Guest (Friend)'}
                <strong style="margin-top:6px; display:block;">Friend Items:</strong>
                <ul>
                  ${order.friendItems.map(item => `<li>${item.quantity}x ${item.name} (Manufacturer Size: <strong>${item.size}</strong> - Color: ${item.color || 'Standard'}) - Supplier: ${item.supplier || 'Unknown'} - Bulk: $${item.bulkPrice}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error("Error loading orders:", err);
    ordersContainer.innerHTML = `<div class="error-msg" style="color:red; font-size:0.8rem; text-align:center; padding:10px;">Failed to load orders from server: ${err.message}</div>`;
  }
}

// AI Size Chart Scanner Event Bindings
const scannerFile = document.getElementById('scanner-file');
const scannerStatus = document.getElementById('scanner-status');

if (scannerFile) {
  scannerFile.addEventListener('change', () => {
    const file = scannerFile.files[0];
    if (!file) return;

    if (scannerStatus) scannerStatus.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const mimeType = file.type;

      try {
        const res = await fetch('/api/parse-size-chart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: dataUrl, mimeType: mimeType })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to scan size chart.");
        }

        const data = await res.json();
        
        if (data.sizes && data.sizeChart && data.poms) {
          // 1. Update columns inputs text box
          if (prodPomsInput) {
            prodPomsInput.value = data.poms.join(', ');
          }

          // 2. Check matching checkboxes
          sizesCheckboxes.forEach(cb => {
            cb.checked = data.sizes.includes(cb.value);
          });

          // 3. Render size chart inputs grid
          updateSizeChartInputs();

          // 4. Populate dimensions in inputs
          document.querySelectorAll('.size-chart-val').forEach(input => {
            const sz = input.getAttribute('data-size');
            const field = input.getAttribute('data-field');
            if (data.sizeChart[sz] && data.sizeChart[sz][field] !== undefined) {
              input.value = data.sizeChart[sz][field];
            }
          });

          alert("🤖 AI Size Chart Scanner: Dynamic columns and measurements extracted successfully! Please review the populated values below.");
        } else {
          throw new Error("AI returned incomplete dynamic sizing data structure.");
        }

      } catch (err) {
        console.error("AI scanning error:", err);
        alert("AI Size Chart Scanner Error: " + err.message);
      } finally {
        if (scannerStatus) scannerStatus.classList.add('hidden');
        scannerFile.value = ''; // Reset scanner input
      }
    };
    reader.readAsDataURL(file);
  });
}

// Initial setup
async function setup() {
  updateSizeChartInputs();
  await loadCategories();
  await loadInventory();
  loadOrders();
}

setup();

setInterval(loadOrders, 5000);
