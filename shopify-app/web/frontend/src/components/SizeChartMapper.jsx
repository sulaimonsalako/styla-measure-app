import React, { useState } from 'react';
import { Card, DataTable, Select, Button, FormLayout, Banner, InlineStack } from '@shopify/polaris';

export default function SizeChartMapper() {
  const [selectedProduct, setSelectedProduct] = useState('raw-denim-jeans');
  const [easeProfile, setEaseProfile] = useState('regular');
  const [stretchCategory, setStretchCategory] = useState('no-stretch');
  const [sizeData, setSizeData] = useState([
    ['28', '14.0', '18.5', '19.0', '10.0'],
    ['30', '15.0', '19.5', '20.2', '10.5'],
    ['32', '16.0', '20.5', '21.5', '11.0'],
    ['34', '17.0', '21.5', '22.8', '11.5']
  ]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const productOptions = [
    { label: 'Raw Denim Jeans', value: 'raw-denim-jeans' },
    { label: 'Relaxed Fit Cotton Tee', value: 'cotton-tee' },
    { label: 'Heavyweight Hoodie', value: 'heavyweight-hoodie' }
  ];

  const easeOptions = [
    { label: 'Slim Fit (+2.0" Chest)', value: 'slim' },
    { label: 'Regular Fit (+4.0" Chest)', value: 'regular' },
    { label: 'Oversized Fit (+8.0" to +12" Chest)', value: 'oversized' }
  ];

  const stretchOptions = [
    { label: 'No Stretch (Woven Cotton)', value: 'no-stretch' },
    { label: 'Slight Stretch (2% Elastane)', value: 'slight' },
    { label: 'Moderate Stretch (5% Elastane)', value: 'moderate' },
    { label: 'High Stretch (Athletic Knit)', value: 'high' }
  ];

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div style={{ padding: '16px 0' }}>
      {saveSuccess && (
        <div style={{ marginBottom: '20px' }}>
          <Banner title="Size Chart Saved" status="success">
            <p>The size chart and ease mappings for this item have been synced with the STYLA Fit Engine.</p>
          </Banner>
        </div>
      )}

      <div>
        <FormLayout>
          <InlineStack gap="500">
            <div style={{ flex: 1 }}>
              <Select
                label="Select Shopify Product"
                options={productOptions}
                value={selectedProduct}
                onChange={(val) => setSelectedProduct(val)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Select
                label="Design Ease Profile"
                options={easeOptions}
                value={easeProfile}
                onChange={(val) => setEaseProfile(val)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Select
                label="Fabric Stretch Compensation"
                options={stretchOptions}
                value={stretchCategory}
                onChange={(val) => setStretchCategory(val)}
              />
            </div>
          </InlineStack>

          <Card title="Garment Point of Measurement (POM) Grid" sectioned>
            <p style={{ marginBottom: '15px', color: '#71717a', fontSize: '13px' }}>
              Measurements represent finished flat garment dimensions. The Fit Engine doubles widths for chest, waist, and hips.
            </p>
            <DataTable
              columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric']}
              headings={['Size', 'Waist Width (Flat)', 'Hips Width (Flat)', 'Seat Width (Flat)', 'Thigh Width (Flat)']}
              rows={sizeData}
            />
          </Card>

          <Button primary onClick={handleSave}>Save size chart mapping</Button>
        </FormLayout>
      </div>
    </div>
  );
}
