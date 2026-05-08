import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB6-AlnuEqFscAUkJy7YL1rvEh-cUJj0R0",
  authDomain: "gongha-bd3b6.firebaseapp.com",
  projectId: "gongha-bd3b6",
  storageBucket: "gongha-bd3b6.firebasestorage.app",
  messagingSenderId: "42104590065",
  appId: "1:42104590065:web:44fa970e3b9566017b2350"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 공유 데이터 키들 — 모든 회원이 같은 이 문서를 보게 됩니다
const SHARED_DOC_REF = doc(db, 'gongha', 'shared');

// Get shared data
export async function getShared(key) {
  try {
    const snap = await getDoc(SHARED_DOC_REF);
    if (snap.exists()) {
      const data = snap.data();
      return data[key] !== undefined ? data[key] : null;
    }
    return null;
  } catch (e) {
    console.error('Firebase getShared error:', e);
    return null;
  }
}

// Set shared data
export async function setShared(key, value) {
  try {
    await setDoc(SHARED_DOC_REF, { [key]: value }, { merge: true });
    return true;
  } catch (e) {
    console.error('Firebase setShared error:', e);
    return false;
  }
}

// Subscribe to live changes
export function subscribeShared(callback) {
  return onSnapshot(SHARED_DOC_REF, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    }
  }, (e) => {
    console.error('Firebase subscribe error:', e);
  });
}

export { db };