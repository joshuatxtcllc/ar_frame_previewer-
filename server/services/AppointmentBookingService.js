// server/services/AppointmentBookingService.js
const moment = require(‘moment-timezone’);
const { EventEmitter } = require(‘events’);

class AppointmentBookingService extends EventEmitter {
constructor(database, smartScheduler, config = {}) {
super();
this.db = database;
this.scheduler = smartScheduler;
this.timezone = config.timezone || ‘America/Chicago’;
this.appointmentTypes = {
consultation: { duration: 1, bufferTime: 15, capacity: 1 },
pickup: { duration: 0.25, bufferTime: 5, capacity: 4 },
delivery: { duration: 0.5, bufferTime: 10, capacity: 2 },
frame_fitting: { duration: 0.5, bufferTime: 10, capacity: 1 },
custom_consultation: { duration: 1.5, bufferTime: 15, capacity: 1 }
};
this.workloadThresholds = {
light: 0.6,    // < 60% capacity
normal: 0.8,   // 60-80% capacity
heavy: 1.0,    // 80-100% capacity
overloaded: 1.2 // > 100% capacity
};
}

async getAvailableSlots(appointmentType, preferredDate = null, daysAhead = 14) {
try {
const startDate = preferredDate ?
moment(preferredDate).tz(this.timezone) :
moment().tz(this.timezone).add(1, ‘day’);

```
  const endDate = startDate.clone().add(daysAhead, 'days');
  const appointmentConfig = this.appointmentTypes[appointmentType];
  
  if (!appointmentConfig) {
    throw new Error(`Unknown appointment type: ${appointmentType}`);
  }

  const availableSlots = [];
  let currentDate = startDate.clone();

  while (currentDate.isBefore(endDate)) {
    if (this.scheduler.isWorkingDay(currentDate)) {
      const daySlots = await this.generateDayAppointmentSlots(
        currentDate, 
        appointmentConfig
      );
      availableSlots.push(...daySlots);
    }
    currentDate.add(1, 'day');
  }

  // Prioritize slots based on current workload
  const prioritizedSlots = await this.prioritizeSlotsByWorkload(availableSlots);
  
  return prioritizedSlots;
} catch (error) {
  console.error('Error getting available slots:', error);
  throw error;
}
```

}

async generateDayAppointmentSlots(date, appointmentConfig) {
const dayStart = date.clone().hour(8).minute(0); // 8 AM
const dayEnd = date.clone().hour(17).minute(0);  // 5 PM
const slotDuration = appointmentConfig.duration * 60; // Convert to minutes
const bufferTime = appointmentConfig.bufferTime;

```
// Get existing appointments for the day
const existingAppointments = await this.db('appointments')
  .whereBetween('appointmentTime', [
    dayStart.toISOString(),
    dayEnd.toISOString()
  ])
  .where('status', '!=', 'cancelled');

// Get scheduled production tasks for the day
const productionTasks = await this.db('scheduled_tasks')
  .whereBetween('startTime', [
    dayStart.toISOString(),
    dayEnd.toISOString()
  ])
  .where('status', 'in', ['scheduled', 'in_progress']);

// Get current workload for the day
const dayWorkload = await this.calculateDayWorkload(date);

const slots = [];
let currentTime = dayStart.clone();

while (currentTime.clone().add(slotDuration + bufferTime, 'minutes').isBefore(dayEnd)) {
  const slotEnd = currentTime.clone().add(slotDuration, 'minutes');
  
  // Check if slot conflicts with existing appointments
  const hasAppointmentConflict = existingAppointments.some(apt => {
    const aptStart = moment(apt.appointmentTime);
    const aptEnd = moment(apt.appointmentEnd);
    return currentTime.isBefore(aptEnd) && slotEnd.isAfter(aptStart);
  });

  // Check if slot conflicts with production tasks
  const hasProductionConflict = productionTasks.some(task => {
    const taskStart = moment(task.startTime);
    const taskEnd = moment(task.endTime);
    return currentTime.isBefore(taskEnd) && slotEnd.isAfter(taskStart);
  });

  if (!hasAppointmentConflict && !hasProductionConflict) {
    // Check capacity for this time slot
    const sameTimeAppointments = existingAppointments.filter(apt => {
      const aptStart = moment(apt.appointmentTime);
      return aptStart.isSame(currentTime, 'minute');
    });

    if (sameTimeAppointments.length < appointmentConfig.capacity) {
      slots.push({
        datetime: currentTime.clone(),
        duration: appointmentConfig.duration,
        workloadLevel: this.categorizeWorkload(dayWorkload.utilization),
        availability: 'available',
        workloadScore: dayWorkload.utilization,
        recommendationScore: this.calculateRecommendationScore(
          currentTime, 
          dayWorkload, 
          appointmentConfig
        )
      });
    }
  }

  currentTime.add(30, 'minutes'); // 30-minute intervals
}

return slots;
```

}

async calculateDayWorkload(date) {
const dayStart = date.clone().startOf(‘day’);
const dayEnd = date.clone().endOf(‘day’);

```
// Get scheduled production tasks
const tasks = await this.db('scheduled_tasks')
  .whereBetween('startTime', [dayStart.toISOString(), dayEnd.toISOString()])
  .where('status', 'in', ['scheduled', 'in_progress']);

// Get appointments
const appointments = await this.db('appointments')
  .whereBetween('appointmentTime', [dayStart.toISOString(), dayEnd.toISOString()])
  .where('status', '!=', 'cancelled');

const totalProductionHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
const totalAppointmentHours = appointments.reduce((sum, apt) => {
  const type = this.appointmentTypes[apt.type];
  return sum + (type ? type.duration : 0.5);
}, 0);

const totalScheduledHours = totalProductionHours + totalAppointmentHours;
const utilization = totalScheduledHours / this.scheduler.maxDailyHours;

return {
  date: date.format('YYYY-MM-DD'),
  totalProductionHours,
  totalAppointmentHours,
  totalScheduledHours,
  utilization,
  taskCount: tasks.length,
  appointmentCount: appointments.length
};
```

}

categorizeWorkload(utilization) {
if (utilization < this.workloadThresholds.light) return ‘light’;
if (utilization < this.workloadThresholds.normal) return ‘normal’;
if (utilization < this.workloadThresholds.heavy) return ‘heavy’;
return ‘overloaded’;
}

calculateRecommendationScore(datetime, workload, appointmentConfig) {
let score = 100;

```
// Penalize high workload days
if (workload.utilization > 0.8) score -= 30;
else if (workload.utilization > 0.6) score -= 10;
else if (workload.utilization < 0.4) score += 20; // Bonus for light days

// Time of day preferences
const hour = datetime.hour();
if (appointmentConfig.duration >= 1) { // Long appointments
  if (hour >= 9 && hour <= 11) score += 15; // Morning preferred
  if (hour >= 14 && hour <= 16) score += 10; // Early afternoon OK
  if (hour >= 16) score -= 20; // Late afternoon discouraged
} else { // Short appointments
  if (hour >= 11 && hour <= 14) score += 10; // Midday preferred
}

// Day of week adjustments
const dayOfWeek = datetime.day();
if (dayOfWeek === 1 || dayOfWeek === 5) score += 5; // Monday/Friday slight bonus
if (dayOfWeek === 3) score += 10; // Wednesday bonus (midweek)

return Math.max(0, Math.min(100, score));
```

}

async prioritizeSlotsByWorkload(slots) {
return slots
.sort((a, b) => {
// First priority: recommendation score
if (a.recommendationScore !== b.recommendationScore) {
return b.recommendationScore - a.recommendationScore;
}
// Second priority: workload level (prefer lighter days)
const workloadPriority = { light: 4, normal: 3, heavy: 2, overloaded: 1 };
if (workloadPriority[a.workloadLevel] !== workloadPriority[b.workloadLevel]) {
return workloadPriority[b.workloadLevel] - workloadPriority[a.workloadLevel];
}
// Third priority: chronological
return a.datetime.diff(b.datetime);
})
.map(slot => ({
…slot,
datetime: slot.datetime.format(),
formattedTime: slot.datetime.format(‘dddd, MMMM Do, h:mm A’),
workloadIndicator: this.getWorkloadIndicator(slot.workloadLevel),
isRecommended: slot.recommendationScore >= 80
}));
}

getWorkloadIndicator(workloadLevel) {
const indicators = {
light: { color: ‘green’, text: ‘Light day - Great availability’, icon: ‘🟢’ },
normal: { color: ‘blue’, text: ‘Normal day - Good availability’, icon: ‘🔵’ },
heavy: { color: ‘orange’, text: ‘Busy day - Limited availability’, icon: ‘🟠’ },
overloaded: { color: ‘red’, text: ‘Very busy - May experience delays’, icon: ‘🔴’ }
};
return indicators[workloadLevel];
}

async bookApointment(appointmentData) {
try {
const {
customerId,
type,
datetime,
duration,
notes = ‘’,
contactMethod = ‘email’,
reminderPreferences = { hours: [24, 2] }
} = appointmentData;

```
  const appointmentTime = moment(datetime).tz(this.timezone);
  const appointmentEnd = appointmentTime.clone().add(
    this.appointmentTypes[type].duration * 60, 
    'minutes'
  );

  // Verify slot is still available
  const conflictingAppointments = await this.db('appointments')
    .whereBetween('appointmentTime', [
      appointmentTime.toISOString(),
      appointmentEnd.toISOString()
    ])
    .where('status', '!=', 'cancelled');

  if (conflictingAppointments.length > 0) {
    throw new Error('Time slot is no longer available');
  }

  // Create appointment record
  const appointment = {
    id: require('uuid').v4(),
    customerId,
    type,
    appointmentTime: appointmentTime.toISOString(),
    appointmentEnd: appointmentEnd.toISOString(),
    duration: this.appointmentTypes[type].duration,
    status: 'confirmed',
    notes,
    contactMethod,
    reminderPreferences: JSON.stringify(reminderPreferences),
    createdAt: moment().toISOString(),
    updatedAt: moment().toISOString()
  };

  await this.db('appointments').insert(appointment);

  // Schedule reminders
  await this.scheduleAppointmentReminders(appointment);

  // Update daily workload cache
  await this.updateWorkloadCache(appointmentTime.format('YYYY-MM-DD'));

  this.emit('appointmentBooked', appointment);

  return {
    appointmentId: appointment.id,
    confirmationNumber: this.generateConfirmationNumber(appointment.id),
    appointment,
    workloadImpact: await this.calculateWorkloadImpact(appointmentTime)
  };

} catch (error) {
  console.error('Error booking appointment:', error);
  throw error;
}
```

}

async scheduleAppointmentReminders(appointment) {
const reminderPrefs = JSON.parse(appointment.reminderPreferences);
const appointmentTime = moment(appointment.appointmentTime);

```
for (const hours of reminderPrefs.hours) {
  const reminderTime = appointmentTime.clone().subtract(hours, 'hours');
  
  if (reminderTime.isAfter(moment())) {
    await this.db('scheduled_reminders').insert({
      id: require('uuid').v4(),
      appointmentId: appointment.id,
      customerId: appointment.customerId,
      reminderTime: reminderTime.toISOString(),
      type: 'appointment',
      method: appointment.contactMethod,
      status: 'pending',
      createdAt: moment().toISOString()
    });
  }
}
```

}

generateConfirmationNumber(appointmentId) {
const prefix = ‘JF’; // Jay’s Frames
const timestamp = moment().format(‘MMDD’);
const hash = require(‘crypto’).createHash(‘md5’)
.update(appointmentId)
.digest(‘hex’)
.substring(0, 4)
.toUpperCase();
return `${prefix}${timestamp}${hash}`;
}

async calculateWorkloadImpact(appointmentDate) {
const workload = await this.calculateDayWorkload(appointmentDate);
return {
utilizationBefore: workload.utilization,
newUtilization: workload.utilization + (0.5 / this.scheduler.maxDailyHours),
impact: workload.utilization > 0.8 ? ‘high’ : ‘low’,
recommendation: workload.utilization > 0.9 ?
‘Consider rescheduling non-urgent production tasks’ :
‘No adjustments needed’
};
}

async updateWorkloadCache(date) {
const workload = await this.calculateDayWorkload(moment(date));

```
await this.db('daily_workload_cache')
  .insert({
    date,
    ...workload,
    updatedAt: moment().toISOString()
  })
  .onConflict('date')
  .merge();
```

}

async rescheduleAppointment(appointmentId, newDatetime, reason = ‘’) {
try {
const appointment = await this.db(‘appointments’)
.where(‘id’, appointmentId)
.first();

```
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  const newTime = moment(newDatetime).tz(this.timezone);
  const newEnd = newTime.clone().add(appointment.duration * 60, 'minutes');

  // Check availability
  const conflicts = await this.db('appointments')
    .whereBetween('appointmentTime', [
      newTime.toISOString(),
      newEnd.toISOString()
    ])
    .where('status', '!=', 'cancelled')
    .where('id', '!=', appointmentId);

  if (conflicts.length > 0) {
    throw new Error('New time slot is not available');
  }

  // Update appointment
  await this.db('appointments')
    .where('id', appointmentId)
    .update({
      appointmentTime: newTime.toISOString(),
      appointmentEnd: newEnd.toISOString(),
      updatedAt: moment().toISOString()
    });

  // Log the reschedule
  await this.db('appointment_history').insert({
    appointmentId,
    action: 'rescheduled',
    oldValue: appointment.appointmentTime,
    newValue: newTime.toISOString(),
    reason,
    timestamp: moment().toISOString()
  });

  // Reschedule reminders
  await this.db('scheduled_reminders')
    .where('appointmentId', appointmentId)
    .del();
  
  await this.scheduleAppointmentReminders({
    ...appointment,
    appointmentTime: newTime.toISOString()
  });

  this.emit('appointmentRescheduled', { appointmentId, newDatetime, reason });

  return { success: true, newTime: newTime.format() };

} catch (error) {
  console.error('Error rescheduling appointment:', error);
  throw error;
}
```

}

async getAppointmentAnalytics(startDate, endDate) {
const analytics = await this.db.raw(`SELECT  DATE(appointmentTime) as date, type, COUNT(*) as total_appointments, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed, COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_shows, COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled, AVG(duration) as avg_duration FROM appointments  WHERE DATE(appointmentTime) BETWEEN ? AND ? GROUP BY DATE(appointmentTime), type ORDER BY date DESC, type`, [startDate, endDate]);

```
const workloadAnalytics = await this.db.raw(`
  SELECT 
    date,
    AVG(utilization) as avg_utilization,
    AVG(totalAppointmentHours) as avg_appointment_hours,
    COUNT(*) as days_tracked
  FROM daily_workload_cache
  WHERE date BETWEEN ? AND ?
  GROUP BY date
  ORDER BY date DESC
`, [startDate, endDate]);

return {
  appointments: analytics[0],
  workload: workloadAnalytics[0]
};
```

}

async getOptimalAppointmentTimes(appointmentType, nextDays = 7) {
const slots = await this.getAvailableSlots(appointmentType, null, nextDays);

```
return slots
  .filter(slot => slot.isRecommended)
  .slice(0, 10) // Top 10 recommendations
  .map(slot => ({
    datetime: slot.datetime,
    formattedTime: slot.formattedTime,
    workloadLevel: slot.workloadLevel,
    recommendationScore: slot.recommendationScore,
    benefits: this.getSlotBenefits(slot)
  }));
```

}

getSlotBenefits(slot) {
const benefits = [];

```
if (slot.workloadLevel === 'light') {
  benefits.push('More attention and time available');
}
if (slot.recommendationScore >= 90) {
  benefits.push('Optimal time for this service');
}
if (slot.workloadScore < 0.5) {
  benefits.push('Flexible scheduling if changes needed');
}

return benefits;
```

}
}

module.exports = AppointmentBookingService;
