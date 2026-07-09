import axios from 'axios';
import http from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppDataSource } from '../../../ormconfig';
import { createApp } from '../../app';
import { License } from '../../entity/License';

describe('Config API Integration', () => {
  let server: http.Server;
  let baseURL: string;

  beforeAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    AppDataSource.setOptions({
      database: ':memory:',
      synchronize: true,
      logging: false,
      dropSchema: true,
    });
    await AppDataSource.initialize();

    const license = new License();
    license.licenseKey = 'TEST-KEY-CONFIG-INTEGRATION';
    license.schoolName = 'Test School';
    license.contactName = 'Test Admin';
    license.contactPhone = '0700000000';
    license.licenseType = 'annual';
    license.isActive = true;
    license.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    license.issuedAt = new Date();
    license.activatedAt = new Date();
    license.gracePeriodDays = 0;
    license.machineId = 'TEST-MACHINE';
    license.signature = 'mock-signature';
    license.features = [];

    await AppDataSource.manager.save(license);

    const app = createApp({
      dataSource: AppDataSource,
      enableCors: false,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseURL = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) server.close();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });

  it('returns null for missing optional configuration keys', async () => {
    const response = await axios.get(`${baseURL}/config/optimization-preferences`);

    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      key: 'optimization-preferences',
      value: null,
    });
  });

  it('saves and fetches configuration values by key', async () => {
    const payload = {
      allowConsecutivePeriodsForSameSubject: true,
      avoidTeacherGapsWeight: 2,
    };

    const saveResponse = await axios.post(`${baseURL}/config/optimization-preferences`, {
      value: payload,
    });

    expect(saveResponse.status).toBe(201);
    expect(saveResponse.data.key).toBe('optimization-preferences');

    const getResponse = await axios.get(`${baseURL}/config/optimization-preferences`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.data.key).toBe('optimization-preferences');
    expect(JSON.parse(getResponse.data.value)).toEqual(payload);
  });
});
