// ============================================================
//  Mr Pizzeria — Admin Portal Logic (admin.js)
//  Real-time order board, PIN auth, audio chime, status sync
// ============================================================

(function () {
  'use strict';

  // --- State ---
  let enteredPin = '';
  let activeTab = 'new';
  let allOrders = {};
  let knownOrderIds = new Set();
  let isInitialLoad = true;

  // --- Audio Chime using Web Audio API (Zero dependencies) ---
  function playOrderNotificationChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(587.33, now, 0.25);       // D5
      playTone(880, now + 0.2, 0.45);     // A5
      playTone(1174.66, now + 0.4, 0.6);  // D6
    } catch (e) {
      console.warn("Audio chime could not be played:", e);
    }
  }

  // --- Elements ---
  const loginScreen = document.getElementById('loginScreen');
  const dashboard = document.getElementById('dashboard');
  const pinDots = [
    document.getElementById('dot0'),
    document.getElementById('dot1'),
    document.getElementById('dot2'),
    document.getElementById('dot3')
  ];
  const pinError = document.getElementById('pinError');
  const adminClock = document.getElementById('adminClock');
  const adminDate = document.getElementById('adminDate');
  const btnLogout = document.getElementById('btnLogout');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const btnSavePIN = document.getElementById('btnSavePIN');
  const newPinInput = document.getElementById('newPinInput');
  const fbStatusPill = document.getElementById('fbStatusPill');

  const btnAddManual = document.getElementById('btnAddManual');
  const manualOrderOverlay = document.getElementById('manualOrderOverlay');
  const btnCloseManual = document.getElementById('btnCloseManual');
  const btnSaveManual = document.getElementById('btnSaveManual');

  const ordersPanel = document.getElementById('ordersPanel');
  const newOrderToast = document.getElementById('newOrderToast');
  const toastOrderInfo = document.getElementById('toastOrderInfo');
  const btnCloseToast = document.getElementById('btnCloseToast');

  // Stats
  const statNew = document.getElementById('statNew');
  const statPrep = document.getElementById('statPrep');
  const statDone = document.getElementById('statDone');
  const statRevenue = document.getElementById('statRevenue');

  // Badges
  const badgeNew = document.getElementById('badgeNew');
  const badgePrep = document.getElementById('badgePrep');
  const badgeDone = document.getElementById('badgeDone');
  const badgeCancelled = document.getElementById('badgeCancelled');

  // ==================== AUTHENTICATION ====================
  function getStoredPIN() {
    return localStorage.getItem('mrp_admin_pin') || '1234';
  }

  function checkSession() {
    if (sessionStorage.getItem('mrp_admin_auth') === 'true') {
      showDashboard();
    }
  }

  function updatePinDots() {
    pinDots.forEach((dot, index) => {
      dot.classList.toggle('filled', index < enteredPin.length);
    });
  }

  function handlePinInput(val) {
    pinError.classList.remove('show');
    if (val === 'clear') {
      enteredPin = '';
      updatePinDots();
      return;
    }

    if (val === 'enter') {
      verifyPIN();
      return;
    }

    if (enteredPin.length < 4) {
      enteredPin += val;
      updatePinDots();
      if (enteredPin.length === 4) {
        setTimeout(verifyPIN, 150);
      }
    }
  }

  function verifyPIN() {
    const correctPin = getStoredPIN();
    if (enteredPin === correctPin) {
      sessionStorage.setItem('mrp_admin_auth', 'true');
      showDashboard();
    } else {
      pinError.classList.add('show');
      enteredPin = '';
      updatePinDots();
    }
  }

  function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'flex';
    initClock();
    initDBListener();
    testFirebaseConnection();
  }

  function logout() {
    sessionStorage.removeItem('mrp_admin_auth');
    dashboard.style.display = 'none';
    loginScreen.style.display = 'flex';
    enteredPin = '';
    updatePinDots();
    pinError.classList.remove('show');
  }

  // ==================== CLOCK & DATE ====================
  function initClock() {
    const update = () => {
      const now = new Date();
      adminClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      adminDate.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    };
    update();
    setInterval(update, 1000);
  }

  // ==================== FIREBASE REALTIME LISTENER ====================
  function initDBListener() {
    MrPizzaDB.listenToOrders(orders => {
      handleOrdersUpdate(orders);
    });
  }

  async function testFirebaseConnection() {
    const isOk = await MrPizzaDB.checkConnection();
    if (fbStatusPill) {
      fbStatusPill.textContent = isOk ? '🟢 Connected (Live RTDB)' : '🟠 Local Mode (Offline Storage)';
      fbStatusPill.style.background = isOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)';
      fbStatusPill.style.color = isOk ? '#34d399' : '#fbbf24';
    }
  }

  function handleOrdersUpdate(orders) {
    if (!orders || typeof orders !== 'object') return;
    allOrders = orders;

    // Detect new orders for chime and toast
    let hasNewArrival = false;
    let newestOrder = null;

    Object.values(orders).forEach(order => {
      if (order && order.id) {
        if (!knownOrderIds.has(order.id)) {
          knownOrderIds.add(order.id);
          if (!isInitialLoad && order.status === 'new') {
            hasNewArrival = true;
            newestOrder = order;
          }
        }
      }
    });

    if (hasNewArrival && newestOrder) {
      playOrderNotificationChime();
      showNewOrderToast(newestOrder);
    }

    isInitialLoad = false;
    updateStatsAndBadges();
    renderOrders();
  }

  function showNewOrderToast(order) {
    const custName = order.customer ? order.customer.name : 'Customer';
    const amount = order.totalAmount || order.subtotal || 0;
    toastOrderInfo.textContent = `${custName} ordered items worth ₹${amount}`;
    newOrderToast.classList.add('show');
    setTimeout(() => {
      newOrderToast.classList.remove('show');
    }, 6000);
  }

  // ==================== STATS & COUNTERS ====================
  function updateStatsAndBadges() {
    let countNew = 0;
    let countPrep = 0;
    let countDone = 0;
    let countCancelled = 0;
    let todayRevenue = 0;

    const todayStr = new Date().toDateString();

    Object.values(allOrders).forEach(order => {
      if (!order) return;
      const status = (order.status || 'new').toLowerCase();
      const amount = Number(order.totalAmount || order.subtotal || 0);

      if (status === 'new') countNew++;
      else if (status === 'preparing') countPrep++;
      else if (status === 'delivered') countDone++;
      else if (status === 'cancelled') countCancelled++;

      // Revenue for delivered or today's active orders
      const orderDate = order.createdAt ? new Date(order.createdAt).toDateString() : todayStr;
      if (orderDate === todayStr && status !== 'cancelled') {
        todayRevenue += amount;
      }
    });

    statNew.textContent = countNew;
    statPrep.textContent = countPrep;
    statDone.textContent = countDone;
    statRevenue.textContent = `₹${todayRevenue}`;

    badgeNew.textContent = countNew;
    badgePrep.textContent = countPrep;
    badgeDone.textContent = countDone;
    badgeCancelled.textContent = countCancelled;
  }

  // ==================== RENDER ORDERS ====================
  function renderOrders() {
    const ordersList = Object.values(allOrders).filter(order => {
      if (!order) return false;
      const status = (order.status || 'new').toLowerCase();
      return status === activeTab;
    });

    // Sort newest first
    ordersList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (ordersList.length === 0) {
      const tabLabels = {
        new: 'No new orders right now.',
        preparing: 'No orders are being prepared.',
        delivered: 'No delivered orders in this list.',
        cancelled: 'No cancelled orders.'
      };
      ordersPanel.innerHTML = `
        <div class="empty-orders">
          <div class="empty-icon">🍽️</div>
          <p>${tabLabels[activeTab] || 'No orders found.'}</p>
        </div>
      `;
      return;
    }

    ordersPanel.innerHTML = ordersList.map(order => createOrderCardHtml(order)).join('');
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function createOrderCardHtml(order) {
    const cust = order.customer || {};
    const items = order.items || [];
    const status = (order.status || 'new').toLowerCase();
    const timeAgo = formatTimeAgo(order.timestamp);
    const total = order.totalAmount || order.subtotal || 0;

    const itemsHtml = items.map(it => `
      <div class="order-item-line">
        <span class="order-item-desc">
          ${it.icon || '🍕'} <strong>${escapeHtml(it.name)}</strong>
          ${it.size ? `<small style="color:var(--text-muted);">(${escapeHtml(it.size)})</small>` : ''}
          × ${it.qty}
        </span>
        <span class="order-item-price">₹${it.price * it.qty}</span>
      </div>
    `).join('');

    // Actions based on status
    let actionButtons = '';
    if (status === 'new') {
      actionButtons = `
        <button class="btn-card-action btn-prep" data-action="set-status" data-id="${order.id}" data-status="preparing">
          👨‍🍳 Start Preparing
        </button>
        <button class="btn-card-action btn-cancel" data-action="set-status" data-id="${order.id}" data-status="cancelled">
          ✕ Cancel
        </button>
      `;
    } else if (status === 'preparing') {
      actionButtons = `
        <button class="btn-card-action btn-done btn-full-width" data-action="set-status" data-id="${order.id}" data-status="delivered">
          ✅ Mark as Delivered
        </button>
      `;
    }

    // Direct WhatsApp message link to customer
    const rawPhone = (cust.phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const waText = encodeURIComponent(
      `Hello ${cust.name || 'Customer'}, this is Mr Pizzeria Bikramganj regarding your order #${order.id}. ` +
      `Status: ${status.toUpperCase()}! Total: ₹${total}. Thank you!`
    );
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waText}` : '#';

    return `
      <div class="order-card" id="card-${order.id}">
        <div class="order-header-row">
          <div>
            <div class="order-id-badge">🍕 #${escapeHtml(order.id)}</div>
            <div class="order-time-ago">${timeAgo}</div>
          </div>
          <span class="status-pill status-${status}">${status}</span>
        </div>

        <div class="order-cust-info">
          <div class="cust-name-phone">
            <span>👤 ${escapeHtml(cust.name || 'Anonymous')}</span>
            ${cust.phone ? `<a href="tel:${escapeHtml(cust.phone)}" class="cust-phone-link">📞 ${escapeHtml(cust.phone)}</a>` : ''}
          </div>
          <div class="cust-address">📍 ${escapeHtml(cust.address || 'Address not provided')}</div>
          ${cust.notes ? `<div class="cust-note">📝 ${escapeHtml(cust.notes)}</div>` : ''}
        </div>

        <div class="order-items-box">
          ${itemsHtml}
        </div>

        <div class="order-total-bar">
          <span>Total Amount</span>
          <span>₹${total}</span>
        </div>

        <div class="order-actions">
          ${actionButtons}
          ${cleanPhone ? `
            <a href="${waLink}" target="_blank" class="btn-card-action btn-wa-card ${status !== 'new' && status !== 'preparing' ? 'btn-full-width' : ''}">
              💬 WhatsApp Customer
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==================== MANUAL ORDER CREATION ====================
  async function handleAddManualOrder() {
    const name = document.getElementById('manualName').value.trim();
    const phone = document.getElementById('manualPhone').value.trim();
    const address = document.getElementById('manualAddress').value.trim();
    const itemsText = document.getElementById('manualItems').value.trim();
    const total = Number(document.getElementById('manualTotal').value.trim());
    const notes = document.getElementById('manualNotes').value.trim();

    if (!name || !phone || !address || !total) {
      alert('Please fill in Customer Name, Phone, Address, and Total Amount.');
      return;
    }

    const orderId = `MRP-${Date.now().toString().slice(-6)}`;
    const manualOrder = {
      id: orderId,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'new',
      customer: { name, phone, address, notes },
      items: [
        {
          name: itemsText || 'Manual Order Items',
          qty: 1,
          price: total,
          icon: '🍕'
        }
      ],
      subtotal: total,
      totalAmount: total,
      source: 'admin-manual'
    };

    btnSaveManual.textContent = 'Saving...';
    btnSaveManual.disabled = true;

    await MrPizzaDB.saveOrder(manualOrder);

    // Reset form & close modal
    document.getElementById('manualName').value = '';
    document.getElementById('manualPhone').value = '';
    document.getElementById('manualAddress').value = '';
    document.getElementById('manualItems').value = '';
    document.getElementById('manualTotal').value = '';
    document.getElementById('manualNotes').value = '';

    btnSaveManual.textContent = 'Add This Order';
    btnSaveManual.disabled = false;
    manualOrderOverlay.style.display = 'none';

    // Switch to 'new' tab
    switchTab('new');
  }

  // ==================== TAB SWITCHING ====================
  function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    renderOrders();
  }

  // ==================== EVENT BINDINGS ====================
  function bindEvents() {
    // Keypad clicks
    document.querySelectorAll('.key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        handlePinInput(btn.dataset.key);
      });
    });

    // Keyboard support for PIN
    window.addEventListener('keydown', e => {
      if (loginScreen.style.display !== 'none') {
        if (e.key >= '0' && e.key <= '9') {
          handlePinInput(e.key);
        } else if (e.key === 'Backspace') {
          handlePinInput('clear');
        } else if (e.key === 'Enter') {
          handlePinInput('enter');
        }
      }
    });

    // Logout
    btnLogout.addEventListener('click', logout);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Orders Panel Action Delegation
    ordersPanel.addEventListener('click', async e => {
      const btn = e.target.closest('[data-action="set-status"]');
      if (!btn) return;
      const orderId = btn.dataset.id;
      const newStatus = btn.dataset.status;

      btn.disabled = true;
      btn.textContent = 'Updating...';

      await MrPizzaDB.updateOrderStatus(orderId, newStatus);
    });

    // Manual Order Modal
    btnAddManual.addEventListener('click', () => {
      manualOrderOverlay.style.display = 'flex';
    });
    btnCloseManual.addEventListener('click', () => {
      manualOrderOverlay.style.display = 'none';
    });
    manualOrderOverlay.addEventListener('click', e => {
      if (e.target === manualOrderOverlay) manualOrderOverlay.style.display = 'none';
    });
    btnSaveManual.addEventListener('click', handleAddManualOrder);

    // Settings Modal
    btnOpenSettings.addEventListener('click', () => {
      settingsOverlay.style.display = 'flex';
      testFirebaseConnection();
    });
    btnCloseSettings.addEventListener('click', () => {
      settingsOverlay.style.display = 'none';
    });
    settingsOverlay.addEventListener('click', e => {
      if (e.target === settingsOverlay) settingsOverlay.style.display = 'none';
    });
    btnSavePIN.addEventListener('click', () => {
      const val = newPinInput.value.trim();
      if (/^\d{4}$/.test(val)) {
        localStorage.setItem('mrp_admin_pin', val);
        alert('Admin PIN updated successfully!');
        newPinInput.value = '';
        settingsOverlay.style.display = 'none';
      } else {
        alert('Please enter a 4-digit numeric PIN (e.g. 1234)');
      }
    });

    // Toast Close
    btnCloseToast.addEventListener('click', () => {
      newOrderToast.classList.remove('show');
    });
  }

  // ==================== INIT ====================
  function init() {
    bindEvents();
    checkSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
