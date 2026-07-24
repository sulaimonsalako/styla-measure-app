import React from 'react';
import { Card, DataTable, Layout, TextContainer, Text, Banner } from '@shopify/polaris';

export default function Analytics() {
  const recentConversions = [
    ['#1082', 'June 20, 2026', 'Raw Denim Jeans', 'Size 30', 'Yes (94% confidence)'],
    ['#1081', 'June 19, 2026', 'Relaxed Fit Cotton Tee', 'Size M', 'Yes (90% confidence)'],
    ['#1080', 'June 19, 2026', 'Heavyweight Hoodie', 'Size L', 'Yes (88% confidence)'],
    ['#1079', 'June 18, 2026', 'Raw Denim Jeans', 'Size 32', 'Yes (95% confidence)']
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <Layout>
        <Layout.Section>
          <Banner title="Sizing Return Mitigation" status="info">
            <p>Your return rate due to sizing issues has dropped from <strong>8.4%</strong> to <strong>4.2%</strong> over the past 30 days.</p>
          </Banner>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card title="Funnel Analytics" sectioned>
            <TextContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text>Scan Onboarding Rate:</Text>
                <strong>78.4%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text>Size Selection Completion:</Text>
                <strong>92.1%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text>Add to Cart Conversion:</Text>
                <strong>14.5%</strong>
              </div>
            </TextContainer>
          </Card>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card title="Sizing Twin Demographics" sectioned>
            <TextContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text>High Fit Confidence Scans:</Text>
                <strong>86%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text>Medium Fit Confidence Scans:</Text>
                <strong>11%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text>Low Fit Confidence Scans:</Text>
                <strong>3%</strong>
              </div>
            </TextContainer>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Recent Orders with STYLA Size Recommendations" sectioned>
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text', 'text']}
              headings={['Order ID', 'Date', 'Product Purchased', 'Size Selected', 'Sized with STYLA']}
              rows={recentConversions}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </div>
  );
}
