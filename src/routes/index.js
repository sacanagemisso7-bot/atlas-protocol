const express = require('express');

const healthRoutes = require('./health-routes');
const linkRoutes = require('./link-routes');
const substanceRoutes = require('./substance-routes');
const userRoutes = require('./user-routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/links', linkRoutes);
router.use('/substances', substanceRoutes);
router.use('/users', userRoutes);

module.exports = router;
