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
    expect(workflow).toContain('30 23 * * *');
    expect(workflow).toContain('if [ "$SCHEDULE" = "30 23 * * *" ]; then');
    expect(workflow).not.toContain('if [ "$SCHEDULE" = "30 23 * * 0-4" ]; then');
    expect(workflow).toContain('0 18 * * *');
    expect(workflow).toContain('0 13 * * *');
    expect(workflow).toContain('0 10 * * *');
    expect(workflow).toContain('0 16 * * *');
    expect(workflow).toContain("- cron: '0 9 * * *'");
    expect(workflow).toContain("- cron: '30 9 * * *'");
    expect(workflow).toContain("- cron: '0 11 * * *'");
    expect(workflow).toContain("- cron: '0 12 * * *'");
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
    expect(deployWorkflow).toContain('actions/deploy-pages@v5');
    expect(deployWorkflow).toContain('actions/upload-pages-artifact@v5');
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
    expect(workflow).toContain('gh run list --workflow update-catalog.yml');
    expect(workflow).not.toContain("get('generatedAt')");
    expect(workflow).toContain('gh workflow run update-catalog.yml');
    expect(workflow).toContain('gh issue create');
    expect(workflow).toContain('age_hours) > 26');
    expect(workflow).toContain('age_hours) > 50');
  });
});

describe('one-click static hosting', () => {
  const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

  it('publishes Vercel and Cloudflare deploy buttons for this repository', () => {
    expect(readme).toContain('https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ficekale%2Fnio-podcast-web');
    expect(readme).toContain('https://deploy.workers.cloudflare.com/?url=https://github.com/icekale/nio-podcast-web');
    expect(readme).toContain('https://deploy.workers.cloudflare.com/button');
    expect(readme).toContain('https://vercel.com/button');
    expect(readme).not.toContain('edgeone.ai');
  });

  it('uses two promo images and drops the old screenshot set', () => {
    expect(readme).toContain('docs/images/nio-radio-cover.png');
    expect(readme).toContain('docs/images/nio-radio-phone.png');
    expect(readme).not.toContain('nio-radio-home.png');
    expect(readme).not.toContain('nio-radio-queue.png');
    expect(readme).not.toContain('nio-radio-pc.png');
    expect(existsSync(resolve(process.cwd(), 'docs/images/nio-radio-cover.png'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'docs/images/nio-radio-phone.png'))).toBe(true);
  });

  it('describes the two one-click hosts and omits the miniprogram intro', () => {
    expect(readme).toContain('## 一键部署');
    expect(readme).toContain('### Vercel');
    expect(readme).toContain('自动识别 Vite');
    expect(readme).toContain('### Cloudflare');
    expect(readme).toContain('wrangler.toml');
    expect(readme).toContain('Workers 静态资源');
    expect(readme).not.toContain('## 小程序版');
    expect(readme).not.toContain('miniprogram/');
  });

  it('ships Cloudflare Workers static-asset settings for the Vite output', () => {
    const wrangler = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8');
    expect(wrangler).toContain('name = "nio-radio"');
    expect(wrangler).toContain('[assets]');
    expect(wrangler).toContain('directory = "./dist"');
    expect(wrangler).toContain('[build]');
    expect(wrangler).toContain('command = "npm run build"');
  });
});
