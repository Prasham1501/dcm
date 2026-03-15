/**
 * DICOM Viewer Pro - Database Setup Helper
 * Automatically initializes MariaDB data directory and runs migrations on first launch.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Initialize the MariaDB data directory if it doesn't exist
 * @param {string} mysqlDir - Path to the portable MariaDB installation
 * @param {string} dataDir - Path where MySQL data should be stored
 * @returns {boolean} true if init was needed and performed
 */
function initMySQLDataDir(mysqlDir, dataDir) {
    const dataSubDir = path.join(dataDir, 'data');

    if (fs.existsSync(dataSubDir) && fs.readdirSync(dataSubDir).length > 0) {
        console.log('[DB Setup] MySQL data directory already exists, skipping init');
        return false;
    }

    console.log('[DB Setup] Initializing MySQL data directory...');

    // Create data directory
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const mysqld = path.join(mysqlDir, 'bin', 'mysqld.exe');

    try {
        // Use mysqld --initialize-insecure (standard for MariaDB/MySQL on Windows)
        console.log('[DB Setup] Using mysqld --initialize-insecure...');
        execSync(`"${mysqld}" --initialize-insecure --datadir="${dataSubDir}" --basedir="${mysqlDir}"`, {
            timeout: 60000,
            stdio: 'pipe'
        });
        console.log('[DB Setup] MySQL data directory initialized successfully');
        return true;
    } catch (error) {
        console.error('[DB Setup] Failed to initialize MySQL data directory:', error.message);
        // Try stderr output for more info
        if (error.stderr) {
            console.error('[DB Setup] stderr:', error.stderr.toString());
        }
        throw error;
    }
}

/**
 * Wait for MySQL to be ready to accept connections
 * @param {string} mysqlDir - Path to MySQL bin directory
 * @param {number} port - MySQL port
 * @param {number} maxAttempts - Max retry attempts
 * @returns {Promise<boolean>}
 */
async function waitForMySQL(mysqlDir, port, maxAttempts = 30) {
    const mysqlExe = path.join(mysqlDir, 'bin', 'mysql.exe');

    for (let i = 0; i < maxAttempts; i++) {
        try {
            execSync(`"${mysqlExe}" -u root --port=${port} -e "SELECT 1" 2>nul`, {
                timeout: 5000,
                stdio: 'pipe'
            });
            console.log('[DB Setup] MySQL is ready!');
            return true;
        } catch {
            console.log(`[DB Setup] Waiting for MySQL... (${i + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return false;
}

/**
 * Create the application database and run all migrations
 * @param {string} mysqlDir - Path to MySQL installation
 * @param {string} wwwDir - Path to the www directory containing migrations
 * @param {number} port - MySQL port
 */
async function setupDatabase(mysqlDir, wwwDir, port) {
    const mysqlExe = path.join(mysqlDir, 'bin', 'mysql.exe');
    const dbName = 'dicom_viewer_desktop';

    console.log('[DB Setup] Setting up database...');

    // Create database
    try {
        execSync(`"${mysqlExe}" -u root --port=${port} -e "CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"`, {
            timeout: 10000,
            stdio: 'pipe'
        });
        console.log(`[DB Setup] Database '${dbName}' created/verified`);
    } catch (error) {
        console.error('[DB Setup] Failed to create database:', error.message);
        throw error;
    }

    // Run migrations in order
    const migrationsDir = path.join(wwwDir, 'database', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.warn('[DB Setup] Migrations directory not found:', migrationsDir);
        return;
    }

    const sqlFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Alphabetical sort ensures correct order (001_, 002_, etc.)

    console.log(`[DB Setup] Found ${sqlFiles.length} migration files`);

    for (const sqlFile of sqlFiles) {
        const filePath = path.join(migrationsDir, sqlFile);
        console.log(`[DB Setup] Running migration: ${sqlFile}`);

        try {
            execSync(`"${mysqlExe}" -u root --port=${port} "${dbName}" < "${filePath}"`, {
                timeout: 30000,
                stdio: 'pipe',
                shell: true
            });
            console.log(`[DB Setup] ✓ ${sqlFile}`);
        } catch (error) {
            // Many migrations use IF NOT EXISTS, so errors about existing tables are OK
            const errMsg = error.stderr ? error.stderr.toString() : error.message;
            if (errMsg.includes('already exists') || errMsg.includes('Duplicate')) {
                console.log(`[DB Setup] ⊝ ${sqlFile} (already applied)`);
            } else {
                console.warn(`[DB Setup] ⚠ ${sqlFile}: ${errMsg.substring(0, 200)}`);
            }
        }
    }

    console.log('[DB Setup] Database setup complete!');
}

/**
 * Check if this is a first-run scenario (no data directory)
 * @param {string} dataDir - MySQL data directory
 * @returns {boolean}
 */
function isFirstRun(dataDir) {
    const dataSubDir = path.join(dataDir, 'data');
    return !fs.existsSync(dataSubDir) || fs.readdirSync(dataSubDir).length === 0;
}

module.exports = {
    initMySQLDataDir,
    waitForMySQL,
    setupDatabase,
    isFirstRun
};
