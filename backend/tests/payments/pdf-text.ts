import { inflateSync } from 'node:zlib';

/** The text drawn by a PDF written with standard fonts: literal and hexadecimal strings of the content streams, as latin1. */
export function pdfText(pdf: Buffer): string {
  const source = pdf.toString('latin1');
  const pieces: string[] = [];
  const collect = (stream: string) => {
    for (const match of stream.matchAll(/\[?<([0-9a-fA-F]+)>|\(((?:\\.|[^\\)])*)\)/g)) {
      if (match[1] !== undefined) pieces.push(Buffer.from(match[1], 'hex').toString('latin1'));
      else pieces.push(match[2]!.replace(/\\(.)/g, '$1'));
    }
    pieces.push('\n');
  };
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const body = match[1]!;
    try {
      collect(inflateSync(Buffer.from(body, 'latin1')).toString('latin1'));
    } catch {
      collect(body);
    }
  }
  return pieces.join('');
}
