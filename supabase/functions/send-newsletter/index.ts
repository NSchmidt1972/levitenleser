import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3";

type Payload = { storyId?: string | number };

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("FROM_EMAIL") ?? "Levitenleser <news@example.com>";
const siteUrl = Deno.env.get("SITE_URL") ?? "https://levitenleser.de";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!supabase) {
      return new Response("Supabase client not configured", { status: 500 });
    }

    const { storyId }: Payload = await req.json().catch(() => ({}));
    if (!storyId) {
      return new Response("storyId fehlt", { status: 400 });
    }

    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("id, title, excerpt, body, date, read_time")
      .eq("id", storyId)
      .single();

    if (storyError || !story) {
      console.error("Story not found", storyError);
      return new Response("Story nicht gefunden", { status: 404 });
    }

    const { data: subs, error: subsError } = await supabase.from("newsletter_signups").select("email");
    if (subsError) {
      console.error("Could not load subscribers", subsError);
      return new Response("Abonnenten-Fehler", { status: 500 });
    }

    const recipients = (subs || [])
      .map((s) => s.email?.trim().toLowerCase())
      .filter((email): email is string => !!email);

    if (!recipients.length) {
      return new Response("Keine Abonnenten", { status: 200 });
    }

    if (!resend) {
      console.warn("RESEND_API_KEY fehlt. Versand wird übersprungen.");
      return new Response("Kein Mail-Provider konfiguriert", { status: 200 });
    }

    const html = `
      <h1>${story.title}</h1>
      <p>${story.excerpt}</p>
      <p>${story.date} · ${story.read_time ?? "–"}</p>
      <p><a href="${siteUrl}#stories">Jetzt lesen</a></p>
    `;

    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: `Neu: ${story.title}`,
      html
    });

    if (sendError) {
      console.error("Send error", sendError);
      return new Response("Versand fehlgeschlagen", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
});
