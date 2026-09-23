// Mr Pizzeria - Swiggy/Zomato Mobile App Logic
(function () {
  'use strict';

  // ========== State ==========
  let cart = [];
  let activeFilter = 'all';
  let searchQuery = '';
  let activeCatId = 'all';
  let customizerItem = null;
  let customizerSelectedSize = null;

  // ========== DOM Refs ==========
  const appSearchInput = document.getElementById('appSearchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const filterPillsRow = document.getElementById('filterPillsRow');
  const offersSliderContainer = document.getElementById('offersSliderContainer');
  const circularCategoryScroll = document.getElementById('circularCategoryScroll');
  const menuFeedContainer = document.getElementById('menuFeedContainer');
  const servicesGrid = document.getElementById('servicesGrid');

  // Cart Pill
  const floatingBottomCartBar = document.getElementById('floatingBottomCartBar');
  const cartBarItemsCount = document.getElementById('cartBarItemsCount');
  const cartBarTotalPrice = document.getElementById('cartBarTotalPrice');
  const btnOpenCartSheet = document.getElementById('btnOpenCartSheet');

  // Cart Sheet
  const cartSheetOverlay = document.getElementById('cartSheetOverlay');
  const btnCloseCartSheet = document.getElementById('btnCloseCartSheet');
  const cartSheetCount = document.getElementById('cartSheetCount');
  const cartSheetItemsList = document.getElementById('cartSheetItemsList');
  const billItemTotal = document.getElementById('billItemTotal');
  const billGrandTotal = document.getElementById('billGrandTotal');
  const cartMinOrderAlert = document.getElementById('cartMinOrderAlert');
  const cartShortageValue = document.getElementById('cartShortageValue');
  const btnSendWhatsAppOrder = document.getElementById('btnSendWhatsAppOrder');

  // Customizer Sheet
  const customizerModalOverlay = document.getElementById('customizerModalOverlay');
  const customizerItemName = document.getElementById('customizerItemName');
  const customizerItemDesc = document.getElementById('customizerItemDesc');
  const customizerSizesContainer = document.getElementById('customizerSizesContainer');
  const btnConfirmCustomization = document.getElementById('btnConfirmCustomization');
  const customizerConfirmPrice = document.getElementById('customizerConfirmPrice');
  const btnCloseCustomizer = document.getElementById('btnCloseCustomizer');

  // Menu Jump Sheet
  const btnOpenMenuJump = document.getElementById('btnOpenMenuJump');
  const menuJumpOverlay = document.getElementById('menuJumpOverlay');
  const categoryJumpSheet = document.getElementById('categoryJumpSheet');
  const btnCloseMenuJump = document.getElementById('btnCloseMenuJump');
  const jumpListOptions = document.getElementById('jumpListOptions');
  const floatingMenuBtnWrap = document.getElementById('floatingMenuBtnWrap');

  // Toast
  const appToast = document.getElementById('appToast');
  const toastText = document.getElementById('toastText');
  const toastIcon = document.getElementById('toastIcon');

  // ========== Init ==========
  function init() {
    loadCart();
    renderOffersBanners();
    renderCircularCategories();
    renderJumpMenu();
    renderMenu();
    renderServices();
    bindEvents();
    updateCartBar();
  }

  // ========== Render Promo Banners ==========
  function renderOffersBanners() {
    offersSliderContainer.innerHTML = PROMO_BANNERS.map(banner => `
      <div class="offer-mini-card" style="background: ${banner.bgGradient};">
        <span class="offer-card-tag">${banner.tag}</span>
        <div>
          <div class="offer-card-title">${banner.title}</div>
          <div class="offer-card-sub">${banner.subtitle}</div>
        </div>
      </div>
    `).join('');
  }

  // ========== Render Circular Category Bubbles ==========
  function renderCircularCategories() {
    circularCategoryScroll.innerHTML = MENU_CATEGORIES.map(cat => `
      <div class="circular-cat-item ${activeCatId === cat.id ? 'active' : ''}" data-cat-id="${cat.id}">
        <div class="cat-circle-avatar">${cat.icon}</div>
        <span class="cat-circle-title">${cat.name}</span>
      </div>
    `).join('');
  }

  // ========== Render Jump Menu Options ==========
  function renderJumpMenu() {
    jumpListOptions.innerHTML = MENU_CATEGORIES.filter(c => c.id !== 'all').map(cat => {
      const count = MENU_ITEMS.filter(i => i.categoryId === cat.id).length;
      return `
        <div class="jump-option-item" data-jump-cat="${cat.id}">
          <span>${cat.icon} ${cat.name}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${count} items</span>
        </div>
      `;
    }).join('');
  }

  // ========== Render Shivhari Services ==========
  function renderServices() {
    servicesGrid.innerHTML = SHIVHARI_SERVICES.map(srv => `
      <div class="service-hub-tile ${srv.active ? 'active-now' : ''}">
        <span class="tile-code">Code ${srv.code}</span>
        <div class="tile-icon">${srv.icon}</div>
        <div class="tile-title">${srv.title}</div>
        <div class="tile-sub">${srv.subtitle}</div>
      </div>
    `).join('');
  }

  // ========== Filter Items ==========
  function getFilteredItems() {
    return MENU_ITEMS.filter(item => {
      if (activeCatId !== 'all' && item.categoryId !== activeCatId) return false;

      if (activeFilter === 'bestseller') {
        if (!item.tags || !item.tags.some(t => /bestseller|must try|chef special|popular/i.test(t))) return false;
      } else if (activeFilter === 'jain') {
        if (!item.isJain) return false;
      } else if (activeFilter === 'cheesy') {
        if (!item.tags || !item.tags.some(t => /cheese|cheesy/i.test(t))) {
          if (!/cheese/i.test(item.name) && !/cheese/i.test(item.desc)) return false;
        }
      } else if (activeFilter === 'spicy') {
        if (!item.tags || !item.tags.some(t => /spicy|spice|smoky|peri|chilli|fiery/i.test(t))) {
          if (!/tandoori|spicy|chilli/i.test(item.name)) return false;
        }
      } else if (activeFilter === 'budget') {
        const lowestPrice = item.hasSizes ? item.prices.small : item.price;
        if (lowestPrice > 100) return false;
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.desc && item.desc.toLowerCase().includes(q);
        const matchesTags = item.tags && item.tags.some(t => t.toLowerCase().includes(q));
        const matchesCat = item.categoryId.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTags && !matchesCat) return false;
      }

      return true;
    });
  }

  // ========== Render Menu Feed ==========
  function renderMenu() {
    const items = getFilteredItems();

    if (items.length === 0) {
      menuFeedContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍🍕</div>
          <h3 style="font-size: 1.1rem; color: var(--text-main);">No items found</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">Try a different search or reset your filter.</p>
          <button id="btnResetFilter" style="margin-top: 14px; background: var(--brand-primary); color: #fff; border: none; padding: 10px 22px; border-radius: 9999px; font-weight: 800; cursor: pointer; font-size: 0.88rem;">Show All Items</button>
        </div>
      `;
      document.getElementById('btnResetFilter')?.addEventListener('click', resetFilters);
      floatingMenuBtnWrap.style.display = 'none';
      return;
    }

    floatingMenuBtnWrap.style.display = 'flex';
    const categoriesInView = MENU_CATEGORIES.filter(cat => cat.id !== 'all' && items.some(i => i.categoryId === cat.id));

    let html = '';
    categoriesInView.forEach(cat => {
      const catItems = items.filter(i => i.categoryId === cat.id);
      html += `
        <div class="category-accordion-group" id="cat-section-${cat.id}">
          <div class="category-section-header">
            <h3 class="category-section-title">${cat.icon} ${cat.name}</h3>
            <span class="category-count-badge">${catItems.length}</span>
          </div>
          ${catItems.map(item => renderFoodItemRow(item)).join('')}
        </div>
      `;
    });
    menuFeedContainer.innerHTML = html;
  }

  // ========== Render a Single Swiggy-Style Food Row ==========
  function renderFoodItemRow(item) {
    const isBestseller = item.tags && item.tags.some(t => /bestseller/i.test(t));
    const isJain = item.isJain;
    const cartEntry = getCartEntry(item);
    const displayPrice = item.hasSizes ? `₹${item.prices.small} - ₹${item.prices.large}` : `₹${item.price}`;

    const addButtonHtml = cartEntry
      ? `<div class="swiggy-qty-stepper" data-stepper-id="${cartEntry.cartItemId}">
           <button class="stepper-btn" data-action="dec" data-cart-id="${cartEntry.cartItemId}">−</button>
           <span class="stepper-val">${cartEntry.qty}</span>
           <button class="stepper-btn" data-action="inc" data-cart-id="${cartEntry.cartItemId}">+</button>
         </div>`
      : `<button class="btn-swiggy-add" data-action="open-add" data-item-id="${item.id}">
           <span>+</span> ADD
         </button>`;

    const customisableNote = item.hasSizes ? `<span class="customisable-text">customisable</span>` : '';

    return `
      <div class="food-item-row" id="row-${item.id}">
        <div class="item-left-col">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <div class="veg-type-symbol ${isJain ? 'jain' : ''}">
              <div class="veg-type-circle"></div>
            </div>
            ${isBestseller ? `<span class="bestseller-tag-pill">⭐ Bestseller</span>` : ''}
          </div>

          <div class="item-name-heading">${item.name}</div>
          <div class="item-price-tag">
            ${displayPrice}
            ${item.hasSizes ? `<span class="item-size-badge">3 sizes</span>` : ''}
          </div>

          ${item.rating ? `
          <div class="item-rating-row">
            <span class="item-rating-star">★</span>
            <span>${item.rating}</span>
            <span class="item-votes-count">(${item.votes} ratings)</span>
          </div>` : ''}

          <p class="item-description-text">${item.desc}</p>
        </div>

        <div class="item-right-col">
          <div class="item-thumbnail-box">${item.icon}</div>
          <div class="swiggy-add-btn-wrap">
            ${addButtonHtml}
            ${customisableNote}
          </div>
        </div>
      </div>
    `;
  }

  // ========== Cart Helpers ==========
  function getCartEntry(item) {
    if (item.hasSizes) return null; // Multi-size items managed separately
    return cart.find(c => c.id === item.id && !c.size);
  }

  function getCartSubtotal() {
    return cart.reduce((s, c) => s + c.price * c.qty, 0);
  }

  function getTotalCount() {
    return cart.reduce((s, c) => s + c.qty, 0);
  }

  function addItemToCart(itemId, size) {
    const item = MENU_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    const price = item.hasSizes ? item.prices[size] : item.price;
    const cartItemId = size ? `${item.id}__${size}` : item.id;
    const existing = cart.find(c => c.cartItemId === cartItemId);

    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ cartItemId, id: item.id, name: item.name, icon: item.icon, size: size || null, price, qty: 1 });
    }

    saveCart();
    updateCartBar();
    renderMenu(); // Re-render to update stepper vs button
    showToast(`${item.icon} ${item.name} added to cart!`);
  }

  function changeQty(cartItemId, delta) {
    const idx = cart.findIndex(c => c.cartItemId === cartItemId);
    if (idx === -1) return;
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    saveCart();
    updateCartBar();
    renderMenu();
    renderCartSheetItems();
    updateBillSummary();
  }

  // ========== Cart Bar Update ==========
  function updateCartBar() {
    const count = getTotalCount();
    const total = getCartSubtotal();

    cartBarItemsCount.textContent = `${count} ${count === 1 ? 'ITEM' : 'ITEMS'}`;
    cartBarTotalPrice.textContent = `₹${total}`;
    cartSheetCount.textContent = count;

    if (count > 0) {
      floatingBottomCartBar.classList.add('visible');
    } else {
      floatingBottomCartBar.classList.remove('visible');
    }
  }

  // ========== Render Cart Sheet ==========
  function renderCartSheetItems() {
    if (cart.length === 0) {
      cartSheetItemsList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding: 1rem 0;">Your cart is empty. Add items from the menu!</p>`;
      return;
    }

    cartSheetItemsList.innerHTML = cart.map(entry => `
      <div class="cart-item-line">
        <div class="cart-item-line-left">
          <div class="cart-item-line-title">${entry.icon} ${entry.name}</div>
          ${entry.size ? `<div class="cart-item-line-size">${entry.size.toUpperCase()}</div>` : ''}
          <div class="cart-item-line-price">₹${entry.price} × ${entry.qty} = ₹${entry.price * entry.qty}</div>
        </div>
        <div class="swiggy-qty-stepper" style="width:86px; flex-shrink:0;">
          <button class="stepper-btn" data-action="dec" data-cart-id="${entry.cartItemId}">−</button>
          <span class="stepper-val">${entry.qty}</span>
          <button class="stepper-btn" data-action="inc" data-cart-id="${entry.cartItemId}">+</button>
        </div>
      </div>
    `).join('');
  }

  function updateBillSummary() {
    const subtotal = getCartSubtotal();
    const count = getTotalCount();
    billItemTotal.textContent = `₹${subtotal}`;
    billGrandTotal.textContent = `₹${subtotal}`;
    cartSheetCount.textContent = count;

    if (subtotal < APP_CONFIG.minOrderAmount && count > 0) {
      cartMinOrderAlert.style.display = 'flex';
      cartShortageValue.textContent = `₹${APP_CONFIG.minOrderAmount - subtotal}`;
      btnSendWhatsAppOrder.disabled = true;
      btnSendWhatsAppOrder.style.opacity = '0.55';
    } else {
      cartMinOrderAlert.style.display = 'none';
      btnSendWhatsAppOrder.disabled = (count === 0);
      btnSendWhatsAppOrder.style.opacity = count === 0 ? '0.55' : '1';
    }
  }

  // ========== Open Customizer (Pizza Size Picker) ==========
  function openCustomizer(itemId) {
    const item = MENU_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    customizerItem = item;

    // Default to first existing cart entry size or medium
    const existingEntry = cart.find(c => c.id === item.id && c.size);
    customizerSelectedSize = (existingEntry && existingEntry.size) || item.defaultSize || 'medium';

    customizerItemName.textContent = item.name;
    customizerItemDesc.textContent = item.desc;

    const sizes = [
      { key: 'small', label: 'Small' },
      { key: 'medium', label: 'Medium' },
      { key: 'large', label: 'Large' }
    ];

    customizerSizesContainer.innerHTML = sizes.map(s => `
      <label class="size-option-label ${customizerSelectedSize === s.key ? 'selected' : ''}" data-size-key="${s.key}">
        <div class="size-radio-left">
          <div class="custom-radio-dot"></div>
          <span class="size-text-title">${s.label} (serves 1-${s.key === 'small' ? '2' : s.key === 'medium' ? '3' : '4'})</span>
        </div>
        <span class="size-price-right">₹${item.prices[s.key]}</span>
      </label>
    `).join('');

    customizerConfirmPrice.textContent = `₹${item.prices[customizerSelectedSize]}`;

    // Bind size radio events
    customizerSizesContainer.querySelectorAll('.size-option-label').forEach(lbl => {
      lbl.addEventListener('click', () => {
        customizerSelectedSize = lbl.dataset.sizeKey;
        customizerSizesContainer.querySelectorAll('.size-option-label').forEach(l => l.classList.remove('selected'));
        lbl.classList.add('selected');
        customizerConfirmPrice.textContent = `₹${customizerItem.prices[customizerSelectedSize]}`;
      });
    });

    customizerModalOverlay.classList.add('open');
  }

  function closeCustomizer() {
    customizerModalOverlay.classList.remove('open');
    customizerItem = null;
  }

  // ========== WhatsApp Order Submission ==========
  function submitOrder() {
    const name = document.getElementById('orderCustName').value.trim();
    const phone = document.getElementById('orderCustPhone').value.trim();
    const address = document.getElementById('orderCustAddress').value.trim();
    const notes = document.getElementById('orderCustNotes').value.trim();

    if (!name) { alert('कृपया अपना नाम दर्ज करें। / Please enter your name.'); return; }
    if (!phone) { alert('कृपया WhatsApp नंबर दर्ज करें। / Please enter your mobile number.'); return; }
    if (!address) { alert('कृपया अपना पता दर्ज करें। / Please enter your delivery address.'); return; }

    const subtotal = getCartSubtotal();
    if (subtotal < APP_CONFIG.minOrderAmount) {
      alert(`Minimum order is ₹${APP_CONFIG.minOrderAmount}. Add more items.`);
      return;
    }

    const itemLines = cart.map((c, i) => {
      const sizeStr = c.size ? ` (${c.size.charAt(0).toUpperCase() + c.size.slice(1)})` : '';
      return `${i + 1}. ${c.icon} *${c.name}${sizeStr}* × ${c.qty} = ₹${c.price * c.qty}`;
    }).join('\n');

    const message =
`🍕 *NEW ORDER – MR PIZZERIA*
*Shivhari Food Delivery, Bikramganj*
━━━━━━━━━━━━━━━━━━━━
👤 *Name:* ${name}
📞 *Phone:* ${phone}
📍 *Address:* ${address}
${notes ? `📝 *Note:* ${notes}\n` : ''}━━━━━━━━━━━━━━━━━━━━
📋 *ORDER ITEMS:*
${itemLines}
━━━━━━━━━━━━━━━━━━━━
💰 *Total Amount: ₹${subtotal}*
🛵 *Delivery: Bikramganj (25 min)*
━━━━━━━━━━━━━━━━━━━━
Please confirm my order & estimated time 🙏`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    cart = [];
    saveCart();
    updateCartBar();
    cartSheetOverlay.classList.remove('open');
    showToast('Order sent via WhatsApp! 🎉');
  }

  // ========== Toast ==========
  let toastTimer;
  function showToast(msg, icon = '🍕') {
    toastText.textContent = msg;
    toastIcon.textContent = icon;
    appToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => appToast.classList.remove('show'), 2500);
  }

  // ========== Reset Filters ==========
  function resetFilters() {
    activeFilter = 'all';
    activeCatId = 'all';
    searchQuery = '';
    appSearchInput.value = '';
    btnClearSearch.classList.remove('visible');
    document.querySelectorAll('.filter-chip-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-chip-btn[data-filter="all"]').classList.add('active');
    renderCircularCategories();
    renderMenu();
  }

  // ========== Local Storage ==========
  function saveCart() {
    try { localStorage.setItem('mrp_cart_v2', JSON.stringify(cart)); } catch (e) {}
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem('mrp_cart_v2');
      if (raw) cart = JSON.parse(raw);
    } catch (e) { cart = []; }
  }

  // ========== Bind Events ==========
  function bindEvents() {

    // Search
    appSearchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      btnClearSearch.classList.toggle('visible', searchQuery.length > 0);
      renderMenu();
    });
    btnClearSearch.addEventListener('click', () => {
      appSearchInput.value = '';
      searchQuery = '';
      btnClearSearch.classList.remove('visible');
      renderMenu();
    });

    // Quick Filter Chips
    filterPillsRow.addEventListener('click', e => {
      const chip = e.target.closest('.filter-chip-btn');
      if (!chip) return;
      activeFilter = chip.dataset.filter;
      document.querySelectorAll('.filter-chip-btn').forEach(b => b.classList.remove('active'));
      chip.classList.add('active');
      renderMenu();
    });

    // Circular Category Bubbles
    circularCategoryScroll.addEventListener('click', e => {
      const item = e.target.closest('.circular-cat-item');
      if (!item) return;
      activeCatId = item.dataset.catId;
      document.querySelectorAll('.circular-cat-item').forEach(c => c.classList.remove('active'));
      item.classList.add('active');
      renderMenu();
      // Scroll to first visible category block
      if (activeCatId !== 'all') {
        const target = document.getElementById(`cat-section-${activeCatId}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Menu Feed Item Interactions (Delegated)
    menuFeedContainer.addEventListener('click', e => {
      // Add button (non-customisable)
      const addBtn = e.target.closest('[data-action="open-add"]');
      if (addBtn) {
        const itemId = addBtn.dataset.itemId;
        const item = MENU_ITEMS.find(i => i.id === itemId);
        if (!item) return;
        if (item.hasSizes) {
          openCustomizer(itemId);
        } else {
          addItemToCart(itemId, null);
        }
        return;
      }

      // Quantity stepper in menu row
      const stepBtn = e.target.closest('[data-action="inc"], [data-action="dec"]');
      if (stepBtn) {
        const cartId = stepBtn.dataset.cartId;
        const delta = stepBtn.dataset.action === 'inc' ? 1 : -1;
        changeQty(cartId, delta);
        return;
      }
    });

    // Cart Sheet Quantity Stepper (Delegated on cart list)
    cartSheetItemsList.addEventListener('click', e => {
      const stepBtn = e.target.closest('[data-action="inc"], [data-action="dec"]');
      if (!stepBtn) return;
      const cartId = stepBtn.dataset.cartId;
      const delta = stepBtn.dataset.action === 'inc' ? 1 : -1;
      changeQty(cartId, delta);
    });

    // Open Cart Sheet
    btnOpenCartSheet.addEventListener('click', () => {
      renderCartSheetItems();
      updateBillSummary();
      cartSheetOverlay.classList.add('open');
    });

    // Close Cart Sheet (backdrop & button)
    btnCloseCartSheet.addEventListener('click', () => cartSheetOverlay.classList.remove('open'));
    cartSheetOverlay.addEventListener('click', e => {
      if (e.target === cartSheetOverlay) cartSheetOverlay.classList.remove('open');
    });

    // Confirm Add from Customizer
    btnConfirmCustomization.addEventListener('click', () => {
      if (!customizerItem || !customizerSelectedSize) return;
      addItemToCart(customizerItem.id, customizerSelectedSize);
      closeCustomizer();
    });

    // Close Customizer
    btnCloseCustomizer.addEventListener('click', closeCustomizer);
    customizerModalOverlay.addEventListener('click', e => {
      if (e.target === customizerModalOverlay) closeCustomizer();
    });

    // Menu Jump Sheet
    btnOpenMenuJump.addEventListener('click', () => {
      menuJumpOverlay.classList.add('open');
      categoryJumpSheet.classList.add('open');
    });
    btnCloseMenuJump.addEventListener('click', () => {
      menuJumpOverlay.classList.remove('open');
      categoryJumpSheet.classList.remove('open');
    });
    menuJumpOverlay.addEventListener('click', e => {
      if (e.target === menuJumpOverlay) {
        menuJumpOverlay.classList.remove('open');
        categoryJumpSheet.classList.remove('open');
      }
    });
    jumpListOptions.addEventListener('click', e => {
      const opt = e.target.closest('[data-jump-cat]');
      if (!opt) return;
      const catId = opt.dataset.jumpCat;
      activeCatId = catId;
      document.querySelectorAll('.circular-cat-item').forEach(c => {
        c.classList.toggle('active', c.dataset.catId === catId);
      });
      renderMenu();
      menuJumpOverlay.classList.remove('open');
      categoryJumpSheet.classList.remove('open');
      setTimeout(() => {
        const target = document.getElementById(`cat-section-${catId}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    });

    // WhatsApp Submit
    btnSendWhatsAppOrder.addEventListener('click', submitOrder);
  }

  // ========== Boot ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
