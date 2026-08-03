import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from '@shopify/app-bridge-react';
import App from './App.jsx';
import '@shopify/polaris/build/esm/styles.css';

// App Bridge needs the app key + the `host` param Shopify passes when it opens the
// embedded app. Wrapping App in <Provider> is what makes useAppBridge() work.
const params = new URLSearchParams(window.location.search);
const host = params.get('host') || '';
const config = { apiKey: 'ae97233671ed9354af95498cd5c7fc62', host, forceRedirect: true };

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider config={config}>
      <App />
    </Provider>
  </React.StrictMode>
);
