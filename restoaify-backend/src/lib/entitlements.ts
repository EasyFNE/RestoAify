import type { TxSql } from '../db/sql.js';
import type { ModuleCode } from '../types/statuses.js';

/**
 * Returns true if the module is enabled for the current tenant.
 *
 * tenant_entitlements has two unique indexes:
 *   - (tenant_id, module_code) WHERE feature_code IS NULL  → module-level row
 *   - (tenant_id, module_code, feature_code)               → per-feature row
 *
 * For tool execution we check the module-level row only. Feature flags
 * (granular) are checked inside specific handlers when relevant.
 */
export async function isModuleEnabled(
  tx: TxSql,
  moduleCode: ModuleCode,
): Promise<boolean> {
  const rows = await tx<Array<{ enabled: boolean }>>`
    SELECT enabled
    FROM tenant_entitlements
    WHERE module_code  = ${moduleCode}
      AND feature_code IS NULL
    LIMIT 1
  `;
  // No row = not entitled (default deny). Explicit false also = not entitled.
  return rows[0]?.enabled === true;
}
