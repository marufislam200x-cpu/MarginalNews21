
/* =========================================
   MARGINAL NEWS
   NEWSLETTER SUBSCRIPTION API
========================================= */

const json = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
};


/* =========================================
   ADMIN AUTHENTICATION
========================================= */

function authorized(request, env) {
  const password = request.headers.get("x-admin-password");

  return Boolean(
    env.ADMIN_PASSWORD &&
    password &&
    password === env.ADMIN_PASSWORD
  );
}


/* =========================================
   CSV HELPERS
========================================= */

function csvEscape(value) {
  let text = String(value ?? "");

  // Prevent spreadsheet formula injection.
  if (/^[\s]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return '"' + text.replace(/"/g, '""') + '"';
}


/* =========================================
   MAIN API HANDLER
========================================= */

export async function onRequest({ request, env }) {

  if (!env.NEWS) {
    return json({
      error: "Cloudflare KV binding NEWS is missing."
    }, 500);
  }


  /* =====================================
     GET: EXPORT SUBSCRIBERS AS CSV
  ===================================== */

  if (request.method === "GET") {

    if (!authorized(request, env)) {
      return json({
        error: "Unauthorized. Admin access required."
      }, 401);
    }

    try {
      const subscribers = [];

      let cursor;

      do {
        const options = {
          prefix: "subscriber:",
          limit: 1000
        };

        if (cursor) {
          options.cursor = cursor;
        }

        const result = await env.NEWS.list(options);

        for (const key of result.keys) {

          const subscriber = await env.NEWS.get(
            key.name,
            "json"
          );

          if (subscriber) {
            subscribers.push(subscriber);
          }
        }

        cursor = result.list_complete
          ? undefined
          : result.cursor;

      } while (cursor);


      const rows = [
        ["Email", "Subscription Date"],

        ...subscribers.map(subscriber => [
          subscriber.email || "",
          subscriber.createdAt || ""
        ])
      ];

      const csv = rows
        .map(row => row.map(csvEscape).join(","))
        .join("\r\n");

      return new Response("\uFEFF" + csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="marginal-news-subscribers.csv"',
          "Cache-Control": "no-store"
        }
      });

    } catch (error) {

      return json({
        error: "Unable to export subscribers.",
        details: error.message
      }, 500);

    }
  }


  /* =====================================
     POST: NEW SUBSCRIPTION
  ===================================== */

  if (request.method === "POST") {

    try {
      const data = await request.json();

      const email = String(data.email || "")
        .trim()
        .toLowerCase();

      if (!email) {
        return json({
          error: "Email address is required."
        }, 400);
      }

      if (email.length > 254) {
        return json({
          error: "Email address is too long."
        }, 400);
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        return json({
          error: "Please enter a valid email address."
        }, 400);
      }


      /* CHECK DUPLICATE EMAIL */

      const id = encodeURIComponent(email);

      const key = "subscriber:" + id;

      const existing = await env.NEWS.get(key);

      if (existing) {
        return json({
          success: true,
          message: "You are already subscribed."
        });
      }


      /* SAVE SUBSCRIBER */

      const subscriber = {
        email,
        createdAt: new Date().toISOString()
      };

      await env.NEWS.put(
        key,
        JSON.stringify(subscriber)
      );

      return json({
        success: true,
        message: "Successfully subscribed to Marginal News."
      }, 201);

    } catch (error) {

      return json({
        error: "Unable to process subscription.",
        details: error.message
      }, 400);

    }
  }


  /* =====================================
     METHOD NOT ALLOWED
  ===================================== */

  return json({
    error: "Method not allowed."
  }, 405);

}
