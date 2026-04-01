import fs from 'fs';
import path from 'path';
import { createTranscript } from '../utils/transcript.js';

export default async function handler(req, res) {
  try {
    // You’ll replace this with your real channel/ticket later
    const fakeChannel = req.body.channel;
    const fakeTicket = req.body.ticket;

    const { filepath, filename } = await createTranscript(fakeChannel, fakeTicket);

    const html = fs.readFileSync(filepath, 'utf8');

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
