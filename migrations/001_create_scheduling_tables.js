// migrations/001_create_scheduling_tables.js
exports.up = function(knex) {
return knex.schema
// Scheduled Tasks Table
.createTable(‘scheduled_tasks’, table => {
table.uuid(‘id’).primary();
table.uuid(‘orderId’).references(‘id’).inTable(‘orders’);
table.datetime(‘startTime’).notNullable();
table.datetime(‘endTime’).notNullable();
table.integer(‘complexity’).notNullable();
table.decimal(‘estimatedHours’, 5, 2).notNullable();
table.decimal(‘actualHours’, 5, 2);
table.enum(‘status’, [‘scheduled’, ‘in_progress’, ‘completed’, ‘delayed’, ‘cancelled’]).defaultTo(‘scheduled’);
table.integer(‘priority’).defaultTo(5);
table.json(‘dependencies’);
table.datetime(‘createdAt’).notNullable();
table.datetime(‘updatedAt’).notNullable();
table.index([‘startTime’, ‘status’]);
table.index(‘orderId’);
})

```
// Appointments Table
.createTable('appointments', table => {
  table.uuid('id').primary();
  table.uuid('customerId').references('id').inTable('customers');
  table.enum('type', ['consultation', 'pickup', 'delivery', 'frame_fitting', 'custom_consultation']).notNullable();
  table.datetime('appointmentTime').notNullable();
  table.datetime('appointmentEnd').notNullable();
  table.decimal('duration', 3, 2).notNullable();
  table.enum('status', ['confirmed', 'completed', 'cancelled', 'no_show']).defaultTo('confirmed');
  table.text('notes');
  table.string('contactMethod', 50);
  table.json('reminderPreferences');
  table.datetime('createdAt').notNullable();
  table.datetime('updatedAt').notNullable();
  table.index(['appointmentTime', 'status']);
  table.index('customerId');
})

// Daily Workload Assessments
.createTable('daily_workload_assessments', table => {
  table.date('date').primary();
  table.integer('totalTasks').notNullable();
  table.decimal('totalHours', 5, 2).notNullable();
  table.integer('complexTasks').notNullable();
  table.decimal('utilization', 5, 2).notNullable();
  table.text('recommendation');
  table.datetime('createdAt').notNullable();
  table.index('date');
})

// Daily Workload Cache
.createTable('daily_workload_cache', table => {
  table.date('date').primary();
  table.decimal('totalProductionHours', 5, 2).notNullable();
  table.decimal('totalAppointmentHours', 5, 2).notNullable();
  table.decimal('totalScheduledHours', 5, 2).notNullable();
  table.decimal('utilization', 5, 2).notNullable();
  table.integer('taskCount').notNullable();
  table.integer('appointmentCount').notNullable();
  table.datetime('updatedAt').notNullable();
})

// Appointment History
.createTable('appointment_history', table => {
  table.increments('id').primary();
  table.uuid('appointmentId').references('id').inTable('appointments');
  table.enum('action', ['created', 'rescheduled', 'cancelled', 'completed']).notNullable();
  table.text('oldValue');
  table.text('newValue');
  table.text('reason');
  table.datetime('timestamp').notNullable();
  table.index('appointmentId');
})

// Scheduled Reminders
.createTable('scheduled_reminders', table => {
  table.uuid('id').primary();
  table.uuid('appointmentId').references('id').inTable('appointments');
  table.uuid('customerId').references('id').inTable('customers');
  table.datetime('reminderTime').notNullable();
  table.enum('type', ['appointment', 'order_ready', 'follow_up']).notNullable();
  table.enum('method', ['email', 'sms', 'discord']).notNullable();
  table.enum('status', ['pending', 'sent', 'failed']).defaultTo('pending');
  table.datetime('sentAt');
  table.datetime('createdAt').notNullable();
  table.index(['reminderTime', 'status']);
});
```

};

exports.down = function(knex) {
return knex.schema
.dropTableIfExists(‘scheduled_reminders’)
.dropTableIfExists(‘appointment_history’)
.dropTableIfExists(‘daily_workload_cache’)
.dropTableIfExists(‘daily_workload_assessments’)
.dropTableIfExists(‘appointments’)
.dropTableIfExists(‘scheduled_tasks’);
};

