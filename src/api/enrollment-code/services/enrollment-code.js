'use strict';

/**
 * enrollment-code service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::enrollment-code.enrollment-code');
