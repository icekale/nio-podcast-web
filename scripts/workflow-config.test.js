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

  it('verifies and deploys a catalog before committing it to main', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/update-catalog.yml'), 'utf8');
    const generate = workflow.indexOf('- name: Generate catalog');
    const test = workflow.indexOf('- name: Test application');
    const lint = workflow.indexOf('- name: Lint application');
    const build = workflow.indexOf('- name: Build PWA');
    const configure = workflow.indexOf('- name: Configure Git identity');
    const deploy = workflow.indexOf('- name: Deploy GitHub Pages');
    const commit = workflow.indexOf('- name: Commit catalog state');

    expect(generate).toBeGreaterThanOrEqual(0);
    expect(test).toBeGreaterThan(generate);
    expect(lint).toBeGreaterThan(test);
    expect(build).toBeGreaterThan(lint);
    expect(configure).toBeGreaterThan(build);
    expect(deploy).toBeGreaterThan(configure);
    expect(commit).toBeGreaterThan(deploy);

    for (const step of ['Test application', 'Lint application', 'Build PWA', 'Deploy GitHub Pages', 'Commit catalog state']) {
      const start = workflow.indexOf(`- name: ${step}`);
      const end = workflow.indexOf('\n      - name:', start + 1);
      const block = workflow.slice(start, end < 0 ? undefined : end);
      expect(block).toContain("if: steps.changes.outputs.changed == 'true'");
    }
    expect(workflow.slice(configure, deploy)).toContain('git config user.name "github-actions[bot]"');
    expect(workflow.slice(configure, deploy)).toContain('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
    expect(workflow).toContain('git pull --rebase origin main');
  });
});
