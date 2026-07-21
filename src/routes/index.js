const express = require('express');

const healthRoutes = require('./health-routes');
const linkRoutes = require('./link-routes');
const protocolRoutes = require('./protocol-routes');
const substanceRoutes = require('./substance-routes');
const userRoutes = require('./user-routes');
const authRoutes = require('./auth-routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/links', linkRoutes);
router.use('/protocols', protocolRoutes);
router.use('/substances', substanceRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);

module.exports = router;
