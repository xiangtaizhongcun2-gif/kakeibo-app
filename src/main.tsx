import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './pwa';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('アプリのルート要素が見つかりません。');
createRoot(root).render(<StrictMode><App /></StrictMode>);
registerServiceWorker();
