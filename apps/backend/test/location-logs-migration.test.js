const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('location_logs compatibility migration upgrades only legacy coordinate columns', () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, '../../../db/migrations/029_location_logs_column_compatibility.sql'),
    'utf8',
  );

  assert.match(migration, /column_name = 'lat'/);
  assert.match(migration, /rename column lat to latitude/);
  assert.match(migration, /rename column lng to longitude/);
  assert.match(migration, /rename column accuracy_m to accuracy/);
  assert.match(migration, /not exists \(/);
});
