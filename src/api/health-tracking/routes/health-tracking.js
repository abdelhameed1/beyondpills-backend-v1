'use strict';

/**
 * health-tracking router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::health-tracking.health-tracking');
