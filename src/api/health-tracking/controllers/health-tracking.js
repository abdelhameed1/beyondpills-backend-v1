'use strict';

/**
 * health-tracking controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::health-tracking.health-tracking');
