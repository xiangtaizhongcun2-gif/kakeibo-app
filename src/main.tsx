import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initializeDatabase } from './data/initializeDatabase';
import { registerServiceWorker } from './pwa';
import './styles.css';
import './tab-colors.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('アプリのルート要素が見つかりません。');

const root = createRoot(rootElement);

async function startApplication(): Promise<void> {
  try {
    await initializeDatabase();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    root.render(
      <StrictMode>
        <main className="app-content">
          <section className="empty-panel" role="alert">
            <h1>データベースを開けませんでした</h1>
            <p>{message}</p>
          </section>
        </main>
      </StrictMode>,
    );
  }
}

void startApplication();
registerServiceWorker();
