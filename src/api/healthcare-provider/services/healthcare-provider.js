'use strict';

/**
 * healthcare-provider service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::healthcare-provider.healthcare-provider');
