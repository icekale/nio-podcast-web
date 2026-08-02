import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('catalog update workflow', () => {
  it('defines serialized scheduled full and incremental catalog deployments', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/update-catalog.yml'), 'utf8');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('MODE=full');
    expect(workflow).toContain('MODE="${INPUT_MODE:-incremental}"');
    expect(workflow).toContain('NIO_CATALOG_MODE=$MODE');
    expect(workflow).toContain('30 23 * * 0-4');
    expect(workflow).toContain('0 16 * * 1-5');
    expect(workflow).toContain('0 4 * * 0,6');
    expect(workflow).toContain('Asia/Shanghai');
  });
});
