'use strict';

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).toLowerCase());
}

function createMssqlDatabase(env = process.env) {
  const auth = String(env.MSSQL_AUTH || 'windows').toLowerCase();
  if (!['windows', 'sql'].includes(auth)) throw new Error('MSSQL_AUTH должен быть windows или sql.');

  // Trusted Windows Authentication is provided by the native ODBC-backed driver.
  // The default Tedious driver is portable and is used with SQL logins, including from Docker/Linux.
  const sql = auth === 'windows' ? require('mssql/msnodesqlv8') : require('mssql');
  const server = env.MSSQL_SERVER || 'localhost';
  const databaseName = env.MSSQL_DATABASE || 'AutoSalonDB';
  const options = {
    encrypt: parseBoolean(env.MSSQL_ENCRYPT, false),
    trustServerCertificate: parseBoolean(env.MSSQL_TRUST_SERVER_CERTIFICATE, true),
    enableArithAbort: true
  };

  if (auth === 'windows') {
    options.trustedConnection = true;
    options.useUTC = false;
    if (env.MSSQL_INSTANCE) options.instanceName = env.MSSQL_INSTANCE;
  }

  const config = {
    server,
    database: databaseName,
    options,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: Number(env.MSSQL_CONNECTION_TIMEOUT || 15000),
    requestTimeout: Number(env.MSSQL_REQUEST_TIMEOUT || 15000)
  };
  if (env.MSSQL_PORT) config.port = Number(env.MSSQL_PORT);
  if (auth === 'sql') {
    if (!env.MSSQL_USER || !env.MSSQL_PASSWORD) {
      throw new Error('Для MSSQL_AUTH=sql задайте MSSQL_USER и MSSQL_PASSWORD в окружении.');
    }
    config.user = env.MSSQL_USER;
    config.password = env.MSSQL_PASSWORD;
  }
  if (env.MSSQL_ODBC_DRIVER && auth === 'windows') config.driver = env.MSSQL_ODBC_DRIVER;

  let poolPromise;
  let closed = false;
  const ensurePool = async () => {
    if (closed) throw new Error('Соединение с SQL Server уже закрыто.');
    if (!poolPromise) {
      const pool = new sql.ConnectionPool(config);
      poolPromise = pool.connect().catch((error) => {
        poolPromise = null;
        throw error;
      });
    }
    return poolPromise;
  };

  function bindParameters(request, statement, params = []) {
    let index = 0;
    const prepared = String(statement).replace(/\?/g, () => {
      const parameterName = `p${index}`;
      request.input(parameterName, params[index] === undefined ? null : params[index]);
      index += 1;
      return `@${parameterName}`;
    });
    if (index !== params.length) {
      throw new Error(`Количество параметров не совпадает: SQL ожидает ${index}, передано ${params.length}.`);
    }
    return prepared;
  }

  async function execute(statement, params = [], transaction = null) {
    const pool = transaction ? null : await ensurePool();
    const request = new sql.Request(transaction || pool);
    const prepared = bindParameters(request, statement, params);
    return request.query(prepared);
  }

  const makeApi = (transaction = null) => ({
    async all(statement, params = []) {
      const result = await execute(statement, params, transaction);
      return result.recordset || [];
    },
    async get(statement, params = []) {
      const result = await execute(statement, params, transaction);
      return (result.recordset && result.recordset[0]) || null;
    },
    async run(statement, params = []) {
      const result = await execute(statement, params, transaction);
      return { changes: (result.rowsAffected || []).reduce((sum, count) => sum + count, 0) };
    }
  });

  const api = makeApi();
  api.transaction = async (work) => {
    const pool = await ensurePool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const value = await work(makeApi(tx));
      await tx.commit();
      return value;
    } catch (error) {
      try { await tx.rollback(); } catch { /* keep the original error */ }
      throw error;
    }
  };
  api.checkConnection = async () => {
    const row = await api.get('SELECT DB_NAME() AS database_name, SUSER_SNAME() AS login_name');
    return row;
  };
  api.close = async () => {
    closed = true;
    if (poolPromise) {
      try { const pool = await poolPromise; await pool.close(); } catch { /* connection may have failed before initialization */ }
    }
  };
  return api;
}

module.exports = { createMssqlDatabase };
