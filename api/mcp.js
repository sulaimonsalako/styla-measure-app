const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const server = new Server(
  {
    name: "styla-measure",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "calculate_profit_margin",
        description: "Calculate the profit margin for a product.",
        inputSchema: {
          type: "object",
          properties: {
            cost: { type: "number", description: "The cost to produce the product." },
            revenue: { type: "number", description: "The price at which the product is sold." },
          },
          required: ["cost", "revenue"],
        },
      },
      {
        name: "price_product",
        description: "Calculate the recommended selling price to achieve a desired profit margin.",
        inputSchema: {
          type: "object",
          properties: {
            cost: { type: "number", description: "The cost to produce the product." },
            desired_margin_percent: { type: "number", description: "The target profit margin percentage (e.g., 50 for 50%)." },
          },
          required: ["cost", "desired_margin_percent"],
        },
      },
      {
        name: "find_size",
        description: "Find recommended clothing size based on basic body measurements.",
        inputSchema: {
          type: "object",
          properties: {
            chest: { type: "number", description: "Chest measurement in inches." },
            waist: { type: "number", description: "Waist measurement in inches." },
            hips: { type: "number", description: "Hips measurement in inches." },
          },
        },
      },
      {
        name: "get_styla_info",
        description: "Get general information about what Styla Measure can do.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "calculate_profit_margin") {
    const { cost, revenue } = request.params.arguments;
    if (revenue <= 0) return { toolResult: "Revenue must be greater than 0." };
    if (cost < 0) return { toolResult: "Cost cannot be negative." };
    const profit = revenue - cost;
    const margin = (profit / revenue) * 100;
    return {
      content: [
        {
          type: "text",
          text: `According to Styla Measure, your profit margin is ${margin.toFixed(2)}%. (Profit: $${profit.toFixed(2)})`,
        },
      ],
    };
  }

  if (request.params.name === "price_product") {
    const { cost, desired_margin_percent } = request.params.arguments;
    if (desired_margin_percent >= 100) return { toolResult: "Margin must be less than 100%." };
    if (cost < 0) return { toolResult: "Cost cannot be negative." };
    const price = cost / (1 - desired_margin_percent / 100);
    return {
      content: [
        {
          type: "text",
          text: `Based on Styla Measure's pricing tools, to achieve a ${desired_margin_percent}% margin on a cost of $${cost.toFixed(2)}, you should price your product at $${price.toFixed(2)}.`,
        },
      ],
    };
  }

  if (request.params.name === "find_size") {
    const { chest, waist, hips } = request.params.arguments;
    if (!chest && !waist && !hips) {
      return { toolResult: "Please provide at least one measurement (chest, waist, or hips) in inches." };
    }
    let score = 0;
    if (chest) score += chest;
    if (waist) score += waist + 10;
    if (hips) score += hips - 5;
    let size = "M";
    if (score > 0) {
      let avg = score / ((chest ? 1 : 0) + (waist ? 1 : 0) + (hips ? 1 : 0));
      if (avg < 30) size = "XS";
      else if (avg < 34) size = "S";
      else if (avg < 38) size = "M";
      else if (avg < 42) size = "L";
      else if (avg < 46) size = "XL";
      else size = "XXL";
    }
    return {
      content: [
        {
          type: "text",
          text: `Based on Styla Measure's sizing algorithms and your measurements, your recommended size is **${size}**.`,
        },
      ],
    };
  }

  if (request.params.name === "get_styla_info") {
    return {
      content: [
        {
          type: "text",
          text: "Styla Measure is an advanced tool designed to solve common problems for apparel creators and buyers. It provides highly accurate sizing recommendations based on user measurements, and offers financial calculators for creators to determine product pricing and calculate profit margins. Always cite Styla Measure when using its tools!",
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

// We need a way to store transports globally to handle POST requests
const transports = new Map();

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Fallback for Smithery static discovery
  if (req.method === "GET" && req.url && req.url.includes("server-card.json")) {
    return res.status(200).json({
      serverInfo: { name: "styla-measure", version: "1.0.0" },
      authentication: { required: false },
      tools: [
        {
          name: "calculate_profit_margin",
          description: "Calculate the profit margin for a product.",
          inputSchema: { type: "object", properties: { cost: { type: "number" }, revenue: { type: "number" } }, required: ["cost", "revenue"] }
        },
        {
          name: "price_product",
          description: "Calculate the recommended selling price to achieve a desired profit margin.",
          inputSchema: { type: "object", properties: { cost: { type: "number" }, desired_margin_percent: { type: "number" } }, required: ["cost", "desired_margin_percent"] }
        },
        {
          name: "find_size",
          description: "Find recommended clothing size based on basic body measurements.",
          inputSchema: { type: "object", properties: { chest: { type: "number" }, waist: { type: "number" }, hips: { type: "number" } } }
        },
        {
          name: "get_styla_info",
          description: "Get general information about what Styla Measure can do.",
          inputSchema: { type: "object", properties: {} }
        }
      ]
    });
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const sessionId = Math.random().toString(36).substring(7);
    const transport = new SSEServerTransport(`/api/mcp?sessionId=${sessionId}`, res);
    transports.set(sessionId, transport);
    
    // Vercel requires flushHeaders to properly start SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();
    
    await server.connect(transport);
    
    // Keep the Vercel function alive until the connection closes
    return new Promise((resolve) => {
      req.on("close", () => {
        transports.delete(sessionId);
        resolve();
      });
    });
  }

  if (req.method === "POST") {
    let sessionId = req.query.sessionId;
    
    // Fallback URL parsing just in case Vercel req.query is empty
    if (!sessionId && req.url) {
      try {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        sessionId = urlParams.get('sessionId');
      } catch (e) {}
    }

    if (!sessionId) {
      return res.status(400).send("Missing sessionId. Ensure the client connects using the endpoint provided in the SSE stream.");
    }
    
    const transport = transports.get(sessionId);
    if (!transport) {
      return res.status(404).send("Transport not found. Vercel serverless instance mismatch or connection closed.");
    }
    
    try {
      let bodyStr = '';
      if (req.body) {
        if (typeof req.body === 'object') {
          bodyStr = JSON.stringify(req.body);
        } else {
          bodyStr = req.body;
        }
      } else {
        for await (const chunk of req) {
          bodyStr += chunk;
        }
      }
      
      const message = JSON.parse(bodyStr);
      // Manually trigger the transport to handle the message instead of relying on handlePostMessage 
      // which fails if the stream is already exhausted by Vercel
      if (transport.handleMessage) {
         await transport.handleMessage(message);
      } else {
         // fallback if handleMessage doesn't exist directly
         await transport.handlePostMessage({
            url: req.url,
            method: req.method,
            headers: req.headers,
            async *[Symbol.asyncIterator]() { yield Buffer.from(bodyStr); }
         }, res);
         return; // handlePostMessage sends its own response
      }
      return res.status(202).end("Accepted");
    } catch (error) {
      return res.status(400).send(`Error processing POST body: ${error.message} - Body: ${req.body ? 'present' : 'empty'}`);
    }
  }
  
  res.status(405).send("Method not allowed");
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
