import React from 'react';
import { Card, Grid, TextContainer, Text, Banner, List } from '@shopify/polaris';

export default function Dashboard() {
  return (
    <div style={{ padding: '16px 0' }}>
      <Banner title="STYLA Fit Engine is Active" status="success">
        <p>The storefront size recommendation widget is currently active on your product detail pages.</p>
      </Banner>

      <div style={{ marginTop: '20px' }}>
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 4 }}>
            <Card title="Return Rate Change" sectioned>
              <TextContainer spacing="tight">
                <Text variant="heading2xl" as="h3">-4.2%</Text>
                <Text color="subdued">Compared to 30d prior to STYLA installation</Text>
              </TextContainer>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 4 }}>
            <Card title="Active Size Matches" sectioned>
              <TextContainer spacing="tight">
                <Text variant="heading2xl" as="h3">14,821</Text>
                <Text color="subdued">Successful recommendations generated</Text>
              </TextContainer>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 4 }}>
            <Card title="Protected Revenue" sectioned>
              <TextContainer spacing="tight">
                <Text variant="heading2xl" as="h3">$84,320 CAD</Text>
                <Text color="subdued">Saved from sizing returns</Text>
              </TextContainer>
            </Card>
          </Grid.Cell>
        </Grid>
      </div>

      <div style={{ marginTop: '20px' }}>
        <Card title="Quick Start Integration Steps" sectioned>
          <TextContainer>
            <p>Complete these steps to unlock full accuracy for your shoppers:</p>
            <List type="number">
              <List.Item>Go to the <strong>Product Size Mapping</strong> tab and verify your points of measurement (POMs).</List.Item>
              <List.Item>Customize the widget styling rules (button colors, fonts) to align with your shop theme.</List.Item>
              <List.Item>Link your sizing tables to the Shopify online storefront using Theme App Extensions.</List.Item>
            </List>
          </TextContainer>
        </Card>
      </div>
    </div>
  );
}
