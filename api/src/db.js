const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, '..', 'db.json'));
const db = low(adapter);

/**
 * Get the database instance. Always call db.read() before reads and db.write() after writes.
 */
function getDb() {
  return db;
}

module.exports = { getDb };
