import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { describe, it } from 'test-anywhere';
import { readTarEntries, scanCompressed } from '../scripts/check-secrets.mjs';

function tarEntry(name, content, type = '0') {
  const bytes = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(name);
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124);
  header.fill(32, 148, 156);
  header.write(type, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
  return Buffer.concat([
    header,
    bytes,
    Buffer.alloc((512 - (bytes.length % 512)) % 512),
  ]);
}
const tar = (...entries) => Buffer.concat([...entries, Buffer.alloc(1024)]);
const token = `gh${'p_'}${'A'.repeat(36)}`;
const refuseToken = (_name, input) => {
  if (input.includes(token)) {
    throw new Error('secret detected');
  }
};
describe('compressed evidence secrets', () => {
  for (const extension of ['log.gz', 'json.gz', 'tar.gz', 'tgz']) {
    it(`scans secrets in ${extension}`, () => {
      const content = /tar.gz|tgz/.test(extension)
        ? tar(tarEntry('evidence.log', token))
        : Buffer.from(token);
      assert.throws(
        () =>
          scanCompressed(
            `evidence.${extension}`,
            gzipSync(content),
            refuseToken
          ),
        /secret detected/
      );
    });
  }
  it('scans every regular tar entry without extracting traversal paths', () => {
    const scanned = [];
    scanCompressed(
      'snapshot.tgz',
      gzipSync(
        tar(
          tarEntry('clean.txt', 'ok'),
          tarEntry('../../outside.log', 'evidence')
        )
      ),
      (name, bytes) => scanned.push([name, bytes.toString()])
    );
    assert.deepEqual(scanned, [
      ['snapshot.tgz/clean.txt', 'ok'],
      ['snapshot.tgz/../../outside.log', 'evidence'],
    ]);
  });
  it('scans gzip nested in tar, including GNU long names', () => {
    const content = tar(
      tarEntry('././@LongLink', 'nested.log.gz\0', 'L'),
      tarEntry('short', gzipSync(token))
    );
    assert.throws(
      () => scanCompressed('snapshot.tgz', gzipSync(content), refuseToken),
      /secret detected/
    );
  });
  it('uses PAX path records when identifying compressed members', () => {
    const record = 'path=nested.log.gz\n';
    const length = record.length + 3;
    const content = tar(
      tarEntry('pax', `${length} ${record}`, 'x'),
      tarEntry('short', gzipSync(token))
    );
    assert.throws(
      () => scanCompressed('snapshot.tgz', gzipSync(content), refuseToken),
      /secret detected/
    );
  });
  it('fails closed on corrupt gzip and truncated or invalid tar', () => {
    assert.throws(() =>
      scanCompressed('bad.gz', Buffer.from('not gzip'), () => {})
    );
    assert.throws(
      () =>
        scanCompressed('bad.tgz', gzipSync(Buffer.from('not tar')), () => {}),
      /Truncated/
    );
    const corrupt = tar(tarEntry('ok', 'data'));
    corrupt[0] ^= 1;
    assert.throws(() => readTarEntries(corrupt), /checksum/);
    assert.throws(
      () => readTarEntries(tar(tarEntry('unsupported', '', 'S'))),
      /Unsupported/
    );
  });
  it('bounds decompression with a tiny finite fixture', () => {
    assert.throws(() =>
      scanCompressed('large.gz', gzipSync(Buffer.alloc(4096)), () => {}, {
        remaining: 1024,
      })
    );
    assert.throws(
      () =>
        scanCompressed(
          'nested.gz',
          gzipSync('ok'),
          () => {},
          { remaining: 1024 },
          4
        ),
      /nesting/
    );
  });
});
