import fs from 'node:fs';
import { E2E_DATABASE_PATH } from '../playwright.config';

export default function globalTeardown() {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${E2E_DATABASE_PATH}${suffix}`, { force: true });
  }
}
