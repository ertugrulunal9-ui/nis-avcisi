import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv } from '../src/env.mjs';

function withRoot(content, fn, procVal) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nis-env-'));
  if (content !== null) fs.writeFileSync(path.join(dir, '.env'), content);
  const old = process.env.YT_API_KEY;
  if (procVal === undefined) delete process.env.YT_API_KEY; else process.env.YT_API_KEY = procVal;
  try {
    return fn(dir);
  } finally {
    if (old === undefined) delete process.env.YT_API_KEY; else process.env.YT_API_KEY = old;
  }
}

test('BOM, CRLF, yorum ve tırnak', () => {
  const text = '﻿# yorum\r\n\r\nDIGER=1\r\nYT_API_KEY="SAHTE-ANAHTAR-1"\r\n';
  withRoot(text, (d) => assert.equal(loadEnv(d).apiKey, 'SAHTE-ANAHTAR-1'));
});

test('tek tırnak ve tırnaksız değer', () => {
  withRoot("YT_API_KEY='abc'\n", (d) => assert.equal(loadEnv(d).apiKey, 'abc'));
  withRoot('YT_API_KEY=xyz', (d) => assert.equal(loadEnv(d).apiKey, 'xyz'));
});

test('boş değer null', () => {
  withRoot('YT_API_KEY=\n', (d) => assert.equal(loadEnv(d).apiKey, null));
  withRoot('YT_API_KEY=""\r\n', (d) => assert.equal(loadEnv(d).apiKey, null));
});

test('.env yoksa null', () => {
  withRoot(null, (d) => assert.equal(loadEnv(d).apiKey, null));
});

test('process.env önceliklidir', () => {
  withRoot('YT_API_KEY=dosyadan\n', (d) => assert.equal(loadEnv(d).apiKey, 'ortamdan'), 'ortamdan');
});
