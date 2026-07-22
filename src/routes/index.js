const express = require('express');

const checkInRoutes = require('./check-in-routes');
const healthRoutes = require('./health-routes');
const linkRoutes = require('./link-routes');
const protocolRoutes = require('./protocol-routes');
const substanceRoutes = require('./substance-routes');
const trackingRecordRoutes = require('./tracking-record-routes');
const userRoutes = require('./user-routes');
const authRoutes = require('./auth-routes');

const router = express.Router();

router.use('/check-ins', checkInRoutes);
router.use('/health', healthRoutes);
router.use('/links', linkRoutes);
router.use('/protocols', protocolRoutes);
router.use('/substances', substanceRoutes);
router.use('/tracking-records', trackingRecordRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);

module.exports = router;
