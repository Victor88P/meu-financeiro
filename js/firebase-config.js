'use strict';
// Configuração do Firebase (Console do Firebase → Configurações do projeto → Seus apps).
// Esses dados não são senha: quem protege os seus dados é o login e as regras do Firestore.
// Com null (ou abrindo o index.html direto do arquivo), o app funciona só no navegador (modo local), sem login.
F.firebaseConfig = {
  apiKey: 'AIzaSyAYZok0t40EU-kUbA7w__ZMwFp1DaGdTHo',
  authDomain: 'meu-financeiro-dbd04.firebaseapp.com',
  projectId: 'meu-financeiro-dbd04',
  storageBucket: 'meu-financeiro-dbd04.firebasestorage.app',
  messagingSenderId: '168739062064',
  appId: '1:168739062064:web:d4bfc154f484ed887908f5',
};
