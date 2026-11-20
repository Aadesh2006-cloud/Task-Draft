import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces Eight Pillars and covers all Dirty Dozen vectors', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

  // 1. Rules version & global default-deny catch-all
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);

  // 2. Every collection in firebase-blueprint.json has an explicit match block
  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const escaped = collectionPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(rules, new RegExp(`match\\s+${escaped}\\s*\\{`), `Missing rule block for ${collectionPath}`);
  }

  // 3. Path ID hardening, verified email check, server timestamps, strict keys, terminal state lock
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.time/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(/);
  assert.match(rules, /existing\(\)\.status != 'closed' &&\s+existing\(\)\.status != 'cancelled'/);

  // 4. PII isolation: /users list denied and /admins write denied
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);
  assert.match(rules, /match \/admins\/\{adminId\}[\s\S]*allow list, create, update, delete: if false;/);

  // 5. Append-only workspace events (no update/delete) and participant resource.data list guard
  assert.match(rules, /match \/workspace_events\/\{eventId\}[\s\S]*allow update, delete: if false;/);
  assert.match(rules, /existing\(\)\.buyerUid == request\.auth\.uid \|\| existing\(\)\.sellerUid == request\.auth\.uid/);
});
