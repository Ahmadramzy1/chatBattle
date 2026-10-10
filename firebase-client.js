// Chat Battle Firebase client. Public web-app configuration; no private keys.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getFirestore, doc, collection, setDoc, getDoc, getDocs,
  onSnapshot, query, orderBy, updateDoc, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyB94S3enruEUS7MHWE4ZHgfVPqlV4nRgOI',
  authDomain: 'chat-battle-b976d.firebaseapp.com',
  projectId: 'chat-battle-b976d',
  storageBucket: 'chat-battle-b976d.firebasestorage.app',
  messagingSenderId: '944995889142',
  appId: '1:944995889142:web:9566d408803e472c7a21d7'
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { doc, collection, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, updateDoc, runTransaction, serverTimestamp };

let authPromise;
export async function authReady(){
  if(!authPromise){
    authPromise = (async()=>{
      await auth.authStateReady();
      if(auth.currentUser)return auth.currentUser;
      const result = await signInAnonymously(auth);
      return result.user;
    })().catch(error=>{authPromise=null;throw error});
  }
  return authPromise;
}
export function firebaseError(error){
  const code=error?.code||'';
  if(code.includes('api-key-not-valid'))return 'کلید API پروژه Firebase معتبر نیست. کلید Web App را از Firebase Project settings → Your apps کپی و تنظیمات را به‌روزرسانی کن.';
  if(code.includes('operation-not-allowed'))return 'ورود ناشناس فعال نیست. در Firebase → Authentication → Sign-in method، Anonymous را فعال کن.';
  if(code.includes('permission-denied'))return 'اجازه دسترسی به Firestore صادر نشده. قوانین firestore.rules را در Firebase Console منتشر کن.';
  if(code.includes('unavailable'))return 'ارتباط با Firestore برقرار نشد؛ اینترنت و وضعیت Firebase را بررسی کن.';
  if(code.includes('failed-precondition'))return 'تنظیمات دیتابیس هنوز تکمیل نشده یا درخواست به پیش‌شرطی نیاز دارد.';
  return (error?.message||String(error)).slice(0,240);
}
