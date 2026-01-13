import { createRoot } from 'react-dom/client';
import App from './App.js';
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './providers.js';

import './index.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Providers>
      <App />
    </Providers>
  </BrowserRouter>
);
