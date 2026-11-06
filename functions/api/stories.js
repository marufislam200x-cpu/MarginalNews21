
/* =========================================
   MARGINAL NEWS
   CLOUDFLARE PAGES FUNCTIONS
   NEWS API
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
   GET ALL NEWS FROM CLOUDFLARE KV
========================================= */

async function getAllStories(env) {
  const stories = [];

  let cursor;

  do {
    const options = {
      prefix: "story:",
      limit: 1000
    };

    if (cursor) {
      options.cursor = cursor;
    }

    const result = await env.NEWS.list(options);

    for (const key of result.keys) {
      const story = await env.NEWS.get(key.name, "json");

      if (story) {
        stories.push(story);
      }
    }

    cursor = result.list_complete
      ? undefined
      : result.cursor;

  } while (cursor);

  return stories;
}


/* =========================================
   GET PUBLIC STORIES
========================================= */

function getPublicStories(stories) {
  const now = Date.now();

  return stories
    .filter(story => {
      if (story.status !== "published") {
        return false;
      }

      if (story.publishAt) {
        const publishTime = new Date(
          story.publishAt
        ).getTime();

        if (!Number.isNaN(publishTime) && publishTime > now) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}


/* =========================================
   VALIDATE STORY
========================================= */

function validateStory(story) {
  if (!story || typeof story !== "object" || Array.isArray(story)) {
    return "Invalid story data.";
  }

  if (
    typeof story.title !== "string" ||
    !story.title.trim()
  ) {
    return "Headline is required.";
  }

  if (
    typeof story.summary !== "string" ||
    !story.summary.trim()
  ) {
    return "Summary is required.";
  }

  if (
    typeof story.body !== "string" ||
    !story.body.trim()
  ) {
    return "Full news content is required.";
  }

  if (
    story.status &&
    !["draft", "published"].includes(story.status)
  ) {
    return "Invalid story status.";
  }

  return null;
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

  const method = request.method;

  /* =====================================
     GET REQUEST
  ===================================== */

  if (method === "GET") {

    try {
      const allStories = await getAllStories(env);

      const url = new URL(request.url);

      const adminMode = url.searchParams.get("admin") === "1";

      /* ADMIN: RETURN ALL STORIES */

      if (adminMode) {

        if (!authorized(request, env)) {
          return json({
            error: "Unauthorized. Invalid admin password."
          }, 401);
        }

        allStories.sort(
          (a, b) => (b.ts || 0) - (a.ts || 0)
        );

        return json(allStories);
      }

      /* PUBLIC: RETURN PUBLISHED STORIES ONLY */

      return json(
        getPublicStories(allStories)
      );

    } catch (error) {

      return json({
        error: "Unable to retrieve news stories.",
        details: error.message
      }, 500);

    }
  }


  /* =====================================
     PROTECT ALL WRITE OPERATIONS
  ===================================== */

  if (!authorized(request, env)) {
    return json({
      error: "Unauthorized. Admin access required."
    }, 401);
  }


  /* =====================================
     POST: CREATE NEW STORY
  ===================================== */

  if (method === "POST") {

    try {
      const story = await request.json();

      const validationError = validateStory(story);

      if (validationError) {
        return json({
          error: validationError
        }, 400);
      }

      const id = crypto.randomUUID();

      const record = {
        ...story,

        id,

        title: story.title.trim(),
        summary: story.summary.trim(),
        body: story.body.trim(),

        status: story.status || "draft",

        ts: Date.now()
      };

      await env.NEWS.put(
        "story:" + id,
        JSON.stringify(record)
      );

      return json({
        success: true,
        message: "Story created successfully.",
        story: record
      }, 201);

    } catch (error) {

      return json({
        error: "Unable to create story.",
        details: error.message
      }, 400);

    }
  }


  /* =====================================
     PUT: UPDATE EXISTING STORY
  ===================================== */

  if (method === "PUT") {

    try {
      const story = await request.json();

      if (!story.id) {
        return json({
          error: "Story ID is required."
        }, 400);
      }

      const validationError = validateStory(story);

      if (validationError) {
        return json({
          error: validationError
        }, 400);
      }

      const key = "story:" + story.id;

      const existingStory = await env.NEWS.get(
        key,
        "json"
      );

      if (!existingStory) {
        return json({
          error: "Story not found."
        }, 404);
      }

      const updatedStory = {
        ...existingStory,
        ...story,

        id: existingStory.id,

        title: story.title.trim(),
        summary: story.summary.trim(),
        body: story.body.trim(),

        ts: Date.now()
      };

      await env.NEWS.put(
        key,
        JSON.stringify(updatedStory)
      );

      return json({
        success: true,
        message: "Story updated successfully.",
        story: updatedStory
      });

    } catch (error) {

      return json({
        error: "Unable to update story.",
        details: error.message
      }, 400);

    }
  }


  /* =====================================
     DELETE: REMOVE STORY
  ===================================== */

  if (method === "DELETE") {

    try {
      const data = await request.json();

      if (!data.id) {
        return json({
          error: "Story ID is required."
        }, 400);
      }

      const key = "story:" + data.id;

      const existingStory = await env.NEWS.get(key);

      if (!existingStory) {
        return json({
          error: "Story not found."
        }, 404);
      }

      await env.NEWS.delete(key);

      return json({
        success: true,
        message: "Story deleted successfully."
      });

    } catch (error) {

      return json({
        error: "Unable to delete story.",
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
