export default {
  id: '0000_baseline',
  title: 'Current sql.js schema baseline',
  status: 'baseline',
  description: 'Marks the current schema.sql and db/index.js bootstrap as the baseline before incremental migrations are introduced.',
  appliesToEmptyDatabase: true,
  irreversible: false,
  up() {
    // Baseline only. The current bootstrap still lives in schema.sql and db/index.js.
  },
};
