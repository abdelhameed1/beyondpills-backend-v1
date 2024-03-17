'use strict';

/**
 * health-tracking service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::health-tracking.health-tracking');
