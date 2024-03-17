'use strict';

/**
 * medical-history service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::medical-history.medical-history');
