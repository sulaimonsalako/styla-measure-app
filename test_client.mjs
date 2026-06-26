import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function run() {
  console.log("Connecting to https://www.styla.ca/api/mcp...");
  const transport = new SSEClientTransport(new URL("https://www.styla.ca/api/mcp"));
  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    console.log("Connected successfully!");
    
    const tools = await client.listTools();
    console.log("Tools discovered:", tools.tools.map(t => t.name));
    
    process.exit(0);
  } catch (err) {
    console.error("Connection failed!");
    console.error(err);
    process.exit(1);
  }
}

run();
