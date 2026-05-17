import { describe, it, expect } from 'vitest';
import { injectHighlightsIntoMarkdown } from './DocumentPreview';
import type { Observation, Severity } from '../../../types';

// ── Minimal observation factory ───────────────────────────────────────────────

const obs = (
  id: string,
  textFragment: string | null,
  severity: Severity = 'WARNING',
): Observation =>
  ({
    id,
    textFragment,
    severity,
    type: 'STRUCTURE',
    message: 'Some issue',
    suggestion: null,
    source: 'AI',
    authorId: null,
    authorName: null,
    isMutable: false,
    escalationLevel: 0,
    offsetStart: null,
    offsetEnd: null,
    sourceReference: null,
  }) as unknown as Observation;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('injectHighlightsIntoMarkdown', () => {
  it('returns the markdown unchanged when no observations have a textFragment', () => {
    const md = 'Hello world, this is a paragraph.';
    const result = injectHighlightsIntoMarkdown(md, [obs('obs-1', null)]);
    expect(result).toBe(md);
  });

  it('returns the markdown unchanged when all textFragments are empty or whitespace', () => {
    const md = 'Hello world';
    const result = injectHighlightsIntoMarkdown(md, [obs('obs-1', ''), obs('obs-2', '   ')]);
    expect(result).toBe(md);
  });

  it('wraps a matching fragment with the correct obs-highlight tag', () => {
    const md = 'The introduction lacks context.';
    const result = injectHighlightsIntoMarkdown(md, [obs('obs-1', 'introduction lacks', 'ERROR')]);

    expect(result).toContain('<obs-highlight data-obs-id="obs-1" data-severity="ERROR">');
    expect(result).toContain('introduction lacks');
    expect(result).toContain('</obs-highlight>');
  });

  it('skips a fragment that does not appear in the markdown', () => {
    const md = 'Hello world';
    const result = injectHighlightsIntoMarkdown(md, [obs('obs-1', 'nonexistent text')]);
    expect(result).toBe(md);
  });

  it('only wraps the FIRST occurrence when a fragment appears multiple times', () => {
    const md = 'error error error';
    const result = injectHighlightsIntoMarkdown(md, [obs('obs-1', 'error')]);

    const matches = (result.match(/data-obs-id="obs-1"/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it('escapes special regex characters in the fragment so they match literally', () => {
    const md = 'The function f(x) = x^2 produces results.';
    const result = injectHighlightsIntoMarkdown(md, [obs('obs-1', 'f(x) = x^2')]);

    // If the parens / caret were not escaped the regex would throw or mis-match
    expect(result).toContain('data-obs-id="obs-1"');
    expect(result).toContain('f(x) = x^2');
  });

  it('processes longer fragments first so shorter overlapping fragments do not break them', () => {
    // "hello world" must be wrapped intact; if "hello" were processed first
    // the regex for "hello world" would no longer find its target.
    const md = 'fix hello world issues';
    const result = injectHighlightsIntoMarkdown(md, [
      obs('shorter', 'hello', 'INFO'),
      obs('longer', 'hello world', 'WARNING'),
    ]);

    // Both observations must appear in the output — only possible when "longer" is processed first
    expect(result).toContain('data-obs-id="longer"');
    expect(result).toContain('data-obs-id="shorter"');
  });

  it('wraps multiple non-overlapping fragments independently', () => {
    const md = 'The introduction and the conclusion both need revision.';
    const result = injectHighlightsIntoMarkdown(md, [
      obs('obs-intro', 'introduction', 'WARNING'),
      obs('obs-conc', 'conclusion', 'ERROR'),
    ]);

    expect(result).toContain('data-obs-id="obs-intro"');
    expect(result).toContain('data-obs-id="obs-conc"');
  });
});
