import { AppDataSource } from "../../ormconfig";
import { AuditLog } from "../entity/AuditLog";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "EXPORT" | "GENERATE";

export interface AuditContext {
  userId?: number;
  userName?: string;
  schoolId?: number;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  private static instance: AuditService;
  private context: AuditContext = {};

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Set the current context (user, school, etc.)
   * Call this from middleware after authentication
   */
  setContext(context: AuditContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear the context (on logout or request end)
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Log an audit event
   */
  async log(
    action: AuditAction,
    entityType: string,
    entityId: number | null,
    entityName: string,
    oldValue?: any,
    newValue?: any
  ): Promise<void> {
    try {
      const repo = AppDataSource.getRepository(AuditLog);

      const auditLog = new AuditLog();
      auditLog.schoolId = this.context.schoolId || null;
      auditLog.userId = this.context.userId || null;
      auditLog.userName = this.context.userName || "System";
      auditLog.action = action;
      auditLog.entityType = entityType;
      auditLog.entityId = entityId;
      auditLog.entityName = entityName;
      auditLog.oldValue = oldValue ? JSON.stringify(oldValue) : "";
      auditLog.newValue = newValue ? JSON.stringify(newValue) : "";
      auditLog.changedFields = this.getChangedFields(oldValue, newValue);
      auditLog.ipAddress = this.context.ipAddress || "";
      auditLog.userAgent = this.context.userAgent || "";
      auditLog.timestamp = new Date();

      await repo.save(auditLog);
    } catch (error) {
      // Don't throw - audit logging should never break the main operation
      console.error("Audit logging failed:", error);
    }
  }

  /**
   * Log entity creation
   */
  async logCreate(entityType: string, entity: any): Promise<void> {
    const entityName = this.getEntityName(entityType, entity);
    await this.log("CREATE", entityType, entity.id, entityName, null, entity);
  }

  /**
   * Log entity update
   */
  async logUpdate(entityType: string, oldEntity: any, newEntity: any): Promise<void> {
    const entityName = this.getEntityName(entityType, newEntity);
    await this.log("UPDATE", entityType, newEntity.id, entityName, oldEntity, newEntity);
  }

  /**
   * Log entity deletion
   */
  async logDelete(entityType: string, entity: any): Promise<void> {
    const entityName = this.getEntityName(entityType, entity);
    await this.log("DELETE", entityType, entity.id, entityName, entity, null);
  }

  /**
   * Log timetable generation
   */
  async logGenerate(timetableId: number, timetableName: string): Promise<void> {
    await this.log("GENERATE", "Timetable", timetableId, timetableName);
  }

  /**
   * Log export action
   */
  async logExport(entityType: string, format: string, count: number): Promise<void> {
    await this.log("EXPORT", entityType, null, `${entityType} export (${format}, ${count} items)`);
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(options: {
    schoolId?: number;
    userId?: number;
    entityType?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const repo = AppDataSource.getRepository(AuditLog);
    const query = repo.createQueryBuilder("log");

    if (options.schoolId) {
      query.andWhere("log.schoolId = :schoolId", { schoolId: options.schoolId });
    }
    if (options.userId) {
      query.andWhere("log.userId = :userId", { userId: options.userId });
    }
    if (options.entityType) {
      query.andWhere("log.entityType = :entityType", { entityType: options.entityType });
    }
    if (options.action) {
      query.andWhere("log.action = :action", { action: options.action });
    }
    if (options.startDate) {
      query.andWhere("log.timestamp >= :startDate", { startDate: options.startDate });
    }
    if (options.endDate) {
      query.andWhere("log.timestamp <= :endDate", { endDate: options.endDate });
    }

    const total = await query.getCount();

    query.orderBy("log.timestamp", "DESC");
    
    if (options.limit) {
      query.limit(options.limit);
    }
    if (options.offset) {
      query.offset(options.offset);
    }

    const logs = await query.getMany();

    return { logs, total };
  }

  /**
   * Get changed fields between old and new values
   */
  private getChangedFields(oldValue: any, newValue: any): string {
    if (!oldValue || !newValue) return "[]";

    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})]);

    for (const key of allKeys) {
      // Skip internal fields
      if (["createdAt", "updatedAt", "deletedAt"].includes(key)) continue;

      const oldVal = JSON.stringify(oldValue?.[key]);
      const newVal = JSON.stringify(newValue?.[key]);

      if (oldVal !== newVal) {
        changedFields.push(key);
      }
    }

    return JSON.stringify(changedFields);
  }

  /**
   * Get a human-readable name for an entity
   */
  private getEntityName(entityType: string, entity: any): string {
    if (!entity) return entityType;

    // Try common name fields
    const nameFields = ["fullName", "name", "displayName", "title", "username"];
    for (const field of nameFields) {
      if (entity[field]) {
        return `${entityType}: ${entity[field]}`;
      }
    }

    return `${entityType} #${entity.id || "new"}`;
  }
}
