import { QueryResult, QueryResultRow } from 'pg';
import { IntegrationResult } from '../../src/integrations/types';

/**
 * Creates a mock QueryResult object for testing database queries
 * @param rows The rows to include in the query result
 * @returns A mocked QueryResult object
 */
export function createMockQueryResult<T extends QueryResultRow = any>(rows: T[]): QueryResult<T> {
  return {
    rows,
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: []
  };
}

/**
 * Creates an empty mock QueryResult object for testing database queries that don't return rows
 * @returns A mocked QueryResult object with no rows
 */
export function createEmptyMockQueryResult(): QueryResult<any> {
  return {
    rows: [],
    command: 'INSERT',
    rowCount: 1,
    oid: 0,
    fields: []
  };
}

/**
 * Creates a mock integration result for testing
 * @param success Whether the integration was successful
 * @param data Optional data returned by the integration
 * @param error Optional error message if the integration failed
 * @returns A mocked IntegrationResult object
 */
export function createMockIntegrationResult(success: boolean, data?: any, error?: string): IntegrationResult {
  return {
    success,
    data,
    error
  };
}

/**
 * Creates a mock UUID for testing
 * @param value The UUID value to use
 * @returns A string that can be used as a mock UUID
 */
export function createMockUuid(value: string = 'mocked-uuid'): string {
  return value;
}
