import React from 'react';
import { createRoot } from 'react-dom/client';
import Modal from 'react-modal';
import { BrowserRouter } from 'react-router-dom';

import DegreePlannerPage from './DegreePlannerPage';

import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Could not find root element');
Modal.setAppElement(container);

createRoot(container).render(
  <BrowserRouter>
    <DegreePlannerPage />
  </BrowserRouter>,
);
