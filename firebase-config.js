import { initialMockItems } from './mock-data.js';

// We import Firebase modules. If they fail to load or are not configured,
// our adapter will gracefully fall back to localStorage.
let firebaseApp = null;
let firestoreDb = null;
let isFirebaseActive = false;

const CONFIG_KEY = 'univ_lost_found_firebase_config';
const LOCAL_ITEMS_KEY = 'univ_lost_found_local_items';

// Helpers for localStorage mock database
const getLocalItems = () => {
  const items = localStorage.getItem(LOCAL_ITEMS_KEY);
  if (!items) {
    localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(initialMockItems));
    return initialMockItems;
  }
  return JSON.parse(items);
};

const saveLocalItems = (items) => {
  localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(items));
};

export const dbService = {
  isFirebaseActive: () => isFirebaseActive,

  getSavedConfig: () => {
    // 1. Check environment variables first (Vite VITE_* environment variables)
    if (import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) {
      return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
    }
    // 2. Fall back to localStorage
    const config = localStorage.getItem(CONFIG_KEY);
    return config ? JSON.parse(config) : null;
  },

  saveConfig: async (config) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return await dbService.init();
  },

  clearConfig: () => {
    localStorage.removeItem(CONFIG_KEY);
    isFirebaseActive = false;
    firebaseApp = null;
    firestoreDb = null;
  },

  init: async () => {
    const config = dbService.getSavedConfig();
    if (!config || !config.apiKey || !config.projectId) {
      console.warn("Firebase is not configured. Running in Mock/Demo mode.");
      isFirebaseActive = false;
      return false;
    }

    try {
      // Dynamically import Firebase libraries so that if there are network issues
      // or config issues, we catch them cleanly.
      const { initializeApp } = await import('firebase/app');
      const { getFirestore } = await import('firebase/firestore');

      firebaseApp = initializeApp(config);
      firestoreDb = getFirestore(firebaseApp);
      isFirebaseActive = true;
      console.log("Firebase initialized successfully. Connected to Firestore.");
      return true;
    } catch (error) {
      console.error("Failed to initialize Firebase. Falling back to Mock/Demo mode.", error);
      isFirebaseActive = false;
      return false;
    }
  },

  getItems: async () => {
    if (isFirebaseActive && firestoreDb) {
      try {
        const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
        const itemsCol = collection(firestoreDb, 'items');
        const q = query(itemsCol, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const items = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });
        
        // If Firestore is empty, let's pre-seed it with mock data for a better initial experience!
        if (items.length === 0) {
          console.log("Firestore collection 'items' is empty. Seeding with initial mock data...");
          const { addDoc } = await import('firebase/firestore');
          for (const item of initialMockItems) {
            const { id, ...itemWithoutId } = item;
            await addDoc(itemsCol, itemWithoutId);
          }
          return await dbService.getItems(); // Recall to get items with Firestore IDs
        }
        return items;
      } catch (error) {
        console.error("Firestore read error, falling back to local mock data.", error);
        return getLocalItems();
      }
    } else {
      // Local Mock DB fallback: Sort by createdAt desc
      const items = getLocalItems();
      return [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  addItem: async (item) => {
    const newItem = {
      ...item,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    if (isFirebaseActive && firestoreDb) {
      try {
        const { collection, addDoc } = await import('firebase/firestore');
        const itemsCol = collection(firestoreDb, 'items');
        const docRef = await addDoc(itemsCol, newItem);
        return { id: docRef.id, ...newItem };
      } catch (error) {
        console.error("Firestore write error, writing to local mock data.", error);
        return writeToLocal(newItem);
      }
    } else {
      return writeToLocal(newItem);
    }
  },

  updateItemStatus: async (id, status) => {
    if (isFirebaseActive && firestoreDb) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const docRef = doc(firestoreDb, 'items', id);
        await updateDoc(docRef, { status: status });
        return true;
      } catch (error) {
        console.error("Firestore update error, updating local mock data.", error);
        return updateLocalStatus(id, status);
      }
    } else {
      return updateLocalStatus(id, status);
    }
  },

  getStats: async () => {
    const items = await dbService.getItems();
    const active = items.filter(item => item.status === 'active').length;
    const resolved = items.filter(item => item.status === 'resolved' || item.status === 'claimed').length;
    const lost = items.filter(item => item.type === 'lost').length;
    const found = items.filter(item => item.type === 'found').length;
    return { active, resolved, lost, found, total: items.length };
  }
};

// Local storage write helpers
function writeToLocal(newItem) {
  const items = getLocalItems();
  const itemWithId = {
    id: 'local-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    ...newItem
  };
  items.push(itemWithId);
  saveLocalItems(items);
  return itemWithId;
}

function updateLocalStatus(id, status) {
  const items = getLocalItems();
  const itemIndex = items.findIndex(item => item.id === id);
  if (itemIndex > -1) {
    items[itemIndex].status = status;
    saveLocalItems(items);
    return true;
  }
  return false;
}
