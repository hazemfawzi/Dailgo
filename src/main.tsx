import './styles/tokens.css';
import { InvitePage, SharedGoalPage, VerifyEmailPage } from './features/tools/PublicPages';
import './features/tools/tools.css';
import './features/journey/journey.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ServerWorkspace } from './features/account/ServerWorkspace';
import './styles/base.css';
import './styles/components.css';
import './features/home/home.css';
import './features/life/life.css';
import './features/planner/planner.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {location.pathname === '/invite' ? (
        <InvitePage />
      ) : location.pathname === '/verify-email' ? (
        <VerifyEmailPage />
      ) : location.pathname === '/share' ? (
        <SharedGoalPage />
      ) : (
        <ServerWorkspace>
          <App />
        </ServerWorkspace>
      )}
    </BrowserRouter>
  </React.StrictMode>,
);
import './styles/responsive.css';
import './features/review/review.css';
