// server/routes/scheduling.js
const express = require('express');
const router = express.Router();
const SmartScheduler = require('../services/SmartScheduler');
const AppointmentBookingService = require('../services/AppointmentBookingService');
const moment = require('moment');

module.exports = (db) => {
  const scheduler = new SmartScheduler(db);
  const appointmentService = new AppointmentBookingService(db, scheduler);

  // Schedule a new order
  router.post('/schedule/order', async (req, res) => {
    try {
      const scheduledTask = await scheduler.scheduleOrder(req.body);
      res.json({ success: true, task: scheduledTask });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Get available appointment slots
  router.get('/appointments/available', async (req, res) => {
    try {
      const { type, date, daysAhead } = req.query;
      const slots = await appointmentService.getAvailableSlots(
        type,
        date,
        parseInt(daysAhead) || 14
      );
      res.json({ success: true, slots });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Get optimal appointment times
  router.get('/appointments/optimal', async (req, res) => {
    try {
      const { type, days } = req.query;
      const optimalTimes = await appointmentService.getOptimalAppointmentTimes(
        type,
        parseInt(days) || 7
      );
      res.json({ success: true, optimalTimes });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Book an appointment
  router.post('/appointments/book', async (req, res) => {
    try {
      const result = await appointmentService.bookApointment(req.body);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Reschedule appointment
  router.put('/appointments/:id/reschedule', async (req, res) => {
    try {
      const { newDatetime, reason } = req.body;
      const result = await appointmentService.rescheduleAppointment(
        req.params.id,
        newDatetime,
        reason
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Get daily workload
  router.get('/workload/daily/:date', async (req, res) => {
    try {
      const workload = await appointmentService.calculateDayWorkload(
        moment(req.params.date)
      );
      res.json({ success: true, workload });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Get schedule analytics
  router.get('/analytics/schedule', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const analytics = await scheduler.getScheduleAnalytics(startDate, endDate);
      res.json({ success: true, analytics });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Get appointment analytics
  router.get('/analytics/appointments', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const analytics = await appointmentService.getAppointmentAnalytics(
        startDate,
        endDate
      );
      res.json({ success: true, analytics });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Update task progress
  router.put('/schedule/task/:orderId', async (req, res) => {
    try {
      const { actualHours, status } = req.body;
      await scheduler.updateTaskProgress(req.params.orderId, actualHours, status);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Optimize schedule
  router.post('/schedule/optimize', async (req, res) => {
    try {
      await scheduler.optimizeSchedule();
      res.json({ success: true, message: 'Schedule optimized' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
};
