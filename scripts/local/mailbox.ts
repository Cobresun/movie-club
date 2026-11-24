#!/usr/bin/env tsx

import { randomUUID } from "crypto";
import { createServer, type ServerResponse } from "http";
import { text as readText } from "stream/consumers";
import { z } from "zod";

import { hasValue, isDefined, isString } from "../../lib/checks/checks.js";

/**
 * A stand-in for Resend's `POST /emails`, so sign-up, verification and
 * password reset run unmodified against a local stack. `local:up` points the
 * Resend SDK here through `RESEND_BASE_URL`.
 *
 * `GET /` lists what was sent, newest first, with the links clickable;
 * `GET /emails?to=<address>` returns the same as JSON for scripts.
 */

const PORT = Number(process.env.MAILBOX_PORT ?? "8025");

const sendEmailSchema = z.object({
  from: z.string(),
  to: z.union([z.string(), z.array(z.string())]),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
});

interface MailboxEmail {
  id: string;
  to: string[];
  subject: string;
  html: string;
  receivedAt: string;
}

const inbox: MailboxEmail[] = [];

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderInbox() {
  const emails = inbox
    .map(
      (email) => `
        <article style="border:1px solid #ccc;border-radius:8px;margin:16px 0;padding:16px">
          <h2 style="margin:0">${escapeHtml(email.subject)}</h2>
          <p>To ${escapeHtml(email.to.join(", "))} at ${email.receivedAt}</p>
          ${email.html}
        </article>`,
    )
    .join("");
  return `<!doctype html><title>Local mailbox</title><h1>Local mailbox</h1>${
    hasValue(emails) ? emails : "<p>Nothing sent yet.</p>"
  }`;
}

function parseEmail(raw: string) {
  try {
    return sendEmailSchema.safeParse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function receive(raw: string, response: ServerResponse) {
  const parsed = parseEmail(raw);
  if (!isDefined(parsed)) {
    json(response, 422, { name: "validation_error", message: "Body is not JSON" });
    return;
  }
  if (!parsed.success) {
    json(response, 422, { name: "validation_error", message: parsed.error.message });
    return;
  }
  const { to, subject, html, text } = parsed.data;
  const email: MailboxEmail = {
    id: randomUUID(),
    to: isString(to) ? [to] : to,
    subject,
    html: html ?? `<pre>${escapeHtml(text ?? "")}</pre>`,
    receivedAt: new Date().toISOString(),
  };
  inbox.unshift(email);
  console.log(`Mail to ${email.to.join(", ")}: ${subject}`);
  json(response, 200, { id: email.id });
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);

  if (request.method === "POST" && url.pathname === "/emails") {
    void readText(request)
      .then((raw) => receive(raw, response))
      .catch((error: unknown) => {
        console.error("Reading a POST /emails body failed", error);
        if (!response.headersSent) {
          json(response, 400, { name: "bad_request", message: "Could not read the body" });
        }
      });
    return;
  }

  if (request.method === "GET" && url.pathname === "/emails") {
    const to = url.searchParams.get("to");
    json(response, 200, isDefined(to) ? inbox.filter((email) => email.to.includes(to)) : inbox);
    return;
  }

  if (request.method === "GET" && url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderInbox());
    return;
  }

  json(response, 404, { name: "not_found", message: `${request.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`Local mailbox on http://localhost:${PORT}`);
});
