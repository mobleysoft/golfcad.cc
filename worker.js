// golfcad-cc-feedback-worker
//
// Real user feedback capture for golfcad.cc's three live client-side
// calculators (tempo, smash factor, spin loft). Built 2026-09-20 as the
// direct answer to the venture's own honest next_step (last set 2026-09-19):
// the client-computable-drill pattern is near its natural ceiling, and the
// real next step past a fourth calculator is either pose estimation
// (blocked - no capability wired) or real user feedback on the three
// drills already live. This is the feedback path.
//
// Deployed as its own dedicated Worker (not folded into mobley-venture-fleet-a
// or mascom-edge) on a route more specific than golfcad.cc's existing
// catch-all (golfcad.cc/api/feedback* beats golfcad.cc/*), so it adds a real
// capability without touching either shared multi-venture Worker file.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const VALID_CALCULATORS = new Set(["tempo", "smash_factor", "spin_loft"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === "/api/feedback" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }

      const calculator = String(body.calculator || "").trim();
      const helpful = body.helpful;
      const comment = String(body.comment || "").trim().slice(0, 1000);

      if (!VALID_CALCULATORS.has(calculator)) {
        return json(
          { error: `calculator must be one of: ${[...VALID_CALCULATORS].join(", ")}` },
          400
        );
      }
      if (typeof helpful !== "boolean") {
        return json({ error: "helpful must be a boolean" }, 400);
      }

      const id = crypto.randomUUID();
      await env.FEEDBACK_DB.prepare(
        `INSERT INTO feedback (id, calculator, helpful, comment, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
        .bind(id, calculator, helpful ? 1 : 0, comment || null)
        .run();

      return json({ ok: true, id }, 201);
    }

    if (url.pathname === "/api/feedback/stats" && request.method === "GET") {
      const rows = await env.FEEDBACK_DB.prepare(
        `SELECT calculator,
                COUNT(*) as total,
                SUM(helpful) as helpful_count
         FROM feedback
         GROUP BY calculator`
      ).all();
      return json({ ok: true, stats: rows.results });
    }

    return json({ error: "not found" }, 404);
  },
};
