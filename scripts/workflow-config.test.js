import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const deployWorkflow = existsSync(resolve(process.cwd(), '.github/workflows/deploy.yml'))
  ? readFileSync(resolve(process.cwd(), '.github/workflows/deploy.yml'), 'utf8')
  : '';
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));

describe('catalog update workflow', () => {
  it('defines serialized scheduled full and incremental catalog deployments', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/update-catalog.yml'), 'utf8');
    expect(workflow).toContain('permissions:\n  actions: write\n  contents: write');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('MODE=full');
    expect(workflow).toContain('MODE="${INPUT_MODE:-incremental}"');
    expect(workflow).toContain('NIO_CATALOG_MODE=$MODE');
    expect(workflow).toContain('30 23 * * 0-4');
    expect(workflow).toContain('0 20 * * *');
    expect(workflow).toContain('0 4 * * 1-5');
    expect(workflow).toContain('0 10 * * 1-5');
    expect(workflow).toContain('0 16 * * 1-5');
    expect(workflow).toContain('0 4 * * 0,6');
    expect(workflow).toContain('0 10 * * 0,6');
    expect(workflow).not.toContain('30 0 * * 1-5');
    expect(workflow).not.toContain('30 1 * * 1-5');
    expect(workflow).not.toContain('30 9 * * 1-5');
    expect(workflow).toContain('Asia/Shanghai');
  });

  it('commits catalog changes and deploys Pages directly from the catalog workflow', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/update-catalog.yml'), 'utf8');
    const commit = workflow.indexOf('- name: Commit catalog state');
    const deploy = workflow.indexOf('- name: Trigger Pages deployment');

    expect(commit).toBeGreaterThanOrEqual(0);
    expect(deploy).toBeGreaterThan(commit);
    expect(workflow).toContain('git push origin HEAD:main');
    expect(workflow).toContain('gh workflow run deploy.yml --ref main');
    expect(workflow).not.toContain('actions/deploy-pages@v4');
    expect(workflow).not.toContain('actions/upload-pages-artifact@v3');
    expect(workflow).not.toContain('environment:\n      name: github-pages');
    expect(workflow).not.toContain('gh workflow run update-catalog.yml');

    for (const step of ['Test application', 'Lint application', 'Build PWA', 'Commit catalog state', 'Trigger Pages deployment']) {
      const start = workflow.indexOf(`- name: ${step}`);
      const end = workflow.indexOf('\n      - name:', start + 1);
      const block = workflow.slice(start, end < 0 ? undefined : end);
      expect(block).toContain("if: steps.changes.outputs.changed == 'true'");
    }
    expect(workflow).toContain('git pull --rebase origin main');

    expect(deployWorkflow).toContain('push:');
    expect(deployWorkflow).toContain('branches: [main]');
    expect(deployWorkflow).toContain('workflow_dispatch:');
    expect(deployWorkflow).toContain('actions/deploy-pages@v4');
    expect(deployWorkflow).toContain('actions/upload-pages-artifact@v3');
    expect(deployWorkflow).toContain('group: nio-pages-deploy');
    expect(packageJson.scripts.deploy).toBeUndefined();
    expect(packageJson.devDependencies['gh-pages']).toBeUndefined();
  });
});

describe('catalog freshness check workflow', () => {
  const workflow = existsSync(resolve(process.cwd(), '.github/workflows/check-catalog-freshness.yml'))
    ? readFileSync(resolve(process.cwd(), '.github/workflows/check-catalog-freshness.yml'), 'utf8')
    : '';

  it('runs daily and can be dispatched manually', () => {
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('0 6 * * *');
    expect(workflow).toContain('workflow_dispatch:');
  });

  it('auto-repairs stale catalogs and escalates via issues', () => {
    expect(workflow).toContain('actions: write');
    expect(workflow).toContain('issues: write');
    expect(workflow).toContain('gh workflow run update-catalog.yml');
    expect(workflow).toContain('gh issue create');
    expect(workflow).toContain('age_hours) > 26');
    expect(workflow).toContain('age_hours) > 50');
  });
});
