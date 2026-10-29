import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe } from 'test-anywhere';
import { itUnless, sandboxed } from './helpers/skip.js';
import {
  collectArtifactFiles,
  packagePages,
  gnuTar,
} from '../scripts/artifact-files.mjs';

describe('artifact filesystem evidence', () => {
  itUnless(sandboxed)(
    'rejects real empty directories and keeps the Pages tar contract',
    async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'artifact-files-'));
      let archive;
      try {
        const search = {
          glob: () => [cwd],
          getSearchPaths: () => [cwd],
        };
        await assert.rejects(
          () => collectArtifactFiles(search, cwd),
          /missing or empty/
        );
        await writeFile(join(cwd, 'index.html'), '<p>Required evidence</p>');
        await mkdir(join(cwd, '.github'));
        await writeFile(join(cwd, '.github', 'private'), 'excluded');
        const file = join(cwd, 'index.html');
        assert.deepEqual(
          await collectArtifactFiles(
            { ...search, glob: () => [cwd, file] },
            cwd
          ),
          { files: [file], root: cwd }
        );
        archive = await packagePages(cwd);
        assert.deepEqual(await readdir(archive.root), ['artifact.tar']);
        const listing = execFileSync(gnuTar(), ['-tf', archive.files[0]], {
          encoding: 'utf8',
        });
        assert.match(listing, /index.html/);
        assert.doesNotMatch(listing, /private|\.github/);
      } finally {
        if (archive) {
          await rm(archive.root, { recursive: true, force: true });
        }
        await rm(cwd, { recursive: true, force: true });
      }
    }
  );
});
