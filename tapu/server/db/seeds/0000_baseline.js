export default {
  id: '0000_baseline',
  title: 'Current bootstrap seed baseline',
  status: 'baseline',
  description: 'Marks existing seed behavior in db/index.js and service seed helpers before incremental seed files are introduced.',
  appliesToEmptyDatabase: true,
  repeatable: true,
  apply() {
    // Baseline only. Current built-in seeds still run through startup helpers.
  },
};