// migrations/002_create_referral_tables.js
exports.up = function(knex) {
return knex.schema
// Referral Codes
.createTable(‘referral_codes’, table => {
table.uuid(‘id’).primary();
table.uuid(‘customerId’).references(‘id’).inTable(‘customers’);
table.string(‘code’, 20).unique().notNullable();
table.enum(‘status’, [‘active’, ‘inactive’, ‘expired’]).defaultTo(‘active’);
table.integer(‘usageCount’).defaultTo(0);
table.integer(‘maxUses’);
table.datetime(‘expiresAt’);
table.datetime(‘createdAt’).notNullable();
table.datetime(‘updatedAt’).notNullable();
table.index(‘code’);
table.index(‘customerId’);
})

```
// Referrals
.createTable('referrals', table => {
  table.uuid('id').primary();
  table.uuid('referralCodeId').references('id').inTable('referral_codes');
  table.uuid('referrerCustomerId').references('id').inTable('customers');
  table.uuid('referredCustomerId').references('id').inTable('customers');
  table.enum('status', ['pending', 'completed', 'cancelled']).defaultTo('pending');
  table.datetime('referralDate').notNullable();
  table.datetime('completedAt');
  table.uuid('firstOrderId').references('id').inTable('orders');
  table.json('rewards');
  table.datetime('createdAt').notNullable();
  table.datetime('updatedAt').notNullable();
  table.index('referrerCustomerId');
  table.index('referredCustomerId');
  table.index('status');
})

// Customer Rewards
.createTable('customer_rewards', table => {
  table.uuid('id').primary();
  table.uuid('customerId').references('id').inTable('customers');
  table.uuid('referralId').references('id').inTable('referrals');
  table.enum('type', ['credit', 'percentage_discount', 'fixed_discount', 'free_service', 'milestone']).notNullable();
  table.string('rewardType', 50);
  table.decimal('amount', 10, 2).notNullable();
  table.text('description');
  table.enum('status', ['pending', 'active', 'used', 'expired']).defaultTo('pending');
  table.datetime('activatedAt');
  table.datetime('usedAt');
  table.uuid('usedOrderId').references('id').inTable('orders');
  table.datetime('expiredAt');
  table.datetime('expiresAt');
  table.datetime('createdAt').notNullable();
  table.index(['customerId', 'status']);
})

// Reward Applications
.createTable('reward_applications', table => {
  table.uuid('id').primary();
  table.uuid('rewardId').references('id').inTable('customer_rewards');
  table.uuid('orderId').references('id').inTable('orders');
  table.uuid('customerId').references('id').inTable('customers');
  table.string('rewardType', 50).notNullable();
  table.decimal('rewardAmount', 10, 2).notNullable();
  table.datetime('appliedAt').notNullable();
  table.index('orderId');
})

// Customer Referral Stats
.createTable('customer_referral_stats', table => {
  table.uuid('customerId').primary().references('id').inTable('customers');
  table.integer('totalReferrals').defaultTo(0);
  table.integer('successfulReferrals').defaultTo(0);
  table.integer('pendingReferrals').defaultTo(0);
  table.decimal('totalRewardsEarned', 10, 2).defaultTo(0);
  table.enum('currentTier', ['none', 'bronze', 'silver', 'gold', 'platinum']).defaultTo('none');
  table.datetime('lastUpdated').notNullable();
});
```

};

exports.down = function(knex) {
return knex.schema
.dropTableIfExists(‘customer_referral_stats’)
.dropTableIfExists(‘reward_applications’)
.dropTableIfExists(‘customer_rewards’)
.dropTableIfExists(‘referrals’)
.dropTableIfExists(‘referral_codes’);
};

// migrations/003_create_behavior_tables.js
exports.up = function(knex) {
return knex.schema
// Customer Behavior Profiles
.createTable(‘customer_behavior_profiles’, table => {
table.uuid(‘customerId’).primary().references(‘id’).inTable(‘customers’);
table.json(‘patterns’).notNullable();
table.json(‘segments’).notNullable();
table.json(‘lifetimeValue’).notNullable();
table.json(‘nextPurchasePrediction’);
table.datetime(‘lastUpdated’).notNullable();
table.index(‘lastUpdated’);
})

```
// Customer Inquiries
.createTable('customer_inquiries', table => {
  table.uuid('id').primary();
  table.uuid('customerId').references('id').inTable('customers');
  table.enum('type', ['quote', 'question', 'consultation', 'custom_request']).notNullable();
  table.text('message').notNullable();
  table.enum('status', ['open', 'responded', 'converted', 'closed']).defaultTo('open');
  table.datetime('createdAt').notNullable();
  table.datetime('respondedAt');
  table.datetime('convertedAt');
  table.uuid('convertedOrderId').references('id').inTable('orders');
  table.index(['customerId', 'status']);
  table.index('createdAt');
})

// Frames Catalog
.createTable('frames', table => {
  table.uuid('id').primary();
  table.string('name', 100).notNullable();
  table.string('style', 50).notNullable();
  table.string('color', 50).notNullable();
  table.decimal('price', 10, 2).notNullable();
  table.integer('popularity').defaultTo(0);
  table.json('availableSizes');
  table.json('recommendedFor');
  table.boolean('customSizable').defaultTo(true);
  table.string('imageUrl');
  table.enum('status', ['active', 'discontinued']).defaultTo('active');
  table.datetime('createdAt').notNullable();
  table.index(['style', 'status']);
  table.index('popularity');
});
```

};

exports.down = function(knex) {
return knex.schema
.dropTableIfExists(‘frames’)
.dropTableIfExists(‘customer_inquiries’)
.dropTableIfExists(‘customer_behavior_profiles’);
};
