import { NextModelProvider } from '@next-model/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ensureBoot } from './db.js';

ensureBoot().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <NextModelProvider>
        <App />
      </NextModelProvider>
    </StrictMode>,
  );
});
