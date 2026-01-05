// server/services/SmartScheduler.js
const moment = require(‘moment-timezone’);
const cron = require(‘node-cron’);
const { EventEmitter } = require(‘events’);

class SmartScheduler extends EventEmitter {
constructor(database, config = {}) {
super();
this.db = database;
this.timezone = config.timezone || ‘America/Chicago’;
this.workingHours = config.workingHours || { start: ‘08:00’, end: ‘17:00’ };
this.workingDays = config.workingDays || [1, 2, 3, 4, 5]; // Mon-Fri
this.maxDailyHours = config.maxDailyHours || 8;
this.bufferTime = config.bufferTime || 30; // minutes between tasks
this.complexityThresholds = {
simple: { maxTime: 2, priority: 3 }, // hours
medium: { maxTime: 6, priority: 2 },
complex: { maxTime: 24, priority: 1 }
};

this.initializeScheduler();

}

initializeScheduler() {
// Run scheduler optimization every hour
cron.schedule(‘0 * * * *’, () => {
this.optimizeSchedule();
});

// Daily workload assessment at 6 AM
cron.schedule('0 6 * * *', () => {
  this.assessDailyWorkload();
});

}

async scheduleOrder(orderData) {
try {
const {
orderId,
complexity,
estimatedHours,
priority,
deadline,
dependencies = [],
customerPreferences = {}
} = orderData;

  // Calculate complexity score
  const complexityScore = this.calculateComplexityScore(orderData);
  
  // Find optimal time slot
  const timeSlot = await this.findOptimalTimeSlot({
    duration: estimatedHours,
    complexity: complexityScore,
    deadline: moment(deadline),
    dependencies,
    customerPreferences
  });

  if (!timeSlot) {
    throw new Error('No available time slot found within constraints');
  }

  // Create scheduled task
  const scheduledTask = {
    orderId,
    startTime: timeSlot.start,
    endTime: timeSlot.end,
    complexity: complexityScore,
    estimatedHours,
    actualHours: null,
    status: 'scheduled',
    priority,
    dependencies,
    createdAt: moment().toISOString(),
    updatedAt: moment().toISOString()
  };

  await this.db('scheduled_tasks').insert(scheduledTask);

  // Update order with scheduling info
  await this.db('orders').where('id', orderId).update({
    scheduledStart: timeSlot.start,
    scheduledEnd: timeSlot.end,
    status: 'scheduled'
  });

  // Check for conflicts and reoptimize if needed
  await this.detectAndResolveConflicts();

  this.emit('orderScheduled', { orderId, timeSlot, scheduledTask });

  return scheduledTask;
} catch (error) {
  console.error('Error scheduling order:', error);
  throw error;
}

}

async findOptimalTimeSlot({ duration, complexity, deadline, dependencies, customerPreferences }) {
const now = moment().tz(this.timezone);
const deadlineDate = moment(deadline).tz(this.timezone);

// Get existing scheduled tasks
const existingTasks = await this.db('scheduled_tasks')
  .where('status', 'scheduled')
  .orWhere('status', 'in_progress')
  .orderBy('startTime', 'asc');

// Generate potential time slots
let currentDate = now.clone().startOf('day');
const maxSearchDays = 30;

for (let day = 0; day < maxSearchDays; day++) {
  if (!this.isWorkingDay(currentDate)) {
    currentDate.add(1, 'day');
    continue;
  }

  const daySlots = this.generateDayTimeSlots(currentDate, duration, existingTasks);
  
  for (const slot of daySlots) {
    if (this.isSlotSuitable(slot, { complexity, deadline: deadlineDate, dependencies, customerPreferences })) {
      return slot;
    }
  }
  
  currentDate.add(1, 'day');
}

return null;

}

generateDayTimeSlots(date, duration, existingTasks) {
const slots = [];
const dayStart = date.clone().hour(parseInt(this.workingHours.start.split(’:’)[0]))
.minute(parseInt(this.workingHours.start.split(’:’)[1]));
const dayEnd = date.clone().hour(parseInt(this.workingHours.end.split(’:’)[0]))
.minute(parseInt(this.workingHours.end.split(’:’)[1]));

// Get tasks for this day
const dayTasks = existingTasks.filter(task => 
  moment(task.startTime).isSame(date, 'day')
).sort((a, b) => moment(a.startTime).diff(moment(b.startTime)));

let currentTime = dayStart.clone();

for (const task of dayTasks) {
  const taskStart = moment(task.startTime);
  const taskEnd = moment(task.endTime);
  
  // Check if there's space before this task
  if (currentTime.clone().add(duration, 'hours').add(this.bufferTime, 'minutes').isBefore(taskStart)) {
    slots.push({
      start: currentTime.clone(),
      end: currentTime.clone().add(duration, 'hours'),
      availableHours: taskStart.diff(currentTime, 'hours', true)
    });
  }
  
  currentTime = taskEnd.clone().add(this.bufferTime, 'minutes');
}

// Check if there's space at the end of the day
if (currentTime.clone().add(duration, 'hours').isBefore(dayEnd)) {
  slots.push({
    start: currentTime.clone(),
    end: currentTime.clone().add(duration, 'hours'),
    availableHours: dayEnd.diff(currentTime, 'hours', true)
  });
}

return slots;

}

isSlotSuitable(slot, criteria) {
const { complexity, deadline, dependencies, customerPreferences } = criteria;

// Check deadline constraint
if (slot.end.isAfter(deadline)) {
  return false;
}

// Check complexity vs time of day (complex tasks in morning)
if (complexity === 'complex' && slot.start.hour() > 14) {
  return false;
}

// Check customer preferences
if (customerPreferences.preferredTimeSlots) {
  const slotHour = slot.start.hour();
  if (!customerPreferences.preferredTimeSlots.includes(slotHour)) {
    return false;
  }
}

return true;

}

calculateComplexityScore(orderData) {
let score = 0;

// Base complexity from estimated hours
if (orderData.estimatedHours <= 2) score += 1;
else if (orderData.estimatedHours <= 6) score += 3;
else score += 5;

// Add complexity factors
if (orderData.customMolding) score += 2;
if (orderData.multipleOpenings) score += 1;
if (orderData.specialGlass) score += 1;
if (orderData.oversized) score += 2;
if (orderData.artworkPrep) score += 1;

// Priority multiplier
score *= (orderData.priority || 1);

return Math.min(score, 10); // Cap at 10

}

async optimizeSchedule() {
try {
const now = moment().tz(this.timezone);
const upcomingTasks = await this.db(‘scheduled_tasks’)
.where(‘startTime’, ‘>’, now.toISOString())
.where(‘status’, ‘scheduled’)
.orderBy(‘startTime’, ‘asc’);

  // Group tasks by complexity and priority
  const taskGroups = this.groupTasksForOptimization(upcomingTasks);
  
  // Reschedule for better efficiency
  for (const group of taskGroups) {
    await this.rescheduleTaskGroup(group);
  }

  this.emit('scheduleOptimized', { optimizedTasks: upcomingTasks.length });
} catch (error) {
  console.error('Schedule optimization error:', error);
}

}

groupTasksForOptimization(tasks) {
const groups = {
complex: [],
medium: [],
simple: []
};

tasks.forEach(task => {
  if (task.complexity >= 7) groups.complex.push(task);
  else if (task.complexity >= 4) groups.medium.push(task);
  else groups.simple.push(task);
});

return [groups.complex, groups.medium, groups.simple];

}

async rescheduleTaskGroup(tasks) {
// Sort by priority and deadline
tasks.sort((a, b) => {
if (a.priority !== b.priority) return a.priority - b.priority;
return moment(a.deadline).diff(moment(b.deadline));
});

// Try to group similar tasks together for efficiency
for (let i = 0; i < tasks.length - 1; i++) {
  const currentTask = tasks[i];
  const nextTask = tasks[i + 1];
  
  if (this.canCombineTasks(currentTask, nextTask)) {
    await this.combineScheduledTasks(currentTask, nextTask);
  }
}

}

canCombineTasks(task1, task2) {
// Check if tasks can be done consecutively for efficiency
const timeDiff = moment(task2.startTime).diff(moment(task1.endTime), ‘hours’);
return timeDiff <= 2 && task1.complexity === task2.complexity;
}

async detectAndResolveConflicts() {
const conflicts = await this.db.raw(`SELECT t1.*, t2.orderId as conflictOrderId FROM scheduled_tasks t1 JOIN scheduled_tasks t2 ON t1.id != t2.id WHERE t1.status IN ('scheduled', 'in_progress') AND t2.status IN ('scheduled', 'in_progress') AND ( (t1.startTime <= t2.startTime AND t1.endTime > t2.startTime) OR (t2.startTime <= t1.startTime AND t2.endTime > t1.startTime) )`);

for (const conflict of conflicts[0]) {
  await this.resolveConflict(conflict);
}

}

async resolveConflict(conflict) {
// Reschedule lower priority task
const conflictingTasks = await this.db(‘scheduled_tasks’)
.whereIn(‘orderId’, [conflict.orderId, conflict.conflictOrderId])
.orderBy(‘priority’, ‘asc’);

const taskToReschedule = conflictingTasks[1]; // Lower priority

// Find new time slot
const newSlot = await this.findOptimalTimeSlot({
  duration: taskToReschedule.estimatedHours,
  complexity: taskToReschedule.complexity,
  deadline: moment().add(7, 'days'), // Default deadline
  dependencies: [],
  customerPreferences: {}
});

if (newSlot) {
  await this.db('scheduled_tasks')
    .where('id', taskToReschedule.id)
    .update({
      startTime: newSlot.start.toISOString(),
      endTime: newSlot.end.toISOString(),
      updatedAt: moment().toISOString()
    });

  this.emit('conflictResolved', { 
    rescheduledTask: taskToReschedule.orderId,
    newSlot 
  });
}

}

async assessDailyWorkload() {
const today = moment().tz(this.timezone).startOf(‘day’);
const tomorrow = today.clone().add(1, ‘day’);

const todayTasks = await this.db('scheduled_tasks')
  .whereBetween('startTime', [today.toISOString(), tomorrow.toISOString()])
  .where('status', 'scheduled');

const totalHours = todayTasks.reduce((sum, task) => sum + task.estimatedHours, 0);
const complexTasks = todayTasks.filter(task => task.complexity >= 7).length;

const workloadAssessment = {
  date: today.format('YYYY-MM-DD'),
  totalTasks: todayTasks.length,
  totalHours,
  complexTasks,
  utilization: (totalHours / this.maxDailyHours) * 100,
  recommendation: this.getWorkloadRecommendation(totalHours, complexTasks)
};

await this.db('daily_workload_assessments').insert(workloadAssessment);

this.emit('dailyWorkloadAssessed', workloadAssessment);

return workloadAssessment;

}

getWorkloadRecommendation(totalHours, complexTasks) {
if (totalHours > this.maxDailyHours * 1.2) {
return ‘OVERLOADED - Consider rescheduling non-urgent tasks’;
} else if (totalHours > this.maxDailyHours) {
return ‘HIGH - Monitor for delays’;
} else if (complexTasks > 2) {
return ‘COMPLEX_HEAVY - Space out complex tasks’;
} else if (totalHours < this.maxDailyHours * 0.6) {
return ‘LIGHT - Good opportunity for catch-up or maintenance’;
}
return ‘OPTIMAL - Well balanced workload’;
}

isWorkingDay(date) {
return this.workingDays.includes(date.day());
}

async updateTaskProgress(orderId, actualHours, status) {
await this.db(‘scheduled_tasks’)
.where(‘orderId’, orderId)
.update({
actualHours,
status,
updatedAt: moment().toISOString()
});

// Update order status
await this.db('orders')
  .where('id', orderId)
  .update({ status });

this.emit('taskProgressUpdated', { orderId, actualHours, status });

}

async getScheduleAnalytics(startDate, endDate) {
const analytics = await this.db.raw(`SELECT  DATE(startTime) as date, COUNT(*) as scheduled_tasks, SUM(estimatedHours) as estimated_hours, SUM(actualHours) as actual_hours, AVG(complexity) as avg_complexity, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks, COUNT(CASE WHEN status = 'delayed' THEN 1 END) as delayed_tasks FROM scheduled_tasks  WHERE DATE(startTime) BETWEEN ? AND ? GROUP BY DATE(startTime) ORDER BY date DESC`, [startDate, endDate]);

return analytics[0];

}
}

module.exports = SmartScheduler;
