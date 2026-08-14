import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // শুধুমাত্র /sse পাথে কাজ করবে
    if (url.pathname !== "/sse") {
      return new Response("✅ MCP Server ready. Connect to /sse", { status: 200 });
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = new McpServer({
      name: "github-mcp",
      version: "1.0.0",
    });

    // ১. ফাইল পড়ার টুল
    server.tool(
      "read_file",
      "গিটহাব রেপো থেকে ফাইল পড়ুন",
      { path: z.string().describe("ফাইলের পাথ (যেমন: src/index.js") },
      async ({ path }) => {
        const token = env.GITHUB_TOKEN;
        const repo = "n8nworkflowmake-gif/github-mcp-worker"; // ★ এখানে পরিবর্তন করুন ★
        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    // ২. ফাইল লেখা/এডিট করার টুল
    server.tool(
      "write_file",
      "গিটহাব রেপোতে ফাইল তৈরি বা আপডেট করুন",
      { path: z.string(), content: z.string(), message: z.string() },
      async ({ path, content, message }) => {
        const token = env.GITHUB_TOKEN;
        const repo = "n8nworkflowmake-gif/github-mcp-worker"; // ★ এখানে পরিবর্তন করুন ★
        
        // আগে থেকে SHA বের করে নিন (আপডেটের জন্য)
        let sha = null;
        try {
          const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const checkData = await checkRes.json();
          if (checkData.sha) sha = checkData.sha;
        } catch (e) {}

        const body = {
          message: message,
          content: btoa(content), // base64 এ কনভার্ট
          sha: sha,
        };

        await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        return {
          content: [{ type: "text", text: `✅ ${path} সফলভাবে লেখা/আপডেট করা হয়েছে!` }],
        };
      }
    );

    // ৩. ফাইল ডিলিট করার টুল
    server.tool(
      "delete_file",
      "গিটহাব রেপো থেকে ফাইল ডিলিট করুন",
      { path: z.string(), message: z.string() },
      async ({ path, message }) => {
        const token = env.GITHUB_TOKEN;
        const repo = "n8nworkflowmake-gif/github-mcp-worker"; // ★ এখানে পরিবর্তন করুন ★

        // SHA বের করুন
        const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await checkRes.json();
        if (!data.sha) throw new Error("ফাইলটি খুঁজে পাওয়া যায়নি!");

        await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: message, sha: data.sha }),
        });

        return {
          content: [{ type: "text", text: `🗑️ ${path} সফলভাবে ডিলিট করা হয়েছে!` }],
        };
      }
    );

    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
