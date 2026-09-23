// ============================================================
//  Mr Pizzeria — Firebase & Order Sync Configuration
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "mrpizza-30827.firebaseapp.com",
  databaseURL: "https://mrpizza-30827-default-rtdb.firebaseio.com",
  projectId: "mrpizza-30827",
  storageBucket: "mrpizza-30827.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

// Admin WhatsApp number for order notifications
const ADMIN_WHATSAPP = "918986187044";

// ============================================================
//  Unified Realtime Database Client (REST + SSE + LocalStorage)
//  Works out-of-the-box with Firebase RTDB test mode!
// ============================================================
const MrPizzaDB = {
  dbUrl: "https://mrpizza-30827-default-rtdb.firebaseio.com",
  storageKey: "mrp_admin_orders",

  // Check if Firebase RTDB is accessible
  async checkConnection() {
    try {
      const res = await fetch(`${this.dbUrl}/_ping.json`, { method: "PUT", body: JSON.stringify({ t: Date.now() }) });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // Save new order to Firebase RTDB and LocalStorage fallback
  async saveOrder(order) {
    // 1. Save to LocalStorage first
    this._saveToLocalStorage(order);

    // 2. Save to Firebase Realtime Database via REST API
    try {
      const res = await fetch(`${this.dbUrl}/orders/${order.id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order)
      });
      if (res.ok) {
        console.log("Order saved to Firebase RTDB successfully:", order.id);
        return true;
      }
    } catch (err) {
      console.warn("Firebase RTDB offline/error, order stored in LocalStorage:", err);
    }
    return false;
  },

  // Update order status (new -> preparing -> delivered -> cancelled)
  async updateOrderStatus(orderId, status) {
    // Update local storage
    const orders = this.getLocalOrders();
    if (orders[orderId]) {
      orders[orderId].status = status;
      orders[orderId].updatedAt = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(orders));
      window.dispatchEvent(new Event("mrp_orders_updated"));
    }

    // Update Firebase RTDB
    try {
      await fetch(`${this.dbUrl}/orders/${orderId}/status.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status)
      });
      await fetch(`${this.dbUrl}/orders/${orderId}/updatedAt.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(new Date().toISOString())
      });
      return true;
    } catch (e) {
      console.warn("Could not update status on Firebase:", e);
      return false;
    }
  },

  // Fetch all orders (merges Firebase and LocalStorage)
  async fetchAllOrders() {
    let remoteOrders = {};
    try {
      const res = await fetch(`${this.dbUrl}/orders.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") {
          remoteOrders = data;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch remote orders, using local storage:", e);
    }

    const localOrders = this.getLocalOrders();
    // Merge: remote takes precedence, but don't lose local orders
    const merged = { ...localOrders, ...remoteOrders };
    // Sync back merged to local storage
    localStorage.setItem(this.storageKey, JSON.stringify(merged));
    return merged;
  },

  // Get orders stored in browser
  getLocalOrders() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  },

  _saveToLocalStorage(order) {
    const orders = this.getLocalOrders();
    orders[order.id] = order;
    localStorage.setItem(this.storageKey, JSON.stringify(orders));
    window.dispatchEvent(new Event("mrp_orders_updated"));
  },

  // Real-time listener using EventSource (SSE) with fallback polling
  listenToOrders(callback) {
    let evtSource = null;
    let fallbackInterval = null;

    // Initial load
    this.fetchAllOrders().then(orders => callback(orders));

    // Try EventSource for real-time Firebase streaming
    try {
      evtSource = new EventSource(`${this.dbUrl}/orders.json`);
      evtSource.addEventListener("put", e => {
        try {
          this.fetchAllOrders().then(orders => callback(orders));
        } catch (err) {}
      });
      evtSource.addEventListener("patch", e => {
        try {
          this.fetchAllOrders().then(orders => callback(orders));
        } catch (err) {}
      });
      evtSource.onerror = () => {
        // If SSE fails, keep polling active
      };
    } catch (e) {
      console.warn("EventSource not supported or blocked, relying on polling");
    }

    // Polling every 7 seconds as guaranteed fallback
    fallbackInterval = setInterval(() => {
      this.fetchAllOrders().then(orders => callback(orders));
    }, 7000);

    // Also listen to local window events
    const localHandler = () => {
      callback(this.getLocalOrders());
    };
    window.addEventListener("mrp_orders_updated", localHandler);
    window.addEventListener("storage", localHandler);

    return () => {
      if (evtSource) evtSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
      window.removeEventListener("mrp_orders_updated", localHandler);
      window.removeEventListener("storage", localHandler);
    };
  }
};
