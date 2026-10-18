import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { bearerMatches } from "@/lib/mcp/auth";
import { buildMcpServer, mcpContext } from "@/lib/mcp/tools";
import { ownerUserId } from "@/lib/services/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Streamable HTTP MCP endpoint for Claude Code. Stateless: every request builds a fresh server,
 * which suits serverless hosting. Protected by a bearer token (MCP_TOKEN).
 */
async function handle(request: Request): Promise<Response> {
  if (!process.env.MCP_TOKEN) return json(503, { error: "MCP is not configured (set MCP_TOKEN)." });
  if (!bearerMatches(request.headers.get("authorization"), process.env.MCP_TOKEN)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } });
  }
  const userId = await ownerUserId();
  if (!userId) return json(500, { error: "owner user not found" });

  const server = buildMcpServer(await mcpContext(userId));
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // The response is fully built for JSON mode; release the per-request server.
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
