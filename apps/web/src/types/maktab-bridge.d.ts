import type { RuntimeInfo } from '@/runtime';

type IpcErrorCode =
  | 'IPC_INVALID_PAYLOAD' | 'IPC_UNTRUSTED_SENDER' | 'IPC_INVALID_RESPONSE' | 'IPC_WINDOW_UNAVAILABLE'
  | 'RUNTIME_READ_FAILED' | 'DOCUMENT_SAVE_PDF_FAILED' | 'DOCUMENT_PRINT_FAILED'
  | 'DIAGNOSTICS_STATUS_FAILED' | 'DIAGNOSTICS_EXPORT_FAILED'
  | 'BACKUP_CREATE_FAILED' | 'BACKUP_INSPECT_FAILED' | 'BACKUP_RESTORE_FAILED'
  | 'LICENSE_STATUS_FAILED' | 'LICENSE_ACTIVATE_FAILED' | 'LICENSE_REFRESH_FAILED' | 'LICENSE_DEACTIVATE_FAILED'
  | 'UPDATE_STATUS_FAILED' | 'UPDATE_CHECK_FAILED' | 'UPDATE_DOWNLOAD_FAILED' | 'UPDATE_CANCEL_FAILED' | 'UPDATE_INSTALL_FAILED';

type BridgeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: IpcErrorCode; message: string; retryable: boolean; correlationId: string } };

interface LicenseStatus {
  state: string;
  canGenerate: boolean;
  isReadOnly: boolean;
  expiresAt: string | null;
  graceUntil: string | null;
  keyId: string | null;
  activationId: string | null;
  message: string;
}

interface BackupManifest {
  format_version: number;
  created_at: string;
  app_version: string;
  build_id: string;
  db_schema_version: number;
  database_sha256: string;
  database_size: number;
  source_platform: string;
  scope: 'desktop-timetable';
}

interface UpdateStatus {
  state: string;
  channel: RuntimeInfo['channel'];
  available: null | { version: string; buildId: string; releaseNotes: unknown };
  percent?: number;
  message?: string;
}

interface DiagnosticsStatus {
  runtime: RuntimeInfo;
  components: Record<string, unknown>;
  license: LicenseStatus;
  security: { safeStorage: 'ok' | 'not-applicable' };
}

declare global {
  interface Window {
    maktab?: {
      runtime: { get: () => Promise<BridgeResult<RuntimeInfo>> };
      license: {
        getStatus: () => Promise<BridgeResult<LicenseStatus>>;
        activate: (licenseKey: string) => Promise<BridgeResult<LicenseStatus>>;
        refresh: () => Promise<BridgeResult<LicenseStatus>>;
        deactivate: () => Promise<BridgeResult<LicenseStatus>>;
      };
      documents: {
        savePdf: (options?: { suggestedName?: string }) => Promise<BridgeResult<{ canceled: boolean; filePath?: string }>>;
        print: () => Promise<BridgeResult<{ printed: true }>>;
      };
      diagnostics: {
        getStatus: () => Promise<BridgeResult<DiagnosticsStatus>>;
        exportSupportBundle: () => Promise<BridgeResult<{ canceled: boolean; fileName?: string; bytes?: number }>>;
      };
      data: {
        createBackup: (passphrase: string) => Promise<BridgeResult<{ canceled: boolean; fileName?: string; manifest?: BackupManifest }>>;
        inspectBackup: (passphrase: string) => Promise<BridgeResult<{ canceled: boolean; handle?: string; manifest?: BackupManifest }>>;
        restoreBackup: (handle: string, passphrase: string) => Promise<BridgeResult<{ restored: true; manifest: BackupManifest }>>;
      };
      updates: {
        getStatus: () => Promise<BridgeResult<UpdateStatus>>;
        check: () => Promise<BridgeResult<UpdateStatus>>;
        download: () => Promise<BridgeResult<UpdateStatus>>;
        cancel: () => Promise<BridgeResult<UpdateStatus>>;
        install: () => Promise<BridgeResult<{ installing: true }>>;
      };
    };
  }
}

export {};
