import { Injectable, BadRequestException } from '@nestjs/common';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

export interface ChapterDetectionResult {
  found: boolean;
  headingTitle: string | null;
  preview: string | null;
}

@Injectable()
export class DocumentParserService {
  async detectChapter(
    buffer: Buffer,
    chapterNumber: number,
  ): Promise<ChapterDetectionResult> {
    const { value: html } = await mammoth.convertToHtml({ buffer });
    const section = this.extractSection(html, chapterNumber);

    if (section === null) {
      return { found: false, headingTitle: null, preview: null };
    }

    return {
      found: true,
      headingTitle: this.extractHeadingText(section),
      preview: this.extractPreview(section),
    };
  }

  async extractChapterAsDocx(
    buffer: Buffer,
    chapterNumber: number,
  ): Promise<Buffer> {
    const { value: html } = await mammoth.convertToHtml({ buffer });
    const section = this.extractSection(html, chapterNumber);

    if (section === null) {
      throw new BadRequestException(
        `Chapter ${chapterNumber} not found in document`,
      );
    }

    return this.buildDocx(section);
  }

  // Returns the HTML slice from the Nth <h1> to the next <h1> (or end).
  private extractSection(html: string, chapterNumber: number): string | null {
    const positions: number[] = [];
    const pattern = /<h1>/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) !== null) {
      positions.push(match.index);
    }

    if (chapterNumber < 1 || chapterNumber > positions.length) return null;

    const start = positions[chapterNumber - 1];
    const end =
      chapterNumber < positions.length
        ? positions[chapterNumber]
        : html.length;

    return html.slice(start, end);
  }

  private extractHeadingText(sectionHtml: string): string | null {
    const match = sectionHtml.match(/<h1>([\s\S]*?)<\/h1>/i);
    return match !== null ? this.stripTags(match[1]) : null;
  }

  private extractPreview(sectionHtml: string): string {
    const match = sectionHtml.match(/<p>([\s\S]*?)<\/p>/i);
    return match !== null ? this.stripTags(match[1]).slice(0, 300) : '';
  }

  private async buildDocx(html: string): Promise<Buffer> {
    const children = this.parseToParagraphs(html);
    const doc = new Document({
      sections: [{ children }],
    });
    return Packer.toBuffer(doc);
  }

  private parseToParagraphs(html: string): Paragraph[] {
    const result: Paragraph[] = [];
    const blockPattern = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;

    while ((match = blockPattern.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      const text = this.stripTags(match[2]).trim();
      if (!text) continue;

      if (tag === 'h1') {
        result.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }));
      } else if (tag === 'h2') {
        result.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
      } else if (tag === 'h3') {
        result.push(new Paragraph({ text, heading: HeadingLevel.HEADING_3 }));
      } else {
        result.push(new Paragraph({ children: [new TextRun(text)] }));
      }
    }

    return result.length > 0
      ? result
      : [new Paragraph({ children: [new TextRun('')] })];
  }

  private stripTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, '')
      .trim();
  }
}
