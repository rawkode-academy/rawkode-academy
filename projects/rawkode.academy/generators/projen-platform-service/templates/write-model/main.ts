{% for workflow in workflows %}import type { {{ workflow.className }} } from "{{ workflow.scriptName }}";
{% endfor %}

export interface Env {
  DB: D1Database;
{% for workflow in workflows %}  {{ workflow.binding }}: Workflow<typeof {{ workflow.className }}>;
{% endfor %}}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Handle workflow creation endpoints
{% for workflow in workflows %}    if (url.pathname === "/{{ workflow.name }}/create" && request.method === "POST") {
      try {
        const data = await request.json();
        
        const instance = await env.{{ workflow.binding }}.create({
          id: crypto.randomUUID(),
          params: data,
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            workflowType: "{{ workflow.name }}",
            workflowId: instance.id,
            status: await instance.status(),
          }),
          {
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }
    
{% endfor %}    // Handle workflow status endpoints
{% for workflow in workflows %}    if (url.pathname.startsWith("/{{ workflow.name }}/status/") && request.method === "GET") {
      const workflowId = url.pathname.split("/")[3];
      
      try {
        const instance = await env.{{ workflow.binding }}.get(workflowId);
        const status = await instance.status();
        const result = await instance.result();
        
        return new Response(
          JSON.stringify({
            workflowType: "{{ workflow.name }}",
            workflowId,
            status,
            result,
          }),
          {
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Workflow not found" }),
          {
            status: 404,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }
    
{% endfor %}    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "healthy" }),
        {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
    
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          service: "{{ serviceName }}-write-model",
          endpoints: {
{% for workflow in workflows %}            "POST /{{ workflow.name }}/create": "Create a new {{ workflow.className }} workflow",
            "GET /{{ workflow.name }}/status/:workflowId": "Check {{ workflow.name }} workflow status",
{% endfor %}            "GET /health": "Health check",
          },
        }),
        {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
    
    return new Response("Method not allowed", { 
      status: 405,
      headers: corsHeaders,
    });
  },
};