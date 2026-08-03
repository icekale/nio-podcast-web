import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const deployWorkflow = existsSync(resolve(process.cwd(), '.github/workflows/deploy.yml'))
  ? readFileSync(resolve(process.cwd(), '.github/workflows/deploy.yml'), 'utf8')
  : '';

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

  it('commits catalog changes and leaves Pages publication to the main deployment workflow', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/update-catalog.yml'), 'utf8');
    const commit = workflow.indexOf('- name: Commit catalog state');

    expect(commit).toBeGreaterThanOrEqual(0);
    expect(workflow).not.toContain('npm run deploy');

    for (const step of ['Test application', 'Lint application', 'Build PWA', 'Commit catalog state']) {
      const start = workflow.indexOf(`- name: ${step}`);
      const end = workflow.indexOf('\n      - name:', start + 1);
      const block = workflow.slice(start, end < 0 ? undefined : end);
      expect(block).toContain("if: steps.changes.outputs.changed == 'true'");
    }
    expect(workflow).toContain('git pull --rebase origin main');

    expect(deployWorkflow).toContain('push:');
    expect(deployWorkflow).toContain('branches: [main]');
    expect(deployWorkflow).toContain('workflow_dispatch:');
    expect(deployWorkflow).toContain('npm run deploy');
    expect(deployWorkflow).toContain('group: nio-pages-deploy');
  });
});
