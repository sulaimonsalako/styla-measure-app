import React, { useState } from 'react';
import { AppProvider, Page, Tabs, Card } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import Dashboard from './components/Dashboard';
import SizeChartMapper from './components/SizeChartMapper';
import Analytics from './components/Analytics';

export default function App() {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'dashboard', content: 'Dashboard', accessibilityLabel: 'Dashboard' },
    { id: 'size-charts', content: 'Product Size Mapping', accessibilityLabel: 'Product Size Mapping' },
    { id: 'analytics', content: 'Analytics', accessibilityLabel: 'Analytics' }
  ];

  const handleTabChange = (selectedTabIndex) => {
    setSelectedTab(selectedTabIndex);
  };

  return (
    <AppProvider i18n={enTranslations}>
      <Page title="STYLA Fit Engine" subtitle="Tailor-grade sizing simulation for Shopify" compactTitle>
        <div style={{ marginBottom: '20px' }}>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Card sectioned>
              {selectedTab === 0 && <Dashboard />}
              {selectedTab === 1 && <SizeChartMapper />}
              {selectedTab === 2 && <Analytics />}
            </Card>
          </Tabs>
        </div>
      </Page>
    </AppProvider>
  );
}
