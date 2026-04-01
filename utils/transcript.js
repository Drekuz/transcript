const fs = require('fs');
const path = require('path');
const { isImageAttachment } = require('./helpers');

const DIR = '/tmp/transcripts';


function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchAllMessages(channel) {
  let all = [];
  let lastId;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
    if (!batch || batch.size === 0) break;

    all.push(...batch.values());
    lastId = batch.last().id;

    if (batch.size < 100) break;
  }

  return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function renderAttachments(message) {
  if (!message.attachments.size) return '';

  return [...message.attachments.values()].map(att => {
    const name = escapeHtml(att.name || 'attachment');
    const url = att.url;

    if (isImageAttachment(att.name, att.contentType || '')) {
      return `
        <div class="attachment">
          <a href="${url}" target="_blank" rel="noopener noreferrer">
            <img src="${url}" alt="${name}">
          </a>
        </div>
      `;
    }

    return `
      <div class="file">
        <a href="${url}" target="_blank" rel="noopener noreferrer">📎 ${name}</a>
      </div>
    `;
  }).join('');
}

function renderEmbeds(message) {
  if (!message.embeds?.length) return '';

  return message.embeds.map(embed => {
    const title = embed.title ? `<div class="embed-title">${escapeHtml(embed.title)}</div>` : '';
    const description = embed.description ? `<div class="embed-description">${escapeHtml(embed.description)}</div>` : '';

    const fields = Array.isArray(embed.fields) && embed.fields.length
      ? `<div class="embed-fields">
          ${embed.fields.map(field => `
            <div class="embed-field">
              <div class="embed-field-name">${escapeHtml(field.name)}</div>
              <div class="embed-field-value">${escapeHtml(field.value)}</div>
            </div>
          `).join('')}
        </div>`
      : '';

    const image = embed.image?.url
      ? `<div class="attachment"><img src="${embed.image.url}" alt="embed image"></div>`
      : '';

    return `
      <div class="embed-box">
        ${title}
        ${description}
        ${fields}
        ${image}
      </div>
    `;
  }).join('');
}

function renderStickers(message) {
  if (!message.stickers?.size) return '';

  return [...message.stickers.values()].map(sticker => {
    if (!sticker.url) return '';
    return `
      <div class="attachment">
        <img src="${sticker.url}" alt="${escapeHtml(sticker.name || 'sticker')}">
      </div>
    `;
  }).join('');
}

function renderMessage(message) {
  const avatar = message.author.displayAvatarURL({ extension: 'png', size: 128 });
  const author = escapeHtml(message.author.tag);
  const time = new Date(message.createdTimestamp).toLocaleString();

  const content = message.content
    ? `<div class="content">${escapeHtml(message.content)}</div>`
    : '';

  const reply = message.reference?.messageId
    ? `<div class="reply-ref">↪ Replying to a previous message</div>`
    : '';

  return `
    <div class="message">
      <img class="avatar" src="${avatar}" alt="${author}">
      <div class="message-body">
        <div class="message-header">
          <span class="author">${author}</span>
          <span class="timestamp">${time}</span>
        </div>
        ${reply}
        ${content}
        ${renderEmbeds(message)}
        ${renderAttachments(message)}
        ${renderStickers(message)}
      </div>
    </div>
  `;
}

async function createTranscript(channel, ticket) {
  ensureDir();
  const messages = await fetchAllMessages(channel);

  const filename = `${ticket.ticketId}.html`;
  const filepath = path.join(DIR, filename);

  const baseUrl = (process.env.TRANSCRIPT_BASE_URL || '').replace(/\/$/, '');
  const publicUrl = baseUrl ? `${baseUrl}/${encodeURIComponent(filename)}` : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transcript ${escapeHtml(channel.name)}</title>
<style>
  body {
    margin: 0;
    background: #0f172a;
    color: #e5e7eb;
    font-family: Inter, Arial, sans-serif;
  }
  .wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px;
  }
  .head {
    background: #111827;
    border: 1px solid #334155;
    border-radius: 18px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .head h1 {
    margin: 0 0 12px 0;
    font-size: 28px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .card {
    background: #0b1220;
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 12px;
  }
  .badge {
    display: inline-block;
    margin-bottom: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    background: #14532d;
    color: #dcfce7;
    font-size: 12px;
    font-weight: 700;
  }
  .message {
    display: flex;
    gap: 14px;
    background: #111827;
    border: 1px solid #334155;
    border-radius: 16px;
    padding: 14px;
    margin-bottom: 14px;
  }
  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .message-body {
    flex: 1;
    min-width: 0;
  }
  .message-header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }
  .author {
    font-weight: 700;
    color: #ffffff;
  }
  .timestamp {
    color: #94a3b8;
    font-size: 12px;
  }
  .reply-ref {
    color: #93c5fd;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .content {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }
  .attachment img {
    max-width: 100%;
    border-radius: 12px;
    margin-top: 10px;
    border: 1px solid #334155;
  }
  .file {
    margin-top: 10px;
  }
  .file a {
    color: #93c5fd;
    text-decoration: none;
  }
  .embed-box {
    margin-top: 10px;
    padding: 12px;
    border-left: 4px solid #22c55e;
    background: #0b1220;
    border-radius: 10px;
  }
  .embed-title {
    font-weight: 700;
    margin-bottom: 6px;
  }
  .embed-description {
    white-space: pre-wrap;
    line-height: 1.45;
  }
  .embed-fields {
    margin-top: 10px;
    display: grid;
    gap: 10px;
  }
  .embed-field-name {
    font-weight: 700;
    margin-bottom: 4px;
  }
  .embed-field-value {
    white-space: pre-wrap;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>Ticket Transcript</h1>
      <div class="grid">
        <div class="card"><div class="badge">Channel</div><div>${escapeHtml(channel.name)}</div></div>
        <div class="card"><div class="badge">Service</div><div>${escapeHtml(ticket.serviceLabel || ticket.service || 'Unknown')}</div></div>
        <div class="card"><div class="badge">Opened By</div><div>${escapeHtml(ticket.openedByTag || ticket.openedById || 'Unknown')}</div></div>
        <div class="card"><div class="badge">Claimed By</div><div>${escapeHtml(ticket.claimedByTag || 'Not claimed')}</div></div>
        <div class="card"><div class="badge">Bundle</div><div>${escapeHtml(ticket.bundle || 'N/A')}</div></div>
        <div class="card"><div class="badge">Budget</div><div>${escapeHtml(ticket.budget || 'N/A')}</div></div>
      </div>
    </div>

    ${messages.map(renderMessage).join('\n')}
  </div>
</body>
</html>`;

  fs.writeFileSync(filepath, html, 'utf8');

  return {
    filepath,
    filename,
    publicUrl
  };
}

module.exports = { createTranscript };